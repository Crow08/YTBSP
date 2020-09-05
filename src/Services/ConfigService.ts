import Configuration from "../Model/Configuration";
import persistenceService from "./PersistenceService";

class ConfigService {
    private configuration: Configuration;
    private onChangeCallbackList: ((config: Configuration) => void)[] = [];

    constructor() {
        this.configuration = new Configuration();
    }

    getConfig(): Configuration {
        return this.configuration;
    }

    setConfig(newConfiguration: Configuration) {
        if (!newConfiguration.equals(this.configuration)) {
            this.configuration = newConfiguration;
            this.onConfigUpdated();

        }
    }

    addChangeListener(callback: (config: Configuration) => void): void {
        this.onChangeCallbackList.push(callback);
    }

    updateConfig(info: any): void {
        const oldConfig = Object.assign({}, this.configuration);
        this.configuration.updateConfiguration(info);
        if (!this.configuration.equals(oldConfig)) {
            this.onConfigUpdated();
        }
    }

    private onConfigUpdated() {
        this.onChangeCallbackList.forEach(callback => {
            callback(this.configuration);
        });
        persistenceService.saveConfing(this.configuration, this.configuration.useRemoteData)
            .catch((error) => console.error(error));
    }
}

const configService = new ConfigService();
export default configService;
