/* global jQuery, $, gapi, GM_info, Subscription, Player, cssString */

const resolutions = {"Ultra": "highres",
    "2880p": "hd2880",
    "2160p": "hd2160",
    "1440p": "hd1440",
    "1080p": "hd1080",
    "720p": "hd720",
    "480p": "large",
    "360p": "medium",
    "240p": "small",
    "144p": "tiny"};

// Config:
const config = {
    "useRemoteData": true,					// DEFAULT: true (using Google Drive as remote storage).
    "maxSimSubLoad": 10,						// DEFAULT: 10 (Range: 1 - 50) (higher numbers result into slower loading of single items but overall faster loading).
    "maxVidsPerRow": 9,						// DEFAULT: 9.
    "maxVidsPerSub": 36,						// DEFAULT: 36 (Range: 1 - 50) (should be dividable by maxVidsPerRow).
    "enlargeDelay": 500,						// DEFAULT: 500 (in ms).
    "enlargeFactor": 2.8,					// DEFAULT: 2.8 (x * 90px).
    "enlargeFactorNative": 2.0,				// DEFAULT: 2.0 (x * 94px).
    "timeToMarkAsSeen": 10,					// DEFAULT: 10 (in s).
    "screenThreshold": 500,					// DEFAULT: 500 (preload images beyond current screen region in px).
    "playerQuality": resolutions["1080p"],	// DEFAULT: hd1080 (resolutions['1080p'])
    "peekPlayerSizeFactor": 1.5,				// DEFAULT: 1.5 (x * 180px).
    "autoPauseVideo": false,					// DEFAULT: false.
    "hideSeenVideos": false,					// DEFAULT: false.
    "hideEmptySubs": true					// DEFAULT: true.
};

// OAuth2 variables:
const CLIENT_ID = "281397662073-jv0iupog9cdb0eopi3gu6ce543v0jo65.apps.googleusercontent.com";
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest", "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
const SCOPE = "https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/drive.appdata";

// Selectors for external HTML elements:
// YouTube selectors:
const YT_APP = "ytd-app";
const YT_STARTPAGE_BODY = "#page-manager.ytd-app";
const YT_PLAYLIST_SIDEBAR = "ytd-playlist-sidebar-renderer";
const YT_VIDEO_TITLE = "#info-contents > ytd-video-primary-info-renderer > div:last-child";
const YT_CHANNEL_LINK = "#owner-name > a";
const YT_CONTENT = "#content";
const YT_GUIDE = "app-drawer#guide";
const YT_PLAYER_QUALITY = "yt-player-quality";
const YT_PLAYER = "#movie_player";
const YT_PLAYER_CONTROL = "#page-manager > ytd-watch-flexy";
const YT_VIDEO_STREAM = ".video-stream";
// MagicAction selectors:
const MA_TOOLBAR = "#info-contents > ytd-video-primary-info-renderer > div";

// Style rules depending on the loaded page.
// Startpage_body display: none is defined via stylesheet to prevent native page to blink through when loading.
// (When page has finished loading initially this rule has to be removed, to prevent feed pages from loading with display: none)
const bodyStyleLoading = `${YT_STARTPAGE_BODY} { background: transparent; display:none; }`;
const bodyStyleStartpage = `${YT_STARTPAGE_BODY} { margin-top: -30px; margin-left: 120px; background: transparent; }
    ${YT_GUIDE}{ z-index: 0 !important;}`;
const bodyStyleVideo = `${YT_STARTPAGE_BODY} { background: transparent; margin-top: 0px; }
    ${YT_GUIDE}{ z-index: 0 !important; width: var(--app-drawer-width, 256px); }`;
const bodyStyleSearch = `${YT_STARTPAGE_BODY} { background: transparent; margin-top: -50px; }
    ${YT_GUIDE}{ z-index: 0; !important;}`;
const bodyStyleDefault = `${YT_STARTPAGE_BODY} { background: transparent; }
    ${YT_GUIDE}{ z-index: 0; !important;}`;
const bodyStylePlaylist = `${YT_STARTPAGE_BODY} { background: transparent; margin-top: -60px; }
    ${YT_GUIDE}{ z-index: 0; !important;}
    ${YT_STARTPAGE_BODY} ${YT_PLAYLIST_SIDEBAR} {padding-top: 54px;}`;

let corruptCache = false;
let cachedVideoInformation = [];
let remoteSaveFileID = null;

// Start page is YTBSP.
let isNative = false;

// Universal loader as resource.
function getLoader(id) {
    return $("<div/>", {"class": "ytbsp-loader", "id": id});
}

// Make slider as resource.
function getSlider(id, checked, onChange) {
    const slider = $("<label/>", {"class": "ytbsp-slider"});
    slider.append($("<input/>", {"class": "ytbsp-slider-cb", "type": "checkbox", "id": id, "checked": checked, "on": {"change": onChange}}));
    slider.append($("<div/>", {"class": "ytbsp-slider-rail"}));
    slider.append($("<div/>", {"class": "ytbsp-slider-knob"}));
    return slider;
}

// Let's build the new site:

// Create an div for us.
const themeClass = isDarkModeEnabled() ? "ytbsp-dark-theme" : "ytbsp-light-theme";
const mainDiv = $("<div/>", {"id": "YTBSP", "class": themeClass});
const menuStrip = $("<div/>", {"id": "ytbsp-menuStrip"});
menuStrip.append($("<div/>", {"id": "ytbsp-loaderSpan"})
    .append(getLoader("ytbsp-main-loader"))
    .append($("<button/>", {"id": "ytbsp-refresh", "class": "ytbsp-func", "html": "&#x27F3;"})));
menuStrip.append($("<button/>", {"id": "ytbsp-togglePage", "class": "ytbsp-func", "html": "Toggle YTBSP"}));
menuStrip.append($("<button/>", {"id": "ytbsp-removeAllVideos", "class": "ytbsp-func ytbsp-hideWhenNative", "html": "Remove all videos"}));
menuStrip.append($("<button/>", {"id": "ytbsp-resetAllVideos", "class": "ytbsp-func ytbsp-hideWhenNative", "html": "Reset all videos"}));
menuStrip.append($("<button/>", {"id": "ytbsp-backup", "class": "ytbsp-func ytbsp-hideWhenNative", "html": "Backup video info"}));
menuStrip.append($("<label/>", {"for": "ytbsp-hideSeenVideosCb", "class": "ytbsp-func ytbsp-hideWhenNative"})
    .append($("<input/>", {"id": "ytbsp-hideSeenVideosCb", "type": "checkbox", "checked": config.hideSeenVideos}))
    .append("Hide seen videos"));
menuStrip.append($("<label/>", {"for": "ytbsp-hideEmptySubsCb", "class": "ytbsp-func ytbsp-hideWhenNative"})
    .append($("<input/>", {"id": "ytbsp-hideEmptySubsCb", "type": "checkbox", "checked": config.hideEmptySubs}))
    .append("Hide empty subs"));
