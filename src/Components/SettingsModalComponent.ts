import $ from "jquery";
import { Resolutions } from "../Model/Configuration";
import configService from "../Services/ConfigService";
import persistenceService from "../Services/PersistenceService";
import BackupModalComponent from "./BackupModalComponent";
import Component from "./Component";
import { getSlider, Slider } from "./ComponentUtils";
import ModalComponent from "./ModalComponent";

export default class SettingsModalComponent extends Component {

    private modal: ModalComponent;

    private hideEmptySubsSlider: Slider;
    private hideSeenVideosSlider: Slider;
    private hideOlderVideosSlider: Slider;
    private autoPauseVideoSlider: Slider;
    private playerQualitySelect: JQuery;
    private maxSimSubLoadInput: JQuery;
    private maxVideosPerRowInput: JQuery;
    private maxVideosPerSubInput: JQuery;
    private timeToMarkAsSeenInput: JQuery;
    private enlargeDelayInput: JQuery;
    private enlargeFactorInput: JQuery;
    private enlargeFactorNativeInput: JQuery;
    private screenThresholdInput: JQuery;
    private deleteUserDataButton: JQuery;
    private backupButton: JQuery;
    private videoDecomposeTimeInput: JQuery;

    constructor(modal: ModalComponent) {
        super($("<div/>"));
        this.modal = modal;

        this.hideEmptySubsSlider = getSlider("ytbsp-settings-hideEmptySubs", configService.getConfig().hideEmptySubs);
        this.hideSeenVideosSlider = getSlider("ytbsp-settings-hideSeenVideos", configService.getConfig().hideSeenVideos);
        this.hideOlderVideosSlider = getSlider("ytbsp-settings-hideOlderVideos", configService.getConfig().hideOlderVideos);
        this.autoPauseVideoSlider = getSlider("ytbsp-settings-autoPauseVideo", configService.getConfig().autoPauseVideo);
        this.playerQualitySelect = this.getQualitySelect();
        this.maxSimSubLoadInput = $("<input>", {
            "type": "number",
            "min": "1",
            "max": "50",
            "id": "ytbsp-settings-maxSimSubLoad",
            "value": configService.getConfig().maxSimSubLoad
        });
        this.maxVideosPerRowInput = $("<input>", {
            "type": "number",
            "min": "1",
            "max": "50",
            "id": "ytbsp-settings-maxVideosPerRow",
            "value": configService.getConfig().maxVideosPerRow
        });
        this.maxVideosPerSubInput = $("<input>", {
            "type": "number",
            "min": "1",
            "max": "50",
            "id": "ytbsp-settings-maxVideosPerSub",
            "value": configService.getConfig().maxVideosPerSub
        });
        this.timeToMarkAsSeenInput = $("<input>", {
            "type": "number",
            "min": "0",
            "id": "ytbsp-settings-timeToMarkAsSeen",
            "value": configService.getConfig().timeToMarkAsSeen
        });
        this.enlargeDelayInput = $("<input>", {
            "type": "number",
            "min": "0",
            "id": "ytbsp-settings-enlargeDelay",
            "value": configService.getConfig().enlargeDelay
        });
        this.enlargeFactorInput = $("<input>", {
            "type": "number",
            "min": "1",
            "step": "0.01",
            "id": "ytbsp-settings-enlargeFactor",
            "value": configService.getConfig().enlargeFactor
        });
        this.enlargeFactorNativeInput = $("<input>", {
            "type": "number",
            "min": "1",
            "step": "0.01",
            "id": "ytbsp-settings-enlargeFactorNative",
            "value": configService.getConfig().enlargeFactorNative
        });
        this.screenThresholdInput = $("<input>", {
            "type": "number",
            "min": "0",
            "id": "ytbsp-settings-screenThreshold",
            "value": configService.getConfig().screenThreshold
        });
        this.backupButton = $("<button/>", {
            "id": "ytbsp-backupBtn",
            "class": "ytbsp-func",
            "html": "Import/Export video information",
            "on": {"click": () => this.modal.openModal(new BackupModalComponent(this.modal))}
        });
        this.deleteUserDataButton = $("<input/>", {
            "type": "button",
            "class": "ytbsp-func",
            "value": "Delete user data",
            "css": {"background-color": "#bb3333", "border-radius": "2px"},
            "on": {"click": () => this.deleteUserData()}
        });
        this.videoDecomposeTimeInput = $("<input>", {
            "type": "number",
            "min": "0",
            "id": "ytbsp-settings-videoDecomposeTime",
            "value": configService.getConfig().videoDecomposeTime
        });
        this.component.append($("<h1/>", {"html": "Settings"}));
        this.component.append(this.buildSettingsTable());
        this.component.append(this.buildBottomControls());
    }

