import Component from './Component';
import ytsub from "../ytsub";
import $ from "jquery";
import Configuration from "../Model/Configuration";
import Subscription from "../Model/Subscription";
import SubComponent from "./SubComponent";
import ConfigService from "../Services/ConfigService";

export default class SubListComponent extends Component {
    hideEmptySubsCb: JQuery;
    hideSeenVideosCb: JQuery;
    subList: JQuery;
    subComponents: SubComponent[] = [];

    constructor() {
        super($("<div/>", {"id": "ytbsp-subsWrapper"}));
        const strip = $("<div/>", {"id": "ytbsp-subsMenuStrip"})
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
            .change(() => ConfigService.updateConfig({hideEmptySubsCb: this.hideEmptySubsCb.prop("checked")}));
        strip.append($("<label/>", {"for": "ytbsp-hideEmptySubsCb", "class": "ytbsp-func"})
            .append(this.hideEmptySubsCb)
            .append("Hide empty subs"));
        this.component.append(strip);
        this.subList = $("<ul/>", {"id": "ytbsp-subsList"});
        this.component.append(this.subList);

        ytsub().then((subs) => this.updateSubs(subs)).catch((err) => console.error(err));

        this.onUpdateConfig(ConfigService.getConfig());
        ConfigService.addChangeListener((config) => this.onUpdateConfig(config));
    }

    onUpdateConfig(config: Configuration): void {
        this.subList.css("min-width", `${config.maxVideosPerRow * 168}px`);
        this.hideEmptySubsCb.prop('checked', config.hideEmptySubs);
        this.hideSeenVideosCb.prop('checked', config.hideSeenVideos);
    }

    updateSubs(subs: Subscription[]): void {
        subs.forEach(sub => {
            const subComp = new SubComponent(sub);
            this.subComponents.push(subComp);
            this.subList.append(subComp.component);
        });
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
}