menuStrip.append($("<button/>", {"id": "ytbsp-settings", "class": "ytbsp-func ytbsp-hideWhenNative", "html": "&#x2699;"}));
mainDiv.append(menuStrip);
mainDiv.append($("<ul/>", {"id": "ytbsp-subs", "css": {"min-width": `${config.maxVidsPerRow * 168}px`}}));
mainDiv.append($("<div/>", {"id": "ytbsp-modal"})
    .append($("<div/>", {"id": "ytbsp-modal-content"})));

// Save a reference for the subList.
const subList = $("#ytbsp-subs", mainDiv);

$(".ytbsp-hideWhenNative", mainDiv).css("visibility", "hidden");

let markAsSeenTimeout = null;

let autoPauseThisVideo = null;

// Call functions on startup.
onScriptStart();

// /////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Start OAuth Stuff

gapi.load("client:auth2", initClient);

let retryInit = 5; // Retry limit for client init with oauth.

// OAuth init
function initClient() {
    // Initialize the gapi.client object, which app uses to make API requests.
    gapi.client.init({
        "clientId": CLIENT_ID,
        "discoveryDocs": DISCOVERY_DOCS,
        "scope": SCOPE
    }).then(() => {
        if (0 >= retryInit) {
            return;
        }
        retryInit = 0;
        window.GoogleAuth = gapi.auth2.getAuthInstance();
        // Handle initial sign-in state. (Determine if user is already signed in.)
        setSignInStatus();
    }, (reason) => {
        if (0 >= retryInit) {
            return;
        }
        retryInit = 0;
        console.error(`Google API client initialization failed:\n${reason}`);
    });
    setTimeout(() => {
        if (0 >= --retryInit) {
            return;
        }
        initClient(); // Retry with timeout because youtube can reset gapi and the promise never returns.
    }, 1000);
}

// OAuth sign in.
function setSignInStatus() {
    const user = window.GoogleAuth.currentUser.get();
    const isAuthorized = user.hasGrantedScopes(SCOPE);
    if (isAuthorized) {
        // Start loading save data.
        startAPIRequests();
    } else {
        window.GoogleAuth.signIn().then(
            () => {
                // Sign in successful then start loading save data.
                startAPIRequests();
            },
            (error) => {
                // Display popup-blocked message.
                if ("popup_blocked_by_browser" === error.error) {
                    alert("please allow popups for this page and reload!");
                } else {
                    console.error(`Google user sign-in failed:\n${error}`);
                }
            }
        );
    }
}

// Prevent unnecessary request parameters.
function removeEmptyParams(params) {
    for (const p in params) {
        if (!params[p] || "undefined" === params[p]) {
            delete params[p];
        }
    }
    return params;
}

// Build proper OAuth request.
function buildApiRequest(requestMethod, path, params, properties) {
    return new Promise(((resolve, reject) => {
        const cleanParams = removeEmptyParams(params);
        let request;
        if (properties) {
            request = gapi.client.request({
                "body": properties,
                "method": requestMethod,
                "path": path,
                "params": cleanParams
            });
        } else {
            request = gapi.client.request({
                "method": requestMethod,
                "path": path,
                "params": cleanParams
            });
        }
        request.execute((response) => {
            resolve(response);
        });
    }));
}

// End OAuth Stuff.
// /////////////////////////////////////////////////////////////////////////////////////////////////////////////

let loading = 0; // 0: all subs / videos loaded.
let saveQueued = false;

// Function to handle loading, showing, hiding loaders when needed and
// Saving when loading has finished if saving flag was set at least once
function loadingProgress(loadingDelta, saveWhenDone = false, sub = null) {
    loading += loadingDelta;
    saveQueued = saveQueued || saveWhenDone;
    if (null !== sub) {
        if (0 > loadingDelta) {
            sub.removeLoader();
        } else {
            sub.showLoader();
        }
    }
    // All subs loaded.
    if (0 === loading) {
        $(".ytbsp-loader", "#ytbsp-loaderSpan").hide();
        $("#ytbsp-refresh", "#ytbsp-loaderSpan").show();
        if (saveQueued) {
            saveQueued = false;
            saveList();
        }
    } else {
        $(".ytbsp-loader", "#ytbsp-loaderSpan").show();
        $("#ytbsp-refresh", "#ytbsp-loaderSpan").hide();
    }
}

config.useRemoteData = "0" !== localStorage.getItem("YTBSP_useRemoteData");

// This function is called after successful OAuth login.
// Loads configuration and video information from local storage or G-Drive,
// Then starts loading subscriptions.
function startAPIRequests()	{
    // Get app configuration.
    loadConfig().then(() => {
        // -> Get save data.
        afterConfigLoaded();
        loadVideoInformation().then(() => {
            // -> start requesting subs.
            requestSubs();
        });
    });
}

// Load G-Drive File Id only.
function loadRemoteFileId() {
    return new Promise(((resolve, reject) => {
        loadingProgress(1);
        buildApiRequest(
            "GET",
            "/drive/v3/files",
            {
                "q": "name = 'YTBSP.json'",
                "fields": "files(id)",
                "spaces": "appDataFolder"
            }
        ).then((response) => {
            const files = response.files;
            // Check if save file exists or has to be created.
            if (files && 0 < files.length) {
                // Save file exists.
                remoteSaveFileID = files[0].id;
            } else {
                // Save file does not exist.
                // Create new save file.
                createRemoteSaveData().then(() => {
                    resolve();
                });
            }
            loadingProgress(-1);
            resolve();
        });
    }));
}

// Load Script configuration.
function loadConfig() {
    if (config.useRemoteData) {
        return loadRemoteConfig();
    }
    return loadLocalConfig();

}

