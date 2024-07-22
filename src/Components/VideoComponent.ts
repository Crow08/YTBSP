import moment from "moment";
import Video from "../Model/Video";
import configService from "../Services/ConfigService";
import dataService from "../Services/DataService";
import pageService from "../Services/PageService";
import playerService from "../Services/PlayerService";
import queueService from "../Services/QueueService";
import Component from "./Component";
import ClickEvent = JQuery.ClickEvent;
import Timeout = NodeJS.Timeout;

export default class VideoComponent extends Component {
    videoId: string;
    private seenMarkerItem: JQuery;
    private thumbItem: JQuery;
    private closeItem: JQuery;
    private addToQueueItem: JQuery;
    private titleItem: JQuery;
    private clipItem: JQuery;
    private enlargeTimeout: Timeout = null;
    private uploadItem: JQuery;

    constructor(video: Video) {
        super($("<li/>", {"class": "ytbsp-video-item"}));
        this.videoId = video.id;
        this.clipItem = $("<a/>", {"href": `/watch?v=${video.id}`, "class": "ytbsp-clip"});
        this.closeItem = $("<div/>", {"class": "ytbsp-x", "html": "X"});
        this.thumbItem = $("<img src=\"\" alt=\"loading...\"/>", {"class": "ytbsp-thumb"});
        const durationItem = $("<ytd-thumbnail-overlay-time-status-renderer/>");
        this.titleItem = $("<a/>", {
            "href": `/watch?v=${video.id}`,
            "class": "ytbsp-title",
            "title": video.title,
            "html": video.title
        });
        const dateHtml = video.premiere ? `Premieres ${moment(video.premiere).calendar()}` : `Uploaded ${video.uploaded} ago`;
        this.uploadItem = $("<p/>", {"class": "ytbsp-uploaded", "html": dateHtml});
        this.addToQueueItem = $("<span/>", {
            "class": "ytbsp-seenMarker",
            "html": "add to queue"
        });
        this.seenMarkerItem = $("<span/>", {
            "class": `ytbsp-seenMarker${video.seen ? " seen" : ""}`,
            "html": (video.seen ? "already seen" : "mark as seen")
        });

        this.clipItem.mouseover(() => this.startEnlargeTimeout());
        this.clipItem.mouseleave(() => this.abortEnlargeTimeout());
        this.closeItem.mouseover(() => this.abortEnlargeTimeout());
        this.component.mouseleave(() => this.resetThumbnail());

        setTimeout(() => {
            // TODO: Workaround, because when executed synchronous time will not be displayed.
            durationItem.find(".ytd-thumbnail-overlay-time-status-renderer > yt-icon")
                .prop("hidden", true);
            durationItem.find("span").html(video.duration);
        }, 100);

        this.component.append(this.clipItem
            .append(this.closeItem)
            .append(this.thumbItem)
            .append(durationItem));
        this.component.append(this.titleItem);
        this.component.append(this.uploadItem);
        this.component.append(this.seenMarkerItem);
        this.component.append($("<span/>", {"class": "ytbsp-spacer", "html": " | "}));
        this.component.append(this.addToQueueItem);
        if (video.premiere) {
            this.component.addClass("ytbsp-premiere");
        }

        // Register some events from this thumb.
        this.seenMarkerItem.click(() => this.toggleSeen());
        this.closeItem.click(() => {
            dataService.upsertVideo(video.id, (video) => {
                video.removed = true;
                return video;
            });
        });

        //this adds clicked video to a magical invisible youtube playlist
        this.addToQueueItem.click(() => {
            pageService.addToQueue(video.id);
            queueService.setStartVideoId(video.id);
            this.addToQueueItem.css("color", "green");
            this.addToQueueItem.html("ADDED &#10003;");
        });

        this.clipItem.add(this.titleItem).add(this.closeItem).click((event) => this.handleOpenVideo(event));

    }

    updateVisibility(): void {
        const src = this.thumbItem.attr("src");
        if (this.isInView() && ("undefined" === typeof src || "" === src)) {
            this.thumbItem.attr("src", dataService.getVideo(this.videoId).thumb);
        }
    }

    toggleSeen(): void {
        dataService.upsertVideo(this.videoId, (video) => {
            video.seen = !video.seen;
            return video;
        });
    }

    update(): void {
        const video = dataService.getVideo(this.videoId);
        this.updateSeenButton(video);
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
        if ((event.target as Element).classList.contains(this.closeItem.attr("class"))) {
            return;
        }

        function onYTAction(e: CustomEvent) {
            if ((e.detail["actionName"] === "yt-miniplayer-play-state-changed" && e.detail["args"][0] === true) ||
                (e.detail["actionName"] === "yt-deactivate-miniplayer-action")) {
                playerService.togglePictureInPicturePlayer(false);
                document.removeEventListener("yt-action", onYTAction);
                window.scrollTo(0, 0);
            }

        }

        document.addEventListener("yt-action", onYTAction);
        pageService.navigateToVideo(this.videoId);

    }

    // Enlarge thumbnail and load higher resolution image.
    private startEnlargeTimeout(): void {
        const enlargeFactor = configService.getConfig().enlargeFactor;
        if (1 >= enlargeFactor) {
            return;
        }
        if (this.closeItem.is(":hover")) {
            return;
        }

        if (null === this.enlargeTimeout) {
            this.enlargeTimeout = setTimeout(() => this.enlargeThumbnail(enlargeFactor), configService.getConfig().enlargeDelay);
        }
    }

    private enlargeThumbnail(enlargeFactor: number) {
        const info = $("p", this.component);
        this.thumbItem.attr("src", dataService.getVideo(this.videoId).thumbLarge);
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
    }

    // Reset thumbnail to original size
    private resetThumbnail(): void {
        if (1 >= configService.getConfig().enlargeFactor) {
            return;
        }
        this.abortEnlargeTimeout();

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

    // Abort enlargement process if not already open.
    private abortEnlargeTimeout(): void {
        clearTimeout(this.enlargeTimeout);
        this.enlargeTimeout = null;
    }
}
