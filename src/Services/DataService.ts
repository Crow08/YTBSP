import Subscription from "../Model/Subscription";
import Video from "../Model/Video";
import persistenceService from "./PersistenceService";

export enum SortPosition {
    TOP, BOTTOM, UP, DOWN
}

// maxVideosPerSub is capped at max 50. An incomplete fetch response cannot delete information from active videos.
const RETAINED_VIDEO_COUNT = 50;

class DataService {
    private subscriptions: Subscription[] = [];

    private onSubscriptionChangeCallbackList: { [channelId: string]: (() => void)[] } = {};
    private onReorderCallbackList: ((subs: Subscription[]) => void)[] = [];

    getSubscription(id: string): Subscription | undefined {
        return this.subscriptions.find(curSub => curSub.channelId === id);
    }

    getVideo(videoId: string, channelId?: string): Video {
        const sub = this.getSubscriptionForVideo(videoId, channelId);
        if ("undefined" === typeof sub) {
            return undefined;
        }
        return sub.videos.find(vid => vid.id === videoId);
    }

    upsertSubscription(channelId: string, func: ((sub: Subscription | undefined) => Subscription), silent = false): void {
        const sub = this.subscriptions.find(curSub => curSub.channelId === channelId);
        const newSub = func(sub);
        if ("undefined" === typeof sub) {
            this.subscriptions.push(newSub);
        } else {
            sub.updateSubscription(newSub);
        }
        if (!silent) {
            this.onDataUpdated(channelId);
        }
    }

    upsertVideo(videoId: string, func: ((video: Video | undefined) => Video), silent = false, channelId?: string,): void {
        const sub = this.getSubscriptionForVideo(videoId, channelId);
        if ("undefined" === typeof sub) {
            return;
        }
        const video = sub.videos.find(vid => vid.id === videoId);
        const newVideo = func(video);
        if ("undefined" === typeof video) {
            sub.videos.push(newVideo);
        } else {
            video.updateVideo(newVideo);
        }
        if (!silent) {
            this.onDataUpdated(sub.channelId);
        }
    }

    getVideos(id: string): Video[] {
        const sub = this.getSubscription(id);
        if ("undefined" === typeof sub) {
            return [];
        }
        return sub.videos;
    }

    updateSubVideos(channelId: string, func: (vid: Video) => void, silent = false): void {
        this.getSubscription(channelId).videos.forEach(video => {
            func(video);
        });
        if (!silent) {
            this.onDataUpdated(channelId);
        }
    }

    /**
     * Removes dead cache entries for a channel after a successful video fetch.
     * Entries restored from localStorage only carry id/seen/removed (no title).
     * If such an entry is not part of the latest fetch response, the video has
     * fallen out of the channel's fetch window for good: it can never be
     * displayed again, so keeping its flags only grows the cache forever.
     * The first RETAINED_VIDEO_COUNT entries are always kept, so a partial
     * fetch response cannot wipe the flags of currently displayable videos.
     *
     * @param channelId channel whose videos were just fetched.
     * @param fetchedIds video ids contained in the fetch response.
     */
    pruneStaleVideos(channelId: string, fetchedIds: string[]): void {
        const sub = this.getSubscription(channelId);
        if ("undefined" === typeof sub) {
            return;
        }
        const fetchedIdSet = new Set(fetchedIds);
        const keptVideos = sub.videos.filter((video, index) =>
            index < RETAINED_VIDEO_COUNT || fetchedIdSet.has(video.id) || "undefined" !== typeof video.title);
        if (keptVideos.length !== sub.videos.length) {
            sub.videos = keptVideos;
            this.persist();
        }
    }

    addSubscriptionChangeListener(channelId: string, callback: () => void): void {
        if ("undefined" === typeof this.onSubscriptionChangeCallbackList[channelId]) {
            this.onSubscriptionChangeCallbackList[channelId] = [];
        }
        this.onSubscriptionChangeCallbackList[channelId].push(callback);
    }

    exportVideoData(): string {
        return JSON.stringify(this.subscriptions.map(sub => sub.getDTO()));
    }

    getSubscriptions(): Subscription[] {
        return this.subscriptions;
    }

    reorderSubscriptions(channelId: string, position: SortPosition) {
        const oldIndex = this.subscriptions.findIndex(sub => sub.channelId == channelId);
        const movingSub = this.subscriptions.splice(oldIndex, 1)[0];
        const newIndex = position == SortPosition.TOP ? 0 :
            position == SortPosition.BOTTOM ? this.subscriptions.length :
                position == SortPosition.UP ? oldIndex - 1 :
                    oldIndex + 1;
        this.subscriptions.splice(newIndex, 0, movingSub);
        this.persist();
        this.onReorderCallbackList.forEach(callback => callback(this.subscriptions));
    }

    addReorderListener(callback: (subs: Subscription[]) => void) {
        this.onReorderCallbackList.push(callback);
    }

    private getSubscriptionForVideo(videoId: string, channelId?: string): Subscription | undefined {
        let sub: Subscription;
        if ("undefined" === typeof channelId) {
            sub = this.subscriptions.find(value => value.videos.findIndex(vid => vid.id === videoId) !== -1);
        } else {
            sub = this.getSubscription(channelId);
        }
        return sub;
    }

    private onDataUpdated(channelId: string) {
        if ("undefined" !== typeof this.onSubscriptionChangeCallbackList[channelId]) {
            this.onSubscriptionChangeCallbackList[channelId].forEach(callback => {
                callback();
            });
        }
        this.persist();
    }

    private persist() {
        persistenceService.saveVideoInfo(() => this.exportVideoData());
    }
}

const dataService = new DataService();
export default dataService;