// Load Script configuration from G-Drive file.
function loadRemoteConfig() {
    return new Promise(((resolve, reject) => {
        loadingProgress(1);
        buildApiRequest(
            "GET",
            "/drive/v3/files",
            {
                "q": "name = 'YTBSP.json'",
                "fields": "files(appProperties,id,name)",
                "spaces": "appDataFolder"
            }
        ).then((response) => {
            const files = response.files;
            // Check if save file exists or has to be created.
            if (files && 0 < files.length) {
                // Save file exists.
                // Parse the config.
                remoteSaveFileID = files[0].id;
                config.useRemoteData = "0" !== files[0].appProperties.useRemoteData;
                config.hideSeenVideos = "0" !== files[0].appProperties.hideSeenVideos;
                config.hideEmptySubs = "0" !== files[0].appProperties.hideEmptySubs;
                config.maxSimSubLoad = files[0].appProperties.maxSimSubLoad;
                config.maxVidsPerRow = files[0].appProperties.maxVidsPerRow;
                config.maxVidsPerSub = files[0].appProperties.maxVidsPerSub;
                config.enlargeDelay = files[0].appProperties.enlargeDelay;
                config.enlargeFactor = files[0].appProperties.enlargeFactor;
                config.enlargeFactorNative = files[0].appProperties.enlargeFactorNative;
                config.playerQuality = files[0].appProperties.playerQuality;
                config.timeToMarkAsSeen = files[0].appProperties.timeToMarkAsSeen;
                config.screenThreshold = files[0].appProperties.screenThreshold;
                config.autoPauseVideo = "0" !== files[0].appProperties.autoPauseVideo;
                $("#ytbsp-hideSeenVideosCb").prop("checked", config.hideSeenVideos);
                $("#ytbsp-hideEmptySubsCb").prop("checked", config.hideEmptySubs);
            } else {
                // Save file does not exist.
                // Create new save file.
                createRemoteSaveData().then(() => {
                    resolve();
                });
            }
            loadingProgress(-1);
            resolve();
        });
    }));
}

// Load Script configuration from local storage
function loadLocalConfig() {
    return new Promise(((resolve, reject) => {
        config.useRemoteData = "0" !== localStorage.getItem("YTBSP_useRemoteData");
        config.hideSeenVideos = "0" !== localStorage.getItem("YTBSP_hideSeenVideos");
        config.hideEmptySubs = "0" !== localStorage.getItem("YTBSP_hideEmptySubs");
        config.maxSimSubLoad = localStorage.getItem("YTBSP_maxSimSubLoad");
        config.maxVidsPerRow = localStorage.getItem("YTBSP_maxVidsPerRow");
        config.maxVidsPerSub = localStorage.getItem("YTBSP_maxVidsPerSub");
        config.enlargeDelay = localStorage.getItem("YTBSP_enlargeDelay");
        config.enlargeFactor = localStorage.getItem("YTBSP_enlargeFactor");
        config.enlargeFactorNative = localStorage.getItem("YTBSP_enlargeFactorNative");
        config.playerQuality = localStorage.getItem("YTBSP_playerQuality");
        config.timeToMarkAsSeen = localStorage.getItem("YTBSP_timeToMarkAsSeen");
        config.screenThreshold = localStorage.getItem("YTBSP_screenThreshold");
        config.autoPauseVideo = "0" !== localStorage.getItem("YTBSP_autoPauseVideo");
        $("#ytbsp-hideSeenVideosCb").prop("checked", config.hideSeenVideos);
        $("#ytbsp-hideEmptySubsCb").prop("checked", config.hideEmptySubs);
        resolve();
    }));
}

// Create new save file on G-Drive.
function createRemoteSaveData() {
    return new Promise(((resolve, reject) => {
        loadingProgress(1);
        buildApiRequest(
            "POST",
            "/drive/v3/files",
            {"fields": "appProperties,id,name"},
            {
                "parents": ["appDataFolder"],
                "name": "YTBSP.json",
                "appProperties": {
                    "useRemoteData": config.useRemoteData,
                    "hideSeenVideos": config.hideSeenVideos,
                    "hideEmptySubs": config.hideEmptySubs,
                    "maxSimSubLoad": config.maxSimSubLoad,
                    "maxVidsPerRow": config.maxVidsPerRow,
                    "maxVidsPerSub": config.maxVidsPerSub,
                    "enlargeDelay": config.enlargeDelay,
                    "enlargeFactor": config.enlargeFactor,
                    "enlargeFactorNative": config.enlargeFactorNative,
                    "playerQuality": config.playerQuality,
                    "timeToMarkAsSeen": config.timeToMarkAsSeen,
                    "screenThreshold": config.screenThreshold,
                    "autoPauseVideo": config.autoPauseVideo
                }
            }
        ).then((response) => {
            remoteSaveFileID = response.id;
            // Config variables are already initialized with default values.
            $("#ytbsp-hideSeenVideosCb").prop("checked", config.hideSeenVideos);
            $("#ytbsp-hideEmptySubsCb").prop("checked", config.hideEmptySubs);
            loadingProgress(-1, true);
            resolve();
        });
    }));
}

// Delete save file on G-Drive.
// eslint-disable-next-line no-unused-vars
function deleteRemoteSaveData() {
    return new Promise(((resolve, reject) => {
        if (null === remoteSaveFileID) {
            loadRemoteFileId().then(() => {
                if (null !== remoteSaveFileID) {
                    deleteRemoteSaveData().then(() => { resolve(); });
                } else {
                    resolve();
                }
            });
        } else {
            buildApiRequest(
                "DELETE",
                `/drive/v3/files/${remoteSaveFileID}`,
                {}
            ).then(() => {
                remoteSaveFileID = null;
                deleteRemoteSaveData().then(() => { resolve(); });
            });
        }
    }));
}

// Load video information.
function loadVideoInformation() {
    return new Promise(((resolve, reject) => {
        getVideoInformation().then((data) => {
            cachedVideoInformation = data;
            resolve();
        });
    }));
}

// Gets and returns video information in resolved promise.
function getVideoInformation() {
    if (config.useRemoteData) {
        return getRemoteVideoInformation();
    }
    return getLocalVideoInformation();

}

// Load video information from G-Drive file.
function getRemoteVideoInformation() {
    return new Promise(((resolve, reject) => {
        if (null === remoteSaveFileID) {
            loadRemoteFileId().then(() => {
                getRemoteVideoInformation().then((data) => { resolve(data); });
            });
        } else {
            // Request file content from API.
            buildApiRequest(
                "GET",
                `/drive/v3/files/${remoteSaveFileID}`,
                {"alt": "media"}
            ).then((data) => {
                if ("undefined" === typeof data || null === data || "" === data) {
                    console.error("Error parsing video information!");
                    resolve([]);
                } else {
                    resolve(data);
                }
            });
        }
    }));
}

// Loads and parses local storage data.
function getLocalVideoInformation() {
    return new Promise(((resolve, reject) => {
        // Get Cache from localStorage and set config.
        let cache = localStorage.getItem("YTBSP");
        corruptCache = "1" === localStorage.getItem("YTBSPcorruptcache"); // DEFAULT: false.
        // If last save process was interrupted: try to load backup.
        if (corruptCache) {
            console.warn("cache corruption detected!");
            console.warn("restoring old cache...");
            cache = localStorage.getItem("YTBSPbackup");
        }
        // If we have a cache parse it.
        if (null === cache || "" === cache) {
            cache = [];
        } else {
            try {
                cache = JSON.parse(cache);
            } catch (e) {
                console.error("Error parsing cache!");
                cache = [];
            }
        }
        resolve(cache);
    }));
}

