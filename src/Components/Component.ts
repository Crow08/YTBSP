import configService from "../Services/ConfigService";

export default class Component {
    component: JQuery;

    constructor(component: JQuery) {
        this.component = component;
    }

    isInView(): boolean {
        let screenTop = 0;
        if(!!document.body?.scrollTop) {
            screenTop = document.body.scrollTop;
        } else if(!!document.documentElement?.scrollTop) {
            screenTop = document.documentElement.scrollTop;
        }
        const offsetTop = this.component.offset().top;
        const screenBottom = screenTop + window.innerHeight;
        const threshold = configService.getConfig().screenThreshold;

        return ((offsetTop - threshold) < screenBottom) && ((offsetTop + threshold) > screenTop);
    }
}
