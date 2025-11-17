import moment, { unitOfTime } from "moment";
import Video from "./Model/Video";

export default async (plistID: string, options: { limit: number; hideShorts: boolean }): Promise<Video[]> => {
    const body = getPlaylistPageBody(plistID, options.hideShorts);
    let contentJson = JSON.parse(await body)["contents"]["twoColumnBrowseResultsRenderer"]["tabs"][0]["tabRenderer"]["content"];
    let allItems: any[];
    if ("undefined" !== typeof contentJson["sectionListRenderer"]) {
        contentJson = contentJson["sectionListRenderer"];
        allItems = contentJson["contents"][0]["itemSectionRenderer"]["contents"][0]["playlistVideoListRenderer"]["contents"];
    } else {
        console.error("Unknown Subscription Format!");
    }

    return convertToVideos(allItems);
};

async function getPlaylistPageBody(playlistId: string, hideShorts: boolean): Promise<string> {
    const payload = {
        "context": {
            "client": {
                "clientName": "WEB",
                "clientVersion": "2.20250328.01.00"
            }
        },
        "browseId": `VL${playlistId}`,
        "params": hideShorts ? "wgYCEAE%3D" : "" // exclude for shorts / only shorts: "params": "wgYCGAE%3D"
    };
    const response = await fetch("https://www.youtube.com/youtubei/v1/browse", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.text();
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

        if (videoItem["upcomingEventData"] && videoItem["upcomingEventData"]["startTime"]) {
            vid.premiere = new Date(Number(videoItem["upcomingEventData"]["startTime"]) * 1000);
        }
        videos.push(vid);
    });

    return videos;
}

function extractUploadInformation(videoItem): { "uploaded": string, "pubDate": Date | null } {
    const result: { uploaded: string, pubDate: Date | null } = {"uploaded": "unknown", "pubDate": null};
    const numberRegex = /\d+/g;
    const videoInfo = videoItem["videoInfo"];

    if (typeof videoInfo !== "undefined" && typeof videoInfo["runs"] !== "undefined") {
        const videoInfoTextRuns = videoInfo["runs"] as { "text": string }[];
        for (const videoInfoTextRun of videoInfoTextRuns) {
            if (videoInfoTextRun.text.endsWith("ago")) {
                const durationAgo = videoInfoTextRun.text.substring(0, videoInfoTextRun.text.length - 4);
                if (durationAgo) {
                    result.uploaded = durationAgo;
                    const numberParts = numberRegex.exec(result.uploaded);
                    const unit = getTimeUnit(result.uploaded);
                    if (unit && numberParts && numberParts.length !== 0) {
                        result.pubDate = moment().subtract(numberParts[0], unit).toDate();
                    }
                }
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
