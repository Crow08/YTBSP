import Configuration, { Resolutions } from "../Model/Configuration";
import SubscriptionDTO from "../Model/SubscriptionDTO";
import Timeout = NodeJS.Timeout;

const stringToResolution = (value: string): Resolutions | undefined =>
    Resolutions[Object.keys(Resolutions).filter((k) => Resolutions[k as keyof typeof Resolutions].toString() === value)[0] as keyof typeof Resolutions];

let saveVideoTimeout: Timeout;
let saveConfigTimeout: Timeout;
const debounceInterval = 2000;
const debounceVideoSave = (func: () => void): void => {
    const later = function() {
        saveVideoTimeout = null;
        func();
    };
    clearTimeout(saveVideoTimeout);
    saveVideoTimeout = setTimeout(later, debounceInterval);
};

const debounceConfigSave = (func: () => void): void => {
    const later = function() {
        saveConfigTimeout = null;
        func();
    };
    clearTimeout(saveConfigTimeout);
    saveConfigTimeout = setTimeout(later, debounceInterval);
};

class PersistenceService {
    private videoSaveQueued = false;
    private configSaveQueued = false;
    private pendingVideoSave: (() => void) | null = null;

    private onSaveCallbackList: ((state: "start" | "end") => void)[] = [];

    constructor() {
        // The debounced save loses up to 2s of changes on a full page unload,
        // so flush pending writes when the page goes to the background.
        window.addEventListener("beforeunload", () => this.flushPendingVideoSave());
        document.addEventListener("visibilitychange", () => {
            if ("hidden" === document.visibilityState) {
                this.flushPendingVideoSave();
            }
        });
    }

    private static applyResolutionPropertyFromLocalStorage(config: Configuration, key: string): void {
        const property = localStorage.getItem(`YTBSP_${key}`);
        if (property !== null) {
            const resolution = stringToResolution(property);
            if ("undefined" !== typeof resolution) {
                config[key] = resolution;
            }
        }
    }

    private static applyNumberPropertyFromLocalStorage(config: Configuration, key: string): void {
        const property = localStorage.getItem(`YTBSP_${key}`);
        if (property !== null) {
            const number = Number(property);
            if (!isNaN(number)) {
                config[key] = Number(property);
            }
        }
    }

    private static applyBooleanPropertyFromLocalStorage(config: Configuration, key: string): void {
        const property = localStorage.getItem(`YTBSP_${key}`);
        if (property !== null) {
            config[key] = "1" === property;
        }
    }

    private static applyObjectPropertyFromLocalStorage(config: Configuration, key: string) {
        const property = localStorage.getItem(`YTBSP_${key}`);
        if (property !== null) {
            config[key] = JSON.parse(property) as unknown;
        }
    }

    public loadConfig(): Promise<Configuration> {
        return this.loadLocalConfig();
    }

    public saveConfig(config: Configuration): void {
        if (!this.configSaveQueued) {
            this.configSaveQueued = true;
        }

        debounceConfigSave((): void => {
            console.log("SAVE Config");
            this.configSaveQueued = false;
            this.saveLocalConfig(config)
                .catch(console.error);
        });
    }

    public loadVideoInfo(): Promise<SubscriptionDTO[]> {
        return this.loadLocalVideoInfo();
    }

    // Takes a supplier so the (potentially large) serialization only runs
    // once per debounce interval instead of on every data mutation.
    public saveVideoInfo(getSubs: () => string): void {

        if (!this.videoSaveQueued) {
            this.videoSaveQueued = true;
            this.onNotifySave("start");
        }

        this.pendingVideoSave = (): void => {
            console.log("SAVE");
            this.pendingVideoSave = null;
            this.videoSaveQueued = false;
            this.saveLocalVideoInfo(getSubs())
                .then(() => this.onNotifySave("end"))
                .catch((error) => {
                    console.error(error);
                    this.onNotifySave("end");
                });
        };
        debounceVideoSave((): void => this.pendingVideoSave?.());
    }

    public flushPendingVideoSave(): void {
        if (null === this.pendingVideoSave) {
            return;
        }
        clearTimeout(saveVideoTimeout);
        saveVideoTimeout = null;
        this.pendingVideoSave();
    }

    /**
     * Synchronously reads the currently stored video cache.
     */
    public loadVideoInfoSync(): SubscriptionDTO[] | null {
        const rawData = localStorage.getItem("YTBSP_VideoInfo");
        if (null === rawData || "" === rawData) {
            return [];
        }
        let subs: unknown;
        try {
            subs = JSON.parse(rawData);
        } catch {
            return null;
        }
        return Array.isArray(subs) ? subs as SubscriptionDTO[] : null;
    }

    addSaveListener(callback: (state: "start" | "end") => void): void {
        this.onSaveCallbackList.push(callback);
    }

