export enum Resolutions {
    Ultra = "highres",
    P2880 = "hd2880",
    P2160 = "hd2160",
    P1440 = "hd1440",
    P1080 = "hd1080",
    P720 = "hd720",
    P480 = "large",
    P360 = "medium",
    P240 = "small",
    P144 = "tiny"
}

export default class Configuration {
    useRemoteData = false;              // DEFAULT: false (using Cloud as remote storage).
    maxSimSubLoad = 10;                 // DEFAULT: 10 (Range: 1 - 50) (higher numbers result into slower loading of single items but overall faster loading).
    maxVideosPerRow = 9;                // DEFAULT: 9.
    maxVideosPerSub = 36;               // DEFAULT: 36 (Range: 1 - 50) (should be dividable by maxVideosPerRow).
    enlargeDelay = 500;                 // DEFAULT: 500 (in ms).
    enlargeFactor = 2.8;                // DEFAULT: 2.8 (x * 90px).
    enlargeFactorNative = 2.0;          // DEFAULT: 2.0 (x * 94px).
    timeToMarkAsSeen = 10;              // DEFAULT: 10 (in s).
    screenThreshold = 500;              // DEFAULT: 500 (preload images beyond current screen region in px).
    playerQuality = Resolutions.P1080;  // DEFAULT: hd1080 (Resolutions.P1080)
    peekPlayerSizeFactor = 1.5;         // DEFAULT: 1.5 (x * 180px).
    autoPauseVideo = false;             // DEFAULT: false.
    hideSeenVideos = false;             // DEFAULT: false.
    hideEmptySubs = true;               // DEFAULT: true.
    hideOlderVideos = false;            // DEFAULT: false.
    videoDecomposeTime = 30;             // DEFAULT: 30 days.

    updateConfiguration(info: {
        useRemoteData?: boolean,
        maxSimSubLoad?: number,
        maxVideosPerRow?: number,
        maxVideosPerSub?: number,
        enlargeDelay?: number,
        enlargeFactor?: number,
        enlargeFactorNative?: number,
        timeToMarkAsSeen?: number,
        screenThreshold?: number,
        playerQuality?: Resolutions,
        peekPlayerSizeFactor?: number,
        autoPauseVideo?: boolean,
        hideSeenVideos?: boolean,
        hideOlderVideos?: boolean,
        hideEmptySubs?: boolean,
        videoDecomposeTime?: number,
        [x: string]: any

    }): void {
        if (Object.prototype.hasOwnProperty.call(info, "useRemoteData")) {
            this.useRemoteData = info.useRemoteData;
        }
        if (Object.prototype.hasOwnProperty.call(info, "maxSimSubLoad")) {
            this.maxSimSubLoad = info.maxSimSubLoad;
        }
        if (Object.prototype.hasOwnProperty.call(info, "maxVideosPerRow")) {
            this.maxVideosPerRow = info.maxVideosPerRow;
        }
        if (Object.prototype.hasOwnProperty.call(info, "maxVideosPerSub")) {
            this.maxVideosPerSub = info.maxVideosPerSub;
        }
        if (Object.prototype.hasOwnProperty.call(info, "enlargeDelay")) {
            this.enlargeDelay = info.enlargeDelay;
        }
        if (Object.prototype.hasOwnProperty.call(info, "enlargeFactor")) {
            this.enlargeFactor = info.enlargeFactor;
        }
        if (Object.prototype.hasOwnProperty.call(info, "enlargeFactorNative")) {
            this.enlargeFactorNative = info.enlargeFactorNative;
        }
        if (Object.prototype.hasOwnProperty.call(info, "timeToMarkAsSeen")) {
            this.timeToMarkAsSeen = info.timeToMarkAsSeen;
        }
        if (Object.prototype.hasOwnProperty.call(info, "screenThreshold")) {
            this.screenThreshold = info.screenThreshold;
        }
        if (Object.prototype.hasOwnProperty.call(info, "playerQuality")) {
            this.playerQuality = info.playerQuality;
        }
        if (Object.prototype.hasOwnProperty.call(info, "peekPlayerSizeFactor")) {
            this.peekPlayerSizeFactor = info.peekPlayerSizeFactor;
        }
        if (Object.prototype.hasOwnProperty.call(info, "autoPauseVideo")) {
            this.autoPauseVideo = info.autoPauseVideo;
        }
        if (Object.prototype.hasOwnProperty.call(info, "hideSeenVideos")) {
            this.hideSeenVideos = info.hideSeenVideos;
        }
        if (Object.prototype.hasOwnProperty.call(info, "hideOlderVideos")) {
            this.hideOlderVideos = info.hideOlderVideos;
        }
        if (Object.prototype.hasOwnProperty.call(info, "hideEmptySubs")) {
            this.hideEmptySubs = info.hideEmptySubs;
        }
        if (Object.prototype.hasOwnProperty.call(info, "videoDecomposeTime")) {
            this.videoDecomposeTime = info.videoDecomposeTime;
        }
    }

    equals(config: Configuration): boolean {
        return this.useRemoteData === config.useRemoteData &&
            this.maxSimSubLoad === config.maxSimSubLoad &&
            this.maxVideosPerRow === config.maxVideosPerRow &&
            this.maxVideosPerSub === config.maxVideosPerSub &&
            this.enlargeDelay === config.enlargeDelay &&
            this.enlargeFactor === config.enlargeFactor &&
            this.enlargeFactorNative === config.enlargeFactorNative &&
            this.timeToMarkAsSeen === config.timeToMarkAsSeen &&
            this.screenThreshold === config.screenThreshold &&
            this.playerQuality === config.playerQuality &&
            this.peekPlayerSizeFactor === config.peekPlayerSizeFactor &&
            this.autoPauseVideo === config.autoPauseVideo &&
            this.hideSeenVideos === config.hideSeenVideos &&
            this.hideOlderVideos === config.hideOlderVideos &&
            this.videoDecomposeTime === config.videoDecomposeTime &&
            this.hideEmptySubs === config.hideEmptySubs;

    }
}