// Save configuration.
function saveConfig() {
    if (config.useRemoteData) {
        return new Promise(((resolve, reject) => {
            saveLocalConfig().then(() => {
                saveRemoteConfig().then(() => { resolve(); });
            });
        }));
    }
    return saveLocalConfig();

}

// Save configuration to G-Drive file.
function saveRemoteConfig() {
    return new Promise(((resolve, reject) => {
        if (null === remoteSaveFileID) {
            loadRemoteFileId().then(() => {
                saveRemoteConfig().then(() => { resolve(); });
            });
        } else {
            buildApiRequest(
                "PATCH",
                `/drive/v3/files/${remoteSaveFileID}`,
                {},
                {"appProperties": {
                    "useRemoteData": config.useRemoteData ? "1" : "0",
                    "hideSeenVideos": config.hideSeenVideos ? "1" : "0",
                    "hideEmptySubs": config.hideEmptySubs ? "1" : "0",
                    "maxSimSubLoad": config.maxSimSubLoad,
                    "maxVidsPerRow": config.maxVidsPerRow,
                    "maxVidsPerSub": config.maxVidsPerSub,
                    "enlargeDelay": config.enlargeDelay,
                    "enlargeFactor": config.enlargeFactor,
                    "enlargeFactorNative": config.enlargeFactorNative,
                    "playerQuality": config.playerQuality,
                    "timeToMarkAsSeen": config.timeToMarkAsSeen,
                    "screenThreshold": config.screenThreshold,
                    "autoPauseVideo": config.autoPauseVideo ? "1" : "0"
                }}
            ).then(() => {
                localStorage.setItem("YTBSP_useRemoteData", config.useRemoteData ? "1" : "0");
                resolve();
            });
        }
    }));
}

// Save config to local storage file.
function saveLocalConfig() {
    return new Promise(((resolve, reject) => {
        localStorage.setItem("YTBSP_useRemoteData", config.useRemoteData ? "1" : "0");
        localStorage.setItem("YTBSP_hideSeenVideos", config.hideSeenVideos ? "1" : "0");
        localStorage.setItem("YTBSP_hideEmptySubs", config.hideEmptySubs ? "1" : "0");
        localStorage.setItem("YTBSP_maxSimSubLoad", config.maxSimSubLoad);
        localStorage.setItem("YTBSP_maxVidsPerRow", config.maxVidsPerRow);
        localStorage.setItem("YTBSP_maxVidsPerSub", config.maxVidsPerSub);
        localStorage.setItem("YTBSP_enlargeDelay", config.enlargeDelay);
        localStorage.setItem("YTBSP_enlargeFactor", config.enlargeFactor);
        localStorage.setItem("YTBSP_enlargeFactorNative", config.enlargeFactorNative);
        localStorage.setItem("YTBSP_playerQuality", config.playerQuality);
        localStorage.setItem("YTBSP_timeToMarkAsSeen", config.timeToMarkAsSeen);
        localStorage.setItem("YTBSP_screenThreshold", config.screenThreshold);
        localStorage.setItem("YTBSP_autoPauseVideo", config.autoPauseVideo ? "1" : "0");
        resolve();
    }));
}

// Save video information.
function saveVideoInformation() {
    if (config.useRemoteData) {
        return new Promise(((resolve, reject) => {
            saveLocalVideoInformation().then(() => {
                saveRemoteVideoInformation().then(() => { resolve(); });
            });
        }));
    }
    return saveLocalVideoInformation();

}

// Save video information to G-Drive file.
function saveRemoteVideoInformation() {
    return new Promise(((resolve, reject) => {
        if (null === remoteSaveFileID) {
            loadRemoteFileId().then(() => {
                saveRemoteVideoInformation().then(() => { resolve(); });
            });
        } else {
            const contentString = JSON.stringify(cachedVideoInformation);
            const boundary = "-------314159265358979323846";
            const delimiter = `\r\n--${boundary}\r\n`;
            const closeDelimiter = `\r\n--${boundary}--`;

            const contentType = "text/plain" || "application/octet-stream";
            // Updating the metadata is optional and you can instead use the value from drive.files.get.
            const base64Data = btoa(encodeURIComponent(contentString).replace(
                /%([0-9A-F]{2})/gu,
                (match, p1) => String.fromCharCode("0x" + p1)
            ));
            const multipartRequestBody =
                `${delimiter
                }Content-Type: application/json\r\n\r\n${
                    JSON.stringify({}) // Metadata goes here.
                }${delimiter
                }Content-Type: ${contentType}\r\n` +
                "Content-Transfer-Encoding: base64\r\n" +
                `\r\n${
                    base64Data
                }${closeDelimiter}`;

            const request = gapi.client.request({"path": `/upload/drive/v3/files/${remoteSaveFileID}`,
                "method": "PATCH",
                "params": {"uploadType": "multipart", "alt": "json"},
                "headers": {
                    "Content-Type": `multipart/mixed; boundary="${boundary}"`
                },
                "body": multipartRequestBody});
            request.execute(() => {
                resolve();
            });
        }
    }));
}

// Save video information to local storage.
function saveLocalVideoInformation() {
    return new Promise(((resolve, reject) => {
        let newCache = JSON.stringify(cachedVideoInformation);
        localStorage.setItem("YTBSPcorruptcache", 1);
        localStorage.setItem("YTBSP", newCache);
        let savedCache = localStorage.getItem("YTBSP");
        if (newCache === savedCache) {
            localStorage.setItem("YTBSPcorruptcache", 0);
            localStorage.setItem("YTBSPbackup", newCache);
        } else {
            console.error("cache save error!");
            reject(new Error("cache save error!"));
        }
        newCache = null;
        savedCache = null;
        resolve();
    }));
}

const subs = []; // Main subscription array contains all subs and in extension all videos.

// Gets subs from api. (Called after successful OAuth-login and save data loading.)
function requestSubs() {
    loadingProgress(1);
    buildApiRequest(
        "GET",
        "/youtube/v3/subscriptions",
        {
            "mine": "true",
            "part": "snippet",
            "maxResults": config.maxSimSubLoad,
            "fields": "items(snippet(resourceId/channelId,title)),nextPageToken,pageInfo,prevPageToken"
        }
    ).then(processRequestSubs);
}

// Parses api results into subs and requests recursively more sub pages if needed.
function processRequestSubs(response) {
    // If Request was denied retry login.
    if (Object.prototype.hasOwnProperty.call(response, "error")) {
        console.error("OAuth failed! retrying...");
        window.GoogleAuth.disconnect();
        setSignInStatus();
        loadingProgress(-1);
        return;
    }
    // If there is another page of subs request it.
    if (("undefined" !== typeof response.nextPageToken) && (null !== response.nextPageToken)) {
        loadingProgress(1);
        buildApiRequest(
            "GET",
            "/youtube/v3/subscriptions",
            {
                "mine": "true",
                "part": "snippet",
                "maxResults": config.maxSimSubLoad,
                "pageToken": response.nextPageToken,
                "fields": "items(snippet(resourceId/channelId,title)),nextPageToken,pageInfo,prevPageToken"
            }
        ).then(processRequestSubs);
    }
    // Create subs from the api response.
    response.items.forEach((item) => {
        subs.push(new Subscription(item.snippet));
    });
    loadingProgress(-1);
}

