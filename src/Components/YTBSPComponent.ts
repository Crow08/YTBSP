import SubListComponent from "./SubListComponent";
import Component from "./Component";
import * as ComponentUtils from "./ComponentUtils";
import PageService from "../Services/PageService";
import $ from "jquery";
import playerService from "../Services/PlayerService";

export default class YTBSPComponent extends Component {
    subList: SubListComponent;
    private loader: ComponentUtils.Loader;
    private toggleSlider: ComponentUtils.Slider;
    private isNative = false;
    private toggleGuide = false;

    constructor() {
        super($("<div/>", {"id": "YTBSP"}));
        this.loader = ComponentUtils.getLoader("ytbsp-main-loader");
        const fixedBar = $("<div/>", {"id": "ytbsp-fixedBar"});
        this.toggleSlider = ComponentUtils.getSlider("ytbsp-togglePage", this.isNative, () => this.toggleNative());
        fixedBar.append(this.toggleSlider.component);
        fixedBar.append($("<div/>", {"id": "ytbsp-loaderSpan"})
            .append(this.loader.component)
            .append($("<button/>", {"id": "ytbsp-refresh", "class": "ytbsp-func", "html": "&#x27F3;"})));
        this.component.append(fixedBar);
        this.subList = new SubListComponent();
        this.component.append(this.subList.component);

        PageService.addPageChangeListener(() => this.updateLocation());
        PageService.addDocumentReadyListener(() => {
            this.updateLocation();
            this.setTheme(PageService.isDarkModeEnabled());
        });

        PageService.addToggleFullscreenListener((isFullscreen) => {
            if (isFullscreen) {
                this.component.hide();
            } else {
                this.component.show();
            }
        });
    }

    setTheme(isDarkModeEnabled: boolean): void {
        this.component.removeClass(["ytbsp-dark-theme", "ytbsp-light-theme"]);
        const themeClass = isDarkModeEnabled ? "ytbsp-dark-theme" : "ytbsp-light-theme";
        this.component.addClass(themeClass);
    }

    toggleNative(): void {
        this.isNative ? this.hideNative() : this.showNative();
        playerService.togglePictureInPicturePlayer(!this.isNative);
    }

    showNative(): void {
        PageService.showNative();
        this.subList.component.hide();
        this.isNative = true;
        this.toggleSlider.setValue(this.isNative);
        if (this.toggleGuide) {
            PageService.toggleGuide();
        }
    }

    hideNative(): void {
        PageService.hideNative();
        this.subList.component.show();
        this.isNative = false;
        this.toggleSlider.setValue(this.isNative);
        if (this.toggleGuide) {
            PageService.toggleGuide();
        }
    }

    updateLocation(): void {
        const path = document.location.pathname;
        this.toggleGuide = false;
        if (1 < path.length) {
            this.showNative();
            if ((/^\/?watch$/u).test(path)) {
                this.toggleGuide = true;
            }
        } else {
            this.hideNative();
        }
    }
}
