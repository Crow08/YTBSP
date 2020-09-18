import MINIGET from "miniget";
import Subscription from "./Model/Subscription";

export default async (): Promise<Subscription[]> => {
    // download subscriptions rss feed to string
    const downloadedSubscriptionFeed = await MINIGET("https://www.youtube.com/subscription_manager?action_takeout=1").text();

    // parse string as xml
    const parsedSubscriptionFeed = (new DOMParser()).parseFromString(downloadedSubscriptionFeed, "text/xml");
    const list = Array.from(parsedSubscriptionFeed.getElementsByTagName("outline"));

    // the first element is no subscription so remove it
    list.shift();

    // extract subscriptions from xml
    const subscriptions: Subscription[] = [];
    for (const item of list) {
        const sub = new Subscription;
        const xmlUrl = item.getAttribute("xmlUrl");
        sub.channelId = xmlUrl.substring(52, 52 + 24);
        sub.channelName = item.getAttribute("title");
        sub.playlistId = sub.channelId.replace(/^UC/u, "UU");
        sub.channelUrl = new URL("/channel/" + sub.channelId, document.baseURI);
        subscriptions.push(sub);
    }

    return subscriptions;
};
