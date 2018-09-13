// ==UserScript==
// @name         YouTube Better Startpage
// @description  Spotlights all subscriptions in an organized fashion on the startpage of YouTube.
// @version      1.4.7
// @namespace    ytbsp
// @include      https://youtube.com/*
// @include      https://www.youtube.com/*
// @require      https://apis.google.com/js/api.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.3.1/jquery.slim.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.21.0/moment.min.js
// @downloadURL  https://raw.githubusercontent.com/Crow08/YTBSP/master/YTBSP.js
// @updateURL    https://raw.githubusercontent.com/Crow08/YTBSP/master/YTBSP.js
// @grant        none
// ==/UserScript==
/**
 * The MIT License
 *
 * Copyright (c) 2015-2018 (Crow08)
 * Copyright (c) 2014 (dzre)
 * Copyright (c) 2011-2013 Marco D. Pfeiffer (Nemo64)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

/* global jQuery, $, gapi */

var moment = this.moment;

var GoogleAuth;

(function() {
    var resolutions = {'Ultra' : 'highres',
                       '2880p' : 'hd2880',
                       '2160p' : 'hd2160',
                       '1440p' : 'hd1440',
                       '1080p' : 'hd1080',
                       '720p' : 'hd720',
                       '480p' : 'large',
                       '360p' : 'medium',
                       '240p' : 'small',
                       '144p' : 'tiny'};

    // Config:
    var useRemoteData = true;					// DEFAULT: true (using Google Drive as remote storage).
    var maxSimSubLoad = 10;						// DEFAULT: 10 (Range: 1 - 50) (higher numbers result into slower loading of single items but overall faster laoding).
    var maxVidsPerRow = 9;						// DEFAULT: 9.
    var maxVidsPerSub = 36;						// DEFAULT: 36 (Range: 1 - 50) (should be dividable by maxVidsPerRow).
    var enlargeDelay = 500;						// DEFAULT: 500 (in ms).
    var enlargeFactor = 2.8;					// DEFAULT: 2.8 (x * 90px).
    var enlargeFactorNative = 2.0;				// DEFAULT: 2.0 (x * 94px).
    var timeToMarkAsSeen = 10;					// DEFAILT: 10 (in s).
    var screenThreshold = 500;					// DEFAULT: 500 (preload images beyond current screen region in px).
    var playerQuality = resolutions['1080p'];	// DEFAULT: hd1080 (resolutions['1080p'])
    var peekPlayerSizeFactor = 1.5;				// DEFAULT: 1.0 (x * 180px).
    var autoPauseVideo = false;					// DEFAULT: false.
    var hideSeenVideos = false;					// DEFAULT: false.
    var hideEmptySubs = true;					// DEFAULT: true.

    // OAuth2 variables:
    const CLIENTID = '281397662073-jv0iupog9cdb0eopi3gu6ce543v0jo65.apps.googleusercontent.com';
    const DISCOVERYDOCS = ['https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest', 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];
    const SCOPE = 'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/drive.appdata';

    // Slectors for external HTML elements:
    // YouTube selectors:
    const YT_STARTPAGE_BODY = "#page-manager.ytd-app";
    const YT_PLAYLIST_SIDEBAR = "ytd-playlist-sidebar-renderer";
    const YT_VIDEOTITLE = "#info-contents > ytd-video-primary-info-renderer > div:last-child";
    const YT_CHANNELLINK = "#owner-name > a";
    const YT_CONTENT = "#content";
    const YT_GUIDE = "app-drawer#guide";
    const YT_PLAYER_QUALITY = "yt-player-quality";
    // MagicAction selectors:
    const MA_TOOLBAR = "#info-contents > ytd-video-primary-info-renderer > div";

    var corruptCache = false;
    var cachedVideoinformation = [];
    var remoteSaveFileID = null;

    // Variables for inView check.
    var lastScroll = Date.now(); // The last time the page was moved or resized.
    var screenTop = 0;
    var screenBottom = screenTop + window.innerHeight;

    // Start page is YTBSP.
    var isNative = false;

    // Universal loader as resource.
    function getLoader(id){
        var loader = $("<div/>", {"class": "ytbsp-loader", "id": id});
        return loader;
    }

    // Make slider as resource.
    function getSlider(id, checked, onChange){
        var slider = $("<label/>",{"class": "ytbsp-slider"});
        slider.append($("<input/>", {"class": "ytbsp-slider-cb", "type": "checkbox", "id": id, "checked": checked, on: { change: onChange } }));
        slider.append($("<div/>", {"class": "ytbsp-slider-rail"}));
        slider.append($("<div/>", {"class": "ytbsp-slider-knob"}));
        return slider;
    }

    // Let's build the new site:

    // Create an div for us.
    var maindiv = $("<div/>",{id: "YTBSP"});
    var menuStrip = $("<div/>",{id: "ytbsp-menuStrip"});
    menuStrip.append($("<div/>", {id: "ytbsp-loaderSpan"})
                     .append(getLoader("ytbsp-main-loader"))
                     .append($("<button/>", {id: "ytbsp-refresh", "class": "ytbsp-func", html:"&#x27F3;"}))
                    );
    menuStrip.append($("<button/>", {id: "ytbsp-togglePage", "class": "ytbsp-func", html:"Toggle YTBSP"}));
    menuStrip.append($("<button/>", {id: "ytbsp-removeAllVideos", "class": "ytbsp-func ytbsp-hideWhenNative", html:"Remove all videos"}));
    menuStrip.append($("<button/>", {id: "ytbsp-resetAllVideos", "class": "ytbsp-func ytbsp-hideWhenNative", html:"Reset all videos"}));
    menuStrip.append($("<button/>", {id: "ytbsp-backup", "class": "ytbsp-func ytbsp-hideWhenNative", html:"Backup video info"}));
    menuStrip.append($("<label/>", {"for": "ytbsp-hideSeenVideosCb", "class": "ytbsp-func ytbsp-hideWhenNative"})
                     .append($("<input/>", {id: "ytbsp-hideSeenVideosCb", type: "checkbox", checked: hideSeenVideos}))
                     .append("Hide seen videos")
                    );
    menuStrip.append($("<label/>", {"for": "ytbsp-hideEmptySubsCb", "class": "ytbsp-func ytbsp-hideWhenNative"})
                     .append($("<input/>", {id: "ytbsp-hideEmptySubsCb", type: "checkbox", checked: hideEmptySubs}))
                     .append("Hide empty subs")
                    );
    menuStrip.append($("<button/>", {id: "ytbsp-settings", "class": "ytbsp-func ytbsp-hideWhenNative", html:"&#x2699;"}));
    maindiv.append(menuStrip);
    maindiv.append($("<ul/>", {id: "ytbsp-subs"}));
    maindiv.append($("<div/>", {id: "ytbsp-modal"})
                   .append($("<div/>", {id: "ytbsp-modal-content"}))
                  );

    // Save a reference for the subList.
    var subList = $("#ytbsp-subs", maindiv);

    $('.ytbsp-hideWhenNative', maindiv).css('visibility','hidden');

    var markAsSeenTimeout = null;

    var autoPauseThisVideo = null;

    // Call functions on startup.
    onScriptStart();

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Start OAuth Stuff

    gapi.load('client:auth2', initClient);

    var retryInit = 5; // Retry limit for client init with oauth.

    // OAuth init
    function initClient() {
        // Initialize the gapi.client object, which app uses to make API requests.
        gapi.client.init({
            'clientId': CLIENTID,
            'discoveryDocs': DISCOVERYDOCS,
            'scope': SCOPE
        }).then(function() {
            if(retryInit <= 0){
                return;
            }
            retryInit = 0;
            GoogleAuth = gapi.auth2.getAuthInstance();
            // Handle initial sign-in state. (Determine if user is already signed in.)
            setSigninStatus();
        }, function(reason) {
            if(retryInit <= 0){
                return;
            }
            retryInit = 0;
            console.error("Google API client initialization failed:\n" + reason);
        });
        setTimeout(function(){
            if(--retryInit <= 0){
                return;
            }
            initClient(); // retry with timeout because youtube can reset gapi and the promise never returns.
        }, 1000);
    }

    // OAuth signin.
    function setSigninStatus() {
        var user = GoogleAuth.currentUser.get();
        var isAuthorized = user.hasGrantedScopes(SCOPE);
        if(isAuthorized) {
            // start loading save data.
            startAPIRequests();
        } else {
            GoogleAuth.signIn().then(
                function() {
                    // Signin successful then start loading save data.
                    startAPIRequests();
                },
                function(error) {
                    // Display popup-blocked message.
                    if(error.error == "popup_blocked_by_browser") {
                        alert('please allow popups for this page and reload!');
                    }else{
                        console.error("Google user sign-in failed:\n" + error);
                    }
                }
            );
        }
    }

    // Prevent unnecessary request parameters.
    function removeEmptyParams(params) {
        for(var p in params) {
            if(!params[p] || params[p] == 'undefined') {
                delete params[p];
            }
        }
        return params;
    }

    // Build proper OAuth request.
    function buildApiRequest(requestMethod, path, params, properties) {
        return new Promise(function(resolve, reject){
            params = removeEmptyParams(params);
            var request;
            if(properties) {
                request = gapi.client.request({
                    'body': properties,
                    'method': requestMethod,
                    'path': path,
                    'params': params
                });
            } else {
                request = gapi.client.request({
                    'method': requestMethod,
                    'path': path,
                    'params': params
                });
            }
            request.execute(function(response){
                resolve(response);
            });
        });
    }

    // End OAuth Stuff.
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var loading = 0; // 0: all subs / vids loaded.
    var saveQueued = false;

    // Function to handle loading, showing, hiding loaders when needed and
    // saving when loading has finished if saving flag was set at least once
    function loadingProgress(loadingDelta, saveWhenDone = false ,sub = null){
        loading += loadingDelta;
        saveQueued = saveQueued || saveWhenDone;
        if (sub !== null){
            if(loadingDelta < 0){
                sub.removeLoader();
            }else{
                sub.showLoader();
            }
        }
        // All subs loaded.
        if(loading === 0) {
            $(".ytbsp-loader","#ytbsp-loaderSpan").hide();
            $("#ytbsp-refresh","#ytbsp-loaderSpan").show();
            if(saveQueued){
                saveQueued = false;
                saveList();
            }
        }else{
            $(".ytbsp-loader","#ytbsp-loaderSpan").show();
            $("#ytbsp-refresh","#ytbsp-loaderSpan").hide();
        }
    }

    useRemoteData = localStorage.getItem("YTBSP_useRemoteData") !== "0";

    // This function is called after successful OAuth login.
    // Loads configuration and video information from local storage or G-Drive,
    // then starts loading subscriptions.
    function startAPIRequests()	{
        // Get app configuration.
        loadConfig().then(function(){
            // -> Get save data.
            afterConfigLoaded();
            loadVideoInformation().then(function(){
                // -> start requesting subs.
                requestSubs();
            });
        });
    }

    // Load G-Drive File Id only.
    function loadRemoteFileId(){
        return new Promise(function(resolve, reject){
            loadingProgress(1);
            buildApiRequest(
                'GET',
                '/drive/v3/files',
                {
                    'q': "name = 'YTBSP.json'",
                    'fields': "files(id)",
                    'spaces': "appDataFolder"
                }
            ).then(function(response){
                var files = response.files;
                // Check if save file exists or has to be created.
                if (files && files.length > 0) {
                    // Save file exists.
                    remoteSaveFileID = files[0].id;
                }else{
                    // Save file does not exist.
                    // Create new save file.
                    createRemoteSaveData().then(function(){
                        resolve();
                    });
                }
                loadingProgress(-1);
                resolve();
            });
        });
    }

    // Load Script configuration.
    function loadConfig(){
        if(useRemoteData){
            return loadRemoteConfig();
        }else{
            return loadLocalConfig();
        }
    }

    // Load Script configuration from G-Drive file.
    function loadRemoteConfig(){
        return new Promise(function(resolve, reject){
            loadingProgress(1);
            buildApiRequest(
                'GET',
                '/drive/v3/files',
                {
                    'q': "name = 'YTBSP.json'",
                    'fields': "files(appProperties,id,name)",
                    'spaces': "appDataFolder"
                }
            ).then(function(response){
                var files = response.files;
                // Check if save file exists or has to be created.
                if (files && files.length > 0) {
                    // Save file exists.
                    // Parse the config.
                    remoteSaveFileID = files[0].id;
                    useRemoteData = files[0].appProperties.useRemoteData !== "0";
                    hideSeenVideos = files[0].appProperties.hideSeenVideos !== "0";
                    hideEmptySubs = files[0].appProperties.hideEmptySubs !== "0";
                    maxSimSubLoad = files[0].appProperties.maxSimSubLoad;
                    maxVidsPerRow = files[0].appProperties.maxVidsPerRow;
                    maxVidsPerSub = files[0].appProperties.maxVidsPerSub;
                    enlargeDelay = files[0].appProperties.enlargeDelay;
                    enlargeFactor = files[0].appProperties.enlargeFactor;
                    enlargeFactorNative = files[0].appProperties.enlargeFactorNative;
                    playerQuality = files[0].appProperties.playerQuality;
                    timeToMarkAsSeen = files[0].appProperties.timeToMarkAsSeen;
                    screenThreshold = files[0].appProperties.screenThreshold;
                    autoPauseVideo = files[0].appProperties.autoPauseVideo !== "0";
                    $("#ytbsp-hideSeenVideosCb").prop("checked", hideSeenVideos);
                    $("#ytbsp-hideEmptySubsCb").prop("checked", hideEmptySubs);
                }else{
                    // Save file does not exist.
                    // Create new save file.
                    createRemoteSaveData().then(function(){
                        resolve();
                    });
                }
                loadingProgress(-1);
                resolve();
            });
        });
    }

    // Load Script configuration from local storage
    function loadLocalConfig(){
        return new Promise(function(resolve, reject){
            useRemoteData = localStorage.getItem("YTBSP_useRemoteData") !== "0";
            hideSeenVideos = localStorage.getItem("YTBSP_hideSeenVideos") !== "0";
            hideEmptySubs = localStorage.getItem("YTBSP_hideEmptySubs") !== "0";
            maxSimSubLoad = localStorage.getItem("YTBSP_maxSimSubLoad");
            maxVidsPerRow = localStorage.getItem("YTBSP_maxVidsPerRow");
            maxVidsPerSub = localStorage.getItem("YTBSP_maxVidsPerSub");
            enlargeDelay = localStorage.getItem("YTBSP_enlargeDelay");
            enlargeFactor = localStorage.getItem("YTBSP_enlargeFactor");
            enlargeFactorNative = localStorage.getItem("YTBSP_enlargeFactorNative");
            playerQuality = localStorage.getItem("YTBSP_playerQuality");
            timeToMarkAsSeen = localStorage.getItem("YTBSP_timeToMarkAsSeen");
            screenThreshold = localStorage.getItem("YTBSP_screenThreshold");
            autoPauseVideo = localStorage.getItem("YTBSP_autoPauseVideo") !== "0";
            $("#ytbsp-hideSeenVideosCb").prop("checked", hideSeenVideos);
            $("#ytbsp-hideEmptySubsCb").prop("checked", hideEmptySubs);
            resolve();
        });
    }

    // Create new save file on G-Drive.
    function createRemoteSaveData(){
        return new Promise(function(resolve, reject){
            loadingProgress(1);
            buildApiRequest(
                'POST',
                '/drive/v3/files',
                {'fields': "appProperties,id,name"},
                {
                    "parents" : ["appDataFolder"],
                    "name":"YTBSP.json",
                    "appProperties": {
                        useRemoteData: useRemoteData,
                        hideSeenVideos: hideSeenVideos,
                        hideEmptySubs: hideEmptySubs,
                        maxSimSubLoad: maxSimSubLoad,
                        maxVidsPerRow: maxVidsPerRow,
                        maxVidsPerSub: maxVidsPerSub,
                        enlargeDelay: enlargeDelay,
                        enlargeFactor: enlargeFactor,
                        enlargeFactorNative: enlargeFactorNative,
                        playerQuality: playerQuality,
                        timeToMarkAsSeen: timeToMarkAsSeen,
                        screenThreshold: screenThreshold,
                        autoPauseVideo: autoPauseVideo
                    }
                }
            ).then(function(response){
                remoteSaveFileID = response.id;
                // config variables are already initialized with default values.
                $("#ytbsp-hideSeenVideosCb").prop("checked", hideSeenVideos);
                $("#ytbsp-hideEmptySubsCb").prop("checked", hideEmptySubs);
                loadingProgress(-1, true);
                resolve();
            });
        });
    }

    // delete save file on G-Drive.
    function deleteRemoteSaveData(){
        return new Promise(function(resolve, reject){
            if(remoteSaveFileID === null){
                loadRemoteFileId().then(function(){
                    if(remoteSaveFileID !== null){
                        deleteRemoteSaveData().then(function(){resolve();});
                    }else{
                        resolve();
                    }
                });
            }else{
                buildApiRequest(
                    'DELETE',
                    '/drive/v3/files/'+remoteSaveFileID,
                    {}
                ).then(function(){
                    remoteSaveFileID = null;
                    deleteRemoteSaveData().then(function(){resolve();});
                });
            }
        });
    }

    // Load video information.
    function loadVideoInformation(){
        return new Promise(function(resolve, reject){
            getVideoInformation().then(function(data){
                cachedVideoinformation = data;
                resolve();
            });
        });
    }

    // Gets and returns video information in resolved promise.
    function getVideoInformation(){
        if(useRemoteData){
            return getRemoteVideoInformation();
        }else{
            return getLocalVideoInformation();
        }
    }

    // Load video information from G-Drive file.
    function getRemoteVideoInformation(){
        return new Promise(function(resolve, reject){
            if(remoteSaveFileID === null){
                loadRemoteFileId().then(function(){
                    getRemoteVideoInformation().then(function(data){resolve(data);});
                });
            }else{
                // request file content from API.
                buildApiRequest(
                    'GET',
                    '/drive/v3/files/'+remoteSaveFileID,
                    {alt: "media"}
                ).then(function(data){
                    if(typeof data === 'undefined' || data === null || data === "") {
                        console.error("Error parsing video information!");
                        data = [];
                    }
                    resolve(data);
                });
            }
        });
    }

    // loads and parses local storage data.
    function getLocalVideoInformation(){
        return new Promise(function(resolve, reject){
            // Get Cache from localStorage and set config.
            var cache = localStorage.getItem("YTBSP");
            corruptCache = localStorage.getItem("YTBSPcorruptcache") === "1"; // DEFAULT: false.
            // If last save process was inerrupted: try to load backup.
            if(corruptCache) {
                console.warn("cache corruption detected!");
                console.warn("restoring old cache...");
                cache = localStorage.getItem("YTBSPbackup");
            }
            // If we have a cache parse it.
            if(cache === null || cache === "") {
                cache = [];
            } else {
                try {
                    cache = JSON.parse(cache);
                } catch(e) {
                    console.error("Error parsing cache!");
                    cache = [];
                }
            }
            resolve(cache);
        });
    }

    // Save configuration.
    function saveConfig(){
        if(useRemoteData){
            return new Promise(function(resolve, reject){
                saveLocalConfig().then(function(){
                    saveRemoteConfig().then(function(){resolve();});
                });
            });
        }else{
            return saveLocalConfig();
        }
    }

    // Save configuration to G-Drive file.
    function saveRemoteConfig(){
        return new Promise(function(resolve, reject){
            if(remoteSaveFileID === null){
                loadRemoteFileId().then(function(){
                    saveRemoteConfig().then(function(){resolve();});
                });
            }else{
                buildApiRequest(
                    'PATCH',
                    '/drive/v3/files/'+remoteSaveFileID,
                    {},
                    {"appProperties" : {
                        useRemoteData: useRemoteData ? "1" : "0",
                        hideSeenVideos: hideSeenVideos ? "1" : "0",
                        hideEmptySubs: hideEmptySubs ? "1" : "0",
                        maxSimSubLoad: maxSimSubLoad,
                        maxVidsPerRow: maxVidsPerRow,
                        maxVidsPerSub: maxVidsPerSub,
                        enlargeDelay: enlargeDelay,
                        enlargeFactor: enlargeFactor,
                        enlargeFactorNative: enlargeFactorNative,
                        playerQuality: playerQuality,
                        timeToMarkAsSeen: timeToMarkAsSeen,
                        screenThreshold: screenThreshold,
                        autoPauseVideo: autoPauseVideo ? "1" : "0"
                    }}
                ).then(function(){
                    localStorage.setItem("YTBSP_useRemoteData", useRemoteData ? "1" : "0");
                    resolve();
                });
            }
        });
    }

    // Save config to local storage file.
    function saveLocalConfig(){
        return new Promise(function(resolve, reject){
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
        });
    }

    function saveVideoInformation(){
        if(useRemoteData){
            return new Promise(function(resolve, reject){
                saveLocalVideoInformation().then(function(){
                    saveRemoteVideoInformation().then(function(){resolve();});
                });
            });
        }else{
            return saveLocalVideoInformation();
        }
    }

    // Save video information to G-Drive file.
    function saveRemoteVideoInformation() {
        return new Promise(function(resolve, reject){
            if(remoteSaveFileID === null){
                loadRemoteFileId().then(function(){
                    saveRemoteVideoInformation().then(function(){resolve();});
                });
            }else{
                var contentString = JSON.stringify(cachedVideoinformation);
                const boundary = '-------314159265358979323846';
                const delimiter = "\r\n--" + boundary + "\r\n";
                const close_delim = "\r\n--" + boundary + "--";

                var contentType = 'text/plain' || 'application/octet-stream';
                // Updating the metadata is optional and you can instead use the value from drive.files.get.
                var base64Data = btoa(encodeURIComponent(contentString).replace(/%([0-9A-F]{2})/g,
                                                                                function toSolidBytes(match, p1) {
                    return String.fromCharCode('0x' + p1);
                }));
                var multipartRequestBody =
                    delimiter +
                    'Content-Type: application/json\r\n\r\n' +
                    JSON.stringify({}) + // Metadata goes here.
                    delimiter +
                    'Content-Type: ' + contentType + '\r\n' +
                    'Content-Transfer-Encoding: base64\r\n' +
                    '\r\n' +
                    base64Data +
                    close_delim;

                var request = gapi.client.request({
                    'path': '/upload/drive/v3/files/' + remoteSaveFileID,
                    'method': 'PATCH',
                    'params': {'uploadType': 'multipart', 'alt': 'json'},
                    'headers': {
                        'Content-Type': 'multipart/mixed; boundary="' + boundary + '"'
                    },
                    'body': multipartRequestBody});
                request.execute(function(){
                    resolve();
                });
            }
        });
    }

    // Save video information to local storage.
    function saveLocalVideoInformation() {
        return new Promise(function(resolve, reject){
            var newcache = JSON.stringify(cachedVideoinformation);
            localStorage.setItem("YTBSPcorruptcache", 1);
            localStorage.setItem("YTBSP", newcache);
            var savedcache = localStorage.getItem("YTBSP");
            if(newcache === savedcache) {
                localStorage.setItem("YTBSPcorruptcache", 0);
                localStorage.setItem("YTBSPbackup", newcache);
            } else {
                console.error("cache save error!");
                reject();
            }
            newcache = null;
            savedcache = null;
            resolve();
        });
    }

    var subs = []; // Main subscription array contains all subs and in extension all videos.

    // Gets subs from api. (Called after successful OAuth-login and save data loading.)
    function requestSubs() {
        loadingProgress(1);
        buildApiRequest(
            'GET',
            '/youtube/v3/subscriptions',
            {
                'mine': 'true',
                'part': 'snippet',
                'maxResults': maxSimSubLoad,
                'fields': 'items(snippet(resourceId/channelId,title)),nextPageToken,pageInfo,prevPageToken'
            }).then(processRequestSubs);
    }

    // Parses api results into subs and requests recursively more subpages if needed.
    function processRequestSubs(response) {
        // If Request was denied retry login.
        if(response.hasOwnProperty("error")) {
            console.error("OAuth failed! retrying...");
            GoogleAuth.disconnect();
            setSigninStatus();
            loadingProgress(-1);
            return;
        }
        // If there is another page of subs request it.
        if(response.nextPageToken !== undefined && response.nextPageToken !== null) {
            loadingProgress(1);
            buildApiRequest(
                'GET',
                '/youtube/v3/subscriptions',
                {
                    'mine': 'true',
                    'part': 'snippet',
                    'maxResults': maxSimSubLoad,
                    'pageToken': response.nextPageToken,
                    'fields': 'items(snippet(resourceId/channelId,title)),nextPageToken,pageInfo,prevPageToken'
                }).then(processRequestSubs);
        }
        // Create subs from the api response.
        response.items.forEach(function(item) {
            subs.push(new Subscription(item.snippet));
        });
        loadingProgress(-1);
    }

    // check if subscription is still subscribed and if so append it.
    function checkAndAppendSub(forChannelId){
        loadingProgress(1);
        buildApiRequest(
            'GET',
            '/youtube/v3/subscriptions',
            {
                'mine': 'true',
                'part': 'snippet',
                'forChannelId': forChannelId,
                'fields': 'items(snippet(resourceId/channelId,title)),pageInfo)'
            }).then(processCheckedSubs);
    }

    // Parses api results into subs if still subscribed.
    function processCheckedSubs(response){
        // No longer subscribed
        if(response.pageInfo.totalResults == 0){
            loadingProgress(-1, true);
            return;
        }
        // Create subs from the api response.
        response.items.forEach(function(item) {
            subs.push(new Subscription(item.snippet));
        });
        loadingProgress(-1, true);
    }

    // Set functions affecting all subs:
    // Set click event for refresh button, updating all videos for all subs.
    function updateAllSubs(){
        setTimeout(function() {
            subs.forEach(function(sub, i) {
                subs[i].updateVideos();
            });
        }, 0);
    }
    $(".ytbsp-func#ytbsp-refresh", maindiv).click(updateAllSubs);

    var toggleGuide = false;

    function shownative() {
        $(YT_STARTPAGE_BODY).show();
        subList.hide();
        $('.ytbsp-hideWhenNative').css('visibility','hidden');
        isNative = true;
        // Toggle guide if on viewpage.
        if(toggleGuide){
            var ytdApp = document.querySelector('ytd-app');
            ytdApp.fire("yt-guide-toggle", {});
        }
    }

    function hidenative() {
        $(YT_STARTPAGE_BODY).hide();
        subList.show();
        $('.ytbsp-hideWhenNative').css('visibility','');
        isNative = false;
        // Toggle guide if on viewpage.
        if (toggleGuide) {
            var ytdApp = document.querySelector('ytd-app');
            ytdApp.fire("yt-guide-toggle", {});
            // Workaround: After opening guide sidebar scroll information gets lost...
            setTimeout(function(){ $('body').attr('style', 'overflow: auto');},200);
        }
    }

    // Now set click event for the toggle native button.
    function toggleytbsp() {
        if(isNative){
            hidenative();
            if(/^\/?watch$/.test(location.pathname)){
                player.showPeekPlayer();
            }
        }else{
            shownative();
            if(/^\/?watch$/.test(location.pathname)){
                player.showNativePlayer();
            }
        }
    }
    $(".ytbsp-func#ytbsp-togglePage", maindiv).click(toggleytbsp);

    // Remove all videos button.
    function removeAllVideos() {
        if(!confirm("delete all videos?")) {
            return;
        }
        loadingProgress(1);
        setTimeout(function() {
            var toRebuild = [];
            subs.forEach(function(sub, i) {
                sub.videos.forEach(function(vid, j) {
                    if(!subs[i].videos[j].isRemoved()) {
                        subs[i].videos[j].remove();
                        toRebuild.push(i);
                    }
                });
            });
            toRebuild.forEach(function(i) {
                subs[i].buildList();
            });
            loadingProgress(-1, true);
        }, 0);
    }
    $(".ytbsp-func#ytbsp-removeAllVideos", maindiv).click(removeAllVideos);

    // Reset videos button.
    function resetAllVideos() {
        if(!confirm("reset all videos?")) {
            return;
        }
        loadingProgress(1);
        setTimeout(function() {
            var toRebuild = [];
            subs.forEach(function(sub, i) {
                sub.videos.forEach(function(vid, j) {
                    if(subs[i].videos[j].isRemoved() || subs[i].videos[j].isSeen()) {
                        subs[i].videos[j].reset();
                        toRebuild.push(i);
                    }
                });
            });
            toRebuild.forEach(function(i) {
                subs[i].buildList();
            });
            loadingProgress(-1, true);
        }, 0);
    }
    $(".ytbsp-func#ytbsp-resetAllVideos", maindiv).click(resetAllVideos);

    // Hide seen videos buttons.
    function toggleHideSeenVideos() {
        hideSeenVideos = !hideSeenVideos;
        loadingProgress(1);
        saveConfig().then(function(){loadingProgress(-1);});
        subs.forEach(function(sub, i) {
            subs[i].buildList();
        });
        $("#ytbsp-hideSeenVideosCb", maindiv).prop("checked", hideSeenVideos);
    }
    $("#ytbsp-hideSeenVideosCb", maindiv).change(toggleHideSeenVideos);

    // Hide empty subscriptions button.
    function toggleHideEmptySubs() {
        hideEmptySubs = !hideEmptySubs;
        loadingProgress(1);
        saveConfig().then(function(){loadingProgress(-1);});
        subs.forEach(function(sub, i) {
            subs[i].handleVisablility();
        });
        $("#ytbsp-hideEmptySubsCb", maindiv).prop("checked", hideEmptySubs);
    }
    $("#ytbsp-hideEmptySubsCb", maindiv).change(toggleHideEmptySubs);

    // Open backup dialog.
    function openBackupDialog() {
        loadingProgress(1);
        getVideoInformation().then(function(saveData){
            createBackupDialog(JSON.stringify(saveData));
            loadingProgress(-1);
        });
    }

    function createBackupDialog(saveData){
        var backupDialog = $("<div/>");
        backupDialog.append($("<h1/>",{html:"Backup video information"}));
        backupDialog.append($("<p/>",{html:"This Feature allows you to save which videos you have seen and removed and import them again on another " +
                                      "browser/computer or just to make save you don't loose these informations over night."}));
        backupDialog.append($("<h1/>",{html:"How do I do this?"}));
        backupDialog.append($("<p/>",{html:"Just copy the content of the following textbox and save it somewhere.<br />" +
                                      "To import it again copy it into the textbox and press import data."}));
        backupDialog.append($("<p/>",{html:"The save data from local storage and Google Drive are compatible and interchangeable."}));
        backupDialog.append($("<textarea/>",{id:"ytbsp-export-import-textarea", html: saveData }));

        var endDiv = $("<div/>",{id:"ytbsp-modal-end-div"});
        endDiv.append($("<h2/>",{html:"Local Storage"}));

        var backupSwitch = function(){
            if($("#ytbsp-backup-switch").prop("checked")){
                $("#ytbsp-export-import-textarea").empty();
                loadingProgress(1);
                getRemoteVideoInformation().then(function(saveData){
                    $("#ytbsp-export-import-textarea").val(JSON.stringify(saveData));
                    loadingProgress(-1);
                });
            }else{
                getLocalVideoInformation().then(function(saveData){
                    $("#ytbsp-export-import-textarea").val(JSON.stringify(saveData));
                    loadingProgress(-1);
                });
            }
        };
        endDiv.append(getSlider("ytbsp-backup-switch", useRemoteData, backupSwitch));

        endDiv.append($("<h2/>",{html:"Google Drive"}));
        endDiv.append($("<input/>",{type:"submit", "class": "ytbsp-func", value: "close", on: { click: closeModal }}));

        var importData = function() {
            loadingProgress(1);
            cachedVideoinformation = JSON.parse($("#ytbsp-export-import-textarea").val());
            if($("#ytbsp-backup-switch").prop("checked")){
                saveRemoteVideoInformation().then(function(){
                    closeModal();
                    loadingProgress(-1);
                    location.reload();
                });
            }else{
                saveLocalVideoInformation().then(function(){
                    setTimeout(function() {
                        closeModal();
                        loadingProgress(-1);
                        location.reload();
                    }, 200);
                });
            }
        };
        endDiv.append($("<input/>",{type:"submit", "class": "ytbsp-func", value: "import data", on: { click: importData }}));
        backupDialog.append(endDiv);
        openModal(backupDialog);
    }
    $(".ytbsp-func#ytbsp-backup", maindiv).click(openBackupDialog);


    function openSettingsDialog() {
        var settingsDialog = $("<div/>");
        settingsDialog.append($("<h1/>",{html:"Settings"}));
        var settingsTable = $("<table/>",{id:"ytbsp-settings-table"});
        settingsTable.append($("<tr>")
                             .append($("<td>", {html:"Hide empty subs"}))
                             .append($("<td>").append(getSlider("ytbsp-settings-hideEmptySubs", hideEmptySubs)))
                             .append($("<td>"))
                            );
        settingsTable.append($("<tr>")
                             .append($("<td>", {html:"Hide seen videos"}))
                             .append($("<td>").append(getSlider("ytbsp-settings-hideSeenVideos", hideSeenVideos)))
                             .append($("<td>"))
                            );
        settingsTable.append($("<tr>")
                             .append($("<td>", {html: "Use Google Drive"}))
                             .append($("<td>").append(getSlider("ytbsp-settings-useRemoteData", useRemoteData)))
                             .append($("<td>"), {html: "Allows synchronization between browsers. May result in slower loading times."})
                            );
        settingsTable.append($("<tr>")
                             .append($("<td>", {html: "Autopause videos"}))
                             .append($("<td>").append(getSlider("ytbsp-settings-autoPauseVideo", autoPauseVideo)))
                             .append($("<td>"), {html: "Open Videos in a paused state. (Does not effect playlists.)"})
                            );

        var playerQualitySelect = $("<Select>", {id: "ytbsp-settings-playerQuality"});
        for (var resolution in resolutions) {
            if (resolutions.hasOwnProperty(resolution)) {
                playerQualitySelect.append($("<option>", {value: resolutions[resolution], html: resolution}));
            }
        }
        playerQualitySelect.val(playerQuality);

        settingsTable.append($("<tr>")
                             .append($("<td>", {html: "Player Quality"}))
                             .append($("<td>").append(playerQualitySelect))
                             .append($("<td>"), {html: "Open Videos in a paused state. (Does not effect playlists.)"})
                            );
        settingsTable.append($("<tr>")
                             .append($("<td>", {html: "Max number of subscriptions loading simultaneously"}))
                             .append($("<td>").append($("<input>", {type: "number", min:"1", max:"50", id: "ytbsp-settings-maxSimSubLoad", value: maxSimSubLoad})))
                             .append($("<td>", {html: "Default: 10 | Range: 1-50 | Higher numbers result in slower loading of single items but overall faster laoding."}))
                            );
        settingsTable.append($("<tr>")
                             .append($("<td>", {html: "Max number of videos per row"}))
                             .append($("<td>").append($("<input>", {type: "number", min:"1", max:"50", id: "ytbsp-settings-maxVidsPerRow", value: maxVidsPerRow})))
                             .append($("<td>", {html: "Default: 9 | Range: 1-50"}))
                            );
        settingsTable.append($("<tr>")
                             .append($("<td>", {html:"Max number of videos per subscription"}))
                             .append($("<td>").append($("<input>", {type: "number", min:"1", max:"50", id: "ytbsp-settings-maxVidsPerSub", value: maxVidsPerSub})))
                             .append($("<td>", {html: "Default: 27 | Range: 1-50 | Should be dividable by videos per row."}))
                            );
        settingsTable.append($("<tr>")
                             .append($("<td>", {html:"Watch time to mark video as seen"}))
                             .append($("<td>").append($("<input>", {type: "number", min:"0", id: "ytbsp-settings-timeToMarkAsSeen", value: timeToMarkAsSeen})).append(" s"))
                             .append($("<td>", {html: "Default: 10"}))
                            );
        settingsTable.append($("<tr>")
                             .append($("<td>", {html: "Delay for thumbnail enlarge"}))
                             .append($("<td>").append($("<input>", {type: "number", min:"0", id: "ytbsp-settings-enlargeDelay", value: enlargeDelay})).append(" ms"))
                             .append($("<td>", {html: "Default: 500"}))
                            );
        settingsTable.append($("<tr>")
                             .append($("<td>", {html: "Factor to enlarge thumbnail by"}))
                             .append($("<td>").append($("<input>", {type: "number", min:"1", step:"0.01", id: "ytbsp-settings-enlargeFactor", value: enlargeFactor})))
                             .append($("<td>", {html: "Default: 2.8 | 1 : disable thumbnail enlarge"}))
                            );
        settingsTable.append($("<tr>")
                             .append($("<td>", {html: "Factor to enlarge native thumbnail by"}))
                             .append($("<td>").append($("<input>", {type: "number", min:"1", step:"0.01", id: "ytbsp-settings-enlargeFactorNative", value: enlargeFactorNative})))
                             .append($("<td>", {html: "Default: 2.0 | 1 : disable thumbnail enlarge"}))
                            );
        settingsTable.append($("<tr>")
                             .append($("<td>", {html: "threshold to preload thumbnails"}))
                             .append($("<td>").append($("<input>", {type: "number", min:"0", id: "ytbsp-settings-screenThreshold", value: screenThreshold})).append(" px"))
                             .append($("<td>", {html: "Default: 500 | Higer threshold results in slower loading and more network traffic. Lower threshold may cause thumbnails to not show up immediately."}))
                            );
        settingsDialog.append(settingsTable);

        var saveSettings = function() {
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


            saveConfig().then(function(){
                setTimeout(function() {
                    closeModal();
                    loadingProgress(-1);
                    location.reload();
                }, 200);
            });
        };

        var versionInformation = "";
        try{
            versionInformation = GM_info && GM_info.script ? "script version:" + GM_info.script.version : "";
        }catch(e){}
        var endDiv = $("<div/>",{id:"ytbsp-modal-end-div"})
        .append($("<a/>",{html:"https://github.com/Crow08/YTBSP", href:"https://github.com/Crow08/YTBSP", target:"_blank", "class": "ytbsp-func", style:"font-size: 1rem;"}))
        .append($("<p/>",{html:versionInformation, "class": "ytbsp-func", style:"font-size: 1rem;"}))
        .append($("<input/>",{type:"submit", "class": "ytbsp-func", value: "Cancel", on: { click: closeModal }}))
        .append($("<input/>",{type:"submit", "class": "ytbsp-func", value: "Save", on: { click: saveSettings }}));
        settingsDialog.append(endDiv);
        openModal(settingsDialog);
    }
    $(".ytbsp-func#ytbsp-settings", maindiv).click(openSettingsDialog);

    // Show backup dialog modal
    function openModal(content) {
        if($("#ytbsp-modal-content").length == 0 || $("#ytbsp-modal").length == 0){
            console.error("could not open modal!");
        }
        $("#ytbsp-modal-content").empty();
        $("#ytbsp-modal-content").append(content);
        $("#ytbsp-modal").css("display", "block");
        setTimeout(function() {
            $("#ytbsp-modal").css("opacity", "1");
        }, 0);
    }

    // Hide backup dialog modal
    function closeModal() {
        if($("#ytbsp-modal").length != 0) {
            $("#ytbsp-modal").css("display", "none");
            $("#ytbsp-modal").css("opacity", "0");
        }
    }

    var player = new Player();

    function Player(){
        this.playerRef = null;
        this.nativePlayerParent = null;
        this.nativePlayerCss = null;
        this.nativePlayerIsTheater = false;
        this.peekPlayerActive = false;

        this.showPeekPlayer = function(){
            this.playerRef = $('#movie_player');
            if(!this.playerRef.length || peekPlayerSizeFactor <= 0.0){
                return;
            }
            this.nativePlayerParent = this.playerRef.parent();
            if(null == this.nativePlayerCss){
                this.nativePlayerCss = {
                    position : this.playerRef.css('position'),
                    right : this.playerRef.css('right'),
                    bottom : this.playerRef.css('bottom'),
                    width : this.playerRef.css('width'),
                    height : this.playerRef.css('height'),
                    zIndex : this.playerRef.css('zIndex')
                };
            }
            // TODO: Repair TheaterMode.
            //this.nativePlayerIsTheater = $('#page-manager > ytd-watch-flexy').get(0).theater;
            //$('#page-manager > ytd-watch-flexy').get(0).theaterModeChanged_(true);

            $("#YTBSP").append(this.playerRef);

            if(this.playerRef.get(0).getPlayerState() == 1){
                this.playerRef.get(0).playVideo();
            }

            this.playerRef.get(0).hideControls();

            this.playerRef.css({
                position: "fixed",
                right: "20px",
                bottom: "20px",
                width: (320 * peekPlayerSizeFactor) + "px",
                height: (180 * peekPlayerSizeFactor) + "px",
                zIndex: "10"
            });


            // add overlay to the peek player that will control click behaviour
            this.playerRef.append('<div id="ytbsp-peekplayer-overlay"><div id="ytbsp-peekplayer-overlay-player-control"><label class="ytbsp-play-pause-icon" title="play / pause"></div></div>');
            // initialize play/pause icon depending on player state
            if(!$('.video-stream').get(0).paused){
                $('.ytbsp-play-pause-icon').addClass('ytbsp-pause');
            }
            var that = this;
            $("#ytbsp-peekplayer-overlay").click(
                function(event){
                    if($('#ytbsp-peekplayer-overlay-player-control:hover').length != 0){ // if over play/pause button
                        that.playerRef.trigger( "click" ); // send click to youtube player to play/pause the video
                        $('.ytbsp-play-pause-icon').toggleClass('ytbsp-pause');
                    }
                    else{ // click somewhere else on the peek player
                        // prevent the event from bubbling to the youtube player and toggle ytbsp to native player view
                        event.preventDefault();
                        event.stopPropagation();
                        toggleytbsp();
                    }
                }
            );

            window.dispatchEvent(new Event('resize'));

            this.peekPlayerActive = true;
        }

        this.showNativePlayer = function(){
            if(null == this.nativePlayerParent && !this.nativePlayerParent.length){
                return;
            }
            this.playerRef = $('#movie_player');
            if(!this.playerRef.length){
                return;
            }

            this.nativePlayerParent.append($('#movie_player'));

            if(this.playerRef.get(0).getPlayerState() == 1){
                this.playerRef.get(0).playVideo();
            }

            this.playerRef.get(0).showControls();

            this.playerRef.css(this.nativePlayerCss);

            if(!this.nativePlayerIsTheater){
                // TODO: Repair TheaterMode.
                //$('#page-manager > ytd-watch-flexy').get(0).theaterModeChanged_(false);
            }
            $("#ytbsp-peekplayer-overlay").remove();

            window.dispatchEvent(new Event('resize'));

            this.peekPlayerActive = false;
        }

        this.isPeekPlayerActive = function(){
            return this.peekPlayerActive;
        }
    }

    /////////////////////////////////////
    // SUBSCRIPTION Object constructor //
    /////////////////////////////////////

    function Subscription(snippet) {

        this.videos = [];
        this.name = snippet.title;
        this.id = snippet.resourceId.channelId;

        // Now build the overview.
        this.row = $("<li/>",{"class": "ytbsp-subscription", css: {display: hideEmptySubs ? "none" : ""}});

        // Create content.
        var subMenuStrip = $("<div/>",{"class":"ytbsp-subMenuStrip"});

        subMenuStrip.append($("<div/>",{css: {"float": "right"}})
                            .append($("<button/>",{"class": "ytbsp-func ytbsp-subRemoveAllVideos", html: "Remove all"}))
                            .append($("<button/>",{"class": "ytbsp-func ytbsp-subResetAllVideos", html: "Reset all"}))
                            .append($("<button/>",{"class": "ytbsp-func ytbsp-subSeenAllVideos", html: "Mark all as seen"}))
                            .append($("<button/>",{"class": "ytbsp-func ytbsp-subShowMore", html: "Show more"}))
                           );
        subMenuStrip.append($("<div/>",{"class": "ytbsp-loaderph"})
                            .append(getLoader("loader_" + this.id)));
        subMenuStrip.append($("<h3/>",{"class": "ytbsp-subTitle"})
                            .append($("<a/>",{href: "/channel/" + this.id}))
                           );
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

        var self = this;

        // Function to remove all videos.
        function subRemoveAllVideos() {
            self.videos.forEach(function(video, i) {
                self.videos[i].remove();
            });
            self.buildList();
            saveList();
        }
        $(".ytbsp-func.ytbsp-subRemoveAllVideos", this.row).click(subRemoveAllVideos);

        // Function to reset all videos.
        function subResetAllVideos() {
            self.videos.forEach(function(video, i) {
                self.videos[i].reset();
            });
            self.buildList();
            saveList();
        }
        $(".ytbsp-func.ytbsp-subResetAllVideos", this.row).click(subResetAllVideos);

        // Function to see all.
        function subSeenAllVideos() {
            self.videos.forEach(function(video, i) {
                self.videos[i].see();
            });
            self.buildList();
            saveList();

        }
        $(".ytbsp-func.ytbsp-subSeenAllVideos", this.row).click(subSeenAllVideos);

        // Function to show more.
        function subShowMore() {
            self.showall = !self.showall;
            if(self.showall) {
                $(".ytbsp-func.ytbsp-subShowMore", self.row).text("Show less");
            } else {
                $(".ytbsp-func.ytbsp-subShowMore", self.row).text("Show more");
            }
            self.buildList();
        }
        $(".ytbsp-func.ytbsp-subShowMore", this.row).click(subShowMore);
    }
    Subscription.prototype = {

        showall: false,
        needsUpdate: false,
        isInView: false,

        updateVideos: function(){
            loadingProgress(1, false, this);
            buildApiRequest(
                'GET',
                '/youtube/v3/playlistItems',
                {
                    'maxResults': maxVidsPerSub,
                    'part': 'snippet',
                    'fields': 'items(snippet(publishedAt,resourceId/videoId,thumbnails(maxres,medium),title)),nextPageToken,pageInfo,prevPageToken',
                    'playlistId': this.id.replace(/^UC/, 'UU')
                }
            ).then(processRequestVids);

            var self = this;

            function processRequestVids(response) {
                self.videos = [];
                // If videos for sub are in cache find them.
                var cacheSub = $.grep(cachedVideoinformation, function(subs) {
                    return subs.id == self.id;
                });
                var cacheVideos = [];
                if(cacheSub.length == 1) {
                    cacheVideos = cacheSub[0].videos;
                }

                response.items.forEach(function(video) {
                    var thumb;
                    var thumb_large;
                    var title;
                    var upload;
                    var pubDate;
                    var vid;
                    var seen;
                    var removed;

                    try {
                        thumb = video.snippet.thumbnails.medium.url;
                    } catch(e) {}
                    try {
                        thumb_large = video.snippet.thumbnails.maxres.url;
                    } catch(e) {}
                    try {
                        title = video.snippet.title;
                    } catch(e) {}
                    try {
                        upload = moment(video.snippet.publishedAt).fromNow();
                    } catch(e) {}
                    try {
                        pubDate = moment(video.snippet.publishedAt).format('YYYY-MM-DD HH:mm:ss');
                    } catch(e) {}
                    try {
                        vid = video.snippet.resourceId.videoId;
                    } catch(e) {}

                    // Merge cache info if available.
                    var cacheVideo = $.grep(cacheVideos, function(cVideo) {
                        return cVideo.vid == vid;
                    });
                    if(cacheVideo.length == 1) {
                        try {
                            seen = cacheVideo[0].seen;
                        } catch(e) {}
                        try {
                            removed = cacheVideo[0].removed;
                        } catch(e) {}
                    }

                    var infos = {
                        vid: vid,
                        title: title,
                        thumb: thumb ? thumb : "",
                        thumb_large: thumb_large ? thumb_large : "",
                        uploaded: upload ? upload : "missing upload time",
                        pubDate: pubDate ? pubDate : "missing upload time",
                        seen: seen ? seen : false,
                        removed: removed ? removed : false
                    };
                    self.videos.push(new Video(infos));
                });
                // Rebuild the list.
                self.buildList();

                loadingProgress(-1, false, self);
            }
        },

        // (Re-)Build the list of videos.
        buildList: function() {

            var self = this;

            var alreadyIn = $(".ytbsp-video-item", this.videoList);
            var visableItems = 0;
            var limit = this.showall ? maxVidsPerSub : maxVidsPerRow;
            $("br", this.videoList).remove();
            // Now loop through the videos.
            this.videos.forEach(function(video, i) {

                // If that video is removed search for it and remove it when found.
                if(video.isRemoved() || (hideSeenVideos && video.isSeen())) {
                    var thumbNode = $("#YTBSPthumb_" + video.vid, this.videoList);
                    var index = alreadyIn.index(thumbNode);
                    if(thumbNode && index !== -1) {
                        thumbNode.remove();
                        alreadyIn.splice(index, 1);
                    }

                    // if this video isn't removed and we are still in the search of new ones
                } else if(visableItems < limit) {
                    var thumb = alreadyIn[visableItems];
                    // If Video is already in the list, update it.
                    if(thumb && thumb.id.substr(11) === video.vid) {
                        this.videos[i].updateThumb(this.inView());
                        // If the thumb in this position isn't the right one.
                    } else {
                        // Create new thumb for video.
                        this.videos[i].createThumb(this.inView());
                        // Register some events from this thumb.
                        $(".ytbsp-seemarker", this.videos[i].thumbLi).click(function() {
                            self.videos[i].toggleSeen();
                            self.buildList();
                            saveList();
                        });
                        $(".ytbsp-x", this.videos[i].thumbLi).click(function() {
                            self.videos[i].remove();
                            self.buildList();
                            saveList();
                        });
                        // Insert new thumb.
                        if(visableItems < alreadyIn.length) {
                            alreadyIn[visableItems].before(this.videos[i].thumbLi[0]);
                            alreadyIn.splice(visableItems, 0, this.videos[i].thumbLi);

                        } else {
                            this.videoList.append(this.videos[i].thumbLi);
                            alreadyIn.push(this.videos[i].thumbLi);
                        }
                    }
                    ++visableItems;
                    if(visableItems < limit && visableItems % maxVidsPerRow == 0){
                        if(visableItems < alreadyIn.length) {
                            $("</br>").insertBefore(alreadyIn[visableItems]);
                        } else {
                            this.videoList.append($("</br>"));
                        }
                    }
                }
            }, this);

            // Remove overstanding items.
            for(var i = visableItems, ilen = alreadyIn.length; i < ilen; ++i) {
                alreadyIn[i].remove();
            }

            // Handly visability.
            this.isEmpty = visableItems <= 0;
            this.handleVisablility();
        },

        // Hides subscription if needed.
        handleVisablility: function() {
            if(this.isEmpty && hideEmptySubs){
                this.row.hide();
            }else{
                this.row.show();
            }
            updateSubsInView();
        },

        // Displays the Loader.
        showLoader: function(){
            var loadph = $(".ytbsp-loaderph", this.row);
            var loader = $(".ytbsp-loader", this.row);
            if(loadph && loader) {
                loadph.css("width", "16px");
                setTimeout(function() {
                    loader.css("opacity", "1");
                }, 200);
            }
        },

        // Removes the Loader.
        removeLoader: function() {
            var loadph = $(".ytbsp-loaderph", this.row);
            var loader = $(".ytbsp-loader", this.row);
            if(loadph && loader) {
                setTimeout(function() {
                    loader.css("opacity", "0");
                    setTimeout(function() {
                        loadph.css("width", "0px");
                    }, 200);
                }, 200);
            }
        },

        // Cecks if the subscription is within the threadshold of the view.
        inView: function() {

            if(this.lastViewCheck === lastScroll) {
                return this.isInView;
            }
            this.lastViewCheck = lastScroll;
            var offsetTop = this.videoList ? this.videoList.offset().top : 0;

            this.isInView = (this.videoList &&
                             offsetTop - screenThreshold < screenBottom &&
                             offsetTop + screenThreshold > screenTop
                            );
            return this.isInView;
        },

        // Returns an object that can be saved as json.
        getSaveable: function() {
            var saveable = {
                videos: [],
                id: this.id
            };
            this.videos.forEach(function(video) {
                saveable.videos.push(video.getSaveable());
            });
            return saveable;
        }
    };


    //////////////////////////////
    // VIDEO Object Constructor //
    //////////////////////////////

    function Video(infos) {
        this.vid = infos.vid;
        this.addInfos(infos);
        this.thumbLi = $("<li/>", {id: "YTBSPthumb_" + this.vid, "class": "ytbsp-video-item"});
    }

    var timeouts = {};

    Video.prototype = {
        vid: undefined,
        title: "",
        thumb: "",
        thumb_large: "",
        duration: "0:00",
        uploaded: "",
        pubDate: "",
        clicks: "",

        seen: false,
        removed: false,

        thumbItem: null,
        thumblargeItem: null,
        durationItem: null,
        clicksItem: null,
        uploadItem: null,
        titleItem: null,


        addInfos: function(infos) {
            // Set given informations.
            if(infos.hasOwnProperty('title')) {
                this.title = infos.title !== "" ? infos.title : this.title;
            }
            if(infos.hasOwnProperty('thumb')) {
                this.thumb = infos.thumb !== "" ? infos.thumb : this.thumb;
            }
            if(infos.hasOwnProperty('thumb_large')) {
                this.thumb_large = infos.thumb_large !== "" ? infos.thumb_large : this.thumb_large;
            }
            if(infos.hasOwnProperty('duration')) {
                this.duration = infos.duration !== "0:00" ? infos.duration : this.duration;
            }
            if(infos.hasOwnProperty('uploaded')) {
                this.uploaded = infos.uploaded !== "" ? infos.uploaded : this.uploaded;
            }
            if(infos.hasOwnProperty('pubDate')) {
                this.pubDate = infos.pubDate !== "" ? infos.pubDate : this.pubDate;
            }
            if(infos.hasOwnProperty('clicks')) {
                this.clicks = infos.clicks !== "" ? infos.clicks : this.clicks;
            }
            if(infos.hasOwnProperty('seen')) {
                this.seen = infos.seen !== false ? infos.seen : this.seen;
            }
            if(infos.hasOwnProperty('removed')) {
                this.removed = infos.removed !== false ? infos.removed : this.removed;
            }
        },

        isRemoved: function() {
            return this.removed;
        },

        remove: function() {
            if(this.removed) {
                return;
            }
            this.removed = true;
        },

        unremove: function() {
            if(!this.removed) {
                return;
            }
            this.removed = false;
        },

        isSeen: function() {
            return this.seen;
        },

        toggleSeen: function() {
            if(this.seen) {
                this.unsee();
            } else {
                this.see();
            }
        },

        see: function() {
            if(this.seen) {
                return;
            }
            this.seen = true;
            this.updateThumb(true);
        },

        unsee: function() {
            if(!this.seen) {
                return;
            }
            this.seen = false;
            this.updateThumb(true);
        },

        reset: function() {
            this.unsee();
            this.unremove();
        },

        createThumb: function(inView) {
            var self = this;
            if(this.duration == "0:00") {
                loadingProgress(1);
                buildApiRequest(
                    'GET',
                    '/youtube/v3/videos',
                    {
                        'part': 'contentDetails,statistics',
                        'fields': 'items(contentDetails/duration,statistics/viewCount)',
                        'id': self.vid
                    }
                ).then(function(response) {
                    var duration;
                    var viewCount;
                    try {
                        duration = moment.duration(response.items[0].contentDetails.duration);
                    } catch(e) {}
                    try {
                        var count = parseInt(response.items[0].statistics.viewCount);
                        if (count > 1000000) {
                            viewCount = (Math.round(count / 1000000 * 10) / 10) + "M views"; // round to one decimal
                        }
                        else if (count > 10000) {
                            viewCount = Math.round(count / 1000) + "K views";
                        }
                        else {
                            viewCount = count + " views";
                        }
                    } catch(e) {}
                    var time;
                    if(duration.hours() === 0) {
                        try {
                            time = moment(duration.minutes() + ':' + duration.seconds(), 'm:s').format('mm:ss');
                        } catch(e) {}
                    } else {
                        try {
                            time = moment(duration.hours() + ':' + duration.minutes() + ':' + duration.seconds(), 'h:m:s').format('HH:mm:ss');
                        } catch(e) {}
                    }
                    self.duration = time;
                    self.clicks = viewCount;

                    self.updateThumb(inView);
                    loadingProgress(-1);
                });
            }
            this.thumbLi.empty();
            this.thumbLi.append($("<a/>", {href: "/watch?v=" + this.vid, "class": "ytbsp-clip", "data-vid": this.vid})
                                .append($("<div/>", {"class": "ytbsp-x", html:"X"}))
                                .append($("<img/>", {"class": "ytbsp-thumb"}))
                                .append($("<ytd-thumbnail-overlay-time-status-renderer/>"))
                                .append($("<input/>", {"class": "ytbsp-thumb-large-url", "type": "hidden"}))
                               );
            this.thumbLi.append($("<a/>", {href: "/watch?v=" + this.vid, "class": "ytbsp-title", "data-vid": this.vid}));
            this.thumbLi.append($("<p/>", {"class": "ytbsp-views"}));
            this.thumbLi.append($("<p/>", {"class": "ytbsp-uploaded"}));
            this.thumbLi.append($("<p/>", {"class": "ytbsp-seemarker" + (this.isSeen() ? " seen" : ""), html: (this.isSeen() ? "already seen" : "mark as seen")}));

            $(".ytbsp-clip, .ytbsp-title, .ytbsp-x", this.thumbLi).click(function(event){
                event.preventDefault();
                if(event.target.classList.contains("ytbsp-x")){
                    return;
                }
                openVideoWithSPF($(this).attr('data-vid'));
            });

            // Enlarge thumbnail and load higher resolution image.
            function enlarge(){
                if(enlargeFactor <= 1){
                    return;
                }
                if ($(".ytbsp-x:hover", this).length !== 0) {
                    return;
                }
                if(!(self.vid.replace('-', '$') in timeouts)){
                    timeouts[self.vid.replace('-', '$')] = -1;
                }
                var thumb = $(this).parent();
                var clip = $(this);
                if(timeouts[self.vid.replace('-', '$')] == -1){
                    timeouts[self.vid.replace('-', '$')] = setTimeout(function(){
                        var img = $('.ytbsp-thumb',clip);
                        var title = $('.ytbsp-title', thumb);
                        var infos = $('p', thumb);
                        img.attr('src', $('.ytbsp-thumb-large-url',clip).val());
                        img.addClass('ytbsp-thumb-large');
                        title.addClass('ytbsp-title-large');
                        clip.addClass('ytbsp-clip-large');
                        infos.hide();
                    }, enlargeDelay);
                }
            }
            $(".ytbsp-clip", this.thumbLi).mouseover(enlarge);

            // reset tumbnail to original size
            function enlargecancel(){
                if(enlargeFactor <= 1){
                    return;
                }
                if(self.vid.replace('-', '$') in timeouts && timeouts[self.vid.replace('-', '$')] > 0){
                    clearTimeout(timeouts[self.vid.replace('-', '$')]);
                }
                timeouts[self.vid.replace('-', '$')] = -1;
                var thumb = $(this);
                var clip = $(".ytbsp-clip", thumb);
                var img = $('.ytbsp-thumb',clip);
                var title = $('.ytbsp-title', thumb);
                var infos = $('p', thumb);
                img.removeClass('ytbsp-thumb-large');
                title.removeClass('ytbsp-title-large');
                clip.removeClass('ytbsp-clip-large');
                infos.show();
            }
            $(this.thumbLi).mouseleave(enlargecancel);

            // abort enlargement process if not already open.
            function enlargecancleTimeout(){
                if(self.vid.replace('-', '$') in timeouts){
                    clearTimeout(timeouts[self.vid.replace('-', '$')]);
                    timeouts[self.vid.replace('-', '$')] = -1;
                }
            }
            $(".ytbsp-x", this.thumbLi).mouseover(enlargecancleTimeout);
            $(".ytbsp-clip", this.thumbLi).mouseleave(enlargecancleTimeout);

            // Save information elements.
            this.thumbItem = $(".ytbsp-thumb", this.thumbLi);
            this.thumblargeItem = $(".ytbsp-thumb-large-url", this.thumbLi);
            this.durationItem = $(".ytbsp-clip > ytd-thumbnail-overlay-time-status-renderer > span", this.thumbLi);
            this.clicksItem = $(".ytbsp-views", this.thumbLi);
            this.uploadItem = $(".ytbsp-uploaded", this.thumbLi);
            this.titleItem = $("a.ytbsp-title", this.thumbLi);
            this.updateThumb(inView);
        },

        updateThumb: function(inView) {
            if(!this.thumbItem) {
                return;
            }
            if(inView || this.thumbItem.src) {
                this.thumbItem.attr("src", this.thumb);
            } else {
                this.thumbItem.attr('data-src', this.thumb);
            }
            this.thumblargeItem.val(this.thumb_large ? this.thumb_large : this.thumb);
            this.durationItem.html(this.duration);
            this.clicksItem.html(this.clicks);
            this.uploadItem.html(this.uploaded);
            this.titleItem.html(this.title);
            this.titleItem.prop('title', this.title);

            var marker = $(".ytbsp-seemarker", this.thumbLi);
            if(this.seen) {
                marker.html("already seen");
                marker.addClass("seen");
            } else {
                marker.html("mark as seen");
                marker.removeClass("seen");
            }

        },

        getSaveable: function() {
            return {
                vid: this.vid,
                seen: this.seen,
                removed: this.removed
            };
        }
    };

    // List for manually checked and potentially unsubscribed or deleted channels.
    var manuallyCheckedSubs = [];

    function saveList() {
        // Check if all subs in cache are loaded properly.
        for (var i = 0; i < cachedVideoinformation.length; i++) {
            // If cached subscription was not alredy checked and is not in current sub list.
            if(!manuallyCheckedSubs.includes(cachedVideoinformation[i].id) &&
               !isInSubs(cachedVideoinformation[i].id)){
                // If subscription was not loaded check if still subscribed.
                checkAndAppendSub(cachedVideoinformation[i].id);
                manuallyCheckedSubs.push(cachedVideoinformation[i].id);
                // After subscription is checked this function is called again.
                return;
            }
        }
        // Clear manuallyCheckedSubs because new cache will be created when saving.
        manuallyCheckedSubs = [];

        // Construct new cache from current subs.
        var saveObj = [];
        subs.forEach(function(sub) {
            saveObj.push(sub.getSaveable());
        });

        // Save new video information cache.
        cachedVideoinformation = saveObj;
        saveVideoInformation();
    }

    function isInSubs(vId){
        return $.grep(subs, function(sub) {
            return sub.id == vId;
        }).length != 0;
    }

    // Now we just need to generate a stylesheet

    // Stylerules depening on the loaded page.
    // Startpage_body display: none is defined via stylesheet to not fash up when loaded.
    // (When loaded this rule has to be removed, to prevent feedpages from loadig with display: none)
    var loading_body_style = YT_STARTPAGE_BODY + ' { background: transparent; display:none; }';
    var startpage_body_style = YT_STARTPAGE_BODY + ' { margin-top: -30px; margin-left: 120px; background: transparent; }' +
        YT_GUIDE + '{ z-index: 0 !important;}';
    var video_body_style = YT_STARTPAGE_BODY + ' { background: transparent; margin-top: 0px; }' +
        YT_GUIDE + '{ z-index: 0 !important; width: var(--app-drawer-width, 256px); }';
    var search_body_style = YT_STARTPAGE_BODY + ' { background: transparent; margin-top: -50px; }' +
        YT_GUIDE + '{ z-index: 0; !important;}';
    var default_body_style = YT_STARTPAGE_BODY + ' { background: transparent; }' +
        YT_GUIDE + '{ z-index: 0; !important;}';
    var playlist_body_style = YT_STARTPAGE_BODY + ' { background: transparent; margin-top: -60px; }' +
        YT_GUIDE + '{ z-index: 0; !important;}' +
        YT_STARTPAGE_BODY + " " + YT_PLAYLIST_SIDEBAR + ' {padding-top: 54px;}';
    function setYTStyleSheet(body_style){
        $("#ytbsp-yt-css").remove();
        var css = document.createElement("style");
        css.type = "text/css";
        css.id="ytbsp-yt-css";
        css.innerHTML = body_style;

        document.head.appendChild(css);
    }

    function addYTBSPStyleSheet() {
        // Check if we got a dark theme.
        var color = getComputedStyle(document.documentElement).backgroundColor.match(/\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
        var dark = document.documentElement.getAttribute("dark");
        dark = dark || (color && (parseInt(color[1]) + parseInt(color[2]) + parseInt(color[3])) < 384);

        var stdFontColor = dark ? "#e1e1e1" : "#111111";
        var subtextColor = dark ? "#ffffffff" : "#141414";
        var viewsAndUploadedInfoColor = dark ? "#888888" : "#11111199";
        var stdBorderColor = dark ? "#2c2c2c" : "#e2e2e2";
        var altBorderColor = dark ? "#737373" : "#737373";
        var stdBgColor = dark ? "#141414" : "#F9F9F9";
        var altBgColor = dark ? "#252525" : "#f5f5f5";

        var css = document.createElement("style");
        css.type = "text/css";
        css.id="ytbsp-css";

        css.innerHTML =
            // header
            '#ytbsp-menuStrip { white-space: nowrap; padding: 10px 0px 20px 80px; display: flex;}' +
            '#YTBSP input { vertical-align: text-top; }' +

            // overall list
            '#ytbsp-subs { overflow: visible; padding: 0px; width: fit-content; margin: auto; list-style-type: none; min-width:' + maxVidsPerRow * 168 + 'px; margin-bottom: 100px;}' +
            '.ytbsp-subscription { border-bottom: 1px solid ' + stdBorderColor + '; padding: 0 4px; border-top: 1px solid ' + stdBorderColor + '; margin-top: -1px;}' +
            '.ytbsp-subVids { padding: 0px; margin: 10px 0; -webkit-transition: height 5s; -moz-transition: height 5s; -o-transition: height 5s; }' +
            '.ytbsp-video-item { display: inline-block; width: 160px; height: 165px; padding: 0 4px; overflow: visible; vertical-align: top; }' +
            '.ytbsp-video-item .ytbsp-title { display: block; padding-top: 5px; height: 3.2rem; overflow: hidden; color: ' + stdFontColor + '; text-decoration: none; font-size: 1.4rem; line-height: 1.6rem; font-weight: 500;}' +
            '.ytbsp-subMenuStrip { height: 25px; margin: 4px 4px 3px; }' +
            '.ytbsp-subTitle a { color: ' + stdFontColor + '; padding-top: 6px; position: absolute; text-decoration: none; font-size: 1.6rem; font-weight: 500;}' +
            '#YTBSP {margin-left: 240px; margin-top: 57px;}' +
            '#ytbsp-subs .ytbsp-title-large{ width:' + (160 * enlargeFactor - 4) + 'px; left: ' + -((160 * enlargeFactor)/2 - 82) + 'px; position: relative; z-index: 1; background: ' + altBgColor + '; text-align: center;' +
            'border-width: 0px 2px 2px 2px; border-style: solid; border-color: ' + altBorderColor + '; padding: 2px;}' +

            // image part
            '.ytbsp-clip { position: relative; width: 160px; height: 90px; border: none; cursor: pointer; display: block;}' +
            '.ytbsp-clip-large { z-index: 1; width:' + (160 * enlargeFactor + 4) + 'px; height:' + (90 * enlargeFactor + 4) + 'px; top: -45px; left:' + -((160 * enlargeFactor)/2 - 82) + 'px; margin-bottom: -44px; border: none; }' +
            '.ytbsp-x { position: absolute; z-index: 2; top: 2%; right: 1%; opacity: 0.6; width: 17px; height: 17px; ' +
            'line-height: 16px; text-align: center; background-color: #000; color: #fff; font-size: 15px; font-weight: bold; ' +
            'border-radius: 3px; -moz-border-radius: 3px; display: none; cursor: pointer;}' +
            '.ytbsp-video-item:hover .ytbsp-x { display: block; }' +
            '.ytbsp-x:hover { opacity: 1; }' +
            '.ytbsp-thumb { display: block; position: absolute; height: 90px;  width: 160px;}' +
            '.ytbsp-thumb-large { width:' + (160 * enlargeFactor) + 'px; height:' + (90 * enlargeFactor) + 'px; border: 2px solid ' + altBorderColor + '; top: 1px;}' +

            // infos
            '.ytbsp-views, .ytbsp-uploaded { color: ' + viewsAndUploadedInfoColor + '; display: inline-block;  margin: 5px 0px 0px 0px; font-size: 1.2rem; }' +
            '.ytbsp-views:after { content: "•"; margin: 0 4px; }' +
            '.ytbsp-seemarker { font-size: 1.2rem; background-color: transparent; color: ' + subtextColor + '; padding: 1px 0px; margin: 5px 0px 0px 0px; text-align: center; opacity: 0.88; cursor: pointer; display: block; }' +
            '.ytbsp-seemarker:hover { opacity: 1; }' +
            '.ytbsp-seemarker:active { opacity: 0.4; }' +
            '.ytbsp-seemarker.seen { opacity: 1;  font-weight: 500; background-color: #474747; }' +
            '.ytbsp-seemarker.seen:hover { opacity: 0.6; }' +

            // functionbuttons
            '#YTBSP .ytbsp-func { color: ' + subtextColor + '; cursor: pointer; display: inline-block; border: none; z-index: 1; opacity: 0.88;' +
            'background-color: transparent; padding: 1px 10px; margin: 0px 2px; font-size: 1.4rem; font-weight: 400; font-family: Roboto, Noto, sans-serif;}' +
            '#YTBSP label.ytbsp-func {padding-top: 3px;}' +
            '#YTBSP .ytbsp-func:hover { opacity: 1; }' +
            '#YTBSP .ytbsp-func:active { opacity: 0.6; }' +
            '#YTBSP .ytbsp-func:focus { outline-style: none; }' +
            '#YTBSP .ytbsp-func input{ vertical-align: middle; margin: -2px 5px -1px 0px;}' +

            // loader
            '.ytbsp-loaderph { float: left; width: 16px; height: 16px; margin-right: 5px; ' +
            '-webkit-transition: width 0.2s; -moz-transition: width 0.2s; -o-transition: width 0.2s; }' +
            '#ytbsp-loaderSpan { width: 21px; margin-right: 1px; display: inline-block;}' +
            '#YTBSP #ytbsp-refresh {display: none; padding: 1px 3px;}' +
            '.ytbsp-loader { border: 3px solid #bbb; border-top: 3px solid #555; border-left: 3px solid #bbb; border-bottom: 3px solid #555; ' +
            'border-radius: 50%; width: 10px; height: 10px; animation: spin 1s linear infinite; -webkit-transition: opacity 0.2s; ' +
            '-moz-transition: opacity 0.2s; -o-transition: opacity 0.2s;}' +
            '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); }}' +

            // slider
            '.ytbsp-slider { display: inline-block; padding: 0px 10px; width: 34px; vertical-align: middle; cursor: pointer;}' +
            '.ytbsp-slider-rail { position: absolute; width: 34px; height: 14px; border-radius: 8px; background-color: ' + altBorderColor + '; ' +
            'opacity: 0.2; -webkit-transition: .1s; transition: .1s; }' +
            '.ytbsp-slider-knob { position: relative; top: -3px; left: 0; height: 20px; width: 20px; border-radius: 50%; background-color: #fff; ' +
            'box-shadow: 0 1px 5px 0 rgba(0, 0, 0, 0.6); -webkit-transition: .4s; transition: .4s; }' +
            '.ytbsp-slider-cb:checked ~ .ytbsp-slider-knob { left: 16px; }' +
            '.ytbsp-slider-cb:checked ~ .ytbsp-slider-rail { background-color: ' + stdFontColor + '; opacity: 0.9; -webkit-transition: .8s; transition: .8s; }' +
            '.ytbsp-slider-cb {display:none;}' +

            // modal
            '#ytbsp-modal { position: fixed; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,.4); z-index: 3;' +
            '-webkit-transition: opacity .2s; -moz-transition: opacity .2s; -o-transition: opacity .2s; opacity: 0; overflow: auto; display: none; }' +
            '#ytbsp-modal-content { margin: 0 auto; width: 600px; min-height: 20px; margin-top: 30px; padding: 10px; background: ' + altBgColor + '; ' +
            ' position: sticky; top: 60px; -moz-border-radius: 3px; border-radius: 3px; box-shadow: 0 5px 20px rgba(0,0,0,.4); }' +
            '#ytbsp-modal-content textarea { width: 595px; height: 400px; resize: none; margin: 20px 0; }' +
            '#ytbsp-modal-content p, h1, h2 {color:' + stdFontColor + '; font-weight: 400;}' +
            '#ytbsp-modal-content h2 {display: inline-block; }' +
            '#ytbsp-modal-end-div { display: inline-block; width: 100%; }' +
            '#ytbsp-modal-end-div input{ float: right; }' +
            '#ytbsp-settings-table { margin: 50px 0px; color:' + stdFontColor + '; border-collapse: collapse;}' +
            '#ytbsp-settings-table tr { border-bottom: 1px solid ' + stdBorderColor + '; min-height:45px;}' +
            '#ytbsp-settings-table td { font-size: 1.4rem; padding:5px; min-width: 80px;}' +
            '#ytbsp-settings-table td:nth-child(3) { font-size: 1.0rem;}' +
            '#ytbsp-settings-table input[type="number"] { width: 50px; }' +

            // peek player
            '#ytbsp-peekplayer-overlay{ position: fixed; right: 20px; bottom: 20px; width:' + (320 * peekPlayerSizeFactor) + 'px; height:' + (180 * peekPlayerSizeFactor) + 'px; z-index: 11 }' +
            '#ytbsp-peekplayer-overlay-player-control{ position: absolute; left: 0px; bottom: 0px; z-index: 12; cursor: pointer;' +
                'width:' + ((320 * peekPlayerSizeFactor) / 10) + 'px;' +
                'height:' + ((320 * peekPlayerSizeFactor) / 10) + 'px; }' +
            '.ytbsp-play-pause-icon {cursor: pointer; position: absolute; top: 0; left: 0; right: 0; bottom: 0; margin: auto; width: 16px; height: 24px;}' +
            '.ytbsp-play-pause-icon::before, .ytbsp-play-pause-icon::after { position: absolute; top: 50%; transform: translateY(-50%); }' +
            '.ytbsp-play-pause-icon::before { content: ""; left: 0; transition: all 0.2s linear; width: 0; height: 12px; border-top: 6px solid transparent; border-bottom: 6px solid transparent; border-left: 8px solid #ccc; }' +
            '.ytbsp-play-pause-icon::after { content: ""; right: 0; transition: all 0.3s; width: 0; height: 0; border-top: 6px solid transparent; border-bottom: 6px solid transparent; border-left: 8px solid #ccc; }' +
            '.ytbsp-play-pause-icon.ytbsp-pause::before{ border-top-width: 0; border-bottom-width: 0; border-left-width: 5.3px; height: 100%; }' +
            '.ytbsp-play-pause-icon.ytbsp-pause::after { border-top-width: 0; border-bottom-width: 0; border-left-width: 5.3px; height: 100%; }';

        document.head.appendChild(css);
    }

    // Because of the extreme ammount of thumbs they shouldn't be downloaded all at once (data-src instead of src)
    // since 2012.6-1 also the entire update only starts as soon as you scroll to it
    // The solution is: only download those on the screen

    // now we need an scroll event
    // also if the window is resized it should be triggered
    var scrollTimeout = null;
    var moved = false;
    function checkEvent() {
        if(scrollTimeout === null) {
            scrollTimeout = setTimeout(function() {
                updateSubsInView();
                if(moved) {
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

    function updateSubsInView() {
        lastScroll = Date.now();
        screenTop = document.body.scrollTop || document.documentElement.scrollTop;
        screenBottom = screenTop + window.innerHeight;
        // check subs which has to be updated
        subs.forEach(function(sub) {
            if(sub.inView()) {
                // get all images that don't have a src but have an data-src
                $("img[data-src]", sub.videoList).each(function() {
                    $(this).get(0).src = $(this).get(0).getAttribute("data-src");
                    $(this).get(0).removeAttribute("data-src");
                });
            }
        });
        scrollTimeout = null;
    }

    function handlePageChange(){
        if(/.*watch\?.+list=.+/.test(location)){
            autoPauseThisVideo = false;
        }else{
            autoPauseThisVideo = autoPauseVideo;
        }
        clearTimeout(markAsSeenTimeout);
        toggleGuide = false;
        // forces some images to reload...
        window.dispatchEvent(new Event('resize'));
        // If we are on the startpage (or feed pages).
        if(/^(\/?|((\/feed\/)(trending|subscriptions|history)\/?))?$/i.test(location.pathname)) {
            setYTStyleSheet(startpage_body_style);
        } else if(/^\/?watch$/.test(location.pathname)) {
            setYTStyleSheet(video_body_style);
            watchpage();
        }else if (/^\/?results$/.test(location.pathname)){
            setYTStyleSheet(search_body_style);
        }else if (/^\/?playlist$/.test(location.pathname)){
            setYTStyleSheet(playlist_body_style);
        }else{
            setYTStyleSheet(default_body_style);
        }
        if(player.isPeekPlayerActive()){
            player.showNativePlayer();
        }

        if(location.pathname.length > 1) {
            shownative();
            if(/^\/?watch$/.test(location.pathname)) {
                toggleGuide = true;
            }
        }else{
            hidenative();
        }
    }

    function watchpage(){
        hideMAToolbar();
        // Mark as seen after at least X secounds.
        markAsSeenTimeout = setTimeout(function() {
            var vid = location.href.match(/v=([^&]{11})/)[1];
            if(vid) {
                var sid = $(YT_CHANNELLINK).attr('href').match(/\/channel\/([^&]*)/)[1];
                subs.forEach(function(sub, i) {
                    if(sub.id == sid) {
                        sub.videos.forEach(function(video, j) {
                            if(video.vid == vid) {
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

    function injectYTBSP(){
        $(YT_CONTENT).prepend(maindiv);
        $(window).scrollTop(0);
    }

    function setHrefObserver(){
        var oldHref = document.location.href;
        var observer = new MutationObserver(function() {
            if (oldHref != document.location.href) {
                oldHref = document.location.href;
                handlePageChange();
            }

            if ($('#YTBSP').length === 0 && $(YT_CONTENT).length!==0){
                injectYTBSP();
            }
            if ($('#page-manager > ytd-watch-flexy').get(0).fullscreen === true){
                $('#YTBSP').hide();
            }
            else{
                $('#YTBSP').show();
            }
        });
        observer.observe(document.querySelector("body"), {childList: true, subtree: true});
    }

    // Hide MA Toolbar.
    function hideMAToolbar(){
        var css = document.createElement("style");
        css.type = "text/css";
        css.innerHTML = MA_TOOLBAR + '{display: none;}' +
            YT_VIDEOTITLE + ' {display: block;}';
        document.head.appendChild(css);
    }

    function openVideoWithSPF(vid){
        var ytdApp = document.querySelector('ytd-app');
        ytdApp.fire("yt-navigate", {
            endpoint: {
                watchEndpoint: {
                    videoId:vid
                },
                webNavigationEndpointData: {
                    url:"/watch?v="+vid,
                    webPageType:"WATCH"
                }
            }
        });
    }

    // Executed on startup before main script.
    function onScriptStart(){
        setYTStyleSheet(loading_body_style);
        // Preconfiguration for settings that cannot wait until configuration is loaded.
        timeToMarkAsSeen = localStorage.getItem("YTBSP_timeToMarkAsSeen");
        autoPauseVideo = localStorage.getItem("YTBSP_autoPauseVideo") !== "0";
    }

    $(window).bind('storage', function (e) {
        if(e.key == "YTBSP"){
            getLocalVideoInformation().then(function(data){
                cachedVideoinformation = data;
                updateAllSubs();
            });
        }
    });

    // Native page is loaded.
    $( document ).ready(function() {
        // Insert new page.
        if($(YT_CONTENT).length!==0){
            injectYTBSP();
        }
        $(YT_STARTPAGE_BODY).hide();
        setHrefObserver();
        handlePageChange();
        // Remove css class from MA.
        $("html").removeClass("m0");
    });

    // Executed after config is Loaded
    function afterConfigLoaded(){
        addYTBSPStyleSheet();
        addThumbnailEnlargeCss();
        setPlayerQuality();
    }

    var defaultPlayFunction = HTMLMediaElement.prototype.play;

    HTMLMediaElement.prototype.play = function () {
        if(!jQuery.isReady){
            return;
        }
        if (autoPauseThisVideo) {
            autoPauseThisVideo = false;
            var player = this.parentElement.parentElement;
            if(player){
                player.stopVideo();
            }
            return;
        }
        defaultPlayFunction.call(this);
    };

    function addThumbnailEnlargeCss(){
        if(enlargeFactorNative <= 1){
            return;
        }
        // Check if we got a dark theme.
        var color = getComputedStyle(document.body).backgroundColor.match(/\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
        var color2 = getComputedStyle(document.documentElement).backgroundColor.match(/\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
        var dark = document.documentElement.getAttribute("dark");
        dark = dark || (color && (parseInt(color[1]) + parseInt(color[2]) + parseInt(color[3])) < 384) ||
            (color2 && (parseInt(color2[1]) + parseInt(color2[2]) + parseInt(color2[3])) < 384);

        var altBorderColor = dark ? "#737373" : "#737373";

        var css = document.createElement("style");
        css.type = "text/css";
        css.id="ytbsp-css";
        css.innerHTML =
            'ytd-thumbnail:hover { transform: scale(' + enlargeFactorNative + '); border: solid ' + enlargeFactorNative / 2.0 + 'px ' + altBorderColor + '; padding: 0px; z-index: 2; }' +
            'ytd-thumbnail { padding: ' + enlargeFactorNative / 2.0 + 'px }' +
            '#video-title { width: 200px; }' +
            '#scroll-container.yt-horizontal-list-renderer { overflow: visible; }';
        document.head.appendChild(css);
    }

    function setPlayerQuality(){
        localStorage.setItem(YT_PLAYER_QUALITY, '{"data":"' + playerQuality + '","expiration":' + moment().add(1, 'months').valueOf() + ',"creation":' + moment().valueOf() + '}');
    }

})(window.unsafeWindow || window);