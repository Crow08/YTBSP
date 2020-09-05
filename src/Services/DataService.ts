import Subscription from "../Model/Subscription";
import Video from "../Model/Video";
import PersistenceService from "./PersistenceService";

class DataService {
    private subscriptions: Subscription[] = [];

    private onSubscriptionChangeCallbackList: { [channelId: string]: (() => void)[] } = {};

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

    upsertSubscription(channelId: string, func: ((sub: Subscription | undefined) => Subscription)): void {
        const sub = this.subscriptions.find(curSub => curSub.channelId === channelId);
        const newSub = func(sub);
        if ("undefined" === typeof sub) {
            this.subscriptions.push(newSub);
        } else {
            sub.updateSubscription(newSub);
        }
        this.onDataUpdated(channelId);
    }

    upsertVideo(videoId: string, func: ((video: Video | undefined) => Video), channelId?: string,): void {
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
        this.onDataUpdated(sub.channelId);
    }

    updateSubVideos(channelId: string, func: (vid: Video) => void): void {
        this.getSubscription(channelId).videos.forEach(video => {
            func(video);
        });
        this.onDataUpdated(channelId);
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
        PersistenceService.saveVideoInfo(this.exportVideoData());
    }
}

const dataService = new DataService();
export default dataService;
