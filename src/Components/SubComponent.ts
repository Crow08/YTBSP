import $ from "jquery";
import ytpl from "ytpl";
import * as ComponentUtils from './ComponentUtils';
import ConfigService from "../Services/ConfigService";
import Component from './Component';
import Subscription from "../Model/Subscription";
import Video from "../Model/Video";
import VideoComponent from "./VideoComponent";
import PageService from "../Services/PageService";

function arrayMove(arr: any[], oldIndex: number, newIndex: number): any[] {
    if (newIndex >= arr.length) {
        let k = newIndex - arr.length + 1;
        while (k--) {
            arr.push(undefined);
        }
    }
    arr.splice(newIndex, 0, arr.splice(oldIndex, 1)[0]);
    return arr;
};

export default class SubComponent extends Component {
    private sub: Subscription;
    videoList: JQuery;
    videoComponents: VideoComponent[] = [];

    isExpanded: boolean;
    expandButton: JQuery;

    constructor(sub: Subscription) {
        super($("<li/>", {"class": "ytbsp-subscription"}));
        this.sub = sub;
        const menuStrip = $("<div/>", {"class": "ytbsp-subMenuStrip"})
        this.expandButton = $("<button/>", {"class": "ytbsp-func ytbsp-subShowMore", "html": "Show more"}).click(() => {
            this.subShowMore();
        });
        menuStrip.append($("<div/>", {"css": {"float": "right"}})
            .append($("<button/>", {"class": "ytbsp-func ytbsp-subRemoveAllVideos", "html": "Remove all"}).click(() => {
                this.subRemoveAllVideos();
            }))
            .append($("<button/>", {"class": "ytbsp-func ytbsp-subResetAllVideos", "html": "Reset all"}).click(() => {
                this.subResetAllVideos();
            }))
            .append($("<button/>", {
                "class": "ytbsp-func ytbsp-subSeenAllVideos",
                "html": "Mark all as seen"
            }).click(() => {
                this.subSeenAllVideos();
            }))
            .append(this.expandButton));
        menuStrip.append($("<div/>", {"class": "ytbsp-loaderDiv"}).append(ComponentUtils.getLoader(`loader_${this.sub.channelId}`).component));
        menuStrip.append($("<h3/>", {"class": "ytbsp-subTitle"}).append($("<a/>", {"href": this.sub.channelUrl}).append(this.sub.channelName)));
        this.component.append(menuStrip);
        this.videoList = $("<ul/>", {"class": "ytbsp-subVids"});
        this.component.append(this.videoList);

        this.updateHiddenState();
        ConfigService.addChangeListener(() => this.updateVideoList());
        PageService.addViewChangeListener(() => this.updateVisibility());
        this.reloadSubVideos();
    }

    // Hides subscription if needed.
    updateHiddenState(): void {
        if (this.videoComponents.length === 0 && ConfigService.getConfig().hideEmptySubs) {
            this.component.hide();
            PageService.triggerViewChange();
        } else {
            this.component.show();
            this.updateVisibility();
        }
    }

    // Function to remove all videos.
    subRemoveAllVideos(): void {
        this.sub.videos.forEach((video, i) => {
            this.sub.videos[i].removed = true;
        });
        this.updateVideoList();
    }

    // Function to reset all videos.
    subResetAllVideos(): void {
        this.sub.videos.forEach((video, i) => {
            this.sub.videos[i].seen = false;
            this.sub.videos[i].removed = false;

        });
        this.updateVideoList();
    }

    // Function to see all.
    subSeenAllVideos(): void {
        this.sub.videos.forEach((video, i) => {
            this.sub.videos[i].seen = true;
        });
        this.updateVideoList();
    }

    // Function to show more.
    subShowMore(): void {
        this.isExpanded = !this.isExpanded;
        if (this.isExpanded) {
            this.expandButton.text("Show less");
        } else {
            this.expandButton.text("Show more");
        }
        this.updateVideoList();
    }

