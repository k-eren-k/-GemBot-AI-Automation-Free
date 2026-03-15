const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

module.exports = {
  PORT: parseInt(process.env.PORT, 10) || 3000,
  DATA_DIR,
  APIKEYS_FILE:       path.join(DATA_DIR, 'apikeys.json'),
  STATS_FILE:         path.join(DATA_DIR, 'stats.json'),
  ACTIVITIES_FILE:    path.join(DATA_DIR, 'activities.json'),
  SELECTORS_FILE:     path.join(DATA_DIR, 'selectors.json'),
  SYSTEM_PROMPT_FILE: path.join(DATA_DIR, 'system-prompt.md'),
  CHROME_PROFILE_DIR: (function() {
    if (process.env.CHROME_PROFILE_DIR && process.env.CHROME_PROFILE_DIR !== 'AUTO') {
      return process.env.CHROME_PROFILE_DIR;
    }
    // Windows Otomatik Tespit
    if (process.platform === 'win32') {
      return path.join(
        process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local'),
        'Google', 'Chrome', 'User Data', 'Default'
      );
    }
    // macOS Falback
    if (process.platform === 'darwin') {
      return path.join(process.env.HOME || '', 'Library', 'Application Support', 'Google', 'Chrome', 'Default');
    }
    // Linux Falback
    return path.join(process.env.HOME || '', '.config', 'google-chrome', 'Default');
  })(),
  KEY_PREFIX: 'gmb_',
  RATE_LIMIT: {
    windowMs: 60_000,
    max: 60,
  },
  APP_NAME: 'Gemini Bot API',
  VERSION: '2.0.0',
};