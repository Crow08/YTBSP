import Video from "../Model/Video";
import dataService from "../Services/DataService";
import PageService from "../Services/PageService";
import Component from "./Component";
import ClickEvent = JQuery.ClickEvent;

export default class VideoComponent extends Component {
    videoId: string;
    private seenMarkerItem: JQuery;
    private thumbItem: JQuery;
    private closeItem: JQuery;

    constructor(video: Video) {
        super($("<li/>", {"class": "ytbsp-video-item"}));
        this.videoId = video.id;
        const clipItem = $("<a/>", {"href": `/watch?v=${video.id}`, "class": "ytbsp-clip"});
        this.closeItem = $("<div/>", {"class": "ytbsp-x", "html": "X"});
        this.thumbItem = $("<img  src=\"\" alt=\"loading...\"/>", {"class": "ytbsp-thumb"});
        const durationItem = $("<ytd-thumbnail-overlay-time-status-renderer/>");
        const thumbLargeItem = $("<input/>", {
            "class": "ytbsp-thumb-large-url",
            "type": "hidden",
            "value": video.thumbLarge ? video.thumbLarge : video.thumb
        });
        const titleItem = $("<a/>", {
            "href": `/watch?v=${video.id}`,
            "class": "ytbsp-title",
            "title": video.title,
            "html": video.title
        });
        const clicksItem = $("<p/>", {"class": "ytbsp-views", "html": video.clicks});
        const uploadItem = $("<p/>", {"class": "ytbsp-uploaded", "html": video.uploaded});
        this.seenMarkerItem = $("<p/>", {
            "class": `ytbsp-seenMarker${video.seen ? " seen" : ""}`,
            "html": (video.seen ? "already seen" : "mark as seen")
        });

        setTimeout(() => {
            // TODO: Workaround, because when executed synchronous time will not be displayed.
            durationItem.html(video.duration);
        }, 100);

        this.component.append(clipItem
            .append(this.closeItem)
            .append(this.thumbItem)
            .append(durationItem)
            .append(thumbLargeItem));
        this.component.append(titleItem);
        this.component.append(clicksItem);
        this.component.append(uploadItem);
        this.component.append(this.seenMarkerItem);

        // Register some events from this thumb.
        this.seenMarkerItem.click(() => this.toggleSeen());
        this.closeItem.click(() => {
            dataService.upsertVideo(video.id, (video) => {
                video.removed = true;
                return video;
            });
        });

        clipItem.add(titleItem).add(this.closeItem).click((event) => this.handleOpenVideo(event));

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
        this.updateSeenButton();
    }

    updateSeenButton(): void {
        if (dataService.getVideo(this.videoId).seen) {
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
}
