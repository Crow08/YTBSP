  import Configuration from "../Model/Configuration"

  class ConfigService {
    private configuration: Configuration;
    private onChangeCallbackList: ((config: Configuration) => void)[] = [];

    constructor(){
      this.configuration = new Configuration();
    }

    getConfig(): Configuration {
      return this.configuration;
    }

    setConfig(newConfiguration: Configuration){
      this.configuration = newConfiguration;
      this.onChangeCallbackList.forEach(callback => {
        callback(this.configuration);
      });
    }

    addChangeListener(callback: (config: Configuration) => void): void {
      this.onChangeCallbackList.push(callback);
    }

    updateConfig(info :any) {
      this.configuration.updateConfiguration(info);
      this.onChangeCallbackList.forEach(callback => {
        callback(this.configuration);
      });
    }
};

const configService = new ConfigService();
export default configService;