import VideoDTO from "./VideoDTO";

export default class SubscriptionDTO {
    channelId: string;
    videos: VideoDTO[] = [];
}
