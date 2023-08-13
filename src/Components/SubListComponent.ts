import $ from "jquery";
import Configuration from "../Model/Configuration";
import Subscription from "../Model/Subscription";
import configService from "../Services/ConfigService";
import dataService from "../Services/DataService";
import ytsub from "../ytsub";
import Component from "./Component";
import SubComponent from "./SubComponent";
import queueService from "../Services/QueueService";
import pageService from "../Services/PageService";

export default class SubListComponent extends Component {

    private subList: JQuery;
    private toggleSortBtn: JQuery;
    private subComponents: SubComponent[] = [];
    private sortMode = false;

    constructor() {
        super($("<div/>", {"id": "ytbsp-subsWrapper"}));
        const strip = $("<div/>", {"id": "ytbsp-subsMenuStrip"});
        strip.append($("<button/>", {
            "id": "ytbsp-startQueue",
            "class": "ytbsp-func",
            "html": "Start watching"
        }).click(() => this.startQueue()));
        strip.append($("<button/>", {
            "id": "ytbsp-removeAllVideos",
            "class": "ytbsp-func",
            "html": "Remove all videos"
        }).click(() => this.removeAllVideos()));
        strip.append($("<button/>", {
            "id": "ytbsp-resetAllVideos",
            "class": "ytbsp-func",
            "html": "Reset all videos"
        }).click(() => this.resetAllVideos()));
        this.toggleSortBtn = $("<button/>", {"id": "ytbsp-toggleSortMode", "class": "ytbsp-func", "html": "Sort subs"}).click(() => {
            this.toggleSortMode();
        });
        strip.append(this.toggleSortBtn);
        this.component.append(strip);
        this.subList = $("<ul/>", {"id": "ytbsp-subsList"});
        this.component.append(this.subList);

        ytsub().then((subs) => this.initSubs(subs)).catch((err) => console.error(err));

        dataService.addReorderListener((subs) => this.updateSubOrder(subs));
    }

    removeAllVideos(): void {
        this.subComponents.forEach(subComp => {
            subComp.subRemoveAllVideos();
        });
    }

    startQueue(): void {
        if (queueService.getStartVideoId() == null){
            alert("Queue is empty, let me choose a video for you!");
            //get rolled boy!
            pageService.navigateToVideo("dQw4w9WgXcQ");
            return;
        }
        pageService.navigateToVideo(queueService.getStartVideoId());
        queueService.resetStartVideoId();
    }

    resetAllVideos(): void {
        this.subComponents.forEach(subComp => {
            subComp.subResetAllVideos();
        });
    }

    updateAllSubs(): Promise<void[]> {
        const subPromiseList = [];

        this.subComponents.forEach((comp) => {
            subPromiseList.push(comp.reloadSubVideos());
        });
        return Promise.all<void>(subPromiseList);
    }

    private initSubs(newSubs: Subscription[]): void {
        const cachedSubs = dataService.getSubscriptions();
        cachedSubs.forEach(cachedSub => {
            const subIndex = newSubs.findIndex(sub => sub.channelId == cachedSub.channelId);
            const newSub = newSubs[subIndex];
            if("undefined" === typeof newSub) {
                //no longer subscribed
                return;
            }
            newSub.updateSubscription(cachedSub);
            this.setupNewSubscription(newSub);
            newSubs.splice(subIndex,1);
        });
        // Only subs without cache left here:
        newSubs.forEach(newSub => {
            this.setupNewSubscription(newSub);
        });
    }

    private setupNewSubscription(sub: Subscription): void {
        dataService.upsertSubscription(sub.channelId, () => sub);
        const subComp = new SubComponent(sub);
        this.subComponents.push(subComp);
        this.subList.append(subComp.component);
    }

    private updateSubOrder(subs: Subscription[]) {
        subs.forEach(sub => {
            const subComponent = this.subComponents.find(subComponent => subComponent.channelId == sub.channelId);
            if ("undefined" !== typeof subComponent) {
                subComponent.component.detach();
                this.subList.append(subComponent.component);
            }
        });
    }

    storedHideEmptySubs = false;

    private toggleSortMode() {
        if(!this.sortMode) {
            this.storedHideEmptySubs = configService.getConfig().hideEmptySubs;
            configService.updateConfig({hideEmptySubs: false});
            this.subList.addClass("ytbsp-sortMode");
        } else {
            configService.updateConfig({hideEmptySubs: this.storedHideEmptySubs});
            this.subList.removeClass("ytbsp-sortMode");
        }
        this.sortMode = !this.sortMode;
    }
}
