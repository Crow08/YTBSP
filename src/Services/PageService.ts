import $ from "jquery";
import YTBSPComponent from "../Components/YTBSPComponent";
import "../Less/ytbsp-stylesheet.less";
import configService from "./ConfigService";
import Timeout = NodeJS.Timeout;

// YouTube selectors:
const YT_APP = "ytd-app";
const YT_HOTKEY_MANAGER = "ytd-app > yt-hotkey-manager";
const YT_HOMEPAGE_SKELETON = "#home-page-skeleton";
//const YT_NAVIGATION_MANAGER = "ytd-app > ytd-navigation-manager";
const YT_START_PAGE_BODY = "#page-manager.ytd-app, #page-manager.ytd-app.style-scope";
const YT_PLAYLIST_SIDEBAR = "ytd-playlist-sidebar-renderer";
//const YT_VIDEO_TITLE = "#info-contents > ytd-video-primary-info-renderer > div:last-child";
const YT_CHANNEL_LINK = "#top-row > ytd-video-owner-renderer > #upload-info > #channel-name > #container > #text-container > #text > a";
const YT_CHANNEL_LINK_ALT = "#movie_player > div.ytp-ce-element.ytp-ce-channel.ytp-ce-channel-this.ytp-ce-bottom-right-quad.ytp-ce-size-640 > div.ytp-ce-expanding-overlay > div.ytp-ce-expanding-overlay-content > div > div > a";
const YT_HEADER_TRANSPARENCY = "#frosted-glass.with-chipbar.ytd-app.style-scope";
const YT_SIDEBAR_COLLAPSED = "ytd-mini-guide-renderer.ytd-app";
const YT_SIDEBAR = "ytd-app[frosted-glass-exp] tp-yt-app-drawer.ytd-app[persistent]";
const YT_CONTENT = "#content";
const YT_GUIDE = "#guide";
//const YT_PLAYER = "#movie_player > div.html5-video-container > video";
//const YT_VIDEO_STREAM = ".video-stream";

// Style rules depending on the loaded native page.
const bodyStyleLoading = `${YT_START_PAGE_BODY} { background: transparent; display:none; }`;
const bodyStyleStartPage = `${YT_START_PAGE_BODY} { margin-top: 0px; background: transparent; }
    ${YT_GUIDE} { z-index: 3000 !important; }
    ${YT_HEADER_TRANSPARENCY} { z-index: 2000; }
    ${YT_SIDEBAR}, ${YT_SIDEBAR_COLLAPSED} { top: calc(var(--ytd-masthead-height, var(--ytd-toolbar-height)) + 22px); }`;
const bodyStyleVideo = `${YT_START_PAGE_BODY} { background: transparent; margin-top: 0px; }
    ${YT_GUIDE} { z-index: 3000 !important; width: var(--app-drawer-width, 256px); }`;
const bodyStyleSearch = `${YT_START_PAGE_BODY} { background: transparent; margin-top: -20px; }
    ${YT_GUIDE} { z-index: 3000; !important;}`;
const bodyStyleDefault = `${YT_START_PAGE_BODY} { background: transparent; margin-top: -30px;}
    ${YT_GUIDE} { z-index: 3000; !important;}`;
const bodyStylePlaylist = `${YT_START_PAGE_BODY} { background: transparent; margin-top: -60px; }
    ${YT_GUIDE} { z-index: 3000; !important;}
    ${YT_START_PAGE_BODY} ${YT_PLAYLIST_SIDEBAR} {padding-top: 54px;}`;

export enum PageState {
    DEFAULT, LOADING, START_PAGE, VIDEO, SEARCH, PLAYLIST
}

const getStyleRulesForPageState = (pageState: PageState): string => {
    switch (pageState) {
    case PageState.LOADING:
        return bodyStyleLoading;
    case PageState.START_PAGE:
        return bodyStyleStartPage;
    case PageState.VIDEO:
        return bodyStyleVideo;
    case PageState.SEARCH:
        return bodyStyleSearch;
    case PageState.PLAYLIST:
        return bodyStylePlaylist;
    default:
        return bodyStyleDefault;
    }
};

