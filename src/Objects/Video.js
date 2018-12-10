// TODO: find better solution
const timeouts = {};

class Video {

    constructor(info) {
        this.title = "";
        this.thumb = "";
        this.thumbLarge = "";
        this.duration = "0:00";
        this.uploaded = "";
        this.pubDate = "";
        this.clicks = "";

        this.seen = false;
        this.removed = false;
        this.thumbItem = null;
        this.thumbLargeItem = null;
        this.durationItem = null;
        this.clicksItem = null;
        this.uploadItem = null;
        this.titleItem = null;

        this.vid = info.vid;
        this.addInfos(info);
        this.thumbLi = $("<li/>", {"id": `YTBSPthumb_${this.vid}`, "class": "ytbsp-video-item"});
    }

    addInfos(infos) {
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
    }

    isRemoved() {
        return this.removed;
    }

    remove() {
        if (this.removed) {
            return;
        }
        this.removed = true;
    }

    unremove() {
        if (!this.removed) {
            return;
        }
        this.removed = false;
    }

    isSeen() {
        return this.seen;
    }

    toggleSeen() {
        if (this.seen) {
            this.unsee();
        } else {
            this.see();
        }
    }

    see() {
        if (this.seen) {
            return;
        }
        this.seen = true;
        this.updateThumb(true);
    }

    unsee() {
        if (!this.seen) {
            return;
        }
        this.seen = false;
        this.updateThumb(true);
    }

    reset() {
        this.unsee();
        this.unremove();
    }

    createThumb(inView) {
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
                    title.addClass("ytbsp-title-large");
                    clip.addClass("ytbsp-clip-large");
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
            title.removeClass("ytbsp-title-large");
            clip.removeClass("ytbsp-clip-large");
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

        // Save information elements.
        this.thumbItem = $(".ytbsp-thumb", this.thumbLi);
        this.thumbLargeItem = $(".ytbsp-thumb-large-url", this.thumbLi);
        this.durationItem = $(".ytbsp-clip > ytd-thumbnail-overlay-time-status-renderer > span", this.thumbLi);
        this.clicksItem = $(".ytbsp-views", this.thumbLi);
        this.uploadItem = $(".ytbsp-uploaded", this.thumbLi);
        this.titleItem = $("a.ytbsp-title", this.thumbLi);
        this.updateThumb(inView);
    }

    updateThumb(inView) {
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

        const marker = $(".ytbsp-seemarker", this.thumbLi);
        if (this.seen) {
            marker.html("already seen");
            marker.addClass("seen");
        } else {
            marker.html("mark as seen");
            marker.removeClass("seen");
        }

    }

    getDTO() {
        return {
            "vid": this.vid,
            "seen": this.seen,
            "removed": this.removed
        };
    }
}
