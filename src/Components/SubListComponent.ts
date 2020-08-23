import $ from "jquery";
import Configuration from "../Model/Configuration";
import Subscription from "../Model/Subscription";
import ConfigService from "../Services/ConfigService";
import DataService from "../Services/DataService";
import ytsub from "../ytsub";
import Component from "./Component";
import SubComponent from "./SubComponent";

export default class SubListComponent extends Component {
    private hideEmptySubsCb: JQuery;
    private hideSeenVideosCb: JQuery;
    private subList: JQuery;
    private subComponents: SubComponent[] = [];

    constructor() {
        super($("<div/>", {"id": "ytbsp-subsWrapper"}));
        const strip = $("<div/>", {"id": "ytbsp-subsMenuStrip"});
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
        this.hideSeenVideosCb = $("<input/>", {"id": "ytbsp-hideSeenVideosCb", "type": "checkbox"})
            .change(() => ConfigService.updateConfig({hideSeenVideos: this.hideSeenVideosCb.prop("checked")}));
        strip.append($("<label/>", {"for": "ytbsp-hideSeenVideosCb", "class": "ytbsp-func"})
            .append(this.hideSeenVideosCb)
            .append("Hide seen videos"));
        this.hideEmptySubsCb = $("<input/>", {"id": "ytbsp-hideEmptySubsCb", "type": "checkbox"})
            .change(() => ConfigService.updateConfig({hideEmptySubs: this.hideEmptySubsCb.prop("checked")}));
        strip.append($("<label/>", {"for": "ytbsp-hideEmptySubsCb", "class": "ytbsp-func"})
            .append(this.hideEmptySubsCb)
            .append("Hide empty subs"));
        this.component.append(strip);
        this.subList = $("<ul/>", {"id": "ytbsp-subsList"});
        this.component.append(this.subList);

        ytsub().then((subs) => this.initSubs(subs)).catch((err) => console.error(err));

        this.onUpdateConfig(ConfigService.getConfig());
        ConfigService.addChangeListener((config) => this.onUpdateConfig(config));
    }

    removeAllVideos(): void {
        this.subComponents.forEach(subComp => {
            subComp.subRemoveAllVideos();
        });
    }

    resetAllVideos(): void {
        this.subComponents.forEach(subComp => {
            subComp.subResetAllVideos();
        });
    }

    updateAllSubs() {
        this.subComponents.forEach((comp) => {
            comp.reloadSubVideos().catch((error) => console.log(error));
        });
    }

    private initSubs(subs: Subscription[]): void {
        subs.forEach(sub => {
            const cachedSub = DataService.getSubscription(sub.channelId);
            if ("undefined" !== typeof cachedSub) {
                sub.updateSubscription(cachedSub);
            }
            this.setupNewSubscription(sub);
        });
    }

    private setupNewSubscription(sub: Subscription) {
        DataService.upsertSubscription(sub.channelId, () => sub);
        const subComp = new SubComponent(sub);
        this.subComponents.push(subComp);
        this.subList.append(subComp.component);
    }

    private onUpdateConfig(config: Configuration): void {
        this.subList.css("min-width", `${config.maxVideosPerRow * 168}px`);
        this.hideEmptySubsCb.prop("checked", config.hideEmptySubs);
        this.hideSeenVideosCb.prop("checked", config.hideSeenVideos);
    }
}
