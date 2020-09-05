import moment from "moment";
import ytdl from "ytdl-core";
import Video from "../Model/Video";
import configService from "../Services/ConfigService";
import dataService from "../Services/DataService";
import PageService from "../Services/PageService";
import Component from "./Component";
import ClickEvent = JQuery.ClickEvent;
import Timeout = NodeJS.Timeout;

export default class VideoComponent extends Component {
    videoId: string;
    private thumbLargeUrl: string;
    private seenMarkerItem: JQuery;
    private thumbItem: JQuery;
    private closeItem: JQuery;
    private titleItem: JQuery;
    private clipItem: JQuery;
    private enlargeTimeout: Timeout = null;
    private clicksItem: JQuery;
    private uploadItem: JQuery;

    constructor(video: Video) {
        super($("<li/>", {"class": "ytbsp-video-item"}));
        this.videoId = video.id;
        this.thumbLargeUrl = video.thumbLarge ? video.thumbLarge : video.thumb;
        this.clipItem = $("<a/>", {"href": `/watch?v=${video.id}`, "class": "ytbsp-clip"});
        this.closeItem = $("<div/>", {"class": "ytbsp-x", "html": "X"});
        this.thumbItem = $("<img  src=\"\" alt=\"loading...\"/>", {"class": "ytbsp-thumb"});
        const durationItem = $("<ytd-thumbnail-overlay-time-status-renderer/>");
        this.titleItem = $("<a/>", {
            "href": `/watch?v=${video.id}`,
            "class": "ytbsp-title",
            "title": video.title,
            "html": video.title
        });
        this.clicksItem = $("<p/>", {"class": "ytbsp-views", "html": video.clicks});
        this.uploadItem = $("<p/>", {"class": "ytbsp-uploaded", "html": video.uploaded});
        this.seenMarkerItem = $("<p/>", {
            "class": `ytbsp-seenMarker${video.seen ? " seen" : ""}`,
            "html": (video.seen ? "already seen" : "mark as seen")
        });

        this.clipItem.mouseover(() => this.enlarge());
        this.clipItem.mouseleave(() => this.enlargeCancelTimeout());
        this.closeItem.mouseover(() => this.enlargeCancelTimeout());
        this.component.mouseleave(() => this.enlargeCancel());

        setTimeout(() => {
            // TODO: Workaround, because when executed synchronous time will not be displayed.
            durationItem.html(video.duration);
        }, 100);

        this.component.append(this.clipItem
            .append(this.closeItem)
            .append(this.thumbItem)
            .append(durationItem));
        this.component.append(this.titleItem);
        this.component.append(this.clicksItem);
        this.component.append(this.uploadItem);
        this.component.append(this.seenMarkerItem);

        // Register some events from this thumb.
        this.seenMarkerItem.click(() => this.toggleSeen());
        this.closeItem.click(() => {
            dataService.upsertVideo(video.id, (video) => {
                video.removed = true;
                return video;
            });
        });

        this.clipItem.add(this.titleItem).add(this.closeItem).click((event) => this.handleOpenVideo(event));

    }

    updateVisibility(): void {
        const src = this.thumbItem.attr("src");
        if (this.isInView() && ("undefined" === typeof src || "" === src)) {
            this.thumbItem.attr("src", dataService.getVideo(this.videoId).thumb);
            this.getAdditionalVideoInfos();
        }
    }

    private getAdditionalVideoInfos() {
        ytdl.getBasicInfo(this.videoId).then(info => {
            const uploaded = moment(info.videoDetails.uploadDate);
            let uploadedText: string;
            if (moment().add(-2, "day").isBefore(uploaded)) {
                uploadedText = uploaded.calendar().split(" at")[0];
            } else {
                uploadedText = uploaded.fromNow();
            }

            const viewCount = parseInt(info.videoDetails.viewCount, 10);
            let viewsText: string;
            if (1000000 < viewCount) {
                viewsText = `${Math.round(viewCount / 1000000 * 10) / 10}M views`; // Rounded million views.
            } else if (10000 < viewCount) {
                viewsText = `${Math.round(viewCount / 1000)}K views`; // Rounded thousand views.
            } else {
                viewsText = `${viewCount} views`; // Exact view count under thousand.
            }

            dataService.upsertVideo(this.videoId, (video) => {
                video.updateVideo({uploaded: uploadedText, clicks: viewsText});
                return video;
            }, true, info.videoDetails.channelId);
            this.update();
        }).catch((e) => console.error(e));
    }

