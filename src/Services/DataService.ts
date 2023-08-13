import Configuration from "../Model/Configuration";
import Subscription from "../Model/Subscription";
import Video from "../Model/Video";
import persistenceService from "./PersistenceService";

export enum SortPosition {
    TOP, BOTTOM, UP, DOWN
}

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

    updateSubVideos(channelId: string, func: (vid: Video) => void, silent = false): void {
        this.getSubscription(channelId).videos.forEach(video => {
            func(video);
        });
        if (!silent) {
            this.onDataUpdated(channelId);
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
        persistenceService.saveVideoInfo(this.exportVideoData());
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
        persistenceService.saveVideoInfo(this.exportVideoData());
        this.onReorderCallbackList.forEach(callback => callback(this.subscriptions));
    }

    addReorderListener(callback: (subs: Subscription[]) => void) {
        this.onReorderCallbackList.push(callback);
    }
}

const dataService = new DataService();
export default dataService;
