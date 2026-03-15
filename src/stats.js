const fs   = require('fs');
const path = require('path');
const { randomBytes } = require('crypto');
const logger = require('./logger');
const { STATS_FILE } = require('./config');

const MAX_RECORDS = 10_000;

let _writeTimer = null;
let _pending = null;

function load() {
  try {
    if (fs.existsSync(STATS_FILE)) {
      const content = fs.readFileSync(STATS_FILE, 'utf8').trim();
      if (!content) return { requests: [], messages: 0, errors: 0 };
      return JSON.parse(content);
    }
  } catch {}
  return { requests: [], messages: 0, errors: 0 };
}

function scheduleSave(data) {
  _pending = data;
  if (_writeTimer) return;
  _writeTimer = setTimeout(() => {
    fs.writeFile(STATS_FILE, JSON.stringify(_pending, null, 2), (err) => {
      if (err) {
        logger.error('[Stats] Save failed:', err);
      } else {
        logger.success('[Stats] Successfully saved to disk');
      }
      _writeTimer = null;
      _pending = null;
    });
  }, 500);
}

function record({ apiKeyId, apiKeyLabel, endpoint, method, responseTime, status, error = null }) {
  const data = load();
  if (!Array.isArray(data.requests)) data.requests = [];

  data.requests.push({
    id: randomBytes(6).toString('hex'),
    timestamp: new Date().toISOString(),
    apiKeyId:    apiKeyId    || 'anonymous',
    apiKeyLabel: apiKeyLabel || 'anonymous',
    endpoint,
    method,
    responseTime,
    status,
    error,
  });

  data.messages = (data.messages || 0) + (endpoint?.includes('/chat') ? 1 : 0);
  data.errors   = (data.errors   || 0) + (status >= 400 ? 1 : 0);

  if (data.requests.length > MAX_RECORDS)
    data.requests = data.requests.slice(-MAX_RECORDS);

  scheduleSave(data);
}

function getSummary() {
  const data  = load();
  const reqs  = data.requests || [];
  const now   = Date.now();

  const EMPTY = {
    total: 0, success: 0, errors: 0, successRate: 100,
    avgResponseTime: 0, minResponseTime: 0, maxResponseTime: 0,
    last24h: 0, last7d: 0, lastHour: 0,
    messages: data.messages || 0,
    hourly: {}, byKey: {}, recent: [], topEndpoints: [], peakHour: null,
  };

  if (!reqs.length) return EMPTY;

  const h1  = now - 3_600_000;
  const h24 = now - 86_400_000;
  const d7  = now - 604_800_000;

  const success = reqs.filter(r => r.status >= 200 && r.status < 400).length;
  const rtArr   = reqs.filter(r => r.responseTime > 0).map(r => r.responseTime);
  const avgRT   = rtArr.length ? Math.round(rtArr.reduce((a, b) => a + b, 0) / rtArr.length) : 0;

  const last24hReqs = reqs.filter(r => new Date(r.timestamp).getTime() > h24);

  const hourly = Object.fromEntries(
    Array.from({ length: 24 }, (_, h) => [
      `${String(h).padStart(2, '0')}:00`,
      { ok: 0, err: 0, total: 0 },
    ])
  );

  for (const r of last24hReqs) {
    const label = `${String(new Date(r.timestamp).getHours()).padStart(2, '0')}:00`;
    hourly[label].total++;
    if (r.status >= 200 && r.status < 400) hourly[label].ok++;
    else hourly[label].err++;
  }

  const peakHour = Object.entries(hourly)
    .filter(([, v]) => v.total > 0)
    .sort(([, a], [, b]) => b.total - a.total)[0]?.[0] ?? null;

  const byKey = {};
  for (const r of reqs) {
    const k = r.apiKeyLabel;
    if (!byKey[k]) byKey[k] = { total: 0, success: 0, errors: 0, rtSum: 0, avgRt: 0 };
    byKey[k].total++;
    if (r.status >= 200 && r.status < 400) byKey[k].success++;
    else byKey[k].errors++;
    byKey[k].rtSum += r.responseTime || 0;
  }
  for (const v of Object.values(byKey)) {
    v.avgRt = v.total ? Math.round(v.rtSum / v.total) : 0;
    delete v.rtSum;
  }

  const endpointCount = reqs.reduce((acc, r) => {
    const ep = r.endpoint || 'unknown';
    acc[ep] = (acc[ep] || 0) + 1;
    return acc;
  }, {});

  const topEndpoints = Object.entries(endpointCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([endpoint, count]) => ({ endpoint, count }));

  return {
    total:           reqs.length,
    success,
    errors:          reqs.length - success,
    successRate:     Math.round((success / reqs.length) * 100),
    avgResponseTime: avgRT,
    minResponseTime: rtArr.length ? Math.min(...rtArr) : 0,
    maxResponseTime: rtArr.length ? Math.max(...rtArr) : 0,
    last24h:         last24hReqs.length,
    last7d:          reqs.filter(r => new Date(r.timestamp).getTime() > d7).length,
    lastHour:        reqs.filter(r => new Date(r.timestamp).getTime() > h1).length,
    messages:        data.messages || 0,
    hourly,
    byKey,
    peakHour,
    topEndpoints,
    recent:          reqs.slice(-20).reverse(),
  };
}

module.exports = { record, getSummary };