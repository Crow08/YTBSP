import $, { error } from "jquery";
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
    private loadingProgress: JQuery<HTMLElement>;

    constructor() {
        super($("<div/>", {"id": "ytbsp-subsWrapper"}));
        const strip = $("<div/>", {"id": "ytbsp-subsMenuStrip"});
        this.loadingProgress = $("<div/>", {
            "id": "ytbsp-loadingProgress",
            "class": "ytbsp-func",
            "html": "(0/0)"
        });
        strip.append(this.loadingProgress);
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
        this.toggleSortBtn = $("<button/>", {"id": "ytbsp-toggleSortMode", "class": "ytbsp-func", "html": "Sort subscriptions"}).click(() => {
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
        this.initializedSubscriptions = 0;

        this.subComponents.forEach((comp) => {
            subPromiseList.push(this.registerVideoLoadingJob(comp));
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
        void this.registerVideoLoadingJob(subComp);
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
            this.toggleSortBtn.html("Finish sorting subscriptions");
        } else {
            configService.updateConfig({hideEmptySubs: this.storedHideEmptySubs});
            this.subList.removeClass("ytbsp-sortMode");
            this.toggleSortBtn.html("Sort subscriptions");
        }
        this.sortMode = !this.sortMode;
    }

    videoLoadingExecutions = 0;
    videoLoadingQueue: SubComponent[] = [];

    /**
     * This will load Videos for a SubComponent with a limit on simulators requests.
     * A maximum of Config.maxSimSubLoad requests will be executed simultaneously.
     * The returned Promise of this function does not indicate if the queued SubComponent is loaded but rather
     * if the process of this request is still ongoing.
     * If a request is queued this functions Promise will immediately resolve, but the earlier requests that caused
     * the queueing will finish the job and resolve afterward.
     *
     * @param subComp SubComponent to load Videos for.
     */
    private registerVideoLoadingJob(subComp: SubComponent): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if(this.videoLoadingExecutions < configService.getConfig().maxSimSubLoad){
                const loadingProcess = subComp.reloadSubVideos();
                ++this.videoLoadingExecutions;
                loadingProcess.then(() => {
                    --this.videoLoadingExecutions;
                    this.updateLoadingProgress();
                    if(this.videoLoadingQueue.length > 0) {
                        const subComponent = this.videoLoadingQueue.shift();
                        this.registerVideoLoadingJob(subComponent).then(resolve).catch(reject);
                    } else {
                        resolve();
                    }
                }).catch(err => console.error(err));
            } else {
                this.videoLoadingQueue.push(subComp);
                resolve();
            }
        });
    }

    initializedSubscriptions = 0;
    updateLoadingProgress(){
        ++this.initializedSubscriptions;
        this.loadingProgress.html(`(${this.initializedSubscriptions}/${this.subComponents.length})`);
        if(this.initializedSubscriptions == this.subComponents.length){
            this.loadingProgress.hide();
        }
    }
}
