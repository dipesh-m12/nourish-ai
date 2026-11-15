const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

/**
 * Release builds shrink resources, and notification sounds are only named at runtime
 * ("nourish_chime"), so the shrinker deletes them and Android plays its default sound.
 * A keep file in res/raw tells it to leave them in.
 */
module.exports = function withKeepSounds(config, { sounds = [] } = {}) {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const dir = path.join(cfg.modRequest.platformProjectRoot, 'app/src/main/res/raw');
      fs.mkdirSync(dir, { recursive: true });
      const keep = sounds.map((s) => `@raw/${s}`).join(',');
      fs.writeFileSync(
        path.join(dir, 'keep_sounds.xml'),
        `<?xml version="1.0" encoding="utf-8"?>\n<resources xmlns:tools="http://schemas.android.com/tools" tools:keep="${keep}" />\n`,
      );
      return cfg;
    },
  ]);
};