    private saveSettings(): void {
        configService.updateConfig({
            maxSimSubLoad: this.maxSimSubLoadInput.val(),
            maxVideosPerRow: this.maxVideosPerRowInput.val(),
            maxVideosPerSub: this.maxVideosPerSubInput.val(),
            enlargeDelay: this.enlargeDelayInput.val(),
            enlargeFactor: this.enlargeFactorInput.val(),
            enlargeFactorNative: this.enlargeFactorNativeInput.val(),
            timeToMarkAsSeen: this.timeToMarkAsSeenInput.val(),
            videoDecomposeTime: this.videoDecomposeTimeInput.val(),
            screenThreshold: this.screenThresholdInput.val(),
            playerQuality: this.playerQualitySelect.val(),
            autoPauseVideo: this.autoPauseVideoSlider.getValue(),
            hideSeenVideos: this.hideSeenVideosSlider.getValue(),
            hideOlderVideos: this.hideOlderVideosSlider.getValue(),
            hideEmptySubs: this.hideEmptySubsSlider.getValue()
        });
        this.modal.closeModal();
        setTimeout(() => {
            location.reload();
        }, 500);
    }

    private deleteUserData(): void {
        persistenceService.deleteUserData().finally(() => {
            this.modal.closeModal();
            setTimeout(() => {
                location.reload();
            }, 500);
        });
    }

