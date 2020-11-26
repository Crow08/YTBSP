/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import MINIGET from "miniget";
import moment, { unitOfTime } from "moment";
import * as querystring from "querystring";
import Video from "./Model/Video";

export default async (plistID: string, options: { limit: number }): Promise<Video[]> => {
    const body = getPlaylistPageBody(plistID);

    const contentJson = getContentJson(await body)["contents"]["twoColumnBrowseResultsRenderer"]["tabs"][0]["tabRenderer"]["content"]["sectionListRenderer"];
    const cfgJson = getConfigurationJson(await body);

    let allItems: any[];
    allItems = contentJson["contents"][0]["itemSectionRenderer"]["contents"][0]["playlistVideoListRenderer"]["contents"];

    const continuations = contentJson["continuations"];
    if (continuations) {
        /*for (const continuationObject of continuations) {
            const continuation = continuationObject["nextContinuationData"]["continuation"];
            const clickTrackingParams = continuationObject["nextContinuationData"]["clickTrackingParams"];
            const spfBody = getSPFSubContinuationBody(cfgJson, continuation, clickTrackingParams);
            const spfJson = JSON.parse(await spfBody);
            const spfItems = spfJson[1]["response"]["continuationContents"]["sectionListContinuation"]["contents"][0]["itemSectionRenderer"]["contents"][0]["shelfRenderer"]["content"]["expandedShelfContentsRenderer"]["items"];
            allItems = allItems.concat(spfItems);
        }*/
    }

    return convertToVideos(allItems);
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

async function getPlaylistPageBody(playlistId: string): Promise<string> {
    const headers = {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.117 Safari/537.36"
    };
    const options = {headers};
    return await MINIGET(`https://www.youtube.com/playlist?list=${playlistId}&disable_polymer=true&hl=en`, options).text();
}

async function getSPFSubContinuationBody(cfgJson, continuation: string, clickTrackingParams: string): Promise<string> {
    const headers = getSPFHeader(cfgJson);
    const options = {headers};
    const params = querystring.stringify({
        "ctoken": continuation,
        "continuation": continuation,
        "itct": clickTrackingParams
    });

    const stream = MINIGET("https://www.youtube.com/browse_ajax?" + params, options);
    // TODO: "redirect" and "error" are both workarounds for the anti bot captcha redirect. you will be redirected but
    //  the redirect fails because of cors problems.
    stream.on("redirect", (url) => {
        console.error("redirect: " + url);
        window.open(url);
    });
    stream.on("error", (err) => {
        console.error(err);
        window.open("https://www.youtube.com/browse_ajax?" + params);
    });
    return await stream.text();
}

function getSPFHeader(cfgJson) {
    const clientName = cfgJson["INNERTUBE_CONTEXT_CLIENT_NAME"];
    const clientVersion = cfgJson["INNERTUBE_CONTEXT_CLIENT_VERSION"];
    const device = cfgJson["DEVICE"];
    const pageCl = cfgJson["PAGE_CL"];
    const pageLabel = cfgJson["PAGE_BUILD_LABEL"];
    const variantsChecksum = cfgJson["VARIANTS_CHECKSUM"];
    const idToken = cfgJson["ID_TOKEN"];
    return {
        "X-SPF-Previous": "https://www.youtube.com/feed/channels",
        "X-SPF-Referer": "https://www.youtube.com/feed/channels",
        "X-YouTube-Time-Zone": "Europe/Berlin",
        "X-YouTube-Utc-Offset": "120",
        "X-YouTube-Ad-Signals": "",
        "X-YouTube-Client-Name": clientName,
        "X-YouTube-Client-Version": clientVersion,
        "X-YouTube-Device": device,
        "X-YouTube-Page-CL": pageCl,
        "X-YouTube-Page-Label": pageLabel,
        "X-YouTube-Variants-Checksum": variantsChecksum,
        "X-Youtube-Identity-Token": idToken
    };
}

function convertToVideos(items: any[]): Video[] {
    const videos: Video[] = [];
    items.forEach(item => {
        const videoItem = item["playlistVideoRenderer"];
        if (typeof videoItem === "undefined") {
            if (typeof item["continuationItemRenderer"] !== "undefined") {
                return;
            } else {
                console.error(`unknown Error:\n${JSON.stringify(item)}`);
                return;
            }
        }
        const vid = new Video(videoItem["videoId"]);
        vid.title = videoItem["title"]["runs"][0]["text"];
        vid.duration = videoItem["lengthText"]["simpleText"];
        vid.thumb = videoItem["thumbnail"]["thumbnails"][0]["url"];
        vid.thumbLarge = videoItem["thumbnail"]["thumbnails"][videoItem["thumbnail"]["thumbnails"].length - 1]["url"];
        // Try to get upload information from accessibility data.
        extractUploadInformation(videoItem, vid);
        videos.push(vid);
    });

    return videos;
}

function extractUploadInformation(videoItem, vid: Video) {
    const author = videoItem["shortBylineText"]["runs"][0]["text"];
    const accessibilityData = (videoItem["title"]["accessibility"]["accessibilityData"]["label"] as string)
        .substring(vid.title.length)
        .replace(author, "");
    const uploadedRegex = /(([0-9]+ (year(s)?|month(s)?|week(s)?|day(s)?|hour(s)?|minute(s)?|second(s)?))|([0-9]+ (Jahr(en)?|Monat(en)?|Woche(n)?|Tag(e)?|Stunde(n)?|Minute(n)?|Sekunde(n)?)))/g;
    const numberRegex = /\d+/g;
    if (typeof accessibilityData !== "undefined") {
        const accessibilityParts = uploadedRegex.exec(accessibilityData);
        if (accessibilityParts && accessibilityParts.length !== 0) {
            vid.uploaded = accessibilityParts[0];
            const numberParts = numberRegex.exec(vid.uploaded);
            const unit = getTimeUnit(vid.uploaded);
            if (unit && numberParts && numberParts.length !== 0) {
                vid.pubDate = moment().subtract(numberParts[0],).toDate();
            }
        }
    }
}

function getTimeUnit(time: string): unitOfTime.DurationConstructor {
    if (time.includes("year") || time.includes("Jahr")) {
        return "y";
    } else if (time.includes("month") || time.includes("Monat")) {
        return "M";
    } else if (time.includes("week") || time.includes("Woche")) {
        return "w";
    } else if (time.includes("day") || time.includes("Tag")) {
        return "d";
    } else if (time.includes("hour") || time.includes("Stunde")) {
        return "h";
    } else if (time.includes("minute") || time.includes("Minute")) {
        return "m";
    } else if (time.includes("second") || time.includes("Sekunde")) {
        return "s";
    }
    return null;
}
