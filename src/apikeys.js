const fs = require('fs');
const { randomUUID } = require('crypto');
const { APIKEYS_FILE, KEY_PREFIX } = require('./config');
const logger = require('./logger');

const MASK = (k) => k.substring(0, 8) + '****' + k.slice(-6);

let _cache = null;
let _cacheMtime = 0;

function load() {
  try {
    const stat = fs.statSync(APIKEYS_FILE);
    if (_cache && stat.mtimeMs === _cacheMtime) return _cache;
    _cache = JSON.parse(fs.readFileSync(APIKEYS_FILE, 'utf8'));
    _cacheMtime = stat.mtimeMs;
    return _cache;
  } catch {
    return [];
  }
}

function save(keys) {
  fs.writeFileSync(APIKEYS_FILE, JSON.stringify(keys, null, 2));
  _cache = keys;
  _cacheMtime = fs.statSync(APIKEYS_FILE).mtimeMs;
}

function createKey(label = 'default') {
  const keys = load();
  const key = {
    id: randomUUID(),
    key: KEY_PREFIX + randomUUID().replace(/-/g, '').substring(0, 32),
    label,
    createdAt: new Date().toISOString(),
    lastUsed: null,
    totalRequests: 0,
  };
  keys.push(key);
  save(keys);
  return key;
}

function listKeys() {
  return load().map(k => ({
    ...k,
    key: MASK(k.key),
    keyFull: k.key,
  }));
}

function deleteKey(id) {
  const keys = load();
  const idx = keys.findIndex(k => k.id === id);
  if (idx === -1) return false;
  keys.splice(idx, 1);
  save(keys);
  return true;
}

function validateKey(rawKey) {
  if (!rawKey) return null;
  const keys = load();
  const found = keys.find(k => k.key === rawKey);
  if (!found) return null;
  found.lastUsed = new Date().toISOString();
  found.totalRequests = (found.totalRequests || 0) + 1;
  save(keys);
  return found;
}

function ensureDefaultKey() {
  const keys = load();
  if (keys.length > 0) return null;
  const k = createKey('default');
  logger.info(`İlk API Key oluşturuldu: ${c.fg.cyan}${k.key}${c.r}`);
  return k;
}

module.exports = { createKey, listKeys, deleteKey, validateKey, ensureDefaultKey, load };