    toggleSeen(): void {
        dataService.upsertVideo(this.videoId, (video) => {
            video.seen = !video.seen;
            return video;
        });
    }

    // Abort enlargement process if not already open.
    enlargeCancelTimeout() {
        clearTimeout(this.enlargeTimeout);
        this.enlargeTimeout = null;
    }

    update() {
        const video = dataService.getVideo(this.videoId);
        this.updateSeenButton(video);
        this.updateClicks(video);
        this.updateUploaded(video);
    }

    private updateClicks(video: Video): void {
        this.clicksItem.html(video.clicks);
    }

    private updateUploaded(video: Video): void {
        this.uploadItem.html(video.uploaded);
    }

    private updateSeenButton(video: Video): void {
        if (video.seen) {
            this.seenMarkerItem.html("already seen");
            this.seenMarkerItem.addClass("seen");
        } else {
            this.seenMarkerItem.html("mark as seen");
            this.seenMarkerItem.removeClass("seen");
        }
    }

    private handleOpenVideo(event: ClickEvent): void {
        event.preventDefault();
        if (event.target.classList.contains(this.closeItem.attr("class"))) {
            return;
        }
        PageService.openVideoWithSPF(this.videoId);
    }

    // Enlarge thumbnail and load higher resolution image.
    private enlarge(): void {
        const enlargeFactor = configService.getConfig().enlargeFactor;
        if (1 >= enlargeFactor) {
            return;
        }
        if (0 !== $(".ytbsp-x:hover", this).length) {
            return;
        }

        if (null === this.enlargeTimeout) {
            this.enlargeTimeout = setTimeout(() => {
                const info = $("p", this.component);
                this.thumbItem.attr("src", this.thumbLargeUrl);
                this.thumbItem.addClass("ytbsp-thumb-large");
                this.thumbItem.css("width", `${160 * enlargeFactor}px`);
                this.thumbItem.css("height", `${90 * enlargeFactor}px`);
                this.titleItem.addClass("ytbsp-title-large");
                this.titleItem.css("width", `${(160 * enlargeFactor) - 4}px`);
                this.titleItem.css("left", `${-(((160 * enlargeFactor) / 2) - 82)}px`);
                this.clipItem.addClass("ytbsp-clip-large");
                this.clipItem.css("width", `${(160 * enlargeFactor) + 4}px`);
                this.clipItem.css("height", `${(90 * enlargeFactor) + 4}px`);
                this.clipItem.css("left", `${-(((160 * enlargeFactor) / 2) - 82)}px`);
                info.hide();
            }, configService.getConfig().enlargeDelay);
        }
    }

    // Reset thumbnail to original size
    private enlargeCancel(): void {
        if (1 >= configService.getConfig().enlargeFactor) {
            return;
        }
        clearTimeout(this.enlargeTimeout);
        this.enlargeTimeout = null;

        const infos = $("p", this.component);
        this.thumbItem.removeClass("ytbsp-thumb-large");
        this.thumbItem.css("width", "");
        this.thumbItem.css("height", "");
        this.titleItem.removeClass("ytbsp-title-large");
        this.titleItem.css("width", "");
        this.titleItem.css("left", "");
        this.clipItem.removeClass("ytbsp-clip-large");
        this.clipItem.css("width", "");
        this.clipItem.css("height", "");
        this.clipItem.css("left", "");
        infos.show();
    }
}
