import $ from "jquery";
import Subscription from "../Model/Subscription";
import Video from "../Model/Video";
import configService from "../Services/ConfigService";
import dataService, { SortPosition } from "../Services/DataService";
import pageService from "../Services/PageService";
import ytpl from "../ytpl";
import Component from "./Component";
import * as ComponentUtils from "./ComponentUtils";
import { Loader } from "./ComponentUtils";
import VideoComponent from "./VideoComponent";

export default class SubComponent extends Component {
    channelId: string;
    private videoList: JQuery;
    private videoComponents: VideoComponent[] = [];
    private loader: Loader;

    private isExpanded: boolean;
    private expandButton: JQuery;

    constructor(sub: Subscription) {
        super($("<li/>", {"class": "ytbsp-subscription"}));
        this.channelId = sub.channelId;
        const menuStrip = $("<div/>", {"class": "ytbsp-subMenuStrip"});
        this.expandButton = $("<button/>", {"class": "ytbsp-func ytbsp-subShowMore", "html": "Show more"}).click(() => {
            this.subShowMore();
        });
        menuStrip.append($("<div/>", {"css": {"float": "right"}})
            .append($("<button/>", {"class": "ytbsp-func ytbsp-sortBtn ytbsp-suborderTop", "html": "⭱"}).click(() => {
                dataService.reorderSubscriptions(this.channelId, SortPosition.TOP);
            }))
            .append($("<button/>", {"class": "ytbsp-func ytbsp-sortBtn  ytbsp-suborderTop", "html": "⭡"}).click(() => {
                dataService.reorderSubscriptions(this.channelId, SortPosition.UP);
            }))
            .append($("<button/>", {"class": "ytbsp-func ytbsp-sortBtn  ytbsp-suborderBottom", "html": "⭣"}).click(() => {
                dataService.reorderSubscriptions(this.channelId, SortPosition.DOWN);
            }))
            .append($("<button/>", {"class": "ytbsp-func ytbsp-sortBtn  ytbsp-suborderBottom", "html": "⭳"}).click(() => {
                dataService.reorderSubscriptions(this.channelId, SortPosition.BOTTOM);
            }))
            .append($("<label/>", {"for": "ytbsp_shoShorts_" + this.channelId, "class": "ytbsp-func ytbsp-showShorts", "html": "Hide Shorts:"}))
            .append($("<input/>", {"id": "ytbsp_shoShorts_" + this.channelId, "class": "ytbsp-func ytbsp-showShorts", "type": "checkbox"}).click(() => {
                this.toggleHideShorts();
            }))
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
        this.loader = ComponentUtils.getLoader(`loader_${sub.channelId}`);
        menuStrip.append(this.loader.component);
        menuStrip.append($("<h3/>", {"class": "ytbsp-subTitle"}).append($("<a/>", {"href": sub.channelUrl}).append(sub.channelName)));
        this.component.append(menuStrip);
        this.videoList = $("<ul/>", {"class": "ytbsp-subVideos"});
        this.component.append(this.videoList);

        this.updateHiddenState();
        this.reloadSubVideos().then(() => {
            configService.addChangeListener(() => this.updateVideoList());
            dataService.addSubscriptionChangeListener(sub.channelId, () => this.updateVideoList());
            pageService.addViewChangeListener(() => this.updateVisibility());
        }).catch((error) => {
            console.error(`Failed to (re-)load playlist for channel: ${this.channelId}`, error);
        });

    }

    private static moveVideoComponent(arr: VideoComponent[], oldIndex: number, newIndex: number): VideoComponent[] {
        if (newIndex >= arr.length) {
            let k = newIndex - arr.length + 1;
            while (k--) {
                arr.push(undefined);
            }
        }
        arr.splice(newIndex, 0, arr.splice(oldIndex, 1)[0]);
        return arr;
    }

    // Function to remove all videos.
    subRemoveAllVideos(): void {
        dataService.updateSubVideos(this.channelId, (video) => {
            video.removed = true;
        });
    }

    // Function to reset all videos.
    subResetAllVideos(): void {
        dataService.updateSubVideos(this.channelId, (video) => {
            video.seen = false;
            video.removed = false;
        });
    }

    // Function to see all.
    subSeenAllVideos(): void {
        dataService.updateSubVideos(this.channelId, (video) => {
            video.seen = true;
        });
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
    reloadSubVideos(): Promise<void> {
        this.loader.showLoader();
        return new Promise<void>((resolve, reject) => {
            ytpl(dataService.getSubscription(this.channelId).playlistId, {
                limit: configService.getConfig().maxVideosPerSub
            })
                .then((response) => {
                    this.processRequestVideos(response);
                    this.updateVideoList();
                    resolve();
                }).catch(reject);
        });
    }

    // (Re-)Build the list of videos.
    updateVideoList(): void {
        this.loader.showLoader();
        let visibleItemIndex = 0;
        const limit = this.isExpanded ? configService.getConfig().maxVideosPerSub : configService.getConfig().maxVideosPerRow;
        $("br", this.videoList).remove();
        // Now loop through the videos.
        dataService.getSubscription(this.channelId).videos.forEach((video) => {
            const oldIndex = this.videoComponents.findIndex((vidComp) => vidComp.videoId === video.id);
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
                if (video.removed || this.isVideoHidden(video)) {
                    this.videoComponents[oldIndex].component.remove();
                    this.videoComponents.splice(oldIndex, 1);
                } else {
                    this.videoComponents[oldIndex].update();
                    // if the video position has changed, move it.
                    if (visibleItemIndex !== oldIndex) {
                        SubComponent.moveVideoComponent(this.videoComponents, oldIndex, visibleItemIndex);
                        this.videoComponents[oldIndex].component.remove();
                        if (visibleItemIndex === 0) {
                            this.videoList.prepend(this.videoComponents[0].component);
                        } else {
                            this.videoComponents[visibleItemIndex - 1].component.after(this.videoComponents[visibleItemIndex].component);
                        }
                    }
                    visibleItemIndex++;
                }
            } else if (video.title !== undefined && (!video.removed && !this.isVideoHidden(video))) {
                // Create new component for video.
                const newVidComp = new VideoComponent(video);
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
            if (1 < visibleItemIndex && 0 === (visibleItemIndex - 1) % configService.getConfig().maxVideosPerRow) {
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
        this.loader.hideLoader();
    }

    private isVideoHidden(video: Video) {
        const hideSeen = configService.getConfig().hideSeenVideos && video.seen;
        const hideOld = configService.getConfig().hideOlderVideos && this.isVideoOld(video.pubDate);
        const hideShorts = configService.getConfig().hideShorts[this.channelId] && video.duration.startsWith("0");
        return hideSeen || hideOld || hideShorts;
    }

    // Hides subscription if needed.
    private updateHiddenState(): void {
        if (this.videoComponents.length === 0 && configService.getConfig().hideEmptySubs) {
            this.component.hide();
            pageService.triggerViewChange();
        } else{
            this.component.show();
            this.updateVisibility();
        }
    }

    //calulate how old the video is and if its too old
    isVideoOld(pubdate : Date): boolean {
        let isOld = false;
        if (pubdate === undefined){
            return false;
        }
        const today = new Date();

        if (((today.getTime() - pubdate.getTime()) / (1000 * 3600 * 24)) > configService.getConfig().videoDecomposeTime){
            isOld = true;
        }
        return isOld;
    }

    private processRequestVideos(response: Video[]): void {
        response.forEach((responseItem) => {
            dataService.upsertVideo(responseItem.id, ((currentVideo) => {
                if ("undefined" === typeof currentVideo) {
                    currentVideo = new Video(responseItem.id);
                }
                currentVideo.updateVideo(responseItem);
                return currentVideo;
            }), true, this.channelId);
        });
    }

    private updateVisibility(): void {
        if (this.isInView()) {
            this.videoComponents.forEach(element => {
                element.updateVisibility();
            });
        }
    }

    private toggleHideShorts() {
        const hideShorts = { ...configService.getConfig().hideShorts};
        hideShorts[this.channelId] = !hideShorts[this.channelId];
        configService.updateConfig({hideShorts: hideShorts});
    }
}
