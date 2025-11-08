import crypto from "crypto";
import https from "https";
import MINIGET from "miniget";
import Subscription from "./Model/Subscription";

export default async (): Promise<Subscription[]> => {
    const body = getSubPageBody();

    const contentJson = getContentJson(await body)["contents"]["twoColumnBrowseResultsRenderer"]["tabs"][0]["tabRenderer"]["content"]["sectionListRenderer"];
    const cfgJson = getConfigurationJson(await body);

    let allItems = contentJson["contents"][0]["itemSectionRenderer"]["contents"][0]["shelfRenderer"]["content"]["expandedShelfContentsRenderer"]["items"];

    if (contentJson["contents"].length > 1) {
        let continuation = contentJson["contents"][1];
        while (continuation) {
            const continuationToken = continuation["continuationItemRenderer"]["continuationEndpoint"]["continuationCommand"]["token"];
            const clickTrackingParams = continuation["continuationItemRenderer"]["continuationEndpoint"]["clickTrackingParams"];
            const spfBody = getSubContinuationBody(cfgJson, continuationToken, clickTrackingParams);
            const continuationJson = JSON.parse(await spfBody);
            const spfItems = continuationJson["onResponseReceivedActions"][0]["appendContinuationItemsAction"]["continuationItems"][0]["itemSectionRenderer"]["contents"][0]["shelfRenderer"]["content"]["expandedShelfContentsRenderer"]["items"];
            continuation = continuationJson["onResponseReceivedActions"][0]["appendContinuationItemsAction"]["continuationItems"][1];
            allItems = allItems.concat(spfItems);
        }
    }

    return convertToSubscriptions(allItems);
};

function getConfigurationJson(body: string): any {
    let jsonString = "";
    if (body.search("window\\.ytplayer = \\{\\};ytcfg\\.set") !== -1) {
        jsonString = body.substring(body.search("window\\.ytplayer = \\{\\};ytcfg\\.set") + 31);
        jsonString = jsonString.substring(0, jsonString.search("ytcfg\\.set"));
    } else {
        jsonString = body.substring(body.search("window\\.ytplayer=\\{\\};\nytcfg\\.set") + 30);
        jsonString = jsonString.substring(0, jsonString.search("\\;var setMessage=function\\(msg\\)"));
    }

    jsonString = jsonString.trim();
    while (jsonString.length > 0 && jsonString[jsonString.length - 1] !== "}") {
        jsonString = jsonString.substring(0, jsonString.length - 1);
    }
    return JSON.parse(jsonString);
}

function getContentJson(body: string): any {
    let jsonString = "";
    if (body.search("window\\[\"ytInitialData\"\\]") !== -1) {
        jsonString = body.substring(body.search("window\\[\"ytInitialData\"\\]") + 25);
        jsonString = jsonString.substring(0, jsonString.search("window\\[\"ytInitialPlayerResponse\"\\]"));
    } else {
        jsonString = body.substring(body.search("var ytInitialData = ") + 20);
        jsonString = jsonString.substring(0, jsonString.search(";</script>"));
    }

    jsonString = jsonString.trim();
    while (jsonString.length > 0 && jsonString[jsonString.length - 1] !== "}") {
        jsonString = jsonString.substring(0, jsonString.length - 1);
    }
    return JSON.parse(jsonString);
}

async function getSubPageBody(): Promise<string> {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const headers = {
                "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.117 Safari/537.36"
            };
            const options = {headers};
            const httpRequestResult = MINIGET("https://www.youtube.com/feed/channels?disable_polymer=true&hl=en", options).text();
            httpRequestResult.catch(error => {
                console.error(error);
                // probably a capture to solve -> redirect
                location.href = "https://www.youtube.com/feed/channels?disable_polymer=true&hl=en";
            });
            httpRequestResult.then(resolve).catch(reject);
        }, 0);
    });
}

async function getSubContinuationBody(cfgJson: any, continuationToken: string, clickTrackingParams: string): Promise<string> {
    const user = cfgJson["DELEGATED_SESSION_ID"];
    const key = cfgJson["INNERTUBE_API_KEY"];
    const clientName = cfgJson["INNERTUBE_CONTEXT_CLIENT_NAME"];
    const clientVersion = cfgJson["INNERTUBE_CONTEXT_CLIENT_VERSION"];
    const options = {
        headers: getPOSTHeader(cfgJson),
        hostname: "www.youtube.com",
        path: `/youtubei/v1/browse?key=${key as string}`,
        method: "POST"
    };
    const payload = JSON.stringify({
        "context": {
            "client": {
                "clientName": clientName,
                "clientVersion": clientVersion
            },
            "user": {
                "onBehalfOfUser": user
            },
            "clickTracking": {
                "clickTrackingParams": clickTrackingParams
            }
        },
        "continuation": continuationToken,
    });
    const requestPromise = new Promise<string>((resolve, reject) => {
        let responseData = "";
        const req = https.request(options, res => {
            res.on("data", chunk => {
                responseData += chunk;
            });
            res.on("end", () => {
                resolve(responseData);
            });
        });
        req.on("error", error => {
            console.error(error);
            reject(error);
        });
        req.write(payload);
        req.end();
    });
    return await requestPromise;
}

function getPOSTHeader(cfgJson) {
    const time = Date.now();
    const cookiePart = document.cookie.substring(document.cookie.search("__Secure-3PAPISID=") + 18);
    const sessionId = cookiePart.substring(0, cookiePart.search(";"));
    const hash = crypto.createHash("sha1");
    const rawAuth = `${time} ${sessionId} https://www.youtube.com`;
    const hashedAuth = hash.update(rawAuth, "utf8").digest("hex");

    const clientName = cfgJson["INNERTUBE_CONTEXT_CLIENT_NAME"];
    const clientVersion = cfgJson["INNERTUBE_CONTEXT_CLIENT_VERSION"];
    return {
        "authorization": `SAPISIDHASH ${time}_${hashedAuth}`,//"SAPISIDHASH {Timestamp}_{Hash{{Timestamp} {SessionID} {Domain}}}",
        "x-youtube-client-name": clientName,
        "x-youtube-client-version": clientVersion,
        "origin": "https://www.youtube.com"
    };
}

function convertToSubscriptions(items: any[]): Subscription[] {
    const subscriptions: Subscription[] = [];
    items.forEach(item => {
        const channelItem = item["channelRenderer"];
        const sub = new Subscription();
        sub.channelId = channelItem["channelId"];
        sub.channelName = channelItem["title"]["simpleText"];
        sub.playlistId = sub.channelId.replace(/^UC/u, "UU");
        sub.channelUrl = new URL("/channel/" + sub.channelId, document.baseURI);
        sub.iconUrl = channelItem["thumbnail"]["thumbnails"][0]["url"];
        subscriptions.push(sub);
    });
    return subscriptions;
}
