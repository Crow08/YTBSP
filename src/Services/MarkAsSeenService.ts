import configService from "./ConfigService";
import dataService from "./DataService";
import pageService from "./PageService";
import Timeout = NodeJS.Timeout;

class MarkAsSeenService {
    markAsSeenTimeout: Timeout = null;

    constructor() {
        pageService.addPageChangeListener(() => this.checkPage());
    }

    checkPage() {
        clearTimeout(this.markAsSeenTimeout);
        if ((/^\/?watch$/u).test(location.pathname)) {
            this.startMarkAsSeenTimeout();
        }
    }

    // Mark as removed after at least X seconds of watching.
    private startMarkAsSeenTimeout(): void {
        this.markAsSeenTimeout = setTimeout(() => {
            const videoId = /v=([^&]{11})/u.exec(location.href)[1];
            if (videoId) {
                dataService.upsertVideo(videoId, (video) => {
                    if ("undefined" !== typeof video) {
                        video.updateVideo({removed: true});
                    }
                    return video;
                }, false, pageService.getChannelId());
            }
        }, configService.getConfig().timeToMarkAsSeen * 1000);
    }
}

const markAsSeenService = new MarkAsSeenService();
export default markAsSeenService;
