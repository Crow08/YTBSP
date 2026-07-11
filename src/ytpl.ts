import Video from "./Model/Video";

export default async (plistID: string, options: { limit: number; hideShorts: boolean }): Promise<Video[]> => {
    const body = getPlaylistPageBody(plistID, options.hideShorts);
    const contentJson = JSON.parse(await body)["contents"]["twoColumnBrowseResultsRenderer"]["tabs"][0]["tabRenderer"]["content"];
    let allItems: any[];
    if ("undefined" !== typeof contentJson["sectionListRenderer"]) {
        const sectionContents = contentJson["sectionListRenderer"]["contents"][0]["itemSectionRenderer"]["contents"];
        if ("undefined" !== typeof sectionContents[0]["playlistVideoListRenderer"]) {
            // Old format: videos wrapped in a playlistVideoListRenderer.
            allItems = sectionContents[0]["playlistVideoListRenderer"]["contents"];
        } else {
            // New format (2025): lockupViewModel items directly in the item section.
            allItems = sectionContents;
        }
    } else {
        // Reject instead of resolving with an empty list: an empty "success"
        // would make pruneStaleVideos wipe the channel's seen/removed flags.
        throw new Error("Unknown Subscription Format!");
    }

    return convertToVideos(allItems);
};

async function getPlaylistPageBody(playlistId: string, hideShorts: boolean): Promise<string> {
    const payload = {
        "context": {
            "client": {
                "clientName": "WEB",
                "clientVersion": "2.20250328.01.00",
                "hl": "en" // Force english texts for date parsing.
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
        if ("undefined" !== typeof item["playlistVideoRenderer"]) {
            videos.push(convertClassicItemToVideo(item["playlistVideoRenderer"]));
        } else if ("undefined" !== typeof item["lockupViewModel"]) {
            const video = convertLockupItemToVideo(item["lockupViewModel"]);
            if (video !== null) {
                videos.push(video);
            }
        } else if ("undefined" !== typeof item["continuationItemRenderer"]) {
            // Pagination token, no video data.
        } else {
            console.error(`unknown Error:\n${JSON.stringify(item)}`);
        }
    });

    return videos;
}

function convertClassicItemToVideo(videoItem): Video {
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
    return vid;
}

function convertLockupItemToVideo(lockupItem): Video | null {
    if ("undefined" === typeof lockupItem["contentId"]) {
        console.error(`unknown lockup format:\n${JSON.stringify(lockupItem)}`);
        return null;
    }
    // Regular videos have a plain thumbnailViewModel, collection entries (e.g. live stations) wrap it in a primaryThumbnail.
    const thumbnailViewModel = lockupItem["contentImage"]?.["thumbnailViewModel"] ??
        lockupItem["contentImage"]?.["collectionThumbnailViewModel"]?.["primaryThumbnail"]?.["thumbnailViewModel"];
    if ("undefined" === typeof thumbnailViewModel) {
        console.error(`unknown lockup format:\n${JSON.stringify(lockupItem)}`);
        return null;
    }
    const vid = new Video(lockupItem["contentId"]);
    vid.title = lockupItem["metadata"]["lockupMetadataViewModel"]["title"]["content"];
    const thumbnails = thumbnailViewModel["image"]["sources"];
    vid.thumb = thumbnails[0]["url"];
    vid.thumbLarge = thumbnails[thumbnails.length - 1]["url"];
    vid.duration = extractDurationFromOverlays(thumbnailViewModel["overlays"]);

    // Try to get upload information from the metadata rows (e.g. "2 days ago").
    const uploadInfo = parseUploadedText(extractMetadataTexts(lockupItem));
    vid.uploaded = uploadInfo.uploaded;
    vid.pubDate = uploadInfo.pubDate;
    return vid;
}

function extractDurationFromOverlays(overlays: any[]): string {
    for (const overlay of overlays ?? []) {
        const badges = overlay["thumbnailBottomOverlayViewModel"]?.["badges"] ?? [];
        for (const badge of badges) {
            const badgeViewModel = badge["thumbnailBadgeViewModel"];
            if ("undefined" === typeof badgeViewModel) {
                continue;
            }
            if (badgeViewModel["badgeStyle"] === "THUMBNAIL_OVERLAY_BADGE_STYLE_LIVE") {
                return "streaming";
            }
            if (badgeViewModel["badgeStyle"] === "THUMBNAIL_OVERLAY_BADGE_STYLE_DEFAULT" && badgeViewModel["text"]) {
                return badgeViewModel["text"];
            }
        }
    }
    return "streaming";
}

function extractMetadataTexts(lockupItem): string[] {
    const metadataRows = lockupItem["metadata"]?.["lockupMetadataViewModel"]?.["metadata"]?.["contentMetadataViewModel"]?.["metadataRows"] ?? [];
    const texts: string[] = [];
    for (const row of metadataRows) {
        for (const part of row["metadataParts"] ?? []) {
            if (part["text"]?.["content"]) {
                texts.push(part["text"]["content"]);
            }
        }
    }
    return texts;
}

function extractUploadInformation(videoItem): { "uploaded": string, "pubDate": Date | null } {
    const videoInfo = videoItem["videoInfo"];
    if (typeof videoInfo !== "undefined" && typeof videoInfo["runs"] !== "undefined") {
        const videoInfoTextRuns = videoInfo["runs"] as { "text": string }[];
        return parseUploadedText(videoInfoTextRuns.map(run => run.text));
    }
    return {"uploaded": "unknown", "pubDate": null};
}

function parseUploadedText(texts: string[]): { "uploaded": string, "pubDate": Date | null } {
    const result: { uploaded: string, pubDate: Date | null } = {"uploaded": "unknown", "pubDate": null};
    const numberRegex = /\d+/g;

    for (const text of texts) {
        let durationAgo: string = null;
        if (text.endsWith(" ago")) {
            durationAgo = text.substring(0, text.length - 4);
        } else if (text.startsWith("vor ")) {
            durationAgo = text.substring(4);
        }
        if (durationAgo) {
            result.uploaded = durationAgo;
            const numberParts = numberRegex.exec(result.uploaded);
            const unit = getTimeUnit(result.uploaded);
            if (!!unit && !!numberParts && numberParts.length !== 0 && !!Number(numberParts[0])) {
                result.pubDate = subtractFromNow(Number(numberParts[0]), unit);
            }
        }
    }
    return result;
}

function getTimeUnit(time: string): string | null {
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

function subtractFromNow(amount: number, unit: string): Date {
    const date = new Date();
    switch (unit) {
      case 'y': // years
        date.setFullYear(date.getFullYear() - amount);
        break;
      case 'M': // months
        date.setMonth(date.getMonth() - amount);
        break;
      case 'w': // weeks
        date.setDate(date.getDate() - amount * 7);
        break;
      case 'd': // days
        date.setDate(date.getDate() - amount);
        break;
      case 'h': // hours
        date.setHours(date.getHours() - amount);
        break;
      case 'm': // minutes
        date.setMinutes(date.getMinutes() - amount);
        break;
      case 's': // seconds
        date.setSeconds(date.getSeconds() - amount);
        break;
      default:
        throw new Error(`Unsupported unit: ${unit}`);
    }

    return date;
}
