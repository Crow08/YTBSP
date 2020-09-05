import $ from "jquery";
import PageService from "../Services/PageService";
import persistenceService from "../Services/PersistenceService";
import playerService from "../Services/PlayerService";
import Component from "./Component";
import * as ComponentUtils from "./ComponentUtils";
import SubListComponent from "./SubListComponent";

export default class YTBSPComponent extends Component {
    private subList: SubListComponent;
    private loader: ComponentUtils.Loader;
    private refresh: JQuery;
    private toggleSlider: ComponentUtils.Slider;
    private isNative = false;
    private toggleGuide = false;

    constructor() {
        super($("<div/>", {"id": "YTBSP"}));
        this.loader = ComponentUtils.getLoader("ytbsp-main-loader");
        this.refresh = $("<button/>", {"id": "ytbsp-refresh", "class": "ytbsp-func", "html": "&#x27F3;"});
        this.refresh.click(() => {
            this.toggleLoaderRefresh(true);
            this.subList.updateAllSubs();
        });
        const fixedBar = $("<div/>", {"id": "ytbsp-fixedBar"});
        this.toggleSlider = ComponentUtils.getSlider("ytbsp-togglePage", this.isNative, () => this.toggleNative());
        fixedBar.append(this.toggleSlider.component);
        fixedBar.append($("<div/>", {"id": "ytbsp-loaderSpan"})
            .append(this.loader.component)
            .append(this.refresh));
        this.component.append(fixedBar);

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

        persistenceService.addSaveListener((state) => this.toggleLoaderRefresh(state === "start"));
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

    startLoading(): void {
        this.subList = new SubListComponent();
        this.component.append(this.subList.component);
    }

    private updateLocation(): void {
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

    private toggleLoaderRefresh(loading: boolean) {
        if (loading) {
            this.loader.component.show();
            this.refresh.hide();
        } else {
            this.loader.component.hide();
            this.refresh.show();
        }
    }
}
