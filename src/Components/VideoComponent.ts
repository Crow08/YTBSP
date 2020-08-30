import PlayerService from "../Services/PlayerService";
import Component from "./Component";
import Video from "../Model/Video";
import PageService from "../Services/PageService";
import SubComponent from "./SubComponent";
import ClickEvent = JQuery.ClickEvent;

export default class VideoComponent extends Component {
    video: Video;
    subComp: SubComponent;
    seenMarkerItem: JQuery;
    thumbItem: JQuery;
    closeItem: JQuery;

    constructor(video: Video, subComp: SubComponent) {
        super($("<li/>", {"class": "ytbsp-video-item"}));
        this.video = video;
        this.subComp = subComp;
        const clipItem = $("<a/>", {"href": `/watch?v=${this.video.id}`, "class": "ytbsp-clip"});
        this.closeItem = $("<div/>", {"class": "ytbsp-x", "html": "X"});
        this.thumbItem = $("<img/>", {"class": "ytbsp-thumb"});
        const durationItem = $("<ytd-thumbnail-overlay-time-status-renderer/>");
        const thumbLargeItem = $("<input/>", {
            "class": "ytbsp-thumb-large-url",
            "type": "hidden",
            "value": this.video.thumbLarge ? this.video.thumbLarge : this.video.thumb
        });
        const titleItem = $("<a/>", {
            "href": `/watch?v=${this.video.id}`,
            "class": "ytbsp-title",
            "title": this.video.title,
            "html": this.video.title
        });
        const clicksItem = $("<p/>", {"class": "ytbsp-views", "html": this.video.clicks});
        const uploadItem = $("<p/>", {"class": "ytbsp-uploaded", "html": this.video.uploaded});
        this.seenMarkerItem = $("<p/>", {
            "class": `ytbsp-seenMarker${this.video.seen ? " seen" : ""}`,
            "html": (this.video.seen ? "already seen" : "mark as seen")
        });

        setTimeout(() => {
            // TODO: Workaround, because when executed synchronous time will not be displayed.
            durationItem.html(this.video.duration);
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
            this.video.removed = true;
            this.subComp.updateVideoList();
        });

        clipItem.add(titleItem).add(this.closeItem).click((event) => this.handleOpenVideo(event));

    }

    handleOpenVideo(event: ClickEvent) {
        event.preventDefault();
        if (event.target.classList.contains(this.closeItem.attr("class"))) {
            return;
        }
        PageService.openVideoWithSPF(this.video.id);
        PlayerService.togglePictureInPicturePlayer(false);
    }

    updateVisibility() {
        if (this.isInView()) {
            this.thumbItem.attr("src", this.video.thumb);
        }
    }

    toggleSeen() {
        this.video.seen = !this.video.seen;
        this.updateSeenButton();
        this.subComp.updateVideoList();
    }

    updateSeenButton() {
        if (this.video.seen) {
            this.seenMarkerItem.html("already seen");
            this.seenMarkerItem.addClass("seen");
        } else {
            this.seenMarkerItem.html("mark as seen");
            this.seenMarkerItem.removeClass("seen");
        }
    }
}
