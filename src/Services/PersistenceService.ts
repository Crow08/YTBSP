import Configuration, { Resolutions } from "../Model/Configuration";
import SubscriptionDTO from "../Model/SubscriptionDTO";
import Timeout = NodeJS.Timeout;

const stringToResolution = (value: string): Resolutions | undefined =>
    Resolutions[Object.keys(Resolutions).filter((k) => Resolutions[k as keyof typeof Resolutions].toString() === value)[0] as keyof typeof Resolutions];

let saveTimeout: Timeout;
const debounceInterval = 1000;
const debounce = (func: () => void): void => {
    const later = function() {
        saveTimeout = null;
        func();
    };
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(later, debounceInterval);
};

class PersistenceService {
    private saveQueued = false;

    private onSaveCallbackList: ((state: "start" | "end") => void)[] = [];


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

    public saveConfing(config: Configuration): Promise<void> {
        return this.saveLocalConfig(config);
    }

    public loadVideoInfo(): Promise<SubscriptionDTO[]> {
        return this.loadLocalVideoInfo();
    }

    public saveVideoInfo(subs: string): void {

        if (!this.saveQueued) {
            this.saveQueued = true;
            this.onNotifySave("start");
        }

        debounce((): void => {
            console.log("SAVE");
            this.saveQueued = false;
            this.saveLocalVideoInfo(subs)
                .then(() => this.onNotifySave("end"))
                .catch((error) => {
                    console.error(error);
                    this.onNotifySave("end");
                });
        });
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
            localStorage.removeItem("YTBSP_enlargeFactorNative");
            localStorage.removeItem("YTBSP_playerQuality");
            localStorage.removeItem("YTBSP_timeToMarkAsSeen");
            localStorage.removeItem("YTBSP_screenThreshold");
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
        return new Promise(((resolve, reject) => {
            let subs = [];
            // Get data from localStorage;
            const rawData = localStorage.getItem("YTBSP_VideoInfo");
            // If we have a data parse it.
            if (null !== rawData && "" !== rawData) {
                try {
                    subs = JSON.parse(rawData) as unknown as SubscriptionDTO[];
                } catch (e) {
                    reject("Error parsing cache!");
                }
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
