import SubscriptionDTO from "./SubscriptionDTO";
import Video from "./Video";

export default class Subscription {
    channelName: string;
    channelId: string;
    playlistId: string;
    channelUrl: URL;
    iconUrl: URL;
    videos: Video[] = [];

    updateSubscription(info: {
        channelName?: string,
        channelId?: string,
        playlistId?: string,
        channelUrl?: URL,
        iconUrl?: URL,
        videos?: {
            title?: string,
            thumb?: string,
            thumbLarge?: string,
            duration?: string,
            uploaded?: string,
            pubDate?: Date,
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
        if (Object.prototype.hasOwnProperty.call(info, "iconUrl")) {
            this.iconUrl = info.iconUrl ? info.iconUrl : this.iconUrl;
        }
        if (Object.prototype.hasOwnProperty.call(info, "videos")) {
            const existingVideos = new Map(this.videos.map(video => [video.id, video]));
            const processedIds = new Set<string>();
            const updatedVideos: Video[] = [];

            info.videos.forEach(updateInfo => {
                if ("undefined" === typeof updateInfo || "undefined" === typeof updateInfo.id) {
                    return;
                }
                let currentVideo = existingVideos.get(updateInfo.id);
                if ("undefined" === typeof currentVideo) {
                    currentVideo = new Video(updateInfo.id);
                }
                currentVideo.updateVideo(updateInfo);
                updatedVideos.push(currentVideo);
                existingVideos.set(updateInfo.id, currentVideo);
                processedIds.add(updateInfo.id);
            });

            if (updatedVideos.length > 0) {
                // Add older videos that were not updated.
                const remainingVideos = this.videos.filter(video => !processedIds.has(video.id));
                this.videos = updatedVideos.concat(remainingVideos);
            }
        }
    }

    getDTO(): SubscriptionDTO {
        return {
            channelId: this.channelId,
            videos: this.videos.map(video => video.getDTO())
        };
    }

}
