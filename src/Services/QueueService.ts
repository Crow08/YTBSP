class QueueService {
    private startVideoId : string = null;

    public getStartVideoId() : string {
        return this.startVideoId;
    }
    public setStartVideoId(id: string) : void {
        if (this.startVideoId == null){
            this.startVideoId = id;
        }
    }
    public resetStartVideoId() : void {
        this.startVideoId = null;
    }
}

const queueService = new QueueService();
export default queueService;