// Check if subscription is still subscribed and if so append it.
function checkAndAppendSub(forChannelId) {
    loadingProgress(1);
    buildApiRequest(
        "GET",
        "/youtube/v3/subscriptions",
        {
            "mine": "true",
            "part": "snippet",
            "forChannelId": forChannelId,
            "fields": "items(snippet(resourceId/channelId,title)),pageInfo"
        }
    ).then(processCheckedSubs);
}

// Parses api results into subs if still subscribed.
function processCheckedSubs(response) {
    // No longer subscribed
    if (0 === response.pageInfo.totalResults) {
        loadingProgress(-1, true);
        return;
    }
    // Create subs from the api response.
    response.items.forEach((item) => {
        subs.push(new Subscription(item.snippet));
    });
    loadingProgress(-1, true);
}

// Set functions affecting all subs:
// Set click event for refresh button, updating all videos for all subs.
function updateAllSubs() {
    setTimeout(() => {
        subs.forEach((sub, i) => {
            subs[i].updateSubVideos();
        });
    }, 0);
}
$(".ytbsp-func#ytbsp-refresh", mainDiv).click(updateAllSubs);

let toggleGuide = false;

function shownative() {
    $(YT_STARTPAGE_BODY).show();
    subList.hide();
    $(".ytbsp-hideWhenNative", mainDiv).css("visibility", "hidden");
    isNative = true;
    // Toggle guide if on view page.
    if (toggleGuide) {
        const ytdApp = document.querySelector("ytd-app");
        ytdApp.fire("yt-guide-toggle", {});
    }
}

function hidenative() {
    $(YT_STARTPAGE_BODY).hide();
    subList.show();
    $(".ytbsp-hideWhenNative", mainDiv).css("visibility", "");
    isNative = false;
    // Toggle guide if on view page.
    if (toggleGuide) {
        const ytdApp = document.querySelector("ytd-app");
        ytdApp.fire("yt-guide-toggle", {});
        // Workaround: After opening guide sidebar scroll information gets lost...
        setTimeout(() => { $("body").attr("style", "overflow: auto"); }, 200);
    }
}

// Now set click event for the toggle native button.
function toggleYTBSP() {
    if (isNative) {
        hidenative();
        if ((/^\/?watch$/u).test(location.pathname)) {
            player.showPeekPlayer();
        }
    } else {
        shownative();
        if ((/^\/?watch$/u).test(location.pathname)) {
            player.showNativePlayer();
        }
    }
}
$(".ytbsp-func#ytbsp-togglePage", mainDiv).click(toggleYTBSP);

// Remove all videos button.
function removeAllVideos() {
    if (!confirm("delete all videos?")) {
        return;
    }
    loadingProgress(1);
    setTimeout(() => {
        const toRebuild = [];
        subs.forEach((sub, i) => {
            sub.videos.forEach((vid, j) => {
                if (!subs[i].videos[j].isRemoved()) {
                    subs[i].videos[j].remove();
                    toRebuild.push(i);
                }
            });
        });
        toRebuild.forEach((i) => {
            subs[i].buildSubList();
        });
        loadingProgress(-1, true);
    }, 0);
}
$(".ytbsp-func#ytbsp-removeAllVideos", mainDiv).click(removeAllVideos);

// Reset videos button.
function resetAllVideos() {
    if (!confirm("reset all videos?")) {
        return;
    }
    loadingProgress(1);
    setTimeout(() => {
        const toRebuild = [];
        subs.forEach((sub, i) => {
            sub.videos.forEach((vid, j) => {
                if (subs[i].videos[j].isRemoved() || subs[i].videos[j].isSeen()) {
                    subs[i].videos[j].reset();
                    toRebuild.push(i);
                }
            });
        });
        toRebuild.forEach((i) => {
            subs[i].buildSubList();
        });
        loadingProgress(-1, true);
    }, 0);
}
$(".ytbsp-func#ytbsp-resetAllVideos", mainDiv).click(resetAllVideos);

// Hide seen videos buttons.
function toggleHideSeenVideos() {
    config.hideSeenVideos = !config.hideSeenVideos;
    loadingProgress(1);
    saveConfig().then(() => { loadingProgress(-1); });
    subs.forEach((sub, i) => {
        subs[i].buildSubList();
    });
    $("#ytbsp-hideSeenVideosCb", mainDiv).prop("checked", config.hideSeenVideos);
}
$("#ytbsp-hideSeenVideosCb", mainDiv).change(toggleHideSeenVideos);

// Hide empty subscriptions button.
function toggleHideEmptySubs() {
    config.hideEmptySubs = !config.hideEmptySubs;
    loadingProgress(1);
    saveConfig().then(() => { loadingProgress(-1); });
    subs.forEach((sub, i) => {
        subs[i].handleVisibility();
    });
    $("#ytbsp-hideEmptySubsCb", mainDiv).prop("checked", config.hideEmptySubs);
}
$("#ytbsp-hideEmptySubsCb", mainDiv).change(toggleHideEmptySubs);

// Open backup dialog.
function openBackupDialog() {
    loadingProgress(1);
    getVideoInformation().then((saveData) => {
        openModal(createBackupDialog(JSON.stringify(saveData)));
        loadingProgress(-1);
    });
}

