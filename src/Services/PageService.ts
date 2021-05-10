import $ from "jquery";
import YTBSPComponent from "../Components/YTBSPComponent";
import "../Less/ytbsp-stylesheet.less";
import configService from "./ConfigService";
import Timeout = NodeJS.Timeout;

// YouTube selectors:
const YT_APP = "ytd-app";
const YT_HOTKEY_MANAGER = "ytd-app > yt-hotkey-manager";
const YT_NAVIGATION_MANAGER = "ytd-app > yt-navigation-manager";
const YT_START_PAGE_BODY = "#page-manager.ytd-app, #page-manager.ytd-app.style-scope";
const YT_PLAYLIST_SIDEBAR = "ytd-playlist-sidebar-renderer";
const YT_VIDEO_TITLE = "#info-contents > ytd-video-primary-info-renderer > div:last-child";
const YT_CHANNEL_LINK = "#top-row > ytd-video-owner-renderer > #upload-info > #channel-name > #container > #text-container > #text > a";

const YT_CONTENT = "#content";
const YT_GUIDE = "#guide";
const YT_PLAYER_QUALITY = "yt-player-quality";
const YT_PLAYER = "#movie_player > div.html5-video-container > video";
const YT_PLAYER_CONTROL = "#page-manager > ytd-watch-flexy";
const YT_VIDEO_STREAM = ".video-stream";
const YT_FEED_FILTER = "#chips > ytd-feed-filter-chip-bar-renderer";

// Style rules depending on the loaded native page.
const bodyStyleLoading = `${YT_START_PAGE_BODY} { background: transparent; display:none; }`;
const bodyStyleStartPage = `${YT_START_PAGE_BODY} { margin-top: -10px; background: transparent; }
    ${YT_GUIDE} { z-index: 3 !important;}
    ${YT_FEED_FILTER} { top: 78px !important; }`;
const bodyStyleVideo = `${YT_START_PAGE_BODY} { background: transparent; margin-top: 0px; }
    ${YT_GUIDE} { z-index: 3 !important; width: var(--app-drawer-width, 256px); }`;
const bodyStyleSearch = `${YT_START_PAGE_BODY} { background: transparent; margin-top: -20px; }
    ${YT_GUIDE} { z-index: 3; !important;}`;
const bodyStyleDefault = `${YT_START_PAGE_BODY} { background: transparent; margin-top: -30px;}
    ${YT_GUIDE} { z-index: 3; !important;}`;
