/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import https from "https";
import moment, { unitOfTime } from "moment";
import Video from "./Model/Video";

export default async (plistID: string, options: { limit: number; hideShorts: boolean }): Promise<Video[]> => {
    const body = getPlaylistPageBody(plistID, options.hideShorts);
    let contentJson = JSON.parse(await body)["contents"]["twoColumnBrowseResultsRenderer"]["tabs"][0]["tabRenderer"]["content"];
    let allItems: any[];
    if("undefined" !== typeof contentJson["sectionListRenderer"]) {
        contentJson = contentJson["sectionListRenderer"];
        allItems = contentJson["contents"][0]["itemSectionRenderer"]["contents"][0]["playlistVideoListRenderer"]["contents"];
    } else {
        console.error("Unknown Subscription Format!");
    }

    return convertToVideos(allItems);
};


async function getPlaylistPageBody(playlistId: string, hideShorts: boolean): Promise<string> {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const options = {
                hostname: "www.youtube.com",
                path: "/youtubei/v1/browse",
                method: "POST"
            };
            const payload = JSON.stringify({
                "context": {
                    "client": {
                        "clientName": "WEB",
                        "clientVersion": "2.20250328.01.00"
                    }
                },
                "browseId": `VL${playlistId}`,
                "params": hideShorts ? "wgYCEAE%3D" : "" // exclude for shorts / only shorts: "params": "wgYCGAE%3D"
            });
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
        },0);
    });
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
        vid.duration = videoItem["lengthText"] ? videoItem["lengthText"]["simpleText"] : "streaming";
        vid.thumb = videoItem["thumbnail"]["thumbnails"][0]["url"];
        vid.thumbLarge = videoItem["thumbnail"]["thumbnails"][videoItem["thumbnail"]["thumbnails"].length - 1]["url"];
        // Try to get upload information from accessibility data.
        const uploadInfo = extractUploadInformation(videoItem);
        vid.uploaded = uploadInfo.uploaded;
        vid.pubDate = uploadInfo.pubDate;

        if(videoItem["upcomingEventData"] && videoItem["upcomingEventData"]["startTime"]) {
            vid.premiere = new Date(Number(videoItem["upcomingEventData"]["startTime"]) * 1000);
        }
        videos.push(vid);
    });

    return videos;
}

function extractUploadInformation(videoItem): {"uploaded": string, "pubDate": Date} {
    const result = {"uploaded": "unknown", "pubDate": null};
    const author = videoItem["shortBylineText"]["runs"][0]["text"];
    const accessibilityData = (videoItem["title"]["accessibility"]["accessibilityData"]["label"] as string)
        .substring(videoItem["title"]["runs"][0]["text"].length)
        .replace(author, "");
    const uploadedRegex = /(([0-9]+ (year(s)?|month(s)?|week(s)?|day(s)?|hour(s)?|minute(s)?|second(s)?))|([0-9]+ (Jahr(en)?|Monat(en)?|Woche(n)?|Tag(e)?|Stunde(n)?|Minute(n)?|Sekunde(n)?)))/g;
    const numberRegex = /\d+/g;
    if (typeof accessibilityData !== "undefined") {
        const accessibilityParts = uploadedRegex.exec(accessibilityData);
        if (accessibilityParts && accessibilityParts.length !== 0) {
            result.uploaded = accessibilityParts[0];
            const numberParts = numberRegex.exec(result.uploaded);
            const unit = getTimeUnit(result.uploaded);
            if (unit && numberParts && numberParts.length !== 0) {
                result.pubDate = moment().subtract(numberParts[0], unit).toDate();
            }
        }
    }
    return result;
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