// Creates and returns a new backup dialog.
function createBackupDialog(saveData) {
    const backupDialog = $("<div/>");
    backupDialog.append($("<h1/>", {"html": "Backup video information"}));
    backupDialog.append($("<p/>", {"html": "This Feature allows you to save which videos you have seen and removed and import them again on another " +
                                    "browser/computer or just to make save you don't loose this information over night."}));
    backupDialog.append($("<h1/>", {"html": "How do I do this?"}));
    backupDialog.append($("<p/>", {"html": "Just copy the content of the following text box and save it somewhere.<br />" +
                                    "To import it again copy it into the text box and press import data."}));
    backupDialog.append($("<p/>", {"html": "The save data from local storage and Google Drive are compatible and interchangeable."}));
    backupDialog.append($("<textarea/>", {"id": "ytbsp-export-import-textarea", "html": saveData}));

    const endDiv = $("<div/>", {"id": "ytbsp-modal-end-div"});
    endDiv.append($("<h2/>", {"html": "Local Storage"}));

    const backupSwitch = function() {
        if ($("#ytbsp-backup-switch").prop("checked")) {
            $("#ytbsp-export-import-textarea").empty();
            loadingProgress(1);
            getRemoteVideoInformation().then((saveDataObject) => {
                $("#ytbsp-export-import-textarea").val(JSON.stringify(saveDataObject));
                loadingProgress(-1);
            });
        } else {
            getLocalVideoInformation().then((saveDataObject) => {
                $("#ytbsp-export-import-textarea").val(JSON.stringify(saveDataObject));
                loadingProgress(-1);
            });
        }
    };
    endDiv.append(getSlider("ytbsp-backup-switch", config.useRemoteData, backupSwitch));

    endDiv.append($("<h2/>", {"html": "Google Drive"}));
    endDiv.append($("<input/>", {"type": "submit", "class": "ytbsp-func", "value": "close", "on": {"click": closeModal}}));

    const importData = function() {
        loadingProgress(1);
        cachedVideoInformation = JSON.parse($("#ytbsp-export-import-textarea").val());
        if ($("#ytbsp-backup-switch").prop("checked")) {
            saveRemoteVideoInformation().then(() => {
                closeModal();
                loadingProgress(-1);
                location.reload();
            });
        } else {
            saveLocalVideoInformation().then(() => {
                setTimeout(() => {
                    closeModal();
                    loadingProgress(-1);
                    location.reload();
                }, 200);
            });
        }
    };
    endDiv.append($("<input/>", {"type": "submit", "class": "ytbsp-func", "value": "import data", "on": {"click": importData}}));
    return backupDialog.append(endDiv);
}
$(".ytbsp-func#ytbsp-backup", mainDiv).click(openBackupDialog);

// Open settings dialog.
function openSettingsDialog() {
    loadingProgress(1);
    setTimeout(() => {
        openModal(createSettingsDialog());
        loadingProgress(-1);
    }, 1);
}

// Create settings dialog.
function createSettingsDialog() {
    const settingsDialog = $("<div/>");
    settingsDialog.append($("<h1/>", {"html": "Settings"}));
    const settingsTable = $("<table/>", {"id": "ytbsp-settings-table"});
    settingsTable.append($("<tr>")
        .append($("<td>", {"html": "Hide empty subs"}))
        .append($("<td>").append(getSlider("ytbsp-settings-hideEmptySubs", config.hideEmptySubs)))
        .append($("<td>")));
    settingsTable.append($("<tr>")
        .append($("<td>", {"html": "Hide seen videos"}))
        .append($("<td>").append(getSlider("ytbsp-settings-hideSeenVideos", config.hideSeenVideos)))
        .append($("<td>")));
    settingsTable.append($("<tr>")
        .append($("<td>", {"html": "Use Google Drive"}))
        .append($("<td>").append(getSlider("ytbsp-settings-useRemoteData", config.useRemoteData)))
        .append($("<td>"), {"html": "Allows synchronization between browsers. May result in slower loading times."}));
    settingsTable.append($("<tr>")
        .append($("<td>", {"html": "Auto pause videos"}))
        .append($("<td>").append(getSlider("ytbsp-settings-autoPauseVideo", config.autoPauseVideo)))
        .append($("<td>"), {"html": "Open Videos in a paused state. (Does not effect playlists.)"}));

    const playerQualitySelect = $("<Select>", {"id": "ytbsp-settings-playerQuality"});
    for (const resolution in resolutions) {
        if (Object.prototype.hasOwnProperty.call(resolutions, resolution)) {
            playerQualitySelect.append($("<option>", {"value": resolutions[resolution], "html": resolution}));
        }
    }
    playerQualitySelect.val(config.playerQuality);

    settingsTable.append($("<tr>")
        .append($("<td>", {"html": "Player Quality"}))
        .append($("<td>").append(playerQualitySelect))
        .append($("<td>"), {"html": "Open Videos in a paused state. (Does not effect playlists.)"}));
    settingsTable.append($("<tr>")
        .append($("<td>", {"html": "Max number of subscriptions loading simultaneously"}))
        .append($("<td>").append($("<input>", {"type": "number", "min": "1", "max": "50", "id": "ytbsp-settings-maxSimSubLoad", "value": config.maxSimSubLoad})))
        .append($("<td>", {"html": "Default: 10 | Range: 1-50 | Higher numbers result in slower loading of single items but overall faster loading."})));
    settingsTable.append($("<tr>")
        .append($("<td>", {"html": "Max number of videos per row"}))
        .append($("<td>").append($("<input>", {"type": "number", "min": "1", "max": "50", "id": "ytbsp-settings-maxVidsPerRow", "value": config.maxVidsPerRow})))
        .append($("<td>", {"html": "Default: 9 | Range: 1-50"})));
    settingsTable.append($("<tr>")
        .append($("<td>", {"html": "Max number of videos per subscription"}))
        .append($("<td>").append($("<input>", {"type": "number", "min": "1", "max": "50", "id": "ytbsp-settings-maxVidsPerSub", "value": config.maxVidsPerSub})))
        .append($("<td>", {"html": "Default: 27 | Range: 1-50 | Should be dividable by videos per row."})));
    settingsTable.append($("<tr>")
        .append($("<td>", {"html": "Watch time to mark video as seen"}))
        .append($("<td>").append($("<input>", {"type": "number", "min": "0", "id": "ytbsp-settings-timeToMarkAsSeen", "value": config.timeToMarkAsSeen})).append(" s"))
        .append($("<td>", {"html": "Default: 10"})));
    settingsTable.append($("<tr>")
        .append($("<td>", {"html": "Delay for thumbnail enlarge"}))
        .append($("<td>").append($("<input>", {"type": "number", "min": "0", "id": "ytbsp-settings-enlargeDelay", "value": config.enlargeDelay})).append(" ms"))
        .append($("<td>", {"html": "Default: 500"})));
    settingsTable.append($("<tr>")
        .append($("<td>", {"html": "Factor to enlarge thumbnail by"}))
        .append($("<td>").append($("<input>", {"type": "number", "min": "1", "step": "0.01", "id": "ytbsp-settings-enlargeFactor", "value": config.enlargeFactor})))
        .append($("<td>", {"html": "Default: 2.8 | 1 : disable thumbnail enlarge"})));
    settingsTable.append($("<tr>")
        .append($("<td>", {"html": "Factor to enlarge native thumbnail by"}))
        .append($("<td>").append($("<input>", {"type": "number", "min": "1", "step": "0.01", "id": "ytbsp-settings-enlargeFactorNative", "value": config.enlargeFactorNative})))
        .append($("<td>", {"html": "Default: 2.0 | 1 : disable thumbnail enlarge"})));
    settingsTable.append($("<tr>")
        .append($("<td>", {"html": "threshold to preload thumbnails"}))
        .append($("<td>").append($("<input>", {"type": "number", "min": "0", "id": "ytbsp-settings-screenThreshold", "value": config.screenThreshold})).append(" px"))
        .append($("<td>", {"html": "Default: 500 | Higher threshold results in slower loading and more network traffic. Lower threshold may cause thumbnails to not show up immediately."})));
    settingsDialog.append(settingsTable);

    // Function for save button.
    const saveSettings = function() {
        loadingProgress(1);

        config.useRemoteData = $("#ytbsp-settings-useRemoteData").prop("checked");
        config.hideEmptySubs = $("#ytbsp-settings-hideEmptySubs").prop("checked");
        config.hideSeenVideos = $("#ytbsp-settings-hideSeenVideos").prop("checked");
        config.maxSimSubLoad = $("#ytbsp-settings-maxSimSubLoad").val();
        config.maxVidsPerRow = $("#ytbsp-settings-maxVidsPerRow").val();
        config.maxVidsPerSub = $("#ytbsp-settings-maxVidsPerSub").val();
        config.timeToMarkAsSeen = $("#ytbsp-settings-timeToMarkAsSeen").val();
        config.enlargeDelay = $("#ytbsp-settings-enlargeDelay").val();
        config.enlargeFactor = $("#ytbsp-settings-enlargeFactor").val();
        config.enlargeFactorNative = $("#ytbsp-settings-enlargeFactorNative").val();
        config.playerQuality = $("#ytbsp-settings-playerQuality").val();
        config.screenThreshold = $("#ytbsp-settings-screenThreshold").val();
        config.autoPauseVideo = $("#ytbsp-settings-autoPauseVideo").prop("checked");

        saveConfig().then(() => {
            setTimeout(() => {
                closeModal();
                loadingProgress(-1);
                location.reload();
            }, 200);
        });
    };

    let versionInformation = "";
    try {
        // eslint-disable-next-line camelcase
        versionInformation = GM_info && GM_info.script ? `script version:${GM_info.script.version}` : "";
    } catch (e) {
        console.info("Tampermonkey variables not available.");
    }
    const endDiv = $("<div/>", {"id": "ytbsp-modal-end-div"})
        .append($("<a/>", {"html": "https://github.com/Crow08/YTBSP", "href": "https://github.com/Crow08/YTBSP", "target": "_blank", "class": "ytbsp-func", "style": "font-size: 1rem;"}))
        .append($("<p/>", {"html": versionInformation, "class": "ytbsp-func", "style": "font-size: 1rem;"}))
        .append($("<input/>", {"type": "submit", "class": "ytbsp-func", "value": "Cancel", "on": {"click": closeModal}}))
        .append($("<input/>", {"type": "submit", "class": "ytbsp-func", "value": "Save", "on": {"click": saveSettings}}));
    return settingsDialog.append(endDiv);
}
$(".ytbsp-func#ytbsp-settings", mainDiv).click(openSettingsDialog);