    deleteUserData(): Promise<void> {
        return new Promise((resolve) => {
            localStorage.removeItem("YTBSP_VideoInfo");
            localStorage.removeItem("YTBSP_hideSeenVideos");
            localStorage.removeItem("YTBSP_hideOlderVideos");
            localStorage.removeItem("YTBSP_hideEmptySubs");
            localStorage.removeItem("YTBSP_maxSimSubLoad");
            localStorage.removeItem("YTBSP_maxVideosPerRow");
            localStorage.removeItem("YTBSP_maxVideosPerSub");
            localStorage.removeItem("YTBSP_enlargeDelay");
            localStorage.removeItem("YTBSP_enlargeFactor");
            localStorage.removeItem("YTBSP_hoverPreview");
            localStorage.removeItem("YTBSP_previewDelay");
            localStorage.removeItem("YTBSP_enlargeFactorNative");
            localStorage.removeItem("YTBSP_playerQuality");
            localStorage.removeItem("YTBSP_timeToMarkAsSeen");
            localStorage.removeItem("YTBSP_screenThreshold");
            localStorage.removeItem("YTBSP_videoDecomposeTime");
            localStorage.removeItem("YTBSP_autoPauseVideo");
            localStorage.removeItem("YTBSP_hideShorts");
            resolve();
        });
    }

    private loadLocalConfig(): Promise<Configuration> {
        return new Promise(((resolve) => {
            const config = new Configuration();
            PersistenceService.applyBooleanPropertyFromLocalStorage(config, "hideSeenVideos");
            PersistenceService.applyBooleanPropertyFromLocalStorage(config, "hideOlderVideos");
            PersistenceService.applyBooleanPropertyFromLocalStorage(config, "hideEmptySubs");
            PersistenceService.applyNumberPropertyFromLocalStorage(config, "maxSimSubLoad");
            PersistenceService.applyNumberPropertyFromLocalStorage(config, "maxVideosPerRow");
            PersistenceService.applyNumberPropertyFromLocalStorage(config, "maxVideosPerSub");
            PersistenceService.applyNumberPropertyFromLocalStorage(config, "enlargeDelay");
            PersistenceService.applyNumberPropertyFromLocalStorage(config, "enlargeFactor");
            PersistenceService.applyBooleanPropertyFromLocalStorage(config, "hoverPreview");
            PersistenceService.applyNumberPropertyFromLocalStorage(config, "previewDelay");
            PersistenceService.applyNumberPropertyFromLocalStorage(config, "enlargeFactorNative");
            PersistenceService.applyResolutionPropertyFromLocalStorage(config, "playerQuality");
            PersistenceService.applyNumberPropertyFromLocalStorage(config, "timeToMarkAsSeen");
            PersistenceService.applyNumberPropertyFromLocalStorage(config, "screenThreshold");
            PersistenceService.applyBooleanPropertyFromLocalStorage(config, "autoPauseVideo");
            PersistenceService.applyObjectPropertyFromLocalStorage(config, "hideShorts");
            PersistenceService.applyNumberPropertyFromLocalStorage(config, "videoDecomposeTime");
            resolve(config);

        }));
    }

    private saveLocalConfig(config: Configuration): Promise<void> {
        return new Promise(((resolve) => {
            localStorage.setItem("YTBSP_hideSeenVideos", config.hideSeenVideos ? "1" : "0");
            localStorage.setItem("YTBSP_hideOlderVideos", config.hideOlderVideos ? "1" : "0");
            localStorage.setItem("YTBSP_hideEmptySubs", config.hideEmptySubs ? "1" : "0");
            localStorage.setItem("YTBSP_maxSimSubLoad", config.maxSimSubLoad.toString());
            localStorage.setItem("YTBSP_maxVideosPerRow", config.maxVideosPerRow.toString());
            localStorage.setItem("YTBSP_maxVideosPerSub", config.maxVideosPerSub.toString());
            localStorage.setItem("YTBSP_enlargeDelay", config.enlargeDelay.toString());
            localStorage.setItem("YTBSP_enlargeFactor", config.enlargeFactor.toString());
            localStorage.setItem("YTBSP_hoverPreview", config.hoverPreview ? "1" : "0");
            localStorage.setItem("YTBSP_previewDelay", config.previewDelay.toString());
            localStorage.setItem("YTBSP_enlargeFactorNative", config.enlargeFactorNative.toString());
            localStorage.setItem("YTBSP_playerQuality", config.playerQuality.toString());
            localStorage.setItem("YTBSP_timeToMarkAsSeen", config.timeToMarkAsSeen.toString());
            localStorage.setItem("YTBSP_screenThreshold", config.screenThreshold.toString());
            localStorage.setItem("YTBSP_videoDecomposeTime", config.videoDecomposeTime.toString());
            localStorage.setItem("YTBSP_autoPauseVideo", config.autoPauseVideo ? "1" : "0");
            localStorage.setItem("YTBSP_hideShorts", JSON.stringify(config.hideShorts));
            resolve();
        }));
    }

    private loadLocalVideoInfo(): Promise<SubscriptionDTO[]> {
        return new Promise(((resolve) => {
            const subs = this.loadVideoInfoSync();
            if (null === subs) {
                console.error("Error parsing video cache!");
                resolve([]);
                return;
            }
            resolve(subs);
        }));
    }

    private saveLocalVideoInfo(subs: string): Promise<void> {
        return new Promise(((resolve) => {
            localStorage.setItem("YTBSP_VideoInfo", subs);
            resolve();
        }));
    }

    private onNotifySave(state: "start" | "end"): void {
        this.onSaveCallbackList.forEach(callback => {
            callback(state);
        });
    }
}

const persistenceService = new PersistenceService();
export default persistenceService;
