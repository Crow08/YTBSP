import PageService from "./PageService";
import configService from "./ConfigService";

const defaultPlay: (() => Promise<void>) = HTMLMediaElement.prototype.play; // Save default play function before replacing it.
let autoPauseThisVideo: boolean;

const modifiedPlay = function(target): Promise<void> {
  // Need JQuery to be loaded.
  if (!PageService.isDocumentReady) {
    return;
}
  // Prevent the first call to play this video and act normally afterwards.
  if (autoPauseThisVideo) {
    const playerParentRef = target.parentElement.parentElement;
    if (playerParentRef) {
      autoPauseThisVideo = false;
      playerParentRef.pauseVideo();
      console.log(`prevented playback for: ${playerParentRef.getVideoUrl()}`);
    }
    return;
  }
  // Resume default behaviour.
  defaultPlay.call(target);
};

class PlayerService {

  constructor(){
    // Override play Function to prevent player from automatically starting the video after loading video page.
    HTMLMediaElement.prototype.play = function() {
      return modifiedPlay(this);
    };

    this.resetAutoplay()
    PageService.addPageChangeListener(()=>this.resetAutoplay());
  }

  togglePictureInPicturePlayer(){
    const playerParentRef = PageService.getPlayerControls();
    if (playerParentRef && playerParentRef[0] && playerParentRef[0]["player"]) {
      playerParentRef[0]["player"].togglePictureInPicture()
    }
  }

  private resetAutoplay(){
    if ((/.*watch\?.+list=.+/u).test(document.location.pathname)) {
      autoPauseThisVideo = false;
    } else {
      autoPauseThisVideo = configService.getConfig().autoPauseVideo;
    }
  }
}
const playerService = new PlayerService();
export default playerService;