    private buildSettingsTable(): JQuery {
        const settingsTable = $("<table/>", {"id": "ytbsp-settings-table"});
        settingsTable.append($("<tr>")
            .append($("<td>", {"html": "Hide empty subs"}))
            .append($("<td>").append(this.hideEmptySubsSlider.component))
            .append($("<td>"))
        );
        settingsTable.append($("<tr>")
            .append($("<td>", {"html": "Hide seen videos"}))
            .append($("<td>").append(this.hideSeenVideosSlider.component))
            .append($("<td>"))
        );
        settingsTable.append($("<tr>")
            .append($("<td>", {"html": "Hide older videos"}))
            .append($("<td>").append(this.hideOlderVideosSlider.component))
            .append($("<td>"))
        );
        settingsTable.append($("<tr>")
            .append($("<td>", {"html": "Auto pause videos"}))
            .append($("<td>").append(this.autoPauseVideoSlider.component))
            .append($("<td>", {"html": "Open Videos in a paused state. (Does not effect playlists.)"}))
        );
        settingsTable.append($("<tr>")
            .append($("<td>", {"html": "Player Quality"}))
            .append($("<td>").append(this.playerQualitySelect))
            .append($("<td>", {"html": "Open Videos in a paused state. (Does not effect playlists.)"}))
        );
        settingsTable.append($("<tr>")
            .append($("<td>", {"html": "Max number of subscriptions loading simultaneously"}))
            .append($("<td>").append(this.maxSimSubLoadInput))
            .append($("<td>", {"html": "Default: 10 | Range: 1-50 | Higher numbers result in slower loading of single items but overall faster loading."}))
        );
        settingsTable.append($("<tr>")
            .append($("<td>", {"html": "Max number of videos per row"}))
            .append($("<td>").append(this.maxVideosPerRowInput))
            .append($("<td>", {"html": "Default: 9 | Range: 1-50"}))
        );
        settingsTable.append($("<tr>")
            .append($("<td>", {"html": "Max number of videos per subscription"}))
            .append($("<td>").append(this.maxVideosPerSubInput))
            .append($("<td>", {"html": "Default: 27 | Range: 1-50 | Should be dividable by videos per row."}))
        );
        settingsTable.append($("<tr>")
            .append($("<td>", {"html": "Watch time to mark video as seen"}))
            .append($("<td>").append(this.timeToMarkAsSeenInput).append(" s"))
            .append($("<td>", {"html": "Default: 10"}))
        );
        settingsTable.append($("<tr>")
            .append($("<td>", {"html": "Hide Videos Older than - Time"}))
            .append($("<td>").append(this.videoDecomposeTimeInput).append(" days"))
            .append($("<td>", {"html": "Default: 30"}))
        );
        settingsTable.append($("<tr>")
            .append($("<td>", {"html": "Delay for thumbnail enlarge"}))
            .append($("<td>").append(this.enlargeDelayInput).append(" ms"))
            .append($("<td>", {"html": "Default: 500"}))
        );
        settingsTable.append($("<tr>")
            .append($("<td>", {"html": "Factor to enlarge thumbnail by"}))
            .append($("<td>").append(this.enlargeFactorInput))
            .append($("<td>", {"html": "Default: 2.8 | 1 : disable thumbnail enlarge"}))
        );
        settingsTable.append($("<tr>")
            .append($("<td>", {"html": "Factor to enlarge native thumbnail by"}))
            .append($("<td>").append(this.enlargeFactorNativeInput))
            .append($("<td>", {"html": "Default: 2.0 | 1 : disable thumbnail enlarge"}))
        );
        settingsTable.append($("<tr>")
            .append($("<td>", {"html": "Threshold to preload thumbnails"}))
            .append($("<td>").append(this.screenThresholdInput).append(" px"))
            .append($("<td>", {"html": "Default: 500 | Higher threshold results in slower loading and more network traffic. Lower threshold may cause thumbnails to not show up immediately."})));
        settingsTable.append($("<tr>")
            .append($("<td>", {"html": "Video data"}))
            .append($("<td>").append(this.backupButton))
            .append($("<td>", {"html": "Can be use to transfer all seen and removal information of videos between PCs or browsers."})));
        settingsTable.append($("<tr>")
            .append($("<td>", {"html": "User data"}))
            .append($("<td>").append(this.deleteUserDataButton))
            .append($("<td>", {"html": "Be careful, this can not be undone!"})));
        return settingsTable;
    }

    private getQualitySelect(): JQuery {
        const select = $("<Select>", {"id": "ytbsp-settings-playerQuality"});
        Object.keys(Resolutions).forEach((resolution) => {
            let resText = resolution;
            if (resolution[0] === "P") {
                resText = resolution.substring(1) + "p";
            }
            select.append($("<option>", {"value": Resolutions[resolution] as string, "html": resText}));
        });
        select.val(configService.getConfig().playerQuality);
        return select;
    }

    private getClientInfo(): string {
        return `Client ID: ${localStorage.getItem("YTBSP_ServerId")}`;
    }

    private getScriptVersionInfo(): string {
        let versionInformation = "";
        try {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            versionInformation = GM_info && GM_info.script ? `script version:${GM_info.script.version as string}` : "";
        } catch (e) {
            console.info("Tampermonkey variables not available.");
        }
        return versionInformation;
    }

    private buildBottomControls(): JQuery {
        return $("<div/>", {"id": "ytbsp-modal-end-div"})
            .append($("<a/>", {
                "html": "https://github.com/Crow08/YTBSP",
                "href": "https://github.com/Crow08/YTBSP",
                "target": "_blank",
                "class": "ytbsp-func",
                "style": "font-size: 1rem;"
            }))
            .append($("<p/>", {
                "html": this.getScriptVersionInfo(),
                "class": "ytbsp-func",
                "style": "font-size: 1rem;"
            }))
            .append($("<p/>", {"html": this.getClientInfo(), "class": "ytbsp-func", "style": "font-size: 1rem;"}))
            .append($("<input/>", {
                "type": "submit",
                "class": "ytbsp-func",
                "value": "Cancel",
                "on": {"click": () => this.modal.closeModal()}
            }))
            .append($("<input/>", {
                "type": "submit",
                "class": "ytbsp-func",
                "value": "Save",
                "on": {"click": () => this.saveSettings()}
            }));
    }
}
