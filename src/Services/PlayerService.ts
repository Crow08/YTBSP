import { Resolutions } from "../Model/Configuration";
import configService from "./ConfigService";
import pageService from "./PageService";

const defaultPlay: (() => Promise<void>) = HTMLMediaElement.prototype.play; // Save default play function before replacing it.
let autoPauseThisVideo: boolean;
let qualityApplied = false;

interface YTHotKeyManager {
    toggleMiniplayer: () => void;
    isMiniplayerActive: () => boolean;
}

interface YTPlayer {
    setPlaybackQualityRange: (min: string, max: string) => void;
    getAvailableQualityLevels: () => string[];
}

// Set the preferred player quality on the main player (once per navigation).
// Runs when playback starts, at which point the player API and the available
// quality levels for the video are guaranteed to be loaded.
const applyPreferredQuality = function(target: Element): void {
    if (qualityApplied) {
        return;
    }
    // Restrict to the main player so inline preview players don't consume the flag.
    const player = target.closest("#movie_player") as unknown as YTPlayer;
    if (!player || "function" !== typeof player.setPlaybackQualityRange) {
        return;
    }
    let quality: string = configService.getConfig().playerQuality;
    if ("function" === typeof player.getAvailableQualityLevels) {
        const available = player.getAvailableQualityLevels();
        if (0 < available.length && !available.includes(quality)) {
            // Preferred quality not offered: fall back to the next lower one available.
            const ordered = Object.values(Resolutions) as string[];
            const lower = ordered.slice(ordered.indexOf(quality) + 1).find((level) => available.includes(level));
            quality = lower ? lower : available[0];
        }
    }
    player.setPlaybackQualityRange(quality, quality);
    qualityApplied = true;
};

const modifiedPlay = function(target: Element): Promise<void> {
    // Need JQuery to be loaded.
    if (!pageService.isDocumentReady) {
        return;
    }
    applyPreferredQuality(target);
    // Prevent the first call to play this video and act normally afterwards.
    if (autoPauseThisVideo) {
        const playerParentRef = target.parentElement.parentElement as unknown as {
            pauseVideo: () => void,
            getVideoUrl: () => string
        };
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
        pageService.addPageChangeListener(() => {
            this.resetAutoplay();
            qualityApplied = false;
        });
        // Re-apply on the current video when the quality setting is changed.
        let configuredQuality = configService.getConfig().playerQuality;
        configService.addChangeListener((config) => {
            if (config.playerQuality === configuredQuality) {
                return;
            }
            configuredQuality = config.playerQuality;
            qualityApplied = false;
            const video = document.querySelector("#movie_player video");
            if (video) {
                applyPreferredQuality(video);
            }
        });
    }

    togglePictureInPicturePlayer(on: boolean) {
        const manager = pageService.getHotkeyManager()[0] as unknown as YTHotKeyManager;
        if (manager.isMiniplayerActive() !== on) {
            manager.toggleMiniplayer();
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