const getPageState = (): PageState => {
    if ((/^(\/?|((\/feed\/)(trending|subscriptions|history)\/?))?$/iu).test(location.pathname)) {
        return PageState.START_PAGE;
    } else if ((/^\/?watch$/u).test(location.pathname)) {
        return PageState.VIDEO;
    } else if ((/^\/?results$/u).test(location.pathname)) {
        return PageState.SEARCH;
    } else if ((/^\/?playlist$/u).test(location.pathname)) {
        return PageState.PLAYLIST;
    } else {
        return PageState.DEFAULT;
    }
};
interface YTApp {
    fire: (key: string, data: {
        endpoint?: {
            "commandMetadata": {
                "webCommandMetadata": {
                    "url": string,
                    "webPageType": string,
                    "rootVe": number
                }
            },
            watchEndpoint: {
                videoId: string
            }
        }
    } | {
        args: (Element | {
            commandMetadata: { webCommandMetadata: { url: string, sendPost: boolean } },
            signalServiceEndpoint: {
                signal: string,
                actions:
                    {
                        addToPlaylistCommand: {
                            openMiniplayer: boolean,
                            videoId: string,
                            listType: string,
                            onCreateListCommand: {
                                commandMetadata: {
                                    webCommandMetadata: {
                                        url: string,
                                        sendPost: boolean,
                                        apiUrl: string
                                    }
                                },
                                createPlaylistServiceEndpoint: {
                                    videoIds: string[],
                                    params: string
                                }
                            },
                            videoIds: string[]
                        }
                    }[]
            }
        })[],
        actionName: string,
        disableBroadcast: boolean,
        optionalAction: boolean,
        returnValue: any[]
    }) => void;
}

class PageService {

    isDocumentReady = false;
    navigateInterval: Timeout = null;
    private oldHref: string;
    private isFullscreen: boolean;
    private onPageChangeCallbackList: (() => void)[] = [];
    private onToggleFullscreenCallbackList: ((isFullscreen: boolean) => void)[] = [];
    private onDocumentReadyCallbackList: (() => void)[] = [];
    private inViewObserver: IntersectionObserver = null;
    private inViewCallbacks: Map<Element, () => void> = new Map();

    constructor() {
        this.oldHref = document.location.href;

        $(document).ready(() => {
            this.isDocumentReady = true;
            this.onDocumentReadyCallbackList.forEach(callback => {
                callback();
            });
            this.onDocumentReadyCallbackList = [];
            this.installDummyPopup();
        });
    }

    startPageObserver() {
        // YouTube fires yt-navigate-finish after every SPA navigation; together with
        // popstate this covers all URL changes without observing DOM mutations.
        window.addEventListener("yt-navigate-finish", () => this.handlePageChange());
        window.addEventListener("popstate", () => this.handlePageChange());
        document.addEventListener("fullscreenchange", () => this.handleFullscreenChange());
    }

    injectYTBSP(ytbsp: YTBSPComponent) {
        $(YT_CONTENT).prepend(ytbsp.component);
    }

    addPageChangeListener(callback: () => void): void {
        this.onPageChangeCallbackList.push(callback);
    }

    addToggleFullscreenListener(callback: (isFullscreen: boolean) => void): void {
        this.onToggleFullscreenCallbackList.push(callback);
    }

    addDocumentReadyListener(callback: () => void): void {
        if (this.isDocumentReady) {
            callback();
        } else {
            this.onDocumentReadyCallbackList.push(callback);
        }
    }

    /**
     * Calls onVisible whenever the element enters the viewport
     * (or comes within screenThreshold pixels of it).
     * Used for lazy-loading without scroll listeners and forced layouts.
     */
    observeInView(element: Element, onVisible: () => void): void {
        this.inViewCallbacks.set(element, onVisible);
        this.getInViewObserver().observe(element);
    }

    unobserveInView(element: Element): void {
        if (this.inViewObserver) {
            this.inViewObserver.unobserve(element);
        }
        this.inViewCallbacks.delete(element);
    }

