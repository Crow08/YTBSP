window.moment = this.moment;
// Don't run on frames or iFrames
if (window.top !== window.self) {
    // eslint-disable-next-line no-useless-return
    return;
}
