import YTBSPComponent from "./Components/YTBSPComponent";
import Subscription from "./Model/Subscription";
import configService from "./Services/ConfigService";
import dataService from "./Services/DataService";
import markAsSeenService from "./Services/MarkAsSeenService";
import pageService, { PageState } from "./Services/PageService";
import persistenceService from "./Services/PersistenceService";

console.log("script start");
setTimeout( () => {
    pageService.updateNativeStyleRuleModifications(PageState.LOADING);

    const ytbspComponent = new YTBSPComponent();

    const atScriptDataLoaded = () => {
        console.log("script data loaded");
        ytbspComponent.startLoading();
    };
    const atDocumentReady = () =>{
        console.log("document ready");
        pageService.injectYTBSP(ytbspComponent);
        pageService.startPageObserver();
        markAsSeenService.checkPage();

        pageService.updateNativeStyleRuleModifications();
        pageService.addPageChangeListener(() => {
            pageService.updateNativeStyleRuleModifications();
        });
    };

    pageService.addDocumentReadyListener(atDocumentReady);

    persistenceService.loadConfig().then((config) => {
        configService.setConfig(config);
        persistenceService.loadVideoInfo().then((subs) => {
            subs.forEach((subDTO) => {
                const sub = new Subscription();
                sub.updateSubscription(subDTO);
                dataService.upsertSubscription(sub.channelId, () => sub);
            });
            atScriptDataLoaded();
        }).catch(e => console.error(e));
        pageService.addThumbnailEnlargeCss();
    }).catch(e => console.error(e));


}, 0);