    updateNativeStyleRuleModifications(state?: PageState) {
        $("#ytbsp-yt-css").remove();
        const css = document.createElement("style");
        css.id = "ytbsp-yt-css";
        document.head.appendChild(css);
        $("#ytbsp-yt-css").html(getStyleRulesForPageState(state ? state : getPageState()));
    }

    updateHideNativeStyle(hideNative: boolean) {
        $("#ytbsp-hideNative-css").remove();
        if (hideNative) {
            const css = document.createElement("style");
            css.id = "ytbsp-hideNative-css";
            document.head.appendChild(css);
            $("#ytbsp-hideNative-css").html(YT_START_PAGE_BODY + "{display: none!important;}" + YT_HOMEPAGE_SKELETON + "{display: none!important;}");
        }
        // TODO: Workaround: After a switch back to the native page thumbnails won't load.
        setTimeout(() => {
            window.dispatchEvent(new Event("resize"));
        }, 200);
    }

    addThumbnailEnlargeCss() {
        const enlargeFactorNative = configService.getConfig().enlargeFactorNative;
        if (1 >= enlargeFactorNative) {
            return;
        }
        const altBorderColor = this.isDarkModeEnabled() ? "#737373" : "#737373";
        const enlargeDelay = configService.getConfig().enlargeDelay;
        $("#ytbsp-css-thumb").remove();
        const css = document.createElement("style");
        css.id = "ytbsp-css-thumb";
        document.head.appendChild(css);
        $("#ytbsp-css-thumb").html(
            `ytd-thumbnail.ytd-grid-video-renderer:hover,
            ytd-thumbnail.ytd-compact-video-renderer:hover {
            transform: scale(${enlargeFactorNative});
            border: solid ${enlargeFactorNative / 2.0}px ${altBorderColor};
            padding: 0px; z-index: 2;
            transition-delay: ${enlargeDelay}ms;
        }
        ytd-thumbnail { padding: ${enlargeFactorNative / 2.0}px }
        #video-title { width: 200px; }
        #scroll-container.yt-horizontal-list-renderer { overflow: visible; }`);
    }

    isDarkModeEnabled(): boolean {
        const color = getComputedStyle(document.documentElement).backgroundColor.match(/\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/ug);
        const dark = document.documentElement.getAttribute("dark");
        return dark !== null || (color && 384 > (parseInt(color[1], 10) + parseInt(color[2], 10) + parseInt(color[3], 10)));
    }

    showNative(): void {
        this.updateHideNativeStyle(false);
    }

    hideNative(): void {
        this.updateHideNativeStyle(true);
    }

    toggleGuide(): void {
        const ytdApp = document.querySelector(YT_APP) as unknown as YTApp;
        ytdApp["fire"]("yt-guide-toggle", {});
        // Workaround: After opening guide sidebar scroll information gets lost.
        setTimeout(() => {
            $("body").attr("style", "overflow: auto");
        }, 200);
    }

    addToQueue(id: string): void {
        const ytdApp = document.querySelector(YT_APP) as unknown as YTApp;
        const queueEventArg = {
            "commandMetadata": {"webCommandMetadata": {"url": "/service_ajax", "sendPost": true}},
            "signalServiceEndpoint": {
                "signal": "CLIENT_SIGNAL",
                "actions": [
                    {
                        "addToPlaylistCommand": {
                            "openMiniplayer": true,
                            "videoId": id,
                            "listType": "PLAYLIST_EDIT_LIST_TYPE_QUEUE",
                            "onCreateListCommand": {
                                "commandMetadata": {
                                    "webCommandMetadata": {
                                        "url": "/service_ajax",
                                        "sendPost": true,
                                        "apiUrl": "/youtubei/v1/playlist/create"
                                    }
                                },
                                "createPlaylistServiceEndpoint": {
                                    "videoIds": [id],
                                    "params": "CAQ%3D"
                                }
                            },
                            "videoIds": [id]
                        }
                    }
                ]
            }
        };
        const QueueEventRequest = {
            args: [document.querySelector("ytd-menu-service-item-renderer.style-scope.ytd-menu-popup-renderer"), queueEventArg],
            actionName: "yt-service-request",
            disableBroadcast: false,
            optionalAction: false,
            returnValue: []
        };
        ytdApp["fire"]("yt-action", QueueEventRequest);
    }