    // Fetches and rebuilds subscription row based on updated videos.
    reloadSubVideos(): void {
        ytpl(this.sub.playlistId, {limit: ConfigService.getConfig().maxVideosPerSub, headers: {}})
            .then((response) => {
                this.processRequestVids(response);
                this.updateVideoList();
            });
    }

    processRequestVids(response: ytpl.result): void {
        response.items.forEach((responseItem) => {
            if (this.sub.videos.some((vid) => vid.id === responseItem.id)) {
                return;
            }

            const video = new Video(responseItem.id);

            if (Object.prototype.hasOwnProperty.call(responseItem, "title")) {
                video.title = responseItem.title;
            }
            if (Object.prototype.hasOwnProperty.call(responseItem, "duration")) {
                video.duration = responseItem.duration;
            }

            if (Object.prototype.hasOwnProperty.call(responseItem, "thumbnail")) {
                video.thumb = responseItem.thumbnail;
            }

            this.sub.videos.push(video);
        });
    }

    // (Re-)Build the list of videos.
    updateVideoList(): void {
        let visibleItemIndex = 0;
        const limit = this.isExpanded ? ConfigService.getConfig().maxVideosPerSub : ConfigService.getConfig().maxVideosPerRow;
        $("br", this.videoList).remove();
        // Now loop through the videos.
        this.sub.videos.forEach((video) => {
            const oldIndex = this.videoComponents.findIndex((vidComp) => vidComp.video.id === video.id);
            // if the list is full, return.
            if (visibleItemIndex >= limit) {
                // if the item is already in the list but exceeds the limit, remove it.
                if (-1 !== oldIndex) {
                    this.videoComponents[oldIndex].component.remove();
                    this.videoComponents.splice(oldIndex, 1);
                }
                return;
            }
            // if the element is already in the list.
            if (-1 !== oldIndex) {
                // If that video is removed search for it and remove it when found.
                if (video.removed || (ConfigService.getConfig().hideSeenVideos && video.seen)) {
                    this.videoComponents[oldIndex].component.remove();
                    this.videoComponents.splice(oldIndex, 1);
                } else {
                    this.videoComponents[oldIndex].updateSeenButton();
                    // if the video position has changed, move it.
                    if (visibleItemIndex !== oldIndex) {
                        arrayMove(this.videoComponents, oldIndex, visibleItemIndex);
                        this.videoComponents[oldIndex].component.remove();
                        if (visibleItemIndex === 0) {
                            this.videoList.prepend(this.videoComponents[0].component);
                        } else {
                            this.videoComponents[visibleItemIndex - 1].component.after(this.videoComponents[visibleItemIndex].component);
                        }
                    }
                    visibleItemIndex++;
                }
            } else if (!video.removed && !(ConfigService.getConfig().hideSeenVideos && video.seen)) {
                // Create new component for video.
                const newVidComp = new VideoComponent(video, this);
                this.videoComponents.splice(visibleItemIndex, 0, newVidComp);
                // Insert new thumb.
                if (visibleItemIndex === 0) {
                    this.videoList.prepend(newVidComp.component);
                } else {
                    this.videoComponents[visibleItemIndex - 1].component.after(newVidComp.component);
                }
                visibleItemIndex++;
            }
            // Add a line break if the maximum number of items per row is exceeded.
            if (1 < visibleItemIndex && 0 === (visibleItemIndex - 1) % ConfigService.getConfig().maxVideosPerRow) {
                $("</br>").insertBefore(this.videoComponents[visibleItemIndex - 1].component);
            }
        }, this);

        // Remove excess items.
        for (let i = visibleItemIndex; i < this.videoComponents.length; ++i) {
            this.videoComponents[i].component.remove();
        }
        this.videoComponents.splice(visibleItemIndex, this.videoComponents.length - visibleItemIndex);

        // Handle visibility.
        this.updateHiddenState();
    }

    updateVisibility(): void {
        if (this.isInView()) {
            this.videoComponents.forEach(element => {
                element.updateVisibility();
            });
        }
    }
}
