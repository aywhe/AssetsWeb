// config.js
const fs = require('fs');
const path = require('path');

class ConfigManager {
  constructor(configPath = 'assets_config.json') {
    this.configPath = configPath;
    this.config = this.loadConfig();
  }

  loadConfig() {
    if (fs.existsSync(this.configPath)) {
      try {
        const content = fs.readFileSync(this.configPath, 'utf8');
        return JSON.parse(content);
      } catch (err) {
        console.error('读取配置文件失败:', err);
        return {};
      }
    }
    return {};
  }

  get(key, defaultValue = null) {
    return this.config[key] || defaultValue;
  }

  getPort() {
    return process.env.PORT || this.get('ServerPort') || 3000;
  }

  getFtpPort() {
    const ftpConfig = this.get('FtpConfig', {});
    return process.env.FTP_PORT || ftpConfig.port || 2121;
  }
}

module.exports = new ConfigManager();