    navigateToVideo(id: string): void {
        const endpointData = {
            "commandMetadata": {
                "webCommandMetadata": {
                    "url": `/watch?v=${id}`,
                    "webPageType": "WEB_PAGE_TYPE_WATCH",
                    "rootVe": 3832
                }
            },
            "watchEndpoint": {
                "videoId": id,
                "nofollow": true
            }
        };

        // TODO: retry is a workaround for navigation where only the player updates and the pages
        //       stays on another videos information.
        const tryNavigate = () => {
            const videoIdRegex = /v=([^&]{11})/u.exec(location.href);
            const videoId = videoIdRegex ? videoIdRegex[1] : null;
            if (videoId != id) {
                $(YT_APP)[0]["handleNavigate"]({
                    "command": endpointData,
                    "type": 0
                });
            } else {
                if (this.navigateInterval) {
                    clearInterval(this.navigateInterval);
                    this.navigateInterval = null;
                }
            }
        };
        if (this.navigateInterval) {
            clearInterval(this.navigateInterval);
        }
        this.navigateInterval = setInterval(tryNavigate, 500);
    }

    getHotkeyManager(): JQuery {
        return $(YT_HOTKEY_MANAGER);
    }

    getChannelId(): string | undefined {
        let channelId = this.getChannelIdFromLink(YT_CHANNEL_LINK);
        if (channelId == undefined) {
            channelId = this.getChannelIdFromLink(YT_CHANNEL_LINK_ALT);
        }
        return channelId;
    }

    /**
     * Installs a YouTube class popup HML element to use as a dummy reference when
     * executing events on the YouTube App class (#YT_APP)
     */
    private installDummyPopup() {
        const dummyContainer = document.createElement("div");
        dummyContainer.style.display = "none";
        dummyContainer.id = "ytbsp-popup-menu-dummy";
        document.body.appendChild(dummyContainer);
        $("#ytbsp-popup-menu-dummy").html(`<ytd-menu-service-item-renderer class="style-scope ytd-menu-popup-renderer" role="menuitem" use-icons="" tabindex="-1" aria-selected="false">
            <paper-item class="style-scope ytd-menu-service-item-renderer" role="option" tabindex="0" aria-disabled="false">
            </ytd-menu-service-item-renderer>`);
    }

    private getChannelIdFromLink(elementSelector): string | undefined {
        if (0 !== $(elementSelector).length) {
            const result = /\/channel\/([^&]*)/u.exec($(elementSelector).attr("href"));
            return result != null ? result[1] : undefined;
        }
        return undefined;
    }

    // Created lazily so the screenThreshold config is loaded by the time it is needed.
    private getInViewObserver(): IntersectionObserver {
        if (!this.inViewObserver) {
            this.inViewObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const callback = this.inViewCallbacks.get(entry.target);
                        if (callback) {
                            callback();
                        }
                    }
                });
            }, {"rootMargin": `${configService.getConfig().screenThreshold}px 0px`});
        }
        return this.inViewObserver;
    }

    private handlePageChange() {
        const currentHref = document.location.href;
        if (this.oldHref !== currentHref) {
            this.oldHref = currentHref;
            this.onPageChangeCallbackList.forEach(callback => {
                callback();
            });
        }
    }

    private handleFullscreenChange() {
        const isFullscreenNow = null !== document.fullscreenElement;
        if (isFullscreenNow !== this.isFullscreen) {
            this.isFullscreen = isFullscreenNow;
            this.onToggleFullscreenCallbackList.forEach(callback => {
                callback(this.isFullscreen);
            });
        }
    }
}

const pageService = new PageService();
export default pageService;