// Show backup dialog modal
function openModal(content) {
    const contentDiv = $("#ytbsp-modal-content");
    const modal = $("#ytbsp-modal");
    if (0 === contentDiv.length || 0 === modal.length) {
        console.error("could not open modal!");
        return;
    }
    contentDiv.empty();
    contentDiv.append(content);
    modal.css("display", "block");
    setTimeout(() => {
        modal.css("opacity", "1");
    }, 0);
}

// Hide backup dialog modal
function closeModal() {
    const modal = $("#ytbsp-modal");
    if (0 !== modal.length) {
        modal.css("display", "none");
        modal.css("opacity", "0");
    }
}

const player = new Player(); // Unique Player Object.

// List for manually checked and potentially unsubscribed or deleted channels.
let manuallyCheckedSubs = [];

// Save all video information and compares it to locally cached information,
// To prevent subscription information to get lost when youtube api misses subscriptions
// (this happens quite frequently).
function saveList() {

    // Helper function to check if a sub is already the sublist.
    const isInSubs = function(id) {
        return 0 !== $.grep(subs, (sub) => sub.id === id).length;
    };

    // TODO: Too complicated and potentially wrong at first invocation...

    // Check if all subs in cache are loaded properly.
    for (let i = 0; i < cachedVideoInformation.length; i++) {
        // If cached subscription was not already checked and is not in current sub list.
        if (!manuallyCheckedSubs.includes(cachedVideoInformation[i].id) &&
            !isInSubs(cachedVideoInformation[i].id)) {
            // If subscription was not loaded check if still subscribed.
            checkAndAppendSub(cachedVideoInformation[i].id);
            manuallyCheckedSubs.push(cachedVideoInformation[i].id);
            // After subscription is checked this function is called again.
            return;
        }
    }
    // Clear manuallyCheckedSubs because new cache will be created when saving.
    manuallyCheckedSubs = [];

    // Construct new cache from current subs.
    const saveObj = [];
    subs.forEach((sub) => {
        saveObj.push(sub.getDTO());
    });

    // Save new video information cache.
    cachedVideoInformation = saveObj;
    saveVideoInformation();
}


// Now we just need to generate a stylesheet

// Function to set css-styles to alter native youtube elements depending on the page loaded.
function setYTStyleSheet(bodyStyle) {
    $("#ytbsp-yt-css").remove();
    const css = document.createElement("style");
    css.type = "text/css";
    css.id = "ytbsp-yt-css";
    css.innerHTML = bodyStyle;

    document.head.appendChild(css);
}

// YTBSP css for all custom elements.
function addYTBSPStyleSheet() {
    const css = document.createElement("style");
    css.type = "text/css";
    css.id = "ytbsp-css";

    css.innerHTML = cssString;


    document.head.appendChild(css);
}

// Add css for enlarged thumbnails.
function addThumbnailEnlargeCss() {
    const dark = isDarkModeEnabled();
    const altBorderColor = dark ? "#737373" : "#737373";

    const css = document.createElement("style");
    css.type = "text/css";
    css.id = "ytbsp-css-thumb";
    css.innerHTML =
        `ytd-thumbnail:hover { transform: scale(${config.enlargeFactorNative}); border: solid ${config.enlargeFactorNative / 2.0}px ${altBorderColor}; padding: 0px; z-index: 2; }` +
        `ytd-thumbnail { padding: ${config.enlargeFactorNative / 2.0}px }` +
        "#video-title { width: 200px; }" +
        "#scroll-container.yt-horizontal-list-renderer { overflow: visible; }";
    document.head.appendChild(css);
}

// Check if dark theme is active.
function isDarkModeEnabled() {
    const color = getComputedStyle(document.documentElement).backgroundColor.match(/\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/u);
    const dark = document.documentElement.getAttribute("dark");
    return dark || (color && 384 > (parseInt(color[1], 10) + parseInt(color[2], 10) + parseInt(color[3], 10)));
}

// Because of the extreme amount of thumbs they shouldn't be downloaded all at once (data-src instead of src)
// Since 2012.6-1 also the entire update only starts as soon as you scroll to it
// The solution is: only download those on the screen

