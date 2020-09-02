import $ from "jquery";
import DataService from "../Services/DataService";
import PersistenceService from "../Services/PersistenceService";
import Component from "./Component";
import ModalComponent from "./ModalComponent";

export default class BackupModalComponent extends Component {

    private modal: ModalComponent;

    constructor(modal: ModalComponent) {
        super($("<div/>", {"id": "ytbsp-backup-content"}));
        this.modal = modal;

        this.component.append($("<h1/>", {"html": "Backup video information"}));
        this.component.append($("<p/>", {
            "html": "This Feature allows you to save the data used in the script containing the " +
                "information which videos you have seen or removed." +
                "<br/>This can be used to import the current state of the script data on another " +
                "browser/computer or just to make sure you don't loose this information over night."
        }));
        this.component.append($("<h1/>", {"html": "How do I do this?"}));
        this.component.append($("<p/>", {
            "html": "Just click export and save the video information as a json file on your computer." +
                "<br/>To restore an saved state of all your videos click import and browse to a previously exported file." +
                "<br/><br/>The save data from local and cloud storage are compatible and interchangeable.<br/><br/>"
        }));

        this.component.append(this.buildBottomControls());
    }

    private buildBottomControls() {
        return $("<div/>", {"id": "ytbsp-modal-end-div"})
            .append($("<input/>", {
                "type": "submit",
                "class": "ytbsp-func",
                "value": "close",
                "on": {"click": () => this.modal.closeModal()}
            }))
            .append($("<input/>", {
                "type": "submit",
                "class": "ytbsp-func",
                "value": "import data",
                "on": {"click": () => this.importData()}
            }))
            .append($("<input/>", {
                "type": "submit",
                "class": "ytbsp-func",
                "value": "export data",
                "on": {"click": () => this.exportData()}
            }));
    }

    private importData(): void {
        const input = document.createElement("input");
        input.type = "file";
        input.multiple = false;
        input.accept = ".json";
        input.onchange = async () => {
            const files = Array.from(input.files);
            if (files[0]) {
                PersistenceService.addSaveListener((state) => {
                    if (state == "end") {
                        location.reload();
                    }
                });
                this.modal.closeModal();
                PersistenceService.saveVideoInfo(await files[0].text());

            }
        };
        input.click();
    }

    private exportData() {
        const link = document.createElement("a");
        link.download = "data.json";
        const blob = new Blob([DataService.exportVideoData()], {"type": "text/json"});
        link.href = window.URL.createObjectURL(blob);
        link.click();
    }
}
