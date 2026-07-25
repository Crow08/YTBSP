import SubscriptionDTO from "./SubscriptionDTO";
import Video from "./Video";

export default class Subscription {
    channelName: string;
    channelId: string;
    playlistId: string;
    channelUrl: URL;
    iconUrl: URL;
    videos: Video[] = [];
    missingSince?: number;
    removedThroughVideoId?: string;

    updateSubscription(info: {
        channelName?: string,
        channelId?: string,
        playlistId?: string,
        channelUrl?: URL,
        iconUrl?: URL,
        removedThroughVideoId?: string,
        videos?: {
            title?: string,
            thumb?: string,
            thumbLarge?: string,
            duration?: string,
            uploaded?: string,
            pubDate?: Date,
            clicks?: string,
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
        if ("number" === typeof info.missingSince) {
            this.missingSince = info.missingSince;
        }
        if ("string" === typeof info.removedThroughVideoId) {
            this.removedThroughVideoId = info.removedThroughVideoId;
        }
        if (Array.isArray(info.videos)) {
            const existingVideos = new Map(this.videos.map(video => [video.id, video]));
            const processedIds = new Set<string>();
            const updatedVideos: Video[] = [];

            info.videos.forEach(updateInfo => {
                if (!updateInfo || "undefined" === typeof updateInfo.id) {
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

    /**
     * Applies the removed boundary to videos discovered for the first time in
     * a freshly fetched playlist page. Must run BEFORE `response` is merged
     * into `videos`, and only ever touches videos not already individually
     * known — an existing entry keeps whatever state it already has.
     *
     * Uses `response`'s own order rather than `this.videos`': the fetched
     * playlist page is always exactly newest-to-oldest, but `this.videos` is
     * not (DataService.upsertVideo appends newly discovered videos to the end
     * of the array rather than inserting them in playlist position).
     */
    applyRemovedBoundary(response: Video[]): void {
        if ("string" !== typeof this.removedThroughVideoId) {
            return;
        }
        const boundaryIndex = response.findIndex(video => video.id === this.removedThroughVideoId);
        if (-1 === boundaryIndex) {
            // Boundary video isn't part of this fetch window: either it fell
            // further out of view (more videos than the window size have
            // appeared since), in which case everything in `response` is
            // newer and none of it should be implied removed, or it was
            // deleted upstream, in which case there's nothing to reconcile.
            // Either way, leave the existing boundary untouched.
            return;
        }
        const knownIds = new Set(this.videos.map(video => video.id));
        for (let i = boundaryIndex; i < response.length; i++) {
            if (!knownIds.has(response[i].id)) {
                response[i].removed = true;
            }
        }
    }

    /**
     * Advances the removed boundary and drops now-covered individual video
     * entries, using a freshly fetched playlist page as the authoritative
     * source of order, and `videos` (already merged with this fetch) as the
     * authoritative source of each video's true removed state. Must run AFTER
     * `response` has been merged into `videos`.
     *
     * `response` items themselves cannot be trusted for removed state: ytpl
     * always constructs brand new Video instances per fetch, and merging only
     * ever updates the stored copy in `videos` -- for a video that already
     * existed before this fetch, `response[i].removed` stays at its ytpl
     * default (false) regardless of the video's true, merged state.
     *
     * Finds the deepest contiguous run of removed videos counting up from the
     * oldest fetched video; the newest video in that run becomes the new
     * boundary, and every video in the run is dropped from `videos` outright
     * — it will be reconstructed as removed the next time it's fetched, via
     * applyRemovedBoundary above.
     */
    compactRemovedVideos(response: Video[]): void {
        const removedById = new Map(this.videos.map(video => [video.id, video.removed]));
        let boundaryIndex = -1;
        for (let i = response.length - 1; i >= 0; i--) {
            if (!removedById.get(response[i].id)) {
                break;
            }
            boundaryIndex = i;
        }
        if (-1 === boundaryIndex) {
            return;
        }
        this.removedThroughVideoId = response[boundaryIndex].id;
        const coveredIds = new Set(response.slice(boundaryIndex).map(video => video.id));
        this.videos = this.videos.filter(video => !coveredIds.has(video.id));
    }

    getDTO(): SubscriptionDTO {
        const dto: SubscriptionDTO = {
            channelId: this.channelId,
            videos: this.videos.map(video => video.getDTO())
        };
        if ("number" === typeof this.missingSince) {
            dto.missingSince = this.missingSince;
        }
        if ("string" === typeof this.removedThroughVideoId) {
            dto.removedThroughVideoId = this.removedThroughVideoId;
        }
        return dto;
    }

}
