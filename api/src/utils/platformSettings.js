const db = require('../db/pool');

// Cache settings in memory for 5 minutes to avoid DB hit on every request
let _cache = {};
let _cacheExpiry = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getSettings() {
  if (Date.now() < _cacheExpiry && Object.keys(_cache).length > 0) {
    return _cache;
  }
  try {
    const [rows] = await db.execute('SELECT key, value FROM platform_settings');
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    _cache = settings;
    _cacheExpiry = Date.now() + CACHE_TTL;
    return settings;
  } catch (err) {
    console.error('[SETTINGS] Failed to load platform settings:', err.message);
    return _cache; // Return stale cache on error
  }
}

async function getSetting(key, defaultValue = null) {
  const settings = await getSettings();
  return settings[key] !== undefined ? settings[key] : defaultValue;
}

async function getNumericSetting(key, defaultValue = 0) {
  const val = await getSetting(key, String(defaultValue));
  return parseFloat(val) || defaultValue;
}

// Invalidate cache when settings are updated
function invalidateCache() {
  _cache = {};
  _cacheExpiry = 0;
}

module.exports = { getSettings, getSetting, getNumericSetting, invalidateCache };
