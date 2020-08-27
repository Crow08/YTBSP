import ConfigService from "./ConfigService";
import DataService from "./DataService";
import PageService from "./PageService";
import Timeout = NodeJS.Timeout;

class MarkAsSeenService {
    markAsSeenTimeout: Timeout = null;

    constructor() {
        PageService.addPageChangeListener(() => this.checkPage());
    }

    checkPage() {
        clearTimeout(this.markAsSeenTimeout);
        if ((/^\/?watch$/u).test(location.pathname)) {
            this.startMarkAsSeenTimeout();
        }
    }

    // Mark as seen after at least X seconds.
    private startMarkAsSeenTimeout(): void {
        this.markAsSeenTimeout = setTimeout(() => {
            const videoId = location.href.match(/v=([^&]{11})/u)[1];
            if (videoId) {
                DataService.upsertVideo(videoId, (video) => {
                    if ("undefined" !== typeof video) {
                        video.updateVideo({seen: true});
                    }
                    return video;
                }, PageService.getChannelId());
            }
        }, ConfigService.getConfig().timeToMarkAsSeen * 1000);
    }
}

const markAsSeenService = new MarkAsSeenService();
export default markAsSeenService;
