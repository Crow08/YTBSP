import configService from "../Services/ConfigService";

export default class Component {
    component: JQuery;

    constructor(component: JQuery) {
        this.component = component;
    }

    isInView(): boolean {
        const offsetTop = this.component.offset().top;
        const screenTop = document.body.scrollTop || document.documentElement.scrollTop;
        const screenBottom = screenTop + window.innerHeight;
        const threshold = configService.getConfig().screenThreshold;

        return ((offsetTop - threshold) < screenBottom) && ((offsetTop + threshold) > screenTop);
    }
}
