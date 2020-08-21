import { Url } from "url";
import Video from "./Video";

export default class Subscription {
  channelName: string;
  channelId: string;
  playlistId: string;
  channelUrl: URL;
  iconUrl: Url;
  videos: Video[] = [];
}