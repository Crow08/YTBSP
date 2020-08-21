import PageService, { PageState } from "./Services/PageService";
import YTBSPComponent from "./Components/YTBSPComponent";

console.log("script start");
const ytbspComponent = new YTBSPComponent();

PageService.updateNativeStyleRuleModifications(PageState.LOADING);

PageService.addDocumentReadyListener(() => {
  console.log("document ready");
  PageService.injectYTBSP(ytbspComponent);
  PageService.startPageObserver();

  PageService.updateNativeStyleRuleModifications();
  PageService.addPageChangeListener(() => {
    PageService.updateNativeStyleRuleModifications();
  });
})