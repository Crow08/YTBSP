import YTBSPComponent from "./Components/YTBSPComponent";
import Subscription from "./Model/Subscription";
import ConfigService from "./Services/ConfigService";
import DataService from "./Services/DataService";
import MarkAsSeenService from "./Services/MarkAsSeenService";
import PageService, { PageState } from "./Services/PageService";
import PersistenceService from "./Services/PersistenceService";

console.log("script start");

PageService.updateNativeStyleRuleModifications(PageState.LOADING);
const ytbspComponent = new YTBSPComponent();

PersistenceService.loadConfig(false).then((config) => {
    ConfigService.setConfig(config);
    if (config.useRemoteData) {
        PersistenceService.loadConfig(true).then((remoteConfig) => {
            ConfigService.setConfig(remoteConfig);
        });
    }
    PersistenceService.loadVideoInfo(config.useRemoteData).then((subs) => {
        subs.forEach((subDTO) => {
            const sub = new Subscription();
            sub.updateSubscription(subDTO);
            DataService.upsertSubscription(sub.channelId, () => sub);
        });
        atScriptDataLoaded();
    });
});

PageService.addDocumentReadyListener(() => {
    console.log("document ready");
    PageService.injectYTBSP(ytbspComponent);
    PageService.startPageObserver();
    MarkAsSeenService.checkPage();

    PageService.updateNativeStyleRuleModifications();
    PageService.addPageChangeListener(() => {
        PageService.updateNativeStyleRuleModifications();
    });
});

const atScriptDataLoaded = () => {
    console.log("script data loaded");
    ytbspComponent.startLoading();
};
