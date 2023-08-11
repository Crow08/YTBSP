import Configuration, { Resolutions } from "../Model/Configuration";
import SubscriptionDTO from "../Model/SubscriptionDTO";
import configService from "./ConfigService";
import https from "https";
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

const SERVER_URL = "ytbsp-server.herokuapp.com"; //"localhost";

class PersistenceService {
    private saveQueued = false;

    private onSaveCallbackList: ((state: "start" | "end") => void)[] = [];

    private static serverId: number;

    constructor() {
        const id = localStorage.getItem("YTBSP-ServerId");
        if (!id) {
            this.getServerId();
        } else {
            PersistenceService.serverId = Number(id);
        }
    }

    // Build proper Server request.
    private static buildServerRequest = (path: string, params: { [key: string]: string } = {}, method = "GET", body = {}): Promise<any> => {
        const fullPath = `${path}?${PersistenceService.encodeQueryData({
            ...params,
            "id": PersistenceService.serverId
        })}`;
        const options = {
            hostname: SERVER_URL,
            path: fullPath,
            method: method
        };
        return new Promise<string> ((resolve, reject) => {
            let responseData = "";
            const req = https.request(options, res => {
                res.on("data", chunk => {
                    responseData += chunk;
                });
                res.on("end", () => {
                    resolve(JSON.parse(responseData));
                });
            });
            req.on("error", error => {
                console.error(error);
                reject(error);
            });
            if(method == "POST") {
                req.write(JSON.stringify(body));
            }
            req.end();
        });
    };

    private static encodeQueryData = (params: { id: number, [key: string]: string|number }) => {
        const ret = [];
        for (const para in params) {
            if (Object.prototype.hasOwnProperty.call(params, para)) {
                ret.push(`${encodeURIComponent(para)}=${encodeURIComponent(params[para])}`);
            }
        }
        return ret.join("&");
    };

    private getServerId = () => {
        const options = {
            hostname: SERVER_URL,
            path: "/authUrl",
            method: "GET"
        };
        const req = https.request(options, (result) => {
            let data = "";
            result.on("data", function (chunk) {
                data += chunk;
            });
            result.on("end", function () {
                const popup = window.open(data, "Auth", "width=600,height=400,status=yes,scrollbars=yes,resizable=yes");
                popup.focus();
                // Bind the event.
                const poll = () => {
                    setTimeout(() => {
                        if (!PersistenceService.serverId) {
                            popup.postMessage("id_poll", "https://" + SERVER_URL);
                            poll();
                        }
                    }, 1000);
                };
                poll();
                window.addEventListener("message", (event) => {
                    if ("https://www.youtube.com" !== event.origin && !isNaN(event.data)) {
                        PersistenceService.serverId = event.data as number;
                        localStorage.setItem("YTBSP-ServerId", PersistenceService.serverId.toString());
                        location.reload();
                    }
                }, false);
            });
        });
        req.on("error", error => {
            console.error(error);
        });
        req.end();
    };

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

    public loadConfig(remote: boolean): Promise<Configuration> {
        if (remote) {
            return this.loadRemoteConfig();
        }
        return this.loadLocalConfig();
    }

    public saveConfing(config: Configuration, remote?: boolean): Promise<void> {
        if ("undefined" === typeof remote) {
            remote = configService.getConfig().useRemoteData;
        }
        if (remote) {
            return this.saveRemoteConfig(config);
        }
        return this.saveLocalConfig(config);
    }

    public loadVideoInfo(remote?: boolean): Promise<SubscriptionDTO[]> {
        if ("undefined" === typeof remote) {
            remote = configService.getConfig().useRemoteData;
        }
        console.log("LOAD");
        if (remote) {
            return this.loadRemoteVideoInfo();
        }
        return this.loadLocalVideoInfo();
    }

    public saveVideoInfo(subs: string, remote?: boolean): void {
        if ("undefined" === typeof remote) {
            remote = configService.getConfig().useRemoteData;
        }
        if (!this.saveQueued) {
            this.saveQueued = true;
            this.onNotifySave("start");
        }

        debounce((): void => {
            console.log("SAVE");
            this.saveQueued = false;
            if (remote) {
                this.saveRemoteVideoInfo(subs)
                    .then(() => this.onNotifySave("end"))
                    .catch((error) => {
                        console.error(error);
                        this.onNotifySave("end");
                    });
                return;
            }
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
            localStorage.removeItem("YTBSP_useRemoteData");
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
            PersistenceService.applyBooleanPropertyFromLocalStorage(config, "useRemoteData");

            if (config.useRemoteData) {
                persistenceService.loadConfig(true).then((remoteConfig) => {
                    resolve(remoteConfig);
                }).catch(e => {
                    console.error(e);
                    resolve(config);
                });
            } else {
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
            }
        }));
    }

    private loadRemoteConfig(): Promise<Configuration> {
        return new Promise(((resolve, reject) => {
            PersistenceService.buildServerRequest("/settings")
                .then((response) => {
                    const config = new Configuration();
                    if (response) {
                        config.updateConfiguration(response);
                    }
                    resolve(config);
                })
                .catch(reject);
        }));
    }

    private saveLocalConfig(config: Configuration): Promise<void> {
        return new Promise(((resolve) => {
            localStorage.setItem("YTBSP_useRemoteData", config.useRemoteData ? "1" : "0");
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

    private saveRemoteConfig(config: Configuration): Promise<void> {
        localStorage.setItem("YTBSP_useRemoteData", config.useRemoteData ? "1" : "0");
        return new Promise(((resolve, reject) => {
            PersistenceService.buildServerRequest("/settings", {}, "POST", config)
                .then(() => {
                    resolve();
                }).catch(reject);
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

    private loadRemoteVideoInfo(): Promise<SubscriptionDTO[]> {
        return new Promise(((resolve, reject) => {
            // Request file content from API.
            PersistenceService.buildServerRequest("/videoStates", {})
                .then((data) => {
                    if ("undefined" === typeof data || null === data || "" === data) {
                        console.error("Error parsing video information!");
                        resolve([]);
                    } else {
                        resolve(JSON.parse(data));
                    }
                }).catch(reject);
        }));
    }

    private saveLocalVideoInfo(subs: string): Promise<void> {
        return new Promise(((resolve) => {
            localStorage.setItem("YTBSP_VideoInfo", subs);
            resolve();
        }));
    }

    private saveRemoteVideoInfo(subs: string): Promise<void> {
        return new Promise(((resolve, reject) => {
            PersistenceService.buildServerRequest("/videoStates", {}, "POST", subs)
                .then(resolve)
                .catch(reject);
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
