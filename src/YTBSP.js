window.moment = this.moment;

window.GoogleAuth = this.GoogleAuth;

(function() {
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
    let useRemoteData = true;					// DEFAULT: true (using Google Drive as remote storage).
    let maxSimSubLoad = 10;						// DEFAULT: 10 (Range: 1 - 50) (higher numbers result into slower loading of single items but overall faster loading).
    let maxVidsPerRow = 9;						// DEFAULT: 9.
    let maxVidsPerSub = 36;						// DEFAULT: 36 (Range: 1 - 50) (should be dividable by maxVidsPerRow).
    let enlargeDelay = 500;						// DEFAULT: 500 (in ms).
    let enlargeFactor = 2.8;					// DEFAULT: 2.8 (x * 90px).
    let enlargeFactorNative = 2.0;				// DEFAULT: 2.0 (x * 94px).
    let timeToMarkAsSeen = 10;					// DEFAULT: 10 (in s).
    let screenThreshold = 500;					// DEFAULT: 500 (preload images beyond current screen region in px).
    let playerQuality = resolutions["1080p"];	// DEFAULT: hd1080 (resolutions['1080p'])
    let peekPlayerSizeFactor = 1.5;				// DEFAULT: 1.5 (x * 180px).
    let autoPauseVideo = false;					// DEFAULT: false.
    let hideSeenVideos = false;					// DEFAULT: false.
    let hideEmptySubs = true;					// DEFAULT: true.

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

    // Variables for inView check.
    let lastScroll = Date.now(); // The last time the page was moved or resized.
    let screenTop = 0;
    let screenBottom = screenTop + window.innerHeight;

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
    const dark_or_light_theme = isDarkModeEnabled() ? "ytbsp-dark-theme" : "ytbsp-light-theme";
    const mainDiv = $("<div/>", {"id": "YTBSP", "class": dark_or_light_theme});
    const menuStrip = $("<div/>", {"id": "ytbsp-menuStrip"});
    menuStrip.append($("<div/>", {"id": "ytbsp-loaderSpan"})
        .append(getLoader("ytbsp-main-loader"))
        .append($("<button/>", {"id": "ytbsp-refresh", "class": "ytbsp-func", "html": "&#x27F3;"})));
    menuStrip.append($("<button/>", {"id": "ytbsp-togglePage", "class": "ytbsp-func", "html": "Toggle YTBSP"}));
    menuStrip.append($("<button/>", {"id": "ytbsp-removeAllVideos", "class": "ytbsp-func ytbsp-hideWhenNative", "html": "Remove all videos"}));
    menuStrip.append($("<button/>", {"id": "ytbsp-resetAllVideos", "class": "ytbsp-func ytbsp-hideWhenNative", "html": "Reset all videos"}));
    menuStrip.append($("<button/>", {"id": "ytbsp-backup", "class": "ytbsp-func ytbsp-hideWhenNative", "html": "Backup video info"}));
    menuStrip.append($("<label/>", {"for": "ytbsp-hideSeenVideosCb", "class": "ytbsp-func ytbsp-hideWhenNative"})
        .append($("<input/>", {"id": "ytbsp-hideSeenVideosCb", "type": "checkbox", "checked": hideSeenVideos}))
        .append("Hide seen videos"));
    menuStrip.append($("<label/>", {"for": "ytbsp-hideEmptySubsCb", "class": "ytbsp-func ytbsp-hideWhenNative"})
        .append($("<input/>", {"id": "ytbsp-hideEmptySubsCb", "type": "checkbox", "checked": hideEmptySubs}))
        .append("Hide empty subs"));
    menuStrip.append($("<button/>", {"id": "ytbsp-settings", "class": "ytbsp-func ytbsp-hideWhenNative", "html": "&#x2699;"}));
    mainDiv.append(menuStrip);
    mainDiv.append($("<ul/>", {"id": "ytbsp-subs", "css": {"min-width" : (maxVidsPerRow * 168) + "px"}}));
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

    useRemoteData = "0" !== localStorage.getItem("YTBSP_useRemoteData");

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
        if (useRemoteData) {
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
                    useRemoteData = "0" !== files[0].appProperties.useRemoteData;
                    hideSeenVideos = "0" !== files[0].appProperties.hideSeenVideos;
                    hideEmptySubs = "0" !== files[0].appProperties.hideEmptySubs;
                    maxSimSubLoad = files[0].appProperties.maxSimSubLoad;
                    maxVidsPerRow = files[0].appProperties.maxVidsPerRow;
                    maxVidsPerSub = files[0].appProperties.maxVidsPerSub;
                    enlargeDelay = files[0].appProperties.enlargeDelay;
                    enlargeFactor = files[0].appProperties.enlargeFactor;
                    enlargeFactorNative = files[0].appProperties.enlargeFactorNative;
                    playerQuality = files[0].appProperties.playerQuality;
                    timeToMarkAsSeen = files[0].appProperties.timeToMarkAsSeen;
                    screenThreshold = files[0].appProperties.screenThreshold;
                    autoPauseVideo = "0" !== files[0].appProperties.autoPauseVideo;
                    $("#ytbsp-hideSeenVideosCb").prop("checked", hideSeenVideos);
                    $("#ytbsp-hideEmptySubsCb").prop("checked", hideEmptySubs);
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
            useRemoteData = "0" !== localStorage.getItem("YTBSP_useRemoteData");
            hideSeenVideos = "0" !== localStorage.getItem("YTBSP_hideSeenVideos");
            hideEmptySubs = "0" !== localStorage.getItem("YTBSP_hideEmptySubs");
            maxSimSubLoad = localStorage.getItem("YTBSP_maxSimSubLoad");
            maxVidsPerRow = localStorage.getItem("YTBSP_maxVidsPerRow");
            maxVidsPerSub = localStorage.getItem("YTBSP_maxVidsPerSub");
            enlargeDelay = localStorage.getItem("YTBSP_enlargeDelay");
            enlargeFactor = localStorage.getItem("YTBSP_enlargeFactor");
            enlargeFactorNative = localStorage.getItem("YTBSP_enlargeFactorNative");
            playerQuality = localStorage.getItem("YTBSP_playerQuality");
            timeToMarkAsSeen = localStorage.getItem("YTBSP_timeToMarkAsSeen");
            screenThreshold = localStorage.getItem("YTBSP_screenThreshold");
            autoPauseVideo = "0" !== localStorage.getItem("YTBSP_autoPauseVideo");
            $("#ytbsp-hideSeenVideosCb").prop("checked", hideSeenVideos);
            $("#ytbsp-hideEmptySubsCb").prop("checked", hideEmptySubs);
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
                        "useRemoteData": useRemoteData,
                        "hideSeenVideos": hideSeenVideos,
                        "hideEmptySubs": hideEmptySubs,
                        "maxSimSubLoad": maxSimSubLoad,
                        "maxVidsPerRow": maxVidsPerRow,
                        "maxVidsPerSub": maxVidsPerSub,
                        "enlargeDelay": enlargeDelay,
                        "enlargeFactor": enlargeFactor,
                        "enlargeFactorNative": enlargeFactorNative,
                        "playerQuality": playerQuality,
                        "timeToMarkAsSeen": timeToMarkAsSeen,
                        "screenThreshold": screenThreshold,
                        "autoPauseVideo": autoPauseVideo
                    }
                }
            ).then((response) => {
                remoteSaveFileID = response.id;
                // Config variables are already initialized with default values.
                $("#ytbsp-hideSeenVideosCb").prop("checked", hideSeenVideos);
                $("#ytbsp-hideEmptySubsCb").prop("checked", hideEmptySubs);
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
        if (useRemoteData) {
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
        if (useRemoteData) {
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
                        "useRemoteData": useRemoteData ? "1" : "0",
                        "hideSeenVideos": hideSeenVideos ? "1" : "0",
                        "hideEmptySubs": hideEmptySubs ? "1" : "0",
                        "maxSimSubLoad": maxSimSubLoad,
                        "maxVidsPerRow": maxVidsPerRow,
                        "maxVidsPerSub": maxVidsPerSub,
                        "enlargeDelay": enlargeDelay,
                        "enlargeFactor": enlargeFactor,
                        "enlargeFactorNative": enlargeFactorNative,
                        "playerQuality": playerQuality,
                        "timeToMarkAsSeen": timeToMarkAsSeen,
                        "screenThreshold": screenThreshold,
                        "autoPauseVideo": autoPauseVideo ? "1" : "0"
                    }}
                ).then(() => {
                    localStorage.setItem("YTBSP_useRemoteData", useRemoteData ? "1" : "0");
                    resolve();
                });
            }
        }));
    }

    // Save config to local storage file.
    function saveLocalConfig() {
        return new Promise(((resolve, reject) => {
            localStorage.setItem("YTBSP_useRemoteData", useRemoteData ? "1" : "0");
            localStorage.setItem("YTBSP_hideSeenVideos", hideSeenVideos ? "1" : "0");
            localStorage.setItem("YTBSP_hideEmptySubs", hideEmptySubs ? "1" : "0");
            localStorage.setItem("YTBSP_maxSimSubLoad", maxSimSubLoad);
            localStorage.setItem("YTBSP_maxVidsPerRow", maxVidsPerRow);
            localStorage.setItem("YTBSP_maxVidsPerSub", maxVidsPerSub);
            localStorage.setItem("YTBSP_enlargeDelay", enlargeDelay);
            localStorage.setItem("YTBSP_enlargeFactor", enlargeFactor);
            localStorage.setItem("YTBSP_enlargeFactorNative", enlargeFactorNative);
            localStorage.setItem("YTBSP_playerQuality", playerQuality);
            localStorage.setItem("YTBSP_timeToMarkAsSeen", timeToMarkAsSeen);
            localStorage.setItem("YTBSP_screenThreshold", screenThreshold);
            localStorage.setItem("YTBSP_autoPauseVideo", autoPauseVideo ? "1" : "0");
            resolve();
        }));
    }

    // Save video information.
    function saveVideoInformation() {
        if (useRemoteData) {
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
                "maxResults": maxSimSubLoad,
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
                    "maxResults": maxSimSubLoad,
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
                "fields": "items(snippet(resourceId/channelId,title)),pageInfo)"
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
                subs[i].updateVideos();
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
                subs[i].buildList();
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
                subs[i].buildList();
            });
            loadingProgress(-1, true);
        }, 0);
    }
    $(".ytbsp-func#ytbsp-resetAllVideos", mainDiv).click(resetAllVideos);

    // Hide seen videos buttons.
    function toggleHideSeenVideos() {
        hideSeenVideos = !hideSeenVideos;
        loadingProgress(1);
        saveConfig().then(() => { loadingProgress(-1); });
        subs.forEach((sub, i) => {
            subs[i].buildList();
        });
        $("#ytbsp-hideSeenVideosCb", mainDiv).prop("checked", hideSeenVideos);
    }
    $("#ytbsp-hideSeenVideosCb", mainDiv).change(toggleHideSeenVideos);

    // Hide empty subscriptions button.
    function toggleHideEmptySubs() {
        hideEmptySubs = !hideEmptySubs;
        loadingProgress(1);
        saveConfig().then(() => { loadingProgress(-1); });
        subs.forEach((sub, i) => {
            subs[i].handleVisablility();
        });
        $("#ytbsp-hideEmptySubsCb", mainDiv).prop("checked", hideEmptySubs);
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
        endDiv.append(getSlider("ytbsp-backup-switch", useRemoteData, backupSwitch));

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
            .append($("<td>").append(getSlider("ytbsp-settings-hideEmptySubs", hideEmptySubs)))
            .append($("<td>")));
        settingsTable.append($("<tr>")
            .append($("<td>", {"html": "Hide seen videos"}))
            .append($("<td>").append(getSlider("ytbsp-settings-hideSeenVideos", hideSeenVideos)))
            .append($("<td>")));
        settingsTable.append($("<tr>")
            .append($("<td>", {"html": "Use Google Drive"}))
            .append($("<td>").append(getSlider("ytbsp-settings-useRemoteData", useRemoteData)))
            .append($("<td>"), {"html": "Allows synchronization between browsers. May result in slower loading times."}));
        settingsTable.append($("<tr>")
            .append($("<td>", {"html": "Auto pause videos"}))
            .append($("<td>").append(getSlider("ytbsp-settings-autoPauseVideo", autoPauseVideo)))
            .append($("<td>"), {"html": "Open Videos in a paused state. (Does not effect playlists.)"}));

        const playerQualitySelect = $("<Select>", {"id": "ytbsp-settings-playerQuality"});
        for (const resolution in resolutions) {
            if (Object.prototype.hasOwnProperty.call(resolutions, resolution)) {
                playerQualitySelect.append($("<option>", {"value": resolutions[resolution], "html": resolution}));
            }
        }
        playerQualitySelect.val(playerQuality);

        settingsTable.append($("<tr>")
            .append($("<td>", {"html": "Player Quality"}))
            .append($("<td>").append(playerQualitySelect))
            .append($("<td>"), {"html": "Open Videos in a paused state. (Does not effect playlists.)"}));
        settingsTable.append($("<tr>")
            .append($("<td>", {"html": "Max number of subscriptions loading simultaneously"}))
            .append($("<td>").append($("<input>", {"type": "number", "min": "1", "max": "50", "id": "ytbsp-settings-maxSimSubLoad", "value": maxSimSubLoad})))
            .append($("<td>", {"html": "Default: 10 | Range: 1-50 | Higher numbers result in slower loading of single items but overall faster loading."})));
        settingsTable.append($("<tr>")
            .append($("<td>", {"html": "Max number of videos per row"}))
            .append($("<td>").append($("<input>", {"type": "number", "min": "1", "max": "50", "id": "ytbsp-settings-maxVidsPerRow", "value": maxVidsPerRow})))
            .append($("<td>", {"html": "Default: 9 | Range: 1-50"})));
        settingsTable.append($("<tr>")
            .append($("<td>", {"html": "Max number of videos per subscription"}))
            .append($("<td>").append($("<input>", {"type": "number", "min": "1", "max": "50", "id": "ytbsp-settings-maxVidsPerSub", "value": maxVidsPerSub})))
            .append($("<td>", {"html": "Default: 27 | Range: 1-50 | Should be dividable by videos per row."})));
        settingsTable.append($("<tr>")
            .append($("<td>", {"html": "Watch time to mark video as seen"}))
            .append($("<td>").append($("<input>", {"type": "number", "min": "0", "id": "ytbsp-settings-timeToMarkAsSeen", "value": timeToMarkAsSeen})).append(" s"))
            .append($("<td>", {"html": "Default: 10"})));
        settingsTable.append($("<tr>")
            .append($("<td>", {"html": "Delay for thumbnail enlarge"}))
            .append($("<td>").append($("<input>", {"type": "number", "min": "0", "id": "ytbsp-settings-enlargeDelay", "value": enlargeDelay})).append(" ms"))
            .append($("<td>", {"html": "Default: 500"})));
        settingsTable.append($("<tr>")
            .append($("<td>", {"html": "Factor to enlarge thumbnail by"}))
            .append($("<td>").append($("<input>", {"type": "number", "min": "1", "step": "0.01", "id": "ytbsp-settings-enlargeFactor", "value": enlargeFactor})))
            .append($("<td>", {"html": "Default: 2.8 | 1 : disable thumbnail enlarge"})));
        settingsTable.append($("<tr>")
            .append($("<td>", {"html": "Factor to enlarge native thumbnail by"}))
            .append($("<td>").append($("<input>", {"type": "number", "min": "1", "step": "0.01", "id": "ytbsp-settings-enlargeFactorNative", "value": enlargeFactorNative})))
            .append($("<td>", {"html": "Default: 2.0 | 1 : disable thumbnail enlarge"})));
        settingsTable.append($("<tr>")
            .append($("<td>", {"html": "threshold to preload thumbnails"}))
            .append($("<td>").append($("<input>", {"type": "number", "min": "0", "id": "ytbsp-settings-screenThreshold", "value": screenThreshold})).append(" px"))
            .append($("<td>", {"html": "Default: 500 | Higher threshold results in slower loading and more network traffic. Lower threshold may cause thumbnails to not show up immediately."})));
        settingsDialog.append(settingsTable);

        // Function for save button.
        const saveSettings = function() {
            loadingProgress(1);

            useRemoteData = $("#ytbsp-settings-useRemoteData").prop("checked");
            hideEmptySubs = $("#ytbsp-settings-hideEmptySubs").prop("checked");
            hideSeenVideos = $("#ytbsp-settings-hideSeenVideos").prop("checked");
            maxSimSubLoad = $("#ytbsp-settings-maxSimSubLoad").val();
            maxVidsPerRow = $("#ytbsp-settings-maxVidsPerRow").val();
            maxVidsPerSub = $("#ytbsp-settings-maxVidsPerSub").val();
            timeToMarkAsSeen = $("#ytbsp-settings-timeToMarkAsSeen").val();
            enlargeDelay = $("#ytbsp-settings-enlargeDelay").val();
            enlargeFactor = $("#ytbsp-settings-enlargeFactor").val();
            enlargeFactorNative = $("#ytbsp-settings-enlargeFactorNative").val();
            playerQuality = $("#ytbsp-settings-playerQuality").val();
            screenThreshold = $("#ytbsp-settings-screenThreshold").val();
            autoPauseVideo = $("#ytbsp-settings-autoPauseVideo").prop("checked");

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
            console.info("Tampermonkey variables not arivable.");
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

    // ///////////////////////////////////
    // PLAYER Object constructor //
    // ///////////////////////////////////

    function Player() {
        this.playerRef = null;
        this.nativePlayerParent = null;
        this.nativePlayerCss = null;
        this.nativePlayerIsTheater = false;
        this.peekPlayerActive = false;

        // Show Peek Player:
        // Small video preview in the bottom right corner as an overlay over another page.
        this.showPeekPlayer = function() {
            this.playerRef = $(YT_PLAYER);
            // If player cannot be found or peekPlayerSize is 0 (disabled) don't show peek player.
            if (!this.playerRef.length || 0.0 >= peekPlayerSizeFactor) {
                return;
            }
            this.nativePlayerParent = this.playerRef.parent();
            if (null === this.nativePlayerCss) {
                // Save native player css before switching to peek player.
                this.nativePlayerCss = {
                    "position": this.playerRef.css("position"),
                    "right": this.playerRef.css("right"),
                    "bottom": this.playerRef.css("bottom"),
                    "width": this.playerRef.css("width"),
                    "height": this.playerRef.css("height"),
                    "zIndex": this.playerRef.css("zIndex")
                };
            }

            // Try to switch to theater mode, because the video size only is scalable in theater mode.
            try {
                this.nativePlayerIsTheater = $(YT_PLAYER_CONTROL).get(0).theater;
                $(YT_PLAYER_CONTROL).get(0).theaterModeChanged_(true);
            } catch (e) {
                console.warn("Unable to put player into theater mode.");
            }

            // Place peek player in YTBSP main div.
            $("#YTBSP").append(this.playerRef);

            // Start player immediately if video was playing before (1: playing).
            if (1 === this.playerRef.get(0).getPlayerState()) {
                this.playerRef.get(0).playVideo();
            }

            // Hide player controls in peek player mode because it takes too much space.
            this.playerRef.get(0).hideControls();

            // Put peek player css into place.
            this.playerRef.css({
                "position": "fixed",
                "right": "20px",
                "bottom": "20px",
                "width": `${320 * peekPlayerSizeFactor}px`,
                "height": `${180 * peekPlayerSizeFactor}px`,
                "zIndex": "10"
            });

            // Add overlay to the peek player that will control click behaviour
            this.playerRef.append($("<div/>", {"id": "ytbsp-peekplayer-overlay", "css": {"width": (320 * peekPlayerSizeFactor),"height": (180 * peekPlayerSizeFactor)}})
                .append($("<div/>", {"id": "ytbsp-peekplayer-overlay-player-control", "css": {"width": ((320 * peekPlayerSizeFactor) / 10),"height": ((320 * peekPlayerSizeFactor) / 10)}})
                    .append($("<label/>", {"class": "ytbsp-play-pause-icon", "title": "play / pause"}))));
            // Initialize play/pause icon depending on player state
            if (!$(YT_VIDEO_STREAM).get(0).paused) {
                $(".ytbsp-play-pause-icon").addClass("ytbsp-pause");
            }
            const that = this;
            $("#ytbsp-peekplayer-overlay").click((event) => {
                if (0 !== $("#ytbsp-peekplayer-overlay-player-control:hover").length) { // If over play/pause button
                    that.playerRef.trigger("click"); // Send click to youtube player to play/pause the video
                    $(".ytbsp-play-pause-icon").toggleClass("ytbsp-pause");
                }
                else { // Click somewhere else on the peek player
                    // Prevent the event from bubbling to the youtube player and toggle ytbsp to native player view
                    event.preventDefault();
                    event.stopPropagation();
                    toggleYTBSP();
                }
            });

            // Force video to update size.
            window.dispatchEvent(new Event("resize"));

            this.peekPlayerActive = true;
        };

        // Returns from peek player to native player.
        this.showNativePlayer = function() {
            // If player and player Container cannot be found abort.
            if (null === this.nativePlayerParent || !this.nativePlayerParent.length) {
                return;
            }
            this.playerRef = $(YT_PLAYER);
            if (!this.playerRef.length) {
                return;
            }
            // Return player to its original position.
            this.nativePlayerParent.append($(YT_PLAYER));

            // Start player immediately if video was playing before (1: playing).
            if (1 === this.playerRef.get(0).getPlayerState()) {
                this.playerRef.get(0).playVideo();
            }

            // Show player controls.
            this.playerRef.get(0).showControls();

            // Revert css changes.
            this.playerRef.css(this.nativePlayerCss);

            // Force video to update size.
            window.dispatchEvent(new Event("resize"));

            // If player was originally not in theater mode, try to disable it.
            if (!this.nativePlayerIsTheater) {
                try {
                    $(YT_PLAYER_CONTROL).get(0).theaterModeChanged_(false);
                } catch (e) {
                    console.warn("Unable to put player out of theater mode.");
                }
            }

            $("#ytbsp-peekplayer-overlay").remove();

            this.peekPlayerActive = false;
        };

        // Returns whether player is in peek mode.
        this.isPeekPlayerActive = function() {
            return this.peekPlayerActive;
        };
    }

    // ///////////////////////////////////
    // SUBSCRIPTION Object constructor //
    // ///////////////////////////////////

    function Subscription(snippet) {

        this.videos = [];
        this.name = snippet.title;
        this.id = snippet.resourceId.channelId;

        // Now build the overview.
        this.row = $("<li/>", {"class": "ytbsp-subscription", "css": {"display": hideEmptySubs ? "none" : ""}});

        // Create content.
        const subMenuStrip = $("<div/>", {"class": "ytbsp-subMenuStrip"});

        subMenuStrip.append($("<div/>", {"css": {"float": "right"}})
            .append($("<button/>", {"class": "ytbsp-func ytbsp-subRemoveAllVideos", "html": "Remove all"}))
            .append($("<button/>", {"class": "ytbsp-func ytbsp-subResetAllVideos", "html": "Reset all"}))
            .append($("<button/>", {"class": "ytbsp-func ytbsp-subSeenAllVideos", "html": "Mark all as seen"}))
            .append($("<button/>", {"class": "ytbsp-func ytbsp-subShowMore", "html": "Show more"})));
        subMenuStrip.append($("<div/>", {"class": "ytbsp-loaderDiv"})
            .append(getLoader(`loader_${this.id}`)));
        subMenuStrip.append($("<h3/>", {"class": "ytbsp-subTitle"})
            .append($("<a/>", {"href": `/channel/${this.id}`})));
        this.row.append(subMenuStrip);
        this.row.append($("<ul/>", {"class": "ytbsp-subVids"}));

        // Save some references.
        this.videoList = $(".ytbsp-subVids", this.row);
        this.titleObj = $(".ytbsp-subTitle a", this.row);

        // Put content in place.
        this.titleObj.html(this.name);
        subList.append(this.row);

        // Get videos for sub from api.
        this.updateVideos();

        const that = this;

        // Function to remove all videos.
        function subRemoveAllVideos() {
            that.videos.forEach((video, i) => {
                that.videos[i].remove();
            });
            that.buildList();
            saveList();
        }
        $(".ytbsp-func.ytbsp-subRemoveAllVideos", this.row).click(subRemoveAllVideos);

        // Function to reset all videos.
        function subResetAllVideos() {
            that.videos.forEach((video, i) => {
                that.videos[i].reset();
            });
            that.buildList();
            saveList();
        }
        $(".ytbsp-func.ytbsp-subResetAllVideos", this.row).click(subResetAllVideos);

        // Function to see all.
        function subSeenAllVideos() {
            that.videos.forEach((video, i) => {
                that.videos[i].see();
            });
            that.buildList();
            saveList();

        }
        $(".ytbsp-func.ytbsp-subSeenAllVideos", this.row).click(subSeenAllVideos);

        // Function to show more.
        function subShowMore() {
            that.showall = !that.showall;
            if (that.showall) {
                $(".ytbsp-func.ytbsp-subShowMore", that.row).text("Show less");
            } else {
                $(".ytbsp-func.ytbsp-subShowMore", that.row).text("Show more");
            }
            that.buildList();
        }
        $(".ytbsp-func.ytbsp-subShowMore", this.row).click(subShowMore);
    }
    Subscription.prototype = {

        "showall": false,
        "needsUpdate": false,
        "isInView": false,

        "updateVideos": function() {
            loadingProgress(1, false, this);
            buildApiRequest(
                "GET",
                "/youtube/v3/playlistItems",
                {
                    "maxResults": maxVidsPerSub,
                    "part": "snippet",
                    "fields": "items(snippet(publishedAt,resourceId/videoId,thumbnails(maxres,medium),title)),nextPageToken,pageInfo,prevPageToken",
                    "playlistId": this.id.replace(/^UC/u, "UU")
                }
            ).then(processRequestVids);

            const that = this;

            function processRequestVids(response) {
                that.videos = [];
                // If videos for sub are in cache find them.
                const cacheSub = $.grep(cachedVideoInformation, (subsList) => subsList.id === that.id);
                let cacheVideos = [];
                if (1 === cacheSub.length) {
                    cacheVideos = cacheSub[0].videos;
                }

                response.items.forEach((video) => {
                    let thumb = null;
                    let thumbLarge = null;
                    let title = null;
                    let upload = null;
                    let pubDate = null;
                    let vid = null;
                    let seen = null;
                    let removed = null;

                    if (Object.prototype.hasOwnProperty.call(video, "snippet")) {
                        if (Object.prototype.hasOwnProperty.call(video.snippet, "title")) {
                            title = video.snippet.title;
                        }
                        if (Object.prototype.hasOwnProperty.call(video.snippet, "publishedAt")) {
                            upload = window.moment(video.snippet.publishedAt).fromNow();
                            pubDate = window.moment(video.snippet.publishedAt).format("YYYY-MM-DD HH:mm:ss");
                        }
                        if (Object.prototype.hasOwnProperty.call(video.snippet, "resourceId") && Object.prototype.hasOwnProperty.call(video.snippet.resourceId, "videoId")) {
                            vid = video.snippet.resourceId.videoId;
                        }
                        if (Object.prototype.hasOwnProperty.call(video.snippet, "thumbnails")) {
                            if (Object.prototype.hasOwnProperty.call(video.snippet.thumbnails, "medium") && Object.prototype.hasOwnProperty.call(video.snippet.thumbnails.medium, "url")) {
                                thumb = video.snippet.thumbnails.medium.url;
                            }
                            if (Object.prototype.hasOwnProperty.call(video.snippet.thumbnails, "maxres") && Object.prototype.hasOwnProperty.call(video.snippet.thumbnails.maxres, "url")) {
                                thumbLarge = video.snippet.thumbnails.maxres.url;
                            }
                        }
                    }

                    // Merge cache info if available.
                    const cacheVideo = $.grep(cacheVideos, (cVideo) => cVideo.vid === vid);
                    if (1 === cacheVideo.length) {
                        if (Object.prototype.hasOwnProperty.call(cacheVideo[0], "seen")) {
                            seen = cacheVideo[0].seen;
                        }
                        if (Object.prototype.hasOwnProperty.call(cacheVideo[0], "removed")) {
                            removed = cacheVideo[0].removed;
                        }
                    }

                    const infos = {
                        "vid": vid,
                        "title": title,
                        "thumb": thumb ? thumb : "",
                        "thumbLarge": thumbLarge ? thumbLarge : "",
                        "uploaded": upload ? upload : "missing upload time",
                        "pubDate": pubDate ? pubDate : "missing upload time",
                        "seen": seen ? seen : false,
                        "removed": removed ? removed : false
                    };
                    that.videos.push(new Video(infos));
                });
                // Rebuild the list.
                that.buildList();

                loadingProgress(-1, false, that);
            }
        },

        // (Re-)Build the list of videos.
        "buildList": function() {

            const that = this;

            const alreadyIn = $(".ytbsp-video-item", this.videoList);
            let visibleItems = 0;
            const limit = this.showall ? maxVidsPerSub : maxVidsPerRow;
            $("br", this.videoList).remove();
            // Now loop through the videos.
            this.videos.forEach(function(video, i) {

                // If that video is removed search for it and remove it when found.
                if (video.isRemoved() || (hideSeenVideos && video.isSeen())) {
                    const thumbNode = $(`#YTBSPthumb_${video.vid}`, this.videoList);
                    const index = alreadyIn.index(thumbNode);
                    if (thumbNode && -1 !== index) {
                        thumbNode.remove();
                        alreadyIn.splice(index, 1);
                    }

                    // If this video isn't removed and we are still in the search of new ones
                } else if (visibleItems < limit) {
                    const thumb = alreadyIn[visibleItems];
                    // If Video is already in the list, update it.
                    if (thumb && thumb.id.substr(11) === video.vid) {
                        this.videos[i].updateThumb(this.inView());
                        // If the thumb in this position isn't the right one.
                    } else {
                        // Create new thumb for video.
                        this.videos[i].createThumb(this.inView());
                        // Register some events from this thumb.
                        $(".ytbsp-seemarker", this.videos[i].thumbLi).click(() => {
                            that.videos[i].toggleSeen();
                            that.buildList();
                            saveList();
                        });
                        $(".ytbsp-x", this.videos[i].thumbLi).click(() => {
                            that.videos[i].remove();
                            that.buildList();
                            saveList();
                        });
                        // Insert new thumb.
                        if (visibleItems < alreadyIn.length) {
                            alreadyIn[visibleItems].before(this.videos[i].thumbLi[0]);
                            alreadyIn.splice(visibleItems, 0, this.videos[i].thumbLi);

                        } else {
                            this.videoList.append(this.videos[i].thumbLi);
                            alreadyIn.push(this.videos[i].thumbLi);
                        }
                    }
                    ++visibleItems;
                    if (visibleItems < limit && 0 === visibleItems % maxVidsPerRow) {
                        if (visibleItems < alreadyIn.length) {
                            $("</br>").insertBefore(alreadyIn[visibleItems]);
                        } else {
                            this.videoList.append($("</br>"));
                        }
                    }
                }
            }, this);

            // Remove excess items.
            for (let i = visibleItems, iLen = alreadyIn.length; i < iLen; ++i) {
                alreadyIn[i].remove();
            }

            // Handle visibility.
            this.isEmpty = 0 >= visibleItems;
            this.handleVisibility();
        },

        // Hides subscription if needed.
        "handleVisibility": function() {
            if (this.isEmpty && hideEmptySubs) {
                this.row.hide();
            } else {
                this.row.show();
            }
            updateSubsInView();
        },

        // Displays the Loader.
        "showLoader": function() {
            const loaderDiv = $(".ytbsp-loaderDiv", this.row);
            const loader = $(".ytbsp-loader", this.row);
            if (loaderDiv && loader) {
                loaderDiv.css("width", "16px");
                setTimeout(() => {
                    loader.css("opacity", "1");
                }, 200);
            }
        },

        // Removes the Loader.
        "removeLoader": function() {
            const loadDiv = $(".ytbsp-loaderDiv", this.row);
            const loader = $(".ytbsp-loader", this.row);
            if (loadDiv && loader) {
                setTimeout(() => {
                    loader.css("opacity", "0");
                    setTimeout(() => {
                        loadDiv.css("width", "0px");
                    }, 200);
                }, 200);
            }
        },

        // Checks if the subscription is within the threshold of the view.
        "inView": function() {

            if (this.lastViewCheck === lastScroll) {
                return this.isInView;
            }
            this.lastViewCheck = lastScroll;
            const offsetTop = this.videoList ? this.videoList.offset().top : 0;

            this.isInView = (this.videoList &&
                             offsetTop - screenThreshold < screenBottom &&
                             offsetTop + screenThreshold > screenTop
            );
            return this.isInView;
        },

        // Returns an object that can be saved as json.
        "getDTO": function() {
            const saveData = {
                "videos": [],
                "id": this.id
            };
            this.videos.forEach((video) => {
                saveData.videos.push(video.getDTO());
            });
            return saveData;
        }
    };


    // ////////////////////////////
    // VIDEO Object Constructor //
    // ////////////////////////////

    function Video(info) {
        this.vid = info.vid;
        this.addInfos(info);
        this.thumbLi = $("<li/>", {"id": `YTBSPthumb_${this.vid}`, "class": "ytbsp-video-item"});
    }

    const timeouts = {};

    Video.prototype = {
        "vid": null,
        "title": "",
        "thumb": "",
        "thumbLarge": "",
        "duration": "0:00",
        "uploaded": "",
        "pubDate": "",
        "clicks": "",

        "seen": false,
        "removed": false,

        "thumbItem": null,
        "thumbLargeItem": null,
        "durationItem": null,
        "clicksItem": null,
        "uploadItem": null,
        "titleItem": null,


        "addInfos": function(infos) {
            // Set given information.
            if (Object.prototype.hasOwnProperty.call(infos, "title")) {
                this.title = "" !== infos.title ? infos.title : this.title;
            }
            if (Object.prototype.hasOwnProperty.call(infos, "thumb")) {
                this.thumb = "" !== infos.thumb ? infos.thumb : this.thumb;
            }
            if (Object.prototype.hasOwnProperty.call(infos, "thumbLarge")) {
                this.thumbLarge = "" !== infos.thumbLarge ? infos.thumbLarge : this.thumbLarge;
            }
            if (Object.prototype.hasOwnProperty.call(infos, "duration")) {
                this.duration = "0:00" !== infos.duration ? infos.duration : this.duration;
            }
            if (Object.prototype.hasOwnProperty.call(infos, "uploaded")) {
                this.uploaded = "" !== infos.uploaded ? infos.uploaded : this.uploaded;
            }
            if (Object.prototype.hasOwnProperty.call(infos, "pubDate")) {
                this.pubDate = "" !== infos.pubDate ? infos.pubDate : this.pubDate;
            }
            if (Object.prototype.hasOwnProperty.call(infos, "clicks")) {
                this.clicks = "" !== infos.clicks ? infos.clicks : this.clicks;
            }
            if (Object.prototype.hasOwnProperty.call(infos, "seen")) {
                this.seen = false !== infos.seen ? infos.seen : this.seen;
            }
            if (Object.prototype.hasOwnProperty.call(infos, "removed")) {
                this.removed = false !== infos.removed ? infos.removed : this.removed;
            }
        },

        "isRemoved": function() {
            return this.removed;
        },

        "remove": function() {
            if (this.removed) {
                return;
            }
            this.removed = true;
        },

        "unremove": function() {
            if (!this.removed) {
                return;
            }
            this.removed = false;
        },

        "isSeen": function() {
            return this.seen;
        },

        "toggleSeen": function() {
            if (this.seen) {
                this.unsee();
            } else {
                this.see();
            }
        },

        "see": function() {
            if (this.seen) {
                return;
            }
            this.seen = true;
            this.updateThumb(true);
        },

        "unsee": function() {
            if (!this.seen) {
                return;
            }
            this.seen = false;
            this.updateThumb(true);
        },

        "reset": function() {
            this.unsee();
            this.unremove();
        },

        "createThumb": function(inView) {
            const that = this;
            if ("0:00" === this.duration) {
                loadingProgress(1);
                buildApiRequest(
                    "GET",
                    "/youtube/v3/videos",
                    {
                        "part": "contentDetails,statistics",
                        "fields": "items(contentDetails/duration,statistics/viewCount)",
                        "id": that.vid
                    }
                ).then((response) => {
                    if (Object.prototype.hasOwnProperty.call(response, "items") && 1 === response.items.length) {
                        if (Object.prototype.hasOwnProperty.call(response.items[0], "contentDetails") && Object.prototype.hasOwnProperty.call(response.items[0].contentDetails, "duration")) {
                            const duration = window.moment.duration(response.items[0].contentDetails.duration);
                            if (0 === duration.hours()) {
                                that.duration = window.moment(`${duration.minutes()}:${duration.seconds()}`, "m:s").format("mm:ss");
                            } else {
                                that.duration = window.moment(`${duration.hours()}:${duration.minutes()}:${duration.seconds()}`, "h:m:s").format("HH:mm:ss");
                            }
                        }
                        if (Object.prototype.hasOwnProperty.call(response.items[0], "statistics") && Object.prototype.hasOwnProperty.call(response.items[0].statistics, "viewCount")) {
                            const count = parseInt(response.items[0].statistics.viewCount, 10);

                            if (1000000 < count) {
                                that.clicks = `${Math.round(count / 1000000 * 10) / 10}M views`; // Rounded million views.
                            }
                            else if (10000 < count) {
                                that.clicks = `${Math.round(count / 1000)}K views`; // Rounded thousand views.
                            }
                            else {
                                that.clicks = `${count} views`; // Exact view count under thousend.
                            }
                        }
                    }
                    that.updateThumb(inView);
                    loadingProgress(-1);
                });
            }
            this.thumbLi.empty();
            this.thumbLi.append($("<a/>", {"href": `/watch?v=${this.vid}`, "class": "ytbsp-clip", "data-vid": this.vid})
                .append($("<div/>", {"class": "ytbsp-x", "html": "X"}))
                .append($("<img/>", {"class": "ytbsp-thumb"}))
                .append($("<ytd-thumbnail-overlay-time-status-renderer/>"))
                .append($("<input/>", {"class": "ytbsp-thumb-large-url", "type": "hidden"})));
            this.thumbLi.append($("<a/>", {"href": `/watch?v=${this.vid}`, "class": "ytbsp-title", "data-vid": this.vid}));
            this.thumbLi.append($("<p/>", {"class": "ytbsp-views"}));
            this.thumbLi.append($("<p/>", {"class": "ytbsp-uploaded"}));
            this.thumbLi.append($("<p/>", {"class": `ytbsp-seemarker${this.isSeen() ? " seen" : ""}`, "html": (this.isSeen() ? "already seen" : "mark as seen")}));

            // Save information elements.
            this.thumbItem = $(".ytbsp-thumb", this.thumbLi);
            this.thumbLargeItem = $(".ytbsp-thumb-large-url", this.thumbLi);
            this.durationItem = $(".ytbsp-clip > ytd-thumbnail-overlay-time-status-renderer > span", this.thumbLi);
            this.clicksItem = $(".ytbsp-views", this.thumbLi);
            this.uploadItem = $(".ytbsp-uploaded", this.thumbLi);
            this.titleItem = $("a.ytbsp-title", this.thumbLi);
            this.seemarkerItem = $(".ytbsp-seemarker", this.thumbLi);

            // Add dynamic style rules
            const dark = isDarkModeEnabled();
            const viewsAndUploadedInfoColor = dark ? "#888888" : "#11111199";
            const subtextColor = dark ? "#ffffffff" : "#141414";
            this.clicksItem.css("color", viewsAndUploadedInfoColor);
            this.uploadItem.css("color", viewsAndUploadedInfoColor);
            this.seemarkerItem.css("color", subtextColor);

            $(".ytbsp-clip, .ytbsp-title, .ytbsp-x", this.thumbLi).click(function(event) {
                event.preventDefault();
                if (event.target.classList.contains("ytbsp-x")) {
                    return;
                }
                openVideoWithSPF($(this).attr("data-vid"));
            });

            // Enlarge thumbnail and load higher resolution image.
            function enlarge() {
                if (1 >= enlargeFactor) {
                    return;
                }
                if (0 !== $(".ytbsp-x:hover", this).length) {
                    return;
                }
                if (!(that.vid.replace("-", "$") in timeouts)) {
                    timeouts[that.vid.replace("-", "$")] = -1;
                }
                const thumb = $(this).parent();
                const clip = $(this);
                if (-1 === timeouts[that.vid.replace("-", "$")]) {
                    timeouts[that.vid.replace("-", "$")] = setTimeout(() => {
                        const img = $(".ytbsp-thumb", clip);
                        const title = $(".ytbsp-title", thumb);
                        const infos = $("p", thumb);
                        img.attr("src", $(".ytbsp-thumb-large-url", clip).val());
                        
                        img.addClass("ytbsp-thumb-large");
                        img.css("width", (160 * enlargeFactor) + "px");
                        img.css("height", (90 * enlargeFactor) + "px");

                        title.addClass("ytbsp-title-large");
                        title.css("width", ((160 * enlargeFactor) - 4) + "px");
                        title.css("left", (-(((160 * enlargeFactor) / 2) - 82)) + "px");

                        clip.addClass("ytbsp-clip-large");
                        clip.css("width", ((160 * enlargeFactor) + 4) + "px");
                        clip.css("height", ((90 * enlargeFactor) + 4) + "px");
                        clip.css("left", (-(((160 * enlargeFactor) / 2) - 82)) + "px");

                        infos.hide();
                    }, enlargeDelay);
                }
            }
            $(".ytbsp-clip", this.thumbLi).mouseover(enlarge);

            // Reset thumbnail to original size
            function enlargeCancel() {
                if (1 >= enlargeFactor) {
                    return;
                }
                if (that.vid.replace("-", "$") in timeouts && 0 < timeouts[that.vid.replace("-", "$")]) {
                    clearTimeout(timeouts[that.vid.replace("-", "$")]);
                }
                timeouts[that.vid.replace("-", "$")] = -1;
                const thumb = $(this);
                const clip = $(".ytbsp-clip", thumb);
                const img = $(".ytbsp-thumb", clip);
                const title = $(".ytbsp-title", thumb);
                const infos = $("p", thumb);

                img.removeClass("ytbsp-thumb-large");
                img.css("width", "");
                img.css("height", "");

                title.removeClass("ytbsp-title-large");
                title.css("width", "");
                title.css("left", "");

                clip.removeClass("ytbsp-clip-large");
                clip.css("width", "");
                clip.css("height", "");
                clip.css("left", "");

                infos.show();
            }
            $(this.thumbLi).mouseleave(enlargeCancel);

            // Abort enlargement process if not already open.
            function enlargeCancelTimeout() {
                if (that.vid.replace("-", "$") in timeouts) {
                    clearTimeout(timeouts[that.vid.replace("-", "$")]);
                    timeouts[that.vid.replace("-", "$")] = -1;
                }
            }
            $(".ytbsp-x", this.thumbLi).mouseover(enlargeCancelTimeout);
            $(".ytbsp-clip", this.thumbLi).mouseleave(enlargeCancelTimeout);

            this.updateThumb(inView);
        },

        "updateThumb": function(inView) {
            if (!this.thumbItem) {
                return;
            }
            if (inView || this.thumbItem.src) {
                this.thumbItem.attr("src", this.thumb);
            } else {
                this.thumbItem.attr("data-src", this.thumb);
            }
            this.thumbLargeItem.val(this.thumbLarge ? this.thumbLarge : this.thumb);
            this.durationItem.html(this.duration);
            this.clicksItem.html(this.clicks);
            this.uploadItem.html(this.uploaded);
            this.titleItem.html(this.title);
            this.titleItem.prop("title", this.title);

            if (this.seen) {
                this.seemarkerItem.html("already seen");
                this.seemarkerItem.addClass("seen");
            } else {
                this.seemarkerItem.html("mark as seen");
                this.seemarkerItem.removeClass("seen");
            }

        },

        "getDTO": function() {
            return {
                "vid": this.vid,
                "seen": this.seen,
                "removed": this.removed
            };
        }
    };

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
        const dark = isDarkModeEnabled();

        const stdFontColor = dark ? "#e1e1e1" : "#111111";
        const subtextColor = dark ? "#ffffffff" : "#141414";
        const viewsAndUploadedInfoColor = dark ? "#888888" : "#11111199";
        const stdBorderColor = dark ? "#2c2c2c" : "#e2e2e2";
        const altBorderColor = dark ? "#737373" : "#737373";
        const bgColor = dark ? "#252525" : "#f5f5f5";

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
            `ytd-thumbnail:hover { transform: scale(${enlargeFactorNative}); border: solid ${enlargeFactorNative / 2.0}px ${altBorderColor}; padding: 0px; z-index: 2; }` +
            `ytd-thumbnail { padding: ${enlargeFactorNative / 2.0}px }` +
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
    let scrollTimeout = null;
    let moved = false;
    function checkEvent() {
        if (null === scrollTimeout) {
            scrollTimeout = setTimeout(() => {
                updateSubsInView();
                if (moved) {
                    moved = false;
                    checkEvent();
                }
            }, 100);
        } else {
            moved = true;
        }
    }
    window.addEventListener("scroll", checkEvent, false);
    window.addEventListener("resize", checkEvent, false);

    // Load thumbnails for subscriptions currently in view plus the screenThreshold property.
    function updateSubsInView() {
        lastScroll = Date.now();
        screenTop = document.body.scrollTop || document.documentElement.scrollTop;
        screenBottom = screenTop + window.innerHeight;
        // Check subs which has to be updated
        subs.forEach((sub) => {
            if (sub.inView()) {
                // Get all images that don't have a src but have an data-src
                $("img[data-src]", sub.videoList).each(function() {
                    $(this).get(0).src = $(this).get(0).getAttribute("data-src");
                    $(this).get(0).removeAttribute("data-src");
                });
            }
        });
        scrollTimeout = null;
    }

    // Handler to manage a fresh page load or a page navigation
    function handlePageChange() {
        if ((/.*watch\?.+list=.+/u).test(location)) {
            autoPauseThisVideo = false;
        } else {
            autoPauseThisVideo = autoPauseVideo;
        }
        clearTimeout(markAsSeenTimeout);
        toggleGuide = false;
        // Forces some images to reload...
        window.dispatchEvent(new Event("resize"));
        // If we are on the startpage (or feed pages).
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
                                subs[i].buildList();
                                saveList();
                            }
                        });
                    }
                });
            }
        }, timeToMarkAsSeen * 1000);
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
        timeToMarkAsSeen = localStorage.getItem("YTBSP_timeToMarkAsSeen");
        autoPauseVideo = "0" !== localStorage.getItem("YTBSP_autoPauseVideo");
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
        if (1 <= enlargeFactorNative) {
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
                playerParentRef.stopVideo();
            }
            return;
        }
        // Resume default behaviour.
        defaultPlayFunction.call(this);
    };

    // Set preferred player quality.
    function setPlayerQuality() {
        localStorage.setItem(YT_PLAYER_QUALITY, `{"data":"${playerQuality}","expiration":${window.moment().add(1, "months").valueOf()},"creation":${window.moment().valueOf()}}`);
    }

})(window.unsafeWindow || window);
