import * as MINIGET from "miniget";
import * as querystring from "querystring";

const test = async () => {
  console.log("START TEST");

  const body = getSubPageBody()

  const contentJson = getContentJson(await body);
  const cfgJson = getConfigurationJson(await body);

  const continuation = contentJson["contents"]["twoColumnBrowseResultsRenderer"]["tabs"][0]["tabRenderer"]["content"]["sectionListRenderer"]["continuations"][0]["nextContinuationData"]["continuation"];
  const clickTrackingParams = contentJson["contents"]["twoColumnBrowseResultsRenderer"]["tabs"][0]["tabRenderer"]["content"]["sectionListRenderer"]["continuations"][0]["nextContinuationData"]["clickTrackingParams"];

  const spfBody = getSPFSubContinuationBody(cfgJson, continuation, clickTrackingParams);

  const spfJson = JSON.parse(await spfBody);

  const initialItems = contentJson["contents"]["twoColumnBrowseResultsRenderer"]["tabs"][0]["tabRenderer"]["content"]["sectionListRenderer"]["contents"][0]["itemSectionRenderer"]["contents"][0]["shelfRenderer"]["content"]["expandedShelfContentsRenderer"]["items"];
  const spfItems = spfJson[1]["response"]["continuationContents"]["sectionListContinuation"]["contents"][0]["itemSectionRenderer"]["contents"][0]["shelfRenderer"]["content"]["expandedShelfContentsRenderer"]["items"];
  const allItems = initialItems.concat(spfItems);

  console.log(allItems);
}

function getConfigurationJson(body: string): any {
  let jsonString = body.substring(body.search("window\\.ytplayer = \\{\\};ytcfg\\.set") + 31);
  jsonString = jsonString.substring(0, jsonString.search("ytcfg\\.set"));
  jsonString = jsonString.trim();
  while(jsonString[jsonString.length - 1] !== '}'){
    jsonString = jsonString.substring(0, jsonString.length - 1);
  }

  return JSON.parse(jsonString);
}

function getContentJson(body: string): any {
  let jsonString = body.substring(body.search("window\\[\"ytInitialData\"\\]") + 25);
  jsonString = jsonString.substring(0, jsonString.search("window\\[\"ytInitialPlayerResponse\"\\]"));
  jsonString = jsonString.trim();
  while(jsonString[jsonString.length - 1] !== '}'){
    jsonString = jsonString.substring(0, jsonString.length - 1);
  }

  return JSON.parse(jsonString);
}

async function getSubPageBody() : Promise<string>{
  const headers = {
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.117 Safari/537.36'
  };
  const options = { headers };
  return await MINIGET("https://www.youtube.com/feed/channels?disable_polymer=true", options).text();
}

async function getSPFSubContinuationBody(cfgJson, continuation: string, clickTrackingParams: string): Promise<string>{
  const headers = getSPFHeader(cfgJson);

  const options = { headers };

  const params = querystring.stringify({
    "ctoken": continuation,
    "continuation": continuation,
    "itct": clickTrackingParams
  });

  return await MINIGET("https://www.youtube.com/browse_ajax?" + params, options).text();
}

function getSPFHeader(cfgJson){
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

export {test}