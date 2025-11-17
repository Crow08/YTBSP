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
    private videoComponentMap: Map<string, VideoComponent> = new Map();
    private loader: Loader;

    private isExpanded: boolean;
    private expandButton: JQuery;
    private videosInitialized: boolean = false;

    private removeShorts: boolean = false;

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
            .append($("<button/>", {
                "class": "ytbsp-func ytbsp-sortBtn  ytbsp-suborderBottom",
                "html": "⭣"
            }).click(() => {
                dataService.reorderSubscriptions(this.channelId, SortPosition.DOWN);
            }))
            .append($("<button/>", {
                "class": "ytbsp-func ytbsp-sortBtn  ytbsp-suborderBottom",
                "html": "⭳"
            }).click(() => {
                dataService.reorderSubscriptions(this.channelId, SortPosition.BOTTOM);
            }))
            .append($("<label/>", {
                "for": "ytbsp_shoShorts_" + this.channelId,
                "class": "ytbsp-func ytbsp-showShorts",
                "html": "Hide Shorts:"
            }))
            .append($("<input/>", {
                "id": "ytbsp_shoShorts_" + this.channelId,
                "class": "ytbsp-func ytbsp-showShorts",
                "type": "checkbox",
                "checked": configService.getConfig().hideShorts[this.channelId]
            }).click(() => {
                this.toggleHideShorts();
            }))
            .append($("<button/>", {"class": "ytbsp-func ytbsp-subRemoveAllVideos", "html": "Remove all"}).click(() => {
                this.subRemoveAllVideos();
            }))
            .append($("<button/>", {"class": "ytbsp-func ytbsp-subResetAllVideos", "html": "Reset all"}).click(() => {
                this.subResetAllVideos();
            }))
            .append(this.expandButton));
        this.loader = ComponentUtils.getLoader(`loader_${sub.channelId}`);
        menuStrip.append(this.loader.component);
        menuStrip.append($("<h3/>", {"class": "ytbsp-subTitle"}).append($("<a/>", {"href": sub.channelUrl}).append(sub.channelName)));
        this.component.append(menuStrip);
        this.videoList = $("<ul/>", {"class": "ytbsp-subVideos"});
        this.component.append(this.videoList);

        this.updateHiddenState();
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
        if (!this.videosInitialized) {
            return this.initVideos();
        }
        this.loader.showLoader();
        const hideShorts = {...configService.getConfig().hideShorts};
        return new Promise<void>((resolve, reject) => {
            ytpl(dataService.getSubscription(this.channelId).playlistId, {
                limit: configService.getConfig().maxVideosPerSub,
                hideShorts: hideShorts[this.channelId]
            })
                .then((response) => {
                    this.processRequestVideos(response);
                    this.updateVideoList();
                    resolve();
                }).catch(reject);
        });
    }

    initVideos(): Promise<void> {
        this.videosInitialized = true;
        return this.reloadSubVideos().then(() => {
            configService.addChangeListener(() => this.updateVideoList());
            dataService.addSubscriptionChangeListener(this.channelId, () => this.updateVideoList());
            pageService.addViewChangeListener(() => this.updateVisibility());
        }).catch((error) => {
            console.error(`Failed to (re-)load playlist for channel: ${this.channelId}`, error);
        });
    }

    // (Re-)Build the list of videos.
    updateVideoList(): void {
        this.loader.showLoader();
        let visibleItemIndex = 0;
        const limit = this.isExpanded ? configService.getConfig().maxVideosPerSub : configService.getConfig().maxVideosPerRow;
        const videoListElement = this.videoList.get(0);
        if (!videoListElement) {
            this.loader.hideLoader();
            return;
        }

        const fragment = document.createDocumentFragment();
        const newVideoComponents: VideoComponent[] = [];

        dataService.getSubscription(this.channelId).videos.forEach((video) => {
            if (visibleItemIndex >= limit) {
                return;
            }
            if (video.title === undefined || video.removed || this.isVideoHidden(video)) {
                return;
            }
            let videoComponent = this.videoComponentMap.get(video.id);
            if ("undefined" === typeof videoComponent) {
                videoComponent = new VideoComponent(video);
            } else {
                videoComponent.update();
            }
            const element = videoComponent.component.detach().get(0);
            if (!element) {
                return;
            }
            fragment.appendChild(element);
            newVideoComponents.push(videoComponent);
            visibleItemIndex++;
            if (visibleItemIndex % configService.getConfig().maxVideosPerRow === 0 && visibleItemIndex !== 0) {
                const br = document.createElement("br");
                br.className = "ytbsp-row-break";
                fragment.appendChild(br);
            }
        });

        // Clear existing content and append new fragment (avoids TrustedHTML requirement)
        videoListElement.replaceChildren(fragment);

        // Remove any unused components from the map.
        this.videoComponentMap = new Map(newVideoComponents.map(component => [component.videoId, component]));
        this.videoComponents = newVideoComponents;

        this.updateHiddenState();
        this.loader.hideLoader();
    }

    //calulate how old the video is and if its too old
    isVideoOld(pubdate: Date): boolean {
        let isOld = false;
        if (pubdate === undefined) {
            return false;
        }
        const today = new Date();

        if (((today.getTime() - pubdate.getTime()) / (1000 * 3600 * 24)) > configService.getConfig().videoDecomposeTime) {
            isOld = true;
        }
        return isOld;
    }

    private isVideoHidden(video: Video) {
        const hideSeen = configService.getConfig().hideSeenVideos && video.seen;
        const hideOld = configService.getConfig().hideOlderVideos && this.isVideoOld(video.pubDate);
        return hideSeen || hideOld;
    }

    // Hides subscription if needed.
    private updateHiddenState(): void {
        if (this.videoComponents.length === 0 && configService.getConfig().hideEmptySubs) {
            this.component.hide();
            pageService.triggerViewChange();
        } else {
            this.component.show();
            this.updateVisibility();
        }
    }

    private processRequestVideos(response: Video[]): void {
        if (this.removeShorts === true) {
            this.removeShorts = false;
            // Find removed shorts videos:
            dataService.getVideos(this.channelId).forEach((oldVideo) => {
                const foundIndex = response.findIndex((vid) => vid.id === oldVideo.id);
                if (foundIndex === -1) {
                    console.log("found:" + oldVideo.title);
                    dataService.upsertVideo(oldVideo.id, video => {
                        video.removed = true;
                        return video;
                    });
                }
            });
        }
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
        const hideShorts = {...configService.getConfig().hideShorts};
        const hideShort = hideShorts[this.channelId];
        hideShorts[this.channelId] = !hideShort;
        configService.updateConfig({hideShorts: hideShorts});
        this.removeShorts = !hideShort;
        this.reloadSubVideos().catch(console.error);
    }
}
