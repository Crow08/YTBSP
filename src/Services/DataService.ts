import Subscription from "../Model/Subscription";
import SubscriptionDTO from "../Model/SubscriptionDTO";
import Video from "../Model/Video";
import persistenceService from "./PersistenceService";

export enum SortPosition {
    TOP, BOTTOM, UP, DOWN
}

// maxVideosPerSub is capped at max 50. An incomplete fetch response cannot delete information from active videos.
const RETAINED_VIDEO_COUNT = 50;

class DataService {
    private subscriptions: Subscription[] = [];

    private fetchedSubscriptions = new Set<string>();
    private unsubscribedChannels = new Set<string>();

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
            if ("undefined" === typeof newVideo) {
                return;
            }
            sub.videos.push(newVideo);
        } else {
            video.updateVideo(newVideo);
        }
        if (!silent) {
            this.onDataUpdated(sub.channelId);
        }
    }

    /**
     * Merges a freshly fetched playlist page into a subscription, preserving
     * upload order: fetched videos first (in fetch order), then any older,
     * previously known videos this fetch didn't include, in their prior
     * order. Unlike per-video upsertVideo (which appends newly discovered
     * videos to the end of the array), this never reorders a channel's
     * newest upload behind older, already-known entries.
     *
     * Does not persist or notify listeners -- callers merging a full fetch
     * response already trigger both via pruneStaleVideos/compactRemovedVideos.
     */
    mergeFetchedVideos(channelId: string, response: Video[]): void {
        const sub = this.getSubscription(channelId);
        if ("undefined" !== typeof sub) {
            sub.updateSubscription({videos: response});
        }
    }

    getVideos(id: string): Video[] {
        const sub = this.getSubscription(id);
        if ("undefined" === typeof sub) {
            return [];
        }
        return sub.videos;
    }

    /**
     * Marks all currently known videos of a channel as removed. Does not try
     * to guess a new boundary itself (that requires the true playlist order,
     * which is only reliable right after a fetch — see Subscription); actual
     * compaction of these into a single boundary happens lazily on the next
     * fetch, via compactRemovedVideos.
     */
    removeAllVideos(channelId: string): void {
        const sub = this.getSubscription(channelId);
        if ("undefined" === typeof sub) {
            return;
        }
        sub.videos.forEach(video => {
            video.removed = true;
        });
        this.onDataUpdated(channelId);
    }

    /**
     * Resets the removed state of all videos of a channel, including the
     * boundary: videos no longer stored individually because the boundary
     * covered them reappear with the next fetch.
     */
    resetAllVideos(channelId: string): void {
        const sub = this.getSubscription(channelId);
        if ("undefined" === typeof sub) {
            return;
        }
        sub.removedThroughVideoId = undefined;
        sub.videos.forEach(video => {
            video.removed = false;
        });
        this.onDataUpdated(channelId);
    }

    /**
     * Applies the removed boundary to videos in a freshly fetched playlist
     * page that this subscription doesn't already know about. Must run
     * before the response is merged — see Subscription.applyRemovedBoundary.
     */
    applyRemovedBoundary(channelId: string, response: Video[]): void {
        const sub = this.getSubscription(channelId);
        if ("undefined" !== typeof sub) {
            sub.applyRemovedBoundary(response);
        }
    }

    /**
     * Advances the removed boundary and drops now-covered individual video
     * entries, using a freshly fetched playlist page as the source of truth.
     * Must run after the response has been merged into the subscription —
     * see Subscription.compactRemovedVideos.
     */
    compactRemovedVideos(channelId: string, response: Video[]): void {
        const sub = this.getSubscription(channelId);
        if ("undefined" === typeof sub) {
            return;
        }
        sub.compactRemovedVideos(response);
        this.persist();
    }

    /**
     * Marks a channel as having had a successful video fetch this session.
     */
    markSubscriptionFetched(channelId: string): void {
        this.fetchedSubscriptions.add(channelId);
    }

    /**
     * Deletes all data of a channel the user is unsubscribed from.
     */
    removeSubscription(channelId: string): void {
        this.unsubscribedChannels.add(channelId);
        const index = this.subscriptions.findIndex(sub => sub.channelId === channelId);
        if (index !== -1) {
            this.subscriptions.splice(index, 1);
        }
        this.persist();
    }

    /**
     * Removes dead cache entries for a channel after a successful video fetch.
     * Entries restored from localStorage only carry id/removed (no title).
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

    /**
     * Serializes the in-memory state merged with the currently stored state.
     * This merge resists incomplete fetches.
     */
    exportVideoData(): string {
        return JSON.stringify(this.mergeWithStoredData(this.subscriptions.map(sub => sub.getDTO())));
    }

    private mergeWithStoredData(memoryDTOs: SubscriptionDTO[]): SubscriptionDTO[] {
        const stored = persistenceService.loadVideoInfoSync();
        if (null === stored || 0 === stored.length) {
            return memoryDTOs;
        }
        const validStored = stored.filter(sub => sub && "string" === typeof sub.channelId);
        const storedById = new Map(validStored.map(sub => [sub.channelId, sub]));
        const memoryIds = new Set(memoryDTOs.map(dto => dto.channelId));

        const merged = memoryDTOs.map(dto => {
            const storedSub = storedById.get(dto.channelId);
            if ("undefined" === typeof storedSub || this.fetchedSubscriptions.has(dto.channelId) || !Array.isArray(storedSub.videos)) {
                return dto;
            }
            const memoryVideoIds = new Set(dto.videos.map(video => video.id));
            const missingVideos = storedSub.videos.filter(video =>
                video && "string" === typeof video.id && !memoryVideoIds.has(video.id));
            if (0 === missingVideos.length) {
                return dto;
            }
            return {...dto, videos: dto.videos.concat(missingVideos)};
        });
        validStored.forEach(storedSub => {
            if (!memoryIds.has(storedSub.channelId) && !this.unsubscribedChannels.has(storedSub.channelId)) {
                merged.push(storedSub);
            }
        });
        return merged;
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
