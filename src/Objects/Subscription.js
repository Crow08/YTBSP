/* global $, getLoader, saveList, loadingProgress, buildApiRequest, maxVidsPerSub, maxVidsPerRow, hideEmptySubs, hideSeenVideos, screenThreshold, subList, cachedVideoInformation, Video */

class Subscription {

    constructor(snippet) {
        this.videos = [];
        this.name = snippet.title;
        this.id = snippet.resourceId.channelId;

        this.isExpanded = false;
        this.needsUpdate = false;
        this.isInView = false;
        this.lastViewCheck = 0;

        // Create subscription row.
        this.row = $("<li/>", {"class": "ytbsp-subscription", "css": {"display": hideEmptySubs ? "none" : ""}});

        // Create subscription functions menu.
        const subMenuStrip = $("<div/>", {"class": "ytbsp-subMenuStrip"});
        subMenuStrip.append($("<div/>", {"css": {"float": "right"}})
            .append($("<button/>", {"class": "ytbsp-func ytbsp-subRemoveAllVideos", "html": "Remove all"}).click(() => { this.subRemoveAllVideos(); }))
            .append($("<button/>", {"class": "ytbsp-func ytbsp-subResetAllVideos", "html": "Reset all"}).click(() => { this.subResetAllVideos(); }))
            .append($("<button/>", {"class": "ytbsp-func ytbsp-subSeenAllVideos", "html": "Mark all as seen"}).click(() => { this.subSeenAllVideos(); }))
            .append($("<button/>", {"class": "ytbsp-func ytbsp-subShowMore", "html": "Show more"}).click(() => { this.subShowMore(); })));
        subMenuStrip.append($("<div/>", {"class": "ytbsp-loaderDiv"}).append(getLoader(`loader_${this.id}`)));
        subMenuStrip.append($("<h3/>", {"class": "ytbsp-subTitle"}).append($("<a/>", {"href": `/channel/${this.id}`}).append(this.name)));
        this.row.append(subMenuStrip);

        // Create subscription video list.
        this.videoList = $("<ul/>", {"class": "ytbsp-subVids"});
        this.row.append(this.videoList);

        // Put new subscription in subscriptions list.
        subList.append(this.row);

        // Get videos for sub from api and fill video list.
        this.updateSubVideos();
    }

    // Function to remove all videos.
    subRemoveAllVideos() {
        const that = this;
        that.videos.forEach((video, i) => {
            that.videos[i].remove();
        });
        that.buildSubList();
        saveList();
    }

    // Function to reset all videos.
    subResetAllVideos() {
        const that = this;
        that.videos.forEach((video, i) => {
            that.videos[i].reset();
        });
        that.buildSubList();
        saveList();
    }

    // Function to see all.
    subSeenAllVideos() {
        const that = this;
        that.videos.forEach((video, i) => {
            that.videos[i].see();
        });
        that.buildSubList();
        saveList();
    }

    // Function to show more.
    subShowMore() {
        const that = this;
        that.isExpanded = !that.isExpanded;
        if (that.isExpanded) {
            $(".ytbsp-func.ytbsp-subShowMore", that.row).text("Show less");
        } else {
            $(".ytbsp-func.ytbsp-subShowMore", that.row).text("Show more");
        }
        that.buildSubList();
    }

    // Fetches and rebuilds subscription row based on updated viodeos.
    updateSubVideos() {
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
            that.buildSubList();

            loadingProgress(-1, false, that);
        }
    }

    // (Re-)Build the list of videos.
    buildSubList() {

        const that = this;

        const alreadyIn = $(".ytbsp-video-item", this.videoList);
        let visibleItems = 0;
        const limit = this.isExpanded ? maxVidsPerSub : maxVidsPerRow;
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
                    this.videos[i].updateThumb(this.isInView());
                    // If the thumb in this position isn't the right one.
                } else {
                    // Create new thumb for video.
                    this.videos[i].createThumb(this.isInView());
                    // Register some events from this thumb.
                    $(".ytbsp-seemarker", this.videos[i].thumbLi).click(() => {
                        that.videos[i].toggleSeen();
                        that.buildSubList();
                        saveList();
                    });
                    $(".ytbsp-x", this.videos[i].thumbLi).click(() => {
                        that.videos[i].remove();
                        that.buildSubList();
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
    }

    // Hides subscription if needed.
    handleVisibility() {
        if (this.isEmpty && hideEmptySubs) {
            this.row.hide();
        } else {
            this.row.show();
        }
        this.updateInView(Date.now());
    }

    // Displays the Loader.
    showLoader() {
        const loaderDiv = $(".ytbsp-loaderDiv", this.row);
        const loader = $(".ytbsp-loader", this.row);
        if (loaderDiv && loader) {
            loaderDiv.css("width", "16px");
            setTimeout(() => {
                loader.css("opacity", "1");
            }, 200);
        }
    }

    // Removes the Loader.
    removeLoader() {
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
    }

    // Checks if the subscription is within the threshold of the view.
    updateInView(timestamp) {
        if (!this.videoList.offset()) {
            return false;
        } else if (timestamp && this.lastViewCheck >= timestamp) {
            return this.isInView;
        } else if (timestamp) {
            this.lastViewCheck = timestamp;
        }

        const offsetTop = this.videoList.offset().top;
        const screenTop = document.body.scrollTop || document.documentElement.scrollTop;
        const screenBottom = screenTop + window.innerHeight;

        this.isInView = ((offsetTop - screenThreshold) < screenBottom) && ((offsetTop + screenThreshold) > screenTop);

        if (this.isInView) {
            // Get all images that don't have source loaded jet.
            $("img[data-src]", this.videoList).each(function() {
                $(this).get(0).src = $(this).get(0).getAttribute("data-src");
                $(this).get(0).removeAttribute("data-src");
            });
        }

        return this.isInView;
    }

    // Returns an object that can be saved as json.
    getDTO() {
        const saveData = {
            "videos": [],
            "id": this.id
        };
        this.videos.forEach((video) => {
            saveData.videos.push(video.getDTO());
        });
        return saveData;
    }
}

