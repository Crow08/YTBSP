class Subscription {

    constructor(snippet) {
        this.videos = [];
        this.name = snippet.title;
        this.id = snippet.resourceId.channelId;

        this.showall = false;
        this.needsUpdate = false;
        this.isInView = false;

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

        $(".ytbsp-func.ytbsp-subRemoveAllVideos", this.row).click(this.subRemoveAllVideos);
        $(".ytbsp-func.ytbsp-subResetAllVideos", this.row).click(this.subResetAllVideos);
        $(".ytbsp-func.ytbsp-subSeenAllVideos", this.row).click(this.subSeenAllVideos);
        $(".ytbsp-func.ytbsp-subShowMore", this.row).click(this.subShowMore);
    }

    // Function to remove all videos.
    subRemoveAllVideos() {
        const that = this;
        that.videos.forEach((video, i) => {
            that.videos[i].remove();
        });
        that.buildList();
        saveList();
    }

    // Function to reset all videos.
    subResetAllVideos() {
        const that = this;
        that.videos.forEach((video, i) => {
            that.videos[i].reset();
        });
        that.buildList();
        saveList();
    }

    // Function to see all.
    subSeenAllVideos() {
        const that = this;
        that.videos.forEach((video, i) => {
            that.videos[i].see();
        });
        that.buildList();
        saveList();

    }

    // Function to show more.
    subShowMore() {
        const that = this;
        that.showall = !that.showall;
        if (that.showall) {
            $(".ytbsp-func.ytbsp-subShowMore", that.row).text("Show less");
        } else {
            $(".ytbsp-func.ytbsp-subShowMore", that.row).text("Show more");
        }
        that.buildList();
    }

    updateVideos() {
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
    }

    // (Re-)Build the list of videos.
    buildList() {

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
    }

    // Hides subscription if needed.
    handleVisibility() {
        if (this.isEmpty && hideEmptySubs) {
            this.row.hide();
        } else {
            this.row.show();
        }
        updateSubsInView();
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
    inView() {

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

