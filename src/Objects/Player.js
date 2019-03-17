/* global $, YT_PLAYER_CONTROL, YT_PLAYER, YT_VIDEO_STREAM, config, toggleYTBSP */

class Player {

    constructor() {
        this.playerRef = null;
        this.nativePlayerParent = null;
        this.nativePlayerCss = null;
        this.nativePlayerIsTheater = false;
        this.peekPlayerActive = false;
    }


    // Show Peek Player:
    // Small video preview in the bottom right corner as an overlay over another page.
    showPeekPlayer() {
        this.playerRef = $(YT_PLAYER);
        // If player cannot be found or peekPlayerSize is 0 (disabled) don't show peek player.
        if (!this.playerRef.length || 0.0 >= config.peekPlayerSizeFactor) {
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
            "width": `${320 * config.peekPlayerSizeFactor}px`,
            "height": `${180 * config.peekPlayerSizeFactor}px`,
            "zIndex": "10"
        });

        // Add overlay to the peek player that will control click behaviour
        this.playerRef.append($("<div/>", {"id": "ytbsp-peekplayer-overlay", "css": {"width": (320 * config.peekPlayerSizeFactor),"height": (180 * config.peekPlayerSizeFactor)}})
            .append($("<div/>", {"id": "ytbsp-peekplayer-overlay-player-control", "css": {"width": ((320 * config.peekPlayerSizeFactor) / 10),"height": ((320 * config.peekPlayerSizeFactor) / 10)}})
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
    }

    // Returns from peek player to native player.
    showNativePlayer() {
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
    }

    // Returns whether player is in peek mode.
    isPeekPlayerActive() {
        return this.peekPlayerActive;
    }
}