// Now we need an scroll event
// Also if the window is resized it should be triggered

// 0: function ready
// 1: function processing
// 2: function processing and request pending
let occupied = 0;

// TODO: too complicated
function handleViewChange() {
    if (0 !== occupied) {
        occupied = 2;
    } else {
      occupied = 1;
      setTimeout(() => {
          const changeEventTime = Date.now(); // The time the page was moved or resized.
          subs.forEach((sub) => {
              sub.updateInView(changeEventTime);
          });
          
          if (2 === occupied) {
              occupied = 0;
              handleViewChange();
          }else{
              occupied = 0;
          }
      }, 0);
    }
}
window.addEventListener("scroll", handleViewChange, false);
window.addEventListener("resize", handleViewChange, false);

// Handler to manage a fresh page load or a page navigation
function handlePageChange() {
    if ((/.*watch\?.+list=.+/u).test(location)) {
        autoPauseThisVideo = false;
    } else {
        autoPauseThisVideo = config.autoPauseVideo;
    }
    clearTimeout(markAsSeenTimeout);
    toggleGuide = false;
    // Forces some images to reload...
    window.dispatchEvent(new Event("resize"));
    // If we are on the start page (or feed pages).
    if ((/^(\/?|((\/feed\/)(trending|subscriptions|history)\/?))?$/iu).test(location.pathname)) {
        setYTStyleSheet(bodyStyleStartpage);
    } else if ((/^\/?watch$/u).test(location.pathname)) {
        setYTStyleSheet(bodyStyleVideo);
        watchpage();
    } else if ((/^\/?results$/u).test(location.pathname)) {
        setYTStyleSheet(bodyStyleSearch);
    } else if ((/^\/?playlist$/u).test(location.pathname)) {
        setYTStyleSheet(bodyStylePlaylist);
    } else {
        setYTStyleSheet(bodyStyleDefault);
    }
    if (player.isPeekPlayerActive()) {
        player.showNativePlayer();
    }

    if (1 < location.pathname.length) {
        shownative();
        if ((/^\/?watch$/u).test(location.pathname)) {
            toggleGuide = true;
        }
    } else {
        hidenative();
    }
}

// Handler for navigating to a watch-page (URL: */watch*)
function watchpage() {
    hideMAToolbar();
    // Mark as seen after at least X seconds.
    markAsSeenTimeout = setTimeout(() => {
        const vid = location.href.match(/v=([^&]{11})/u)[1];
        if (vid) {
            const sid = $(YT_CHANNEL_LINK).attr("href").match(/\/channel\/([^&]*)/u)[1];
            subs.forEach((sub, i) => {
                if (sub.id === sid) {
                    sub.videos.forEach((video, j) => {
                        if (video.vid === vid) {
                            subs[i].videos[j].see();
                            subs[i].buildSubList();
                            saveList();
                        }
                    });
                }
            });
        }
    }, config.timeToMarkAsSeen * 1000);
}


let oldHref = document.location.href; // Saves previous location until page change is processed.

// Unique Mutation Observer to react to certain events.
const observer = new MutationObserver((() => {
    // Detect page changes.
    if (oldHref !== document.location.href) {
        oldHref = document.location.href;
        handlePageChange();
    }
    // Inject YTBSP main div if not injected already.
    if (0 === mainDiv.parent().length && 0 !== $(YT_CONTENT).length) {
        $(YT_CONTENT).prepend(mainDiv);
        $(window).scrollTop(0);
    }
    // Detect going fullscreen.
    if (0 !== $(YT_PLAYER_CONTROL).length && true === $(YT_PLAYER_CONTROL).get(0).fullscreen) {
        mainDiv.hide();
    } else {
        mainDiv.show();
    }
}));

// Setup mutation observer to detect page changes and act accordingly.
function initPageChangeObserver() {
    observer.observe(document.querySelector("body"), {"childList": true, "subtree": true});
}

// Hide MA Toolbar.
function hideMAToolbar() {
    const css = document.createElement("style");
    css.type = "text/css";
    css.innerHTML = `${MA_TOOLBAR}{display: none;}${
        YT_VIDEO_TITLE} {display: block;}`;
    document.head.appendChild(css);
}

// Opens Video by Id using SPF without reloading the entire site.
function openVideoWithSPF(vid) {
    // Using a native YT event to mimic a native navigation.
    const ytdApp = document.querySelector(YT_APP);
    ytdApp.fire("yt-navigate", {
        "endpoint": {
            "watchEndpoint": {
                "videoId": vid
            },
            "webNavigationEndpointData": {
                "url": `/watch?v=${vid}`,
                "webPageType": "WATCH"
            }
        }
    });
}

$(window).bind("storage", (e) => {
    if ("YTBSP" === e.key) {
        getLocalVideoInformation().then((data) => {
            cachedVideoInformation = data;
            updateAllSubs();
        });
    }
});

// LifecycleHook: Startup:
// Executed once as soon as possible, before bulk of the main script.
function onScriptStart() {
    setYTStyleSheet(bodyStyleLoading);
    // Early configuration for settings that cannot wait until configuration is loaded.
    config.timeToMarkAsSeen = localStorage.getItem("YTBSP_timeToMarkAsSeen");
    config.autoPauseVideo = "0" !== localStorage.getItem("YTBSP_autoPauseVideo");
}

// LifecycleHook: DocumentRead:
// Executed once as soon as the native page has finished loading.
$(document).ready(() => {
    $(YT_STARTPAGE_BODY).hide();
    initPageChangeObserver();
    handlePageChange();
    // Remove css class from MA.
    $("html").removeClass("m0");
});

// LifecycleHook: ConfigLoaded:
// Executed after config is Loaded.
function afterConfigLoaded() {
    addYTBSPStyleSheet();
    if (1 <= config.enlargeFactorNative) {
        addThumbnailEnlargeCss();
    }
    setPlayerQuality();
}

const defaultPlayFunction = HTMLMediaElement.prototype.play; // Save default play function before replacing it.

// Override play Function to prevent player from automatically starting the video after loading video page.
HTMLMediaElement.prototype.play = function() {
    // Need JQuery to be loaded.
    if (!jQuery.isReady) {
        return;
    }
    // Prevent the first call to play this video and act normally afterwards.
    if (autoPauseThisVideo) {
        autoPauseThisVideo = false;
        const playerParentRef = this.parentElement.parentElement;
        if (playerParentRef) {
            playerParentRef.pauseVideo();
        }
        return;
    }
    // Resume default behaviour.
    defaultPlayFunction.call(this);
};

// Set preferred player quality.
function setPlayerQuality() {
    localStorage.setItem(YT_PLAYER_QUALITY, `{"data":"${config.playerQuality}","expiration":${window.moment().add(1, "months").valueOf()},"creation":${window.moment().valueOf()}}`);
}
