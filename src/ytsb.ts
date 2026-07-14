// Fetches a video's storyboard (the seek-bar preview mosaics) by parsing
// ytInitialPlayerResponse out of the watch page HTML. The youtubei/v1/player
// endpoint would be the natural source but is gated behind bot attestation
// (PoToken), while the page HTML is served to any authenticated request.
export interface Storyboard {
    urlTemplate: string; // Signed page URL with a "$M" placeholder for the page number.
    frameCount: number;
    rows: number;
    cols: number;
}

const cache = new Map<string, Promise<Storyboard | null>>();

// Resolves to null for videos without a storyboard (e.g. live streams).
export default (videoId: string): Promise<Storyboard | null> => {
    let storyboard = cache.get(videoId);
    if ("undefined" === typeof storyboard) {
        storyboard = fetchStoryboard(videoId).catch((error) => {
            // Do not cache transient failures, allow a retry on the next hover.
            cache.delete(videoId);
            throw error;
        });
        cache.set(videoId, storyboard);
    }
    return storyboard;
};

async function fetchStoryboard(videoId: string): Promise<Storyboard | null> {
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const html = await response.text();
    const match = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});(?:\s*var\s|\s*<\/script>)/su);
    if (!match) {
        return null;
    }
    const spec: string = JSON.parse(match[1])?.["storyboards"]?.["playerStoryboardSpecRenderer"]?.["spec"];
    if (!spec) {
        return null;
    }
    // Spec format: "<baseUrl>|<level 0>|<level 1>|..." with levels of ascending
    // resolution as "width#height#frameCount#rows#cols#intervalMs#name#signature".
    const parts = spec.split("|");
    if (2 > parts.length) {
        return null;
    }
    const level = parts[parts.length - 1].split("#");
    if (8 > level.length) {
        return null;
    }
    const urlTemplate = parts[0]
        .replace("$L", String(parts.length - 2))
        .replace("$N", level[6])
        .concat(`&sigh=${encodeURIComponent(level[7])}`);
    return {
        "urlTemplate": urlTemplate,
        "frameCount": Number(level[2]),
        "rows": Number(level[3]),
        "cols": Number(level[4])
    };
}
