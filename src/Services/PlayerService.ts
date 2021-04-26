import $ from "jquery";
import configService from "./ConfigService";
import pageService from "./PageService";

// eslint-disable-next-line @typescript-eslint/unbound-method
const defaultPlay: (() => Promise<void>) = HTMLMediaElement.prototype.play; // Save default play function before replacing it.
let autoPauseThisVideo: boolean;

interface YTHotKeyManager {
    toggleMiniplayer_: () => void;
    isMiniplayerActive_: () => boolean;
}

const modifiedPlay = function(target: Element): Promise<void> {
    // Need JQuery to be loaded.
    if (!pageService.isDocumentReady) {
        return;
    }
    // Prevent the first call to play this video and act normally afterwards.
    if (autoPauseThisVideo) {
        const playerParentRef = target.parentElement.parentElement as unknown as { pauseVideo: () => void, getVideoUrl: () => string };
        if (playerParentRef) {
            autoPauseThisVideo = false;
            playerParentRef.pauseVideo();
            console.log(`prevented playback for: ${playerParentRef.getVideoUrl()}`);
        }
        return;
    }
    // Resume default behavior.
    defaultPlay.call(target);
};

class PlayerService {
    constructor() {
        // Override play Function to prevent player from automatically starting the video after loading video page.
        HTMLMediaElement.prototype.play = function() {
            return modifiedPlay(this);
        };

        this.resetAutoplay();
        pageService.addPageChangeListener(() => this.resetAutoplay());
    }

    togglePictureInPicturePlayer(on: boolean) {
        const manager =pageService.getHotkeyManager[0] as unknown as YTHotKeyManager;
        if(manager.isMiniplayerActive_() !== on) {
            manager.toggleMiniplayer_();
        }
    }

    private resetAutoplay() {
        if ((/.*watch\?.+list=.+/u).test(document.location.pathname)) {
            autoPauseThisVideo = false;
        } else {
            autoPauseThisVideo = configService.getConfig().autoPauseVideo;
        }
    }
}

const playerService = new PlayerService();
export default playerService;