const bodyStylePlaylist = `${YT_START_PAGE_BODY} { background: transparent; margin-top: -60px; }
    ${YT_GUIDE} { z-index: 3; !important;}
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
const throttleDuration = 400;
const throttleTime = (func: () => void) => {
    let timeout: Timeout;
    let pendingFunc: () => void;
    return function() {
        if (timeout) {
            pendingFunc = func;
        }
        else {
            func.apply(this);
            pendingFunc = null;
            timeout = setTimeout(
                (): void => {
                    timeout = null;
                    if (pendingFunc) {
                        pendingFunc.apply(this);
                    }
                }, throttleDuration);
        }
    };
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
    } | { args: (Element|{
            commandMetadata:{webCommandMetadata:{url:string,sendPost:boolean}},
            signalServiceEndpoint:{
                signal:string,
                actions:
                    {
                        addToPlaylistCommand:{
                            openMiniplayer:boolean,
                            videoId: string,
                            listType:string,
                            onCreateListCommand:{
                                commandMetadata:{
                                    webCommandMetadata:{
                                        url:string,
                                        sendPost:boolean,
                                        apiUrl:string
                                    }
                                },
                                createPlaylistServiceEndpoint:{
                                    videoIds:string[],
                                    params: string
                                }
                            },
                            videoIds:string[]
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
    private observer: MutationObserver;
    private oldHref: string;
    private isFullscreen: boolean;
    private onPageChangeCallbackList: (() => void)[] = [];
    private onToggleFullscreenCallbackList: ((isFullscreen: boolean) => void)[] = [];
    private onDocumentReadyCallbackList: (() => void)[] = [];
    private onViewChangeCallbackList: (() => void)[] = [];

    constructor() {
        this.oldHref = document.location.href;
        // Setup page observer.
        this.observer = new MutationObserver(() => {
            // Detect page changes.
            const currentHref = document.location.href;
            if (this.oldHref !== currentHref) {
                this.oldHref = currentHref;
                this.onPageChangeCallbackList.forEach(callback => {
                    callback();
                });
            }
            // Detect going fullscreen.
            if (0 !== $(YT_PLAYER_CONTROL).length && true === $(YT_PLAYER_CONTROL).get(0)["fullscreen"]) {
                if (!this.isFullscreen) {
                    this.isFullscreen = true;
                    this.onToggleFullscreenCallbackList.forEach(callback => {
                        callback(true);
                    });
                }
            } else {
                if (this.isFullscreen) {
                    this.isFullscreen = false;
                    this.onToggleFullscreenCallbackList.forEach(callback => {
                        callback(false);
                    });
                }
            }
        });

        $(document).ready(() => {
            this.isDocumentReady = true;
            this.onDocumentReadyCallbackList.forEach(callback => {
                callback();
            });
            this.onDocumentReadyCallbackList = [];
            const newDiv = document.createElement("div");
            newDiv.style.display = "none";
            newDiv.innerHTML += (`<ytd-menu-service-item-renderer class="style-scope ytd-menu-popup-renderer" role="menuitem" use-icons="" tabindex="-1" aria-selected="false">
            <paper-item class="style-scope ytd-menu-service-item-renderer" role="option" tabindex="0" aria-disabled="false">
            </ytd-menu-service-item-renderer>`);
            document.body.appendChild(newDiv);
        });

        window.addEventListener("scroll", throttleTime(() => this.handleViewChange()), false);
        window.addEventListener("resize", throttleTime(() => this.handleViewChange()), false);
    }

    startPageObserver() {
        this.observer.observe(document.querySelector("body"), {"childList": true, "subtree": true});
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

    addViewChangeListener(callback: () => void): void {
        this.onViewChangeCallbackList.push(callback);
    }

    triggerViewChange() {
        throttleTime(() => this.handleViewChange());
    }

    updateNativeStyleRuleModifications(state?: PageState) {
        $("#ytbsp-yt-css").remove();
        const css = document.createElement("style");
        css.id = "ytbsp-yt-css";
        css.innerHTML = getStyleRulesForPageState(state ? state : getPageState());
        document.head.appendChild(css);
    }

    updateHideNativeStyle(hideNative: boolean) {
        $("#ytbsp-hideNative-css").remove();
        if (hideNative) {
            const css = document.createElement("style");
            css.id = "ytbsp-hideNative-css";
            css.innerHTML = YT_START_PAGE_BODY + "{display: none}";
            document.head.appendChild(css);
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
        css.innerHTML =
            `ytd-thumbnail.ytd-grid-video-renderer:hover,
            ytd-thumbnail.ytd-compact-video-renderer:hover {
            transform: scale(${enlargeFactorNative});
            border: solid ${enlargeFactorNative / 2.0}px ${altBorderColor};
            padding: 0px; z-index: 2;
            transition-delay: ${enlargeDelay}ms;
        }
        ytd-thumbnail { padding: ${enlargeFactorNative / 2.0}px }
        #video-title { width: 200px; }
        #scroll-container.yt-horizontal-list-renderer { overflow: visible; }`;
        document.head.appendChild(css);
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
            "commandMetadata":{"webCommandMetadata":{"url":"/service_ajax","sendPost":true}},
            "signalServiceEndpoint":{
                "signal":"CLIENT_SIGNAL",
                "actions":[
                    {
                        "addToPlaylistCommand":{
                            "openMiniplayer":true,
                            "videoId": id,
                            "listType":"PLAYLIST_EDIT_LIST_TYPE_QUEUE",
                            "onCreateListCommand":{
                                "commandMetadata":{
                                    "webCommandMetadata":{
                                        "url":"/service_ajax",
                                        "sendPost":true,
                                        "apiUrl":"/youtubei/v1/playlist/create"
                                    }
                                },
                                "createPlaylistServiceEndpoint":{
                                    "videoIds":[id],
                                    "params": "CAQ%3D"
                                }
                            },
                            "videoIds":[id]
                        }
                    }
                ]
            }
        };
        const QueueEventRequest = {
            args: [document.querySelector("ytd-menu-service-item-renderer.style-scope.ytd-menu-popup-renderer"),queueEventArg],
            actionName: "yt-service-request",
            disableBroadcast: false,
            optionalAction: false,
            returnValue: []
        };
        ytdApp["fire"]("yt-action", QueueEventRequest);
    }

    navigateToVideo(id: string): void {
        $(YT_NAVIGATION_MANAGER)[0]["navigate"]({
            "commandMetadata": {
                "webCommandMetadata": {
                    "url": `/watch?v=${id}`,
                    "webPageType": "WEB_PAGE_TYPE_WATCH",
                    "rootVe": 3832
                }
            },
            "watchEndpoint": {
                "videoId": id
            }
        }, false);
    }

    getHotkeyManager(): JQuery {
        return $(YT_HOTKEY_MANAGER);
    }

    getChannelId(): string | undefined {
        if (0 !== $(YT_CHANNEL_LINK).length) {
            return /\/channel\/([^&]*)/u.exec($(YT_CHANNEL_LINK).attr("href"))[1];
        }
        return undefined;
    }

    private handleViewChange = () => {
        this.onViewChangeCallbackList.forEach(callback => {
            callback();
        });
    };
}

const pageService = new PageService();
export default pageService;
