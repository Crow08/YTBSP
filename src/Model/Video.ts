import VideoDTO from "./VideoDTO";

export default class Video {
    id: string;

    title: string;
    thumb: string;
    thumbLarge: string;
    duration: string;
    uploaded: string;
    pubDate: Date;
    clicks: string;
    premiere: Date;

    removed = false;

    constructor(id: string) {
        this.id = id;
    }

    updateVideo(info: {
        title?: string,
        thumb?: string,
        thumbLarge?: string,
        duration?: string,
        uploaded?: string,
        pubDate?: Date,
        clicks?: string,
        seen?: boolean,
        removed?: boolean,
        premiere?: Date;
        [x: string]: any
    }): void {
        // Set given information.
        if (Object.prototype.hasOwnProperty.call(info, "title")) {
            this.title = "" !== info.title ? info.title : this.title;
        }
        if (Object.prototype.hasOwnProperty.call(info, "thumb")) {
            this.thumb = "" !== info.thumb ? info.thumb : this.thumb;
        }
        if (Object.prototype.hasOwnProperty.call(info, "thumbLarge")) {
            this.thumbLarge = "" !== info.thumbLarge ? info.thumbLarge : this.thumbLarge;
        }
        if (Object.prototype.hasOwnProperty.call(info, "duration")) {
            this.duration = "0:00" !== info.duration ? info.duration : this.duration;
        }
        if (Object.prototype.hasOwnProperty.call(info, "uploaded")) {
            this.uploaded = "" !== info.uploaded ? info.uploaded : this.uploaded;
        }
        if (Object.prototype.hasOwnProperty.call(info, "pubDate")) {
            this.pubDate = null !== info.pubDate ? info.pubDate : this.pubDate;
        }
        if (Object.prototype.hasOwnProperty.call(info, "clicks")) {
            this.clicks = "" !== info.clicks ? info.clicks : this.clicks;
        }
        if (Object.prototype.hasOwnProperty.call(info, "removed")) {
            this.removed = false !== info.removed ? info.removed : this.removed;
        }
        // Legacy caches stored a separate seen flag; seen now means removed.
        if (true === info.seen) {
            this.removed = true;
        }
        if (Object.prototype.hasOwnProperty.call(info, "premiere")) {
            this.premiere = null !== info.premiere ? info.premiere : this.premiere;
        }
    }

    getDTO(): VideoDTO {
        return {
            "id": this.id,
            "removed": this.removed
        };
    }
}
