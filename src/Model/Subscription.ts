import SubscriptionDTO from "./SubscriptionDTO";
import Video from "./Video";

export default class Subscription {
    channelName: string;
    channelId: string;
    playlistId: string;
    channelUrl: URL;
    videos: Video[] = [];

    updateSubscription(info: {
        channelName?: string,
        channelId?: string,
        playlistId?: string,
        channelUrl?: URL,
        videos?: {
            title?: string,
            thumb?: string,
            thumbLarge?: string,
            duration?: string,
            uploaded?: string,
            pubDate?: string,
            clicks?: string,
            seen?: boolean,
            removed?: boolean,
            [x: string]: any
        }[],
        [x: string]: any
    }): void {
        // Set given information.
        if (Object.prototype.hasOwnProperty.call(info, "channelName")) {
            this.channelName = "" !== info.channelName ? info.channelName : this.channelName;
        }
        if (Object.prototype.hasOwnProperty.call(info, "channelId")) {
            this.channelId = "" !== info.channelId ? info.channelId : this.channelId;
        }
        if (Object.prototype.hasOwnProperty.call(info, "playlistId")) {
            this.playlistId = "" !== info.playlistId ? info.playlistId : this.playlistId;
        }
        if (Object.prototype.hasOwnProperty.call(info, "channelUrl")) {
            this.channelUrl = info.channelUrl ? info.channelUrl : this.channelUrl;
        }
        if (Object.prototype.hasOwnProperty.call(info, "videos")) {
            info.videos.reverse().forEach(updateInfo => {
                const currentVideo = this.videos.find(vid => vid.id === updateInfo.id);
                if ("undefined" !== typeof currentVideo) {
                    currentVideo.updateVideo(updateInfo);
                } else {
                    const newVideo = new Video(updateInfo.id);
                    newVideo.updateVideo(updateInfo);
                    this.videos.unshift(newVideo);
                }
            });
        }
    }

    getDTO(): SubscriptionDTO {
        return {
            channelId: this.channelId,
            videos: this.videos.map(video => video.getDTO())
        };
    }

}
