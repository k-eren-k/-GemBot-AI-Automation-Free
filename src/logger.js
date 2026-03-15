'use strict';

// ── ANSI ─────────────────────────────────────────────────────────────
const c = {
  r: '\x1b[0m', b: '\x1b[1m', d: '\x1b[2m', i: '\x1b[3m', u: '\x1b[4m', bk: '\x1b[5m',
  fg: {
    black: '\x1b[30m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
    blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m', white: '\x1b[37m',
    gray: '\x1b[90m', bred: '\x1b[91m', bgreen: '\x1b[92m', byellow: '\x1b[93m',
    bblue: '\x1b[94m', bmagenta: '\x1b[95m', bcyan: '\x1b[96m', bwhite: '\x1b[97m',
  },
  bg: {
    black: '\x1b[40m', red: '\x1b[41m', green: '\x1b[42m', yellow: '\x1b[43m',
    blue: '\x1b[44m', magenta: '\x1b[45m', cyan: '\x1b[46m', white: '\x1b[47m',
    gray: '\x1b[100m', bred: '\x1b[101m', bgreen: '\x1b[102m', byellow: '\x1b[103m',
    bblue: '\x1b[104m', bmagenta: '\x1b[105m', bcyan: '\x1b[106m', bwhite: '\x1b[107m',
  },
};

// CI / pipe ortamında renkleri kapat
if (!process.stdout.isTTY || process.env.NO_COLOR) {
  const noop = '';
  const wipe = (obj) => { for (const k of Object.keys(obj)) obj[k] = noop; };
  wipe(c.fg); wipe(c.bg);
  ['r','b','d','i','u','bk'].forEach(k => { c[k] = noop; });
}

// ── YAPILANDIRMA ─────────────────────────────────────────────────────
const _cfg = {
  silent:          false,
  showTimestamp:   true,
  showLevel:       true,
  maxJsonDepth:    6,
  truncateStrings: 200,
  truncateArrays:  15,
  sampleRate:      1.0,
  redactKeys:      ['password','token','secret','key','apiKey','api_key',
                    'auth','credential','private','credit_card','ssn','cvv'],
};

// ── DAHİLİ SAYAÇLAR ──────────────────────────────────────────────────
const _st = {
  requests: 0, errors: 0, warns: 0, infos: 0, debugs: 0,
  startTime: Date.now(),
  methodCounts: {}, statusCounts: {},
  responseTimes: [],
  dbQueries: { total: 0, slow: 0, cacheHits: 0, avgTime: 0 },
  wsConnections: { active: 0, total: 0, messages: 0 },
  queueStats: {}, eventsEmitted: 0, browserActions: 0,
  customCounters: new Map(),
  logHistory: [], maxHistory: 500,
};

// ── ABONE SİSTEMİ ─────────────────────────────────────────────────────
const _subs = new Set();
const _activeTasks = new Map();
const _spinners = new Map();
let _reqId = 0;

// ── YARDIMCI ─────────────────────────────────────────────────────────
const stripAnsi = (s) => String(s).replace(/\x1b\[[0-9;]*m/g, '');
const vLen      = (s) => stripAnsi(s).length;

// Görsel genişliğe göre sağa/sola pad (ANSI kodları sayılmaz)
function ansiPad(str, len, align = 'left') {
  const sp = ' '.repeat(Math.max(0, len - vLen(str)));
  return align === 'right' ? sp + str : str + sp;
}

function ts() {
  const n = new Date(), p = (x) => String(x).padStart(2, '0');
  return `${c.fg.gray}${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}${c.d}.${String(n.getMilliseconds()).padStart(3,'0')}${c.r}`;
}

function fmtUptime() {
  const s = Math.floor((Date.now() - _st.startTime) / 1000);
  if (s < 60)   return `${s}s`;
  if (s < 3600) return `${Math.floor(s/60)}m ${s%60}s`;
  return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m`;
}

function fmtBytes(b) {
  if (!b || b === 0) return '0 B';
  const k = 1024, units = ['B','KB','MB','GB','TB'];
  const i = Math.floor(Math.log(Math.abs(b)) / Math.log(k));
  return (b / Math.pow(k, i)).toFixed(2) + ' ' + units[i];
}

function fmtMs(ms) {
  if (ms < 1000)  return `${ms}ms`;
  if (ms < 60000) return `${(ms/1000).toFixed(1)}s`;
  return `${Math.floor(ms/60000)}m ${((ms%60000)/1000).toFixed(0)}s`;
}

function avg(arr) {
  return arr.length ? Math.round(arr.reduce((a,b)=>a+b,0) / arr.length) : 0;
}

function pct(arr, p) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a,b)=>a-b);
  return s[Math.min(Math.floor(s.length * p), s.length - 1)];
}

function truncate(s, len = _cfg.truncateStrings) {
  s = String(s);
  return s.length > len ? s.slice(0, len) + `${c.fg.gray}…(${s.length})${c.r}` : s;
}

function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
}

// Hassas alan maskeleme (dairesel ref + derinlik korumalı)
function redact(obj, depth = 0, seen = new WeakSet()) {
  if (depth > 5 || obj === null || typeof obj !== 'object') return obj;
  if (seen.has(obj)) return '[Circular]';
  seen.add(obj);
  const r = Array.isArray(obj) ? [...obj] : { ...obj };
  for (const k of Object.keys(r)) {
    if (_cfg.redactKeys.some(rx => k.toLowerCase().includes(rx))) {
      const v = String(r[k]);
      r[k] = v.length > 8 ? v.slice(0,3) + '***' + v.slice(-3) : '***';
    } else if (r[k] && typeof r[k] === 'object') {
      r[k] = redact(r[k], depth + 1, seen);
    }
  }
  return r;
}

// ── SÜRE / BELLEK RENK ───────────────────────────────────────────────
function durColor(ms) {
  if (ms > 10000) return c.fg.bred;
  if (ms > 5000)  return c.fg.red;
  if (ms > 2000)  return c.fg.yellow;
  if (ms > 800)   return c.fg.byellow;
  return c.fg.bgreen;
}

function durBar(ms, width = 12) {
  const filled = Math.min(Math.max(Math.ceil((ms / 10000) * width), 0), width);
  return durColor(ms) + '█'.repeat(filled) + c.fg.gray + '░'.repeat(width - filled) + c.r;
}

function memBar(used, total, width = 20) {
  const p = total > 0 ? used / total : 0;
  const filled = Math.round(p * width);
  const col = p > 0.9 ? c.fg.bred : p > 0.7 ? c.fg.byellow : c.fg.bgreen;
  return col + '█'.repeat(filled) + c.fg.gray + '░'.repeat(width - filled) + c.r;
}

function statusBadge(code) {
  const n = Number(code);
  if (n >= 500) return `${c.bg.bred}${c.fg.bwhite}${c.b} ${n} ${c.r}`;
  if (n >= 400) return `${c.bg.byellow}${c.fg.black}${c.b} ${n} ${c.r}`;
  if (n >= 300) return `${c.bg.cyan}${c.fg.black}${c.b} ${n} ${c.r}`;
  if (n >= 200) return `${c.bg.bgreen}${c.fg.black}${c.b} ${n} ${c.r}`;
  return `${c.bg.gray}${c.fg.bwhite}${c.b} ${n} ${c.r}`;
}

// ── prettyJson — dairesel ref + derinlik + boyut korumalı ─────────────
function prettyJson(obj, indent = 0, depth = 0, seen = new WeakSet()) {
  if (depth > _cfg.maxJsonDepth) return `${c.fg.gray}…${c.r}`;
  const sp = '  '.repeat(indent), sp2 = '  '.repeat(indent + 1);

  if (Array.isArray(obj)) {
    if (!obj.length) return `${c.fg.gray}[]${c.r}`;
    if (seen.has(obj)) return `${c.fg.gray}[Circular]${c.r}`;
    seen.add(obj);
    const slice = obj.slice(0, _cfg.truncateArrays);
    const items = slice.map(v => `${sp2}${prettyJson(v, indent+1, depth+1, seen)}`).join(`${c.fg.gray},${c.r}\n`);
    const more  = obj.length > _cfg.truncateArrays ? `\n${sp2}${c.fg.gray}… +${obj.length - _cfg.truncateArrays} more${c.r}` : '';
    return `${c.fg.gray}[${c.r}\n${items}${more}\n${sp}${c.fg.gray}]${c.r}`;
  }
  if (obj !== null && typeof obj === 'object') {
    if (seen.has(obj)) return `${c.fg.gray}{Circular}${c.r}`;
    seen.add(obj);
    const keys = Object.keys(obj);
    if (!keys.length) return `${c.fg.gray}{}${c.r}`;
    const shown = keys.slice(0, 30);
    const entries = shown.map(k => `${sp2}${c.fg.cyan}"${k}"${c.r}${c.fg.gray}:${c.r} ${prettyJson(obj[k], indent+1, depth+1, seen)}`).join(`${c.fg.gray},${c.r}\n`);
    const more = keys.length > 30 ? `\n${sp2}${c.fg.gray}… +${keys.length - 30} more keys${c.r}` : '';
    return `${c.fg.gray}{${c.r}\n${entries}${more}\n${sp}${c.fg.gray}}${c.r}`;
  }
  if (typeof obj === 'string')  return `${c.fg.bgreen}"${truncate(obj)}"${c.r}`;
  if (typeof obj === 'number')  return `${c.fg.byellow}${obj}${c.r}`;
  if (typeof obj === 'boolean') return obj ? `${c.fg.bgreen}true${c.r}` : `${c.fg.bred}false${c.r}`;
  if (obj === null)             return `${c.fg.gray}null${c.r}`;
  if (obj === undefined)        return `${c.fg.gray}undefined${c.r}`;
  return `${c.fg.gray}${String(obj)}${c.r}`;
}

// ── LEVEL ETİKETLERİ — eşit görsel genişlikte (8 char) ───────────────
const L = {
  trace:    `${c.bg.white}${c.fg.black}${c.b} TRACE  ${c.r}`,
  debug:    `${c.bg.black}${c.fg.gray}${c.b} DEBUG  ${c.r}`,
  info:     `${c.bg.blue}${c.fg.bwhite}${c.b} INFO   ${c.r}`,
  success:  `${c.bg.bgreen}${c.fg.black}${c.b} OK     ${c.r}`,
  warn:     `${c.bg.byellow}${c.fg.black}${c.b} WARN   ${c.r}`,
  error:    `${c.bg.bred}${c.fg.bwhite}${c.b} ERROR  ${c.r}`,
  fatal:    `${c.bg.bred}${c.fg.bwhite}${c.b}${c.bk} FATAL  ${c.r}`,
  api:      `${c.bg.magenta}${c.fg.bwhite}${c.b} API    ${c.r}`,
  browser:  `${c.bg.bblue}${c.fg.bwhite}${c.b} WEB    ${c.r}`,
  system:   `${c.bg.gray}${c.fg.bwhite}${c.b} SYS    ${c.r}`,
  db:       `${c.bg.cyan}${c.fg.black}${c.b} DB     ${c.r}`,
  event:    `${c.bg.bmagenta}${c.fg.bwhite}${c.b} EVENT  ${c.r}`,
  perf:     `${c.bg.byellow}${c.fg.black}${c.b} PERF   ${c.r}`,
  security: `${c.bg.bred}${c.fg.byellow}${c.b} SEC    ${c.r}`,
  cache:    `${c.bg.bcyan}${c.fg.black}${c.b} CACHE  ${c.r}`,
  queue:    `${c.bg.bmagenta}${c.fg.bwhite}${c.b} QUEUE  ${c.r}`,
  ws:       `${c.bg.green}${c.fg.black}${c.b} WS     ${c.r}`,
  grpc:     `${c.bg.bmagenta}${c.fg.bwhite}${c.b} GRPC   ${c.r}`,
  redis:    `${c.bg.red}${c.fg.bwhite}${c.b} REDIS  ${c.r}`,
  kafka:    `${c.bg.byellow}${c.fg.black}${c.b} KAFKA  ${c.r}`,
};

const METHOD = {
  GET:     `${c.bg.bgreen}${c.fg.black}${c.b}  GET   ${c.r}`,
  POST:    `${c.bg.bblue}${c.fg.bwhite}${c.b}  POST  ${c.r}`,
  PUT:     `${c.bg.byellow}${c.fg.black}${c.b}  PUT   ${c.r}`,
  PATCH:   `${c.bg.bmagenta}${c.fg.bwhite}${c.b} PATCH  ${c.r}`,
  DELETE:  `${c.bg.bred}${c.fg.bwhite}${c.b}  DEL   ${c.r}`,
  OPTIONS: `${c.bg.gray}${c.fg.bwhite}${c.b}  OPT   ${c.r}`,
  HEAD:    `${c.bg.cyan}${c.fg.black}${c.b}  HEAD  ${c.r}`,
};

// ── CORE PRINT ────────────────────────────────────────────────────────
function _notify(level, msg, meta = {}) {
  const entry = {
    id: generateId(), ts: new Date().toISOString(),
    level: stripAnsi(level).trim(), message: stripAnsi(msg), meta,
  };
  _st.logHistory.push(entry);
  if (_st.logHistory.length > _st.maxHistory) _st.logHistory.shift();
  _subs.forEach(cb => { try { cb(entry); } catch {} });
}

function _out(label, msg, ...extras) {
  if (_cfg.silent || Math.random() > _cfg.sampleRate) return;
  const prefix = `${_cfg.showTimestamp ? ts() + ' ' : ''}${_cfg.showLevel ? label + ' ' : ''}`;
  process.stdout.write(`${prefix}${c.fg.bwhite}${msg}${c.r}\n`);
  for (const x of extras) {
    if (x === null || x === undefined) continue;
    typeof x === 'object'
      ? process.stdout.write(prettyJson(x, 1) + '\n')
      : process.stdout.write(`          ${c.fg.gray}${x}${c.r}\n`);
  }
  _notify(label, msg);
}

function _err(label, msg, ...extras) {
  if (_cfg.silent) return;
  process.stderr.write(`${ts()} ${label} ${c.fg.bred}${msg}${c.r}\n`);
  for (const x of extras) {
    if (x === null || x === undefined) continue;
    process.stderr.write(`          ${c.fg.gray}${typeof x === 'object' ? JSON.stringify(x).slice(0,120) : x}${c.r}\n`);
  }
  _notify(label, msg, { error: true });
}

// ── SPINNER ───────────────────────────────────────────────────────────
function createSpinner(text) {
  const frames = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'];
  let i = 0, curText = text;
  const start = Date.now();
  const id = generateId();
  const iv = setInterval(() => {
    process.stdout.write(`\r${ts()} ${L.system} ${c.fg.bcyan}${frames[i]}${c.r} ${curText}${c.fg.gray} ...${c.r}   `);
    i = (i + 1) % frames.length;
  }, 80);
  _spinners.set(id, { iv, start });
  return {
    id,
    update: (t) => { curText = t; },
    stop: (ok = true, final = '') => {
      const sp = _spinners.get(id);
      if (!sp) return;
      clearInterval(sp.iv);
      _spinners.delete(id);
      const dur = Date.now() - sp.start;
      const mark = ok ? `${c.fg.bgreen}✔${c.r}` : `${c.fg.bred}✖${c.r}`;
      process.stdout.write(`\r${ts()} ${L.system} ${mark} ${final || curText} ${c.fg.gray}(${dur}ms)${c.r}   \n`);
      return dur;
    },
  };
}

// ── İLERLEME ÇUBUĞU ──────────────────────────────────────────────────
function createProgressBar(label, total, opts = {}) {
  let current = 0;
  const width = opts.width || 30, start = Date.now();
  const render = () => {
    const p = Math.min(current / Math.max(total, 1), 1);
    const filled = Math.round(p * width);
    const bar = c.fg.bgreen + '█'.repeat(filled) + c.fg.gray + '░'.repeat(width - filled) + c.r;
    const elapsed = Date.now() - start;
    const eta = p > 0 ? fmtMs((elapsed / p) * (1 - p)) : '?';
    process.stdout.write(`\r${ts()} ${L.perf} ${label} ${bar} ${c.fg.bwhite}${(p*100).toFixed(1)}%${c.r} (${current}/${total}) ETA:${c.fg.byellow}${eta}${c.r}   `);
  };
  return {
    increment: (n = 1) => { current += n; render(); },
    set:       (v)     => { current  = v; render(); },
    stop:      (msg = '') => { current = total; render(); process.stdout.write(msg ? ` ${c.fg.bgreen}${msg}${c.r}\n` : '\n'); },
  };
}

// ── TABLO ──────────────────────────────────────────────────────────────
// BUG FIX: colWidths ANSI-aware; boş rows koruması; separator row hizası
function _table(headers, rows, title = '') {
  if (!rows || !rows.length) {
    if (title) process.stdout.write(`\n${c.fg.cyan}  ${title}${c.r}\n`);
    process.stdout.write(`${c.fg.gray}  (boş)${c.r}\n\n`);
    return;
  }
  const cw = headers.map((h, i) =>
    Math.max(vLen(String(h)), ...rows.map(r => vLen(String(r[i] ?? '')))) + 2
  );
  const border = (l, m, r, f) =>
    `${c.fg.gray}${l}${cw.map(w => f.repeat(w)).join(m)}${r}${c.r}`;
  const rowStr = (cells, hl = false) =>
    `${c.fg.gray}│${c.r}` + cells.map((cell, i) => {
      const s = String(cell ?? '');
      const pad = ' '.repeat(Math.max(0, cw[i] - vLen(s) - 1));
      const inner = hl ? `${c.b}${c.fg.bwhite} ${s}${pad}${c.r}` : ` ${s}${pad}`;
      return inner + `${c.fg.gray}│${c.r}`;
    }).join('');

  if (title) process.stdout.write(`\n${c.fg.cyan}  ${title}${c.r}\n`);
  process.stdout.write(border('┌','┬','┐','─') + '\n');
  process.stdout.write(rowStr(headers, true) + '\n');
  process.stdout.write(border('├','┼','┤','─') + '\n');
  rows.forEach(r => process.stdout.write(rowStr(r) + '\n'));
  process.stdout.write(border('└','┴','┘','─') + '\n\n');
}

// ── KUTU ────────────────────────────────────────────────────────────
// BUG FIX: maxW negatif → repeat() patlaması giderildi
function _box(title, lines = [], type = 'info') {
  const colorMap = {
    info: c.fg.bcyan, success: c.fg.bgreen, warn: c.fg.byellow,
    error: c.fg.bred, debug: c.fg.gray, perf: c.fg.byellow,
    security: c.fg.bred, neon: c.fg.bmagenta,
  };
  const bc    = colorMap[type] || c.fg.gray;
  const items = Array.isArray(lines) ? lines : [lines];
  const titleW = vLen(title);
  const contentW = items.length ? Math.max(...items.map(l => vLen(l))) : 0;
  const maxW = Math.max(titleW + 4, contentW + 4, 20);
  const titlePad = Math.max(0, maxW - titleW - 4);

  process.stdout.write(`\n${bc}╔═ ${c.fg.bwhite}${title}${bc} ${'═'.repeat(titlePad)}╗${c.r}\n`);
  items.forEach(l => {
    const pad = ' '.repeat(Math.max(0, maxW - vLen(l) - 2));
    process.stdout.write(`${bc}║${c.r}  ${l}${pad}  ${bc}║${c.r}\n`);
  });
  process.stdout.write(`${bc}╚${'═'.repeat(maxW + 2)}╝${c.r}\n\n`);
}

// ── startTask / endTask ───────────────────────────────────────────────
function startTask(id, label) {
  _activeTasks.set(id, { label, start: Date.now() });
  process.stdout.write(`${ts()} ${L.system} ${c.fg.byellow}⟳${c.r}  ${label}${c.fg.gray} ...${c.r}`);
}

function endTask(id, ok = true, note = '') {
  const task = _activeTasks.get(id);
  _activeTasks.delete(id);
  const dur  = task ? Date.now() - task.start : 0;
  const mark = ok ? `${c.fg.bgreen}✔ TAMAM${c.r}` : `${c.fg.bred}✖ BAŞARISIZ${c.r}`;
  process.stdout.write(` ${mark} ${c.fg.gray}(${dur}ms)${c.r}${note ? ' ' + note : ''}\n`);
  return { duration: dur, success: ok };
}

// ── ANA LOGGER ───────────────────────────────────────────────────────
const logger = {

  // Yapılandırma
  configure(opts) { Object.assign(_cfg, opts); return this; },
  getConfig()     { return { ..._cfg }; },

  // Abone yönetimi — BUG FIX: subscribe artık export edildi
  subscribe(fn)   { _subs.add(fn); return () => _subs.delete(fn); },
  unsubscribe(fn) { _subs.delete(fn); },

  // Temel seviyeler
  trace:   (msg, ...a) => _out(L.trace, `${c.d}${msg}${c.r}`, ...a),
  debug(msg, ...a)     { if (process.env.DEBUG) { _st.debugs++; _out(L.debug, `${c.d}${msg}${c.r}`, ...a); } },
  info(msg, ...a)      { _st.infos++; _out(L.info, msg, ...a); },
  success: (msg, ...a) => _out(L.success, msg, ...a),
  warn(msg, ...a)      { _st.warns++; _out(L.warn, msg, ...a); },
  error(msg, ...a)     { _st.errors++; _err(L.error, msg, ...a); },
  fatal(msg, ...a)     { _st.errors++; _err(L.fatal, `${c.b}${msg}${c.r}`, ...a); process.exit(1); },

  api:      (msg, ...a) => _out(L.api,      msg, ...a),
  browser:  (msg, ...a) => _out(L.browser,  msg, ...a),
  system:   (msg, ...a) => _out(L.system,   msg, ...a),
  db:       (msg, ...a) => _out(L.db,       msg, ...a),
  perf:     (msg, ...a) => _out(L.perf,     msg, ...a),
  security: (msg, ...a) => _out(L.security, msg, ...a),
  cache:    (msg, ...a) => _out(L.cache,    msg, ...a),
  queue:    (msg, ...a) => { _st.eventsEmitted++; _out(L.queue, msg, ...a); },
  ws:       (msg, ...a) => _out(L.ws,       msg, ...a),
  grpc:     (msg, ...a) => _out(L.grpc,     msg, ...a),
  redis:    (msg, ...a) => _out(L.redis,    msg, ...a),
  kafka:    (msg, ...a) => _out(L.kafka,    msg, ...a),
  event(name, data) {
    _st.eventsEmitted++;
    const payload = data === undefined ? '' :
      typeof data === 'object'
        ? ` ${c.fg.gray}${JSON.stringify(data).slice(0, 80)}${c.r}`
        : ` ${c.fg.gray}${data}${c.r}`;
    _out(L.event, `${c.fg.bmagenta}${name}${c.r}${payload}`);
  },

  // HTTP İstek
  request(req) {
    _st.requests++;
    _st.methodCounts[req.method] = (_st.methodCounts[req.method] || 0) + 1;
    req._reqId = ++_reqId;

    const method = METHOD[req.method] || `${c.fg.gray}[${req.method}]${c.r}`;
    // BUG FIX: req.url undefined olunca split patlaması
    const rawUrl  = req.url || req.path || '/';
    const [path, qs] = rawUrl.split('?');
    const qsStr   = qs ? `${c.fg.gray}?${truncate(qs, 60)}${c.r}` : '';
    const ip      = ((req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || '?')
                    .split(',')[0].trim().replace('::ffff:', ''));
    const ua      = req.headers?.['user-agent'] ? truncate(req.headers['user-agent'], 50) : '';

    process.stdout.write(`\n${ts()} ${L.api} ${method} ${c.b}${path}${c.r}${qsStr} ${c.fg.gray}← ${ip} [#${req._reqId}]${c.r}\n`);
    if (ua) process.stdout.write(`${c.fg.gray}         ├  ${c.r}${c.fg.gray}${ua}${c.r}\n`);

    const body = req.body;
    if (body && typeof body === 'object' && Object.keys(body).length) {
      const safe = redact(body);
      const raw  = JSON.stringify(safe);
      const lim  = Math.min((process.stdout.columns || 120) - 20, 100);
      const snip = raw.length > lim ? raw.slice(0, lim) + `${c.fg.gray}…${c.r}` : raw;
      process.stdout.write(`${c.fg.gray}         ├ body   ${c.r}${snip}\n`);
    }

    const auth = req.headers?.['authorization'] || req.headers?.['x-api-key'];
    if (auth) {
      // BUG FIX: kısa key'lerde slice(-4) hatalı sonuç veriyordu
      const masked = auth.length > 12
        ? auth.slice(0, Math.min(8, auth.length)) + '****' + auth.slice(-Math.min(4, auth.length))
        : '****';
      process.stdout.write(`${c.fg.gray}         └ auth   ${c.fg.cyan}${masked}${c.r}\n`);
    }
  },

  // HTTP Yanıt
  response(req, res, duration) {
    // BUG FIX: NaN / negatif süre koruması
    const dur = Number.isFinite(duration) && duration >= 0 ? duration : 0;
    const code = res.statusCode;

    _st.statusCounts[code] = (_st.statusCounts[code] || 0) + 1;
    _st.responseTimes.push(dur);
    if (_st.responseTimes.length > 1000) _st.responseTimes.splice(0, 200);

    const badge  = statusBadge(code);
    const bar    = durBar(dur);
    const dc     = durColor(dur);
    const size   = res.getHeader?.('content-length');
    const sizeStr = size ? ` ${c.fg.gray}(${fmtBytes(parseInt(size))})${c.r}` : '';
    let hint = '';
    if (dur > 8000) hint = ` ${c.fg.bred}⚠ ÇOK YAVAŞ${c.r}`;
    else if (dur > 4000) hint = ` ${c.fg.yellow}⚠ YAVAŞ${c.r}`;
    if (code >= 500) hint += ` ${c.fg.bred}● SUNUCU HATASI${c.r}`;

    process.stdout.write(`${ts()} ${L.api} ${badge} ${bar} ${dc}${dur}ms${c.r}${sizeStr}${hint} ${c.fg.gray}[#${req?._reqId || '?'}]${c.r}\n`);
  },

  // İstisna detay logu
  exception(err, ctx = '') {
    if (!err) return;
    if (typeof err === 'string') { this.error(err); return; }
    _st.errors++;
    const ctxStr = ctx ? `${c.fg.gray}[${ctx}]${c.r} ` : '';
    process.stderr.write(`\n${ts()} ${L.error} ${ctxStr}${c.fg.bred}${c.b}${err.message || String(err)}${c.r}\n`);
    if (err.code)    process.stderr.write(`${c.fg.gray}         ├ code    ${c.fg.yellow}${err.code}${c.r}\n`);
    if (err.status)  process.stderr.write(`${c.fg.gray}         ├ status  ${statusBadge(err.status)}\n`);
    if (err.syscall) process.stderr.write(`${c.fg.gray}         ├ syscall ${c.fg.cyan}${err.syscall}${c.r}\n`);
    if (err.path)    process.stderr.write(`${c.fg.gray}         ├ path    ${c.fg.gray}${err.path}${c.r}\n`);
    if (err.errno)   process.stderr.write(`${c.fg.gray}         ├ errno   ${c.fg.yellow}${err.errno}${c.r}\n`);
    if (err.stack) {
      const frames = err.stack.split('\n').slice(1)
        .filter(l => !l.includes('node_modules') && l.trim().startsWith('at'))
        .slice(0, 6);
      frames.forEach((l, i) => {
        const pre = i < frames.length - 1 ? '├' : '└';
        process.stderr.write(`${c.fg.gray}         ${pre} ${c.d}${l.trim()}${c.r}\n`);
      });
    }
    process.stderr.write('\n');
    _notify(L.error, err.message, { error: true, ctx, code: err.code });
  },

  // JSON güzel print
  json(label, obj, doRedact = true) {
    process.stdout.write(`${ts()} ${L.debug} ${c.fg.cyan}${label}${c.r}\n`);
    process.stdout.write(prettyJson(doRedact ? redact(obj) : obj, 1) + '\n');
  },

  // Tablo / kutu / ayraç
  table:   _table,
  box:     _box,
  divider(label = '', char = '─') {
    const total = 56;
    if (label) {
      const side = Math.max(0, total - vLen(label) - 6);
      process.stdout.write(`${c.fg.gray}${char.repeat(4)} ${c.fg.white}${label}${c.fg.gray} ${char.repeat(side)}${c.r}\n`);
    } else {
      process.stdout.write(`${c.fg.gray}${char.repeat(total)}${c.r}\n`);
    }
  },

  group(label)  { process.stdout.write(`\n${c.fg.bcyan}┌── ${c.fg.bwhite}${label}${c.fg.bcyan} ${'─'.repeat(Math.max(0, 40 - vLen(label)))}${c.r}\n`); },
  groupEnd()    { process.stdout.write(`${c.fg.bcyan}└${'─'.repeat(50)}${c.r}\n\n`); },

  // Görev
  startTask, endTask,
  spinner:     createSpinner,
  progressBar: createProgressBar,

  // Süre ölçümü — BUG FIX: çift end() ignore, bellek delta
  time(label) {
    const start = Date.now();
    const memStart = process.memoryUsage().heapUsed;
    let ended = false;
    return {
      lap(lapLabel) {
        const d = Date.now() - start;
        _out(L.perf, `${label} ${c.fg.gray}[${lapLabel}]${c.r} ${durColor(d)}${d}ms${c.r}`);
        return d;
      },
      end(note = '') {
        if (ended) return 0;
        ended = true;
        const dur = Date.now() - start;
        const memDiff = process.memoryUsage().heapUsed - memStart;
        const dc  = durColor(dur);
        const mem = memDiff !== 0 ? ` ${c.fg.gray}(mem: ${memDiff>0?'+':''}${fmtBytes(memDiff)})${c.r}` : '';
        _out(L.perf, `${c.fg.white}${label}${c.r} ${dc}${dur}ms${c.r}${mem}${note ? ` ${c.fg.gray}— ${note}${c.r}` : ''}`);
        return dur;
      },
    };
  },

  // İlerleme sayacı — BUG FIX: max=0 sıfıra bölme
  counter(label, value, max, unit = '') {
    const p = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    const width = 20, filled = Math.round((p / 100) * width);
    const col = p > 90 ? c.fg.bred : p > 70 ? c.fg.byellow : c.fg.bgreen;
    const bar = col + '█'.repeat(filled) + c.fg.gray + '░'.repeat(width - filled) + c.r;
    _out(L.perf, `${ansiPad(label, 18)} ${bar} ${col}${Math.round(p)}%${c.r} ${c.fg.gray}(${value}/${max}${unit ? ' '+unit : ''})${c.r}`);
  },

  multiCounter(counters) {
    _out(L.perf, `${c.fg.bcyan}Multi Counter${c.r}`);
    counters.forEach(({ label, value, max, unit }) => this.counter(label, value, max, unit));
  },

  // Bellek raporu
  memory(detailed = false) {
    const u = process.memoryUsage();
    const bar = memBar(u.heapUsed, u.heapTotal);
    const p   = u.heapTotal > 0 ? ((u.heapUsed / u.heapTotal) * 100).toFixed(1) : '0.0';
    _out(L.system, `${c.fg.bcyan}Memory${c.r} ${bar} ${c.fg.bwhite}${p}%${c.r} ${c.fg.gray}(${fmtBytes(u.heapUsed)}/${fmtBytes(u.heapTotal)})${c.r}`);
    if (detailed) {
      ['rss','external','arrayBuffers'].forEach(k => {
        if (u[k] !== undefined)
          process.stdout.write(`${c.fg.gray}         ├ ${k.padEnd(12)} ${c.r}${c.fg.bwhite}${fmtBytes(u[k])}${c.r}\n`);
      });
    }
  },

  // DB sorgu logu
  dbQuery(query, duration, opts = {}) {
    _st.dbQueries.total++;
    if (opts.cacheHit) _st.dbQueries.cacheHits++;
    if (duration > 1000) _st.dbQueries.slow++;
    _st.dbQueries.avgTime = (_st.dbQueries.avgTime * (_st.dbQueries.total - 1) + duration) / _st.dbQueries.total;
    const icon = opts.cacheHit ? `${c.fg.bcyan}⚡CACHE${c.r}` : opts.write ? `${c.fg.bred}✎WRITE${c.r}` : `${c.fg.gray}◉READ${c.r}`;
    const rows = opts.rows ? ` ${c.fg.gray}(${opts.rows} rows)${c.r}` : '';
    const hint = duration > 1000 ? ` ${c.fg.bred}⚠ YAVAŞ${c.r}` : '';
    _out(L.db, `${icon} ${c.fg.gray}${truncate(query, 60)}${c.r} ${durColor(duration)}${duration}ms${c.r}${rows}${hint}`);
  },

  cacheEvent(action, key, hit = null, ttl = null) {
    const icon = hit === true ? `${c.fg.bgreen}✓HIT${c.r}` : hit === false ? `${c.fg.bred}✗MISS${c.r}` : `${c.fg.bcyan}○${action}${c.r}`;
    const k    = key.length > 30 ? key.slice(0,12) + '…' + key.slice(-12) : key;
    const ttlS = ttl ? ` ${c.fg.gray}(TTL:${ttl}s)${c.r}` : '';
    _out(L.cache, `${icon} ${c.fg.gray}${k}${c.r}${ttlS}`);
  },

  queueEvent(action, name, count = null, jobId = null) {
    const cs = count  !== null ? ` ${c.fg.gray}(${count} items)${c.r}` : '';
    const js = jobId  ? ` ${c.fg.cyan}[${String(jobId).slice(0,8)}]${c.r}` : '';
    _out(L.queue, `${c.fg.bmagenta}${action}${c.r} ${c.fg.bwhite}${name}${c.r}${js}${cs}`);
    _st.queueStats[name] = (_st.queueStats[name] || 0) + 1;
  },

  wsEvent(action, clientId, data = null, room = null) {
    const rs = room ? ` ${c.fg.gray}[${room}]${c.r}` : '';
    const ds = data  ? ` ${c.fg.gray}${JSON.stringify(data).slice(0,40)}${c.r}` : '';
    _out(L.ws, `${c.fg.bgreen}${action}${c.r} ${c.fg.bwhite}${String(clientId).slice(0,8)}${c.r}${rs}${ds}`);
    _st.wsConnections.messages++;
  },

  // Özel sayaçlar
  customCounter(name, inc = 1) {
    const v = (_st.customCounters.get(name) || 0) + inc;
    _st.customCounters.set(name, v);
    return v;
  },
  getCounter(name)   { return _st.customCounters.get(name) || 0; },
  resetCounter(name) { _st.customCounters.delete(name); },

  // Obje ağacı
  tree(obj, name = 'root', indent = 0) {
    const sp = '  '.repeat(indent), keys = Object.keys(obj);
    process.stdout.write(`${sp}${c.fg.bcyan}📁 ${name}${c.r}\n`);
    keys.forEach((k, i) => {
      const last = i === keys.length - 1, pre = last ? '└──' : '├──';
      const v = obj[k];
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        process.stdout.write(`${sp}${pre} ${c.fg.cyan}${k}/${c.r}\n`);
        this.tree(v, '', indent + 1);
      } else {
        const vs = Array.isArray(v) ? `${c.fg.gray}[${v.length} items]${c.r}` : `${c.fg.byellow}${truncate(String(v), 40)}${c.r}`;
        process.stdout.write(`${sp}${pre} ${c.fg.cyan}${k}${c.r}: ${vs}\n`);
      }
    });
  },

  // İki değeri karşılaştır
  diff(label, oldVal, newVal) {
    _out(L.debug, `${c.fg.cyan}diff: ${label}${c.r}`);
    if (JSON.stringify(oldVal) === JSON.stringify(newVal)) {
      process.stdout.write(`  ${c.fg.gray}(değişiklik yok)${c.r}\n`); return;
    }
    if (typeof oldVal === 'object' && typeof newVal === 'object' && oldVal && newVal) {
      const allKeys = new Set([...Object.keys(oldVal), ...Object.keys(newVal)]);
      allKeys.forEach(k => {
        if (JSON.stringify(oldVal[k]) !== JSON.stringify(newVal[k])) {
          process.stdout.write(`  ${c.fg.cyan}${k}${c.r}:\n`);
          process.stdout.write(`    ${c.fg.bred}- ${JSON.stringify(oldVal[k])}${c.r}\n`);
          process.stdout.write(`    ${c.fg.bgreen}+ ${JSON.stringify(newVal[k])}${c.r}\n`);
        }
      });
    } else {
      process.stdout.write(`  ${c.fg.bred}- ${JSON.stringify(oldVal)}${c.r}\n`);
      process.stdout.write(`  ${c.fg.bgreen}+ ${JSON.stringify(newVal)}${c.r}\n`);
    }
  },

  // Assertion
  assert(condition, message) {
    if (!condition) {
      this.error(`ASSERTION FAILED: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
    if (process.env.DEBUG) this.debug(`ASSERTION OK: ${message}`);
  },

  // Sync profiling
  profile(label, fn) {
    const start = Date.now();
    const memB  = process.memoryUsage().heapUsed;
    try {
      const r   = fn();
      const dur = Date.now() - start;
      const mem = process.memoryUsage().heapUsed - memB;
      _out(L.perf, `${c.fg.bwhite}${label}${c.r} ${durColor(dur)}${dur}ms${c.r} ${c.fg.gray}(mem: ${mem>0?'+':''}${fmtBytes(mem)})${c.r}`);
      return r;
    } catch (err) { this.exception(err, `profile:${label}`); throw err; }
  },

  // Async profiling
  async profileAsync(label, fn) {
    const start = Date.now();
    const memB  = process.memoryUsage().heapUsed;
    try {
      const r   = await fn();
      const dur = Date.now() - start;
      const mem = process.memoryUsage().heapUsed - memB;
      _out(L.perf, `${c.fg.bwhite}${label}${c.r} ${durColor(dur)}${dur}ms${c.r} ${c.fg.gray}(mem: ${mem>0?'+':''}${fmtBytes(mem)})${c.r}`);
      return r;
    } catch (err) { this.exception(err, `profileAsync:${label}`); throw err; }
  },

  // Benchmark
  benchmark(name, fn, iterations = 1000) {
    const times = [];
    for (let i = 0; i < iterations; i++) {
      const s = process.hrtime.bigint();
      fn();
      times.push(Number(process.hrtime.bigint() - s) / 1e6);
    }
    const a = times.reduce((x,y)=>x+y,0) / times.length;
    const mn = Math.min(...times), mx = Math.max(...times);
    const p95v = pct(times, 0.95);
    _box(`Benchmark: ${name}`, [
      `${c.fg.bwhite}Iterations:${c.r} ${iterations.toLocaleString()}`,
      `${c.fg.bwhite}Avg:${c.r} ${a.toFixed(2)}ms  ${c.fg.bwhite}Min:${c.r} ${c.fg.bgreen}${mn.toFixed(2)}ms${c.r}  ${c.fg.bwhite}Max:${c.r} ${c.fg.bred}${mx.toFixed(2)}ms${c.r}`,
      `${c.fg.bwhite}P95:${c.r} ${c.fg.bmagenta}${p95v.toFixed(2)}ms${c.r}`,
    ], 'perf');
    return { avg: a, min: mn, max: mx, p95: p95v, times };
  },

  // Histogram
  histogram(name, values, unit = '') {
    const s = [...values].sort((a,b)=>a-b);
    const [mn, mx] = [s[0], s[s.length-1]];
    const a = s.reduce((x,y)=>x+y,0) / s.length;
    _box(`Histogram: ${name}`, [
      `Count: ${c.fg.bwhite}${values.length}${c.r}  Min: ${c.fg.bgreen}${mn}${c.r}${unit}  Max: ${c.fg.bred}${mx}${c.r}${unit}`,
      `Avg: ${c.fg.byellow}${a.toFixed(1)}${c.r}${unit}  P50: ${c.fg.bcyan}${pct(s,.5)}${c.r}${unit}  P95: ${c.fg.bmagenta}${pct(s,.95)}${c.r}${unit}  P99: ${c.fg.bmagenta}${pct(s,.99)}${c.r}${unit}`,
    ], 'perf');
  },

  // Health check
  healthCheck(checks) {
    const rows = checks.map(({ name, status, message, duration }) => [
      status ? `${c.fg.bgreen}✔${c.r}` : `${c.fg.bred}✖${c.r}`,
      name,
      (status ? c.fg.bgreen : c.fg.bred) + (message || (status ? 'OK' : 'FAIL')) + c.r,
      duration ? `${duration}ms` : '',
    ]);
    _table(['', 'Servis', 'Durum', 'Süre'], rows, 'Health Check');
    return rows.every(r => stripAnsi(r[0]).includes('✔'));
  },

  // Metrik
  metric(name, value, unit = '', labels = {}) {
    const ls = Object.entries(labels).map(([k,v]) => `${k}=${v}`).join(',');
    const lp = ls ? ` ${c.fg.gray}{${ls}}${c.r}` : '';
    _out(L.perf, `${c.fg.bwhite}${name}${c.r}${lp} ${c.fg.byellow}${value}${c.r}${unit}`);
  },

  // Log geçmişi
  getHistory(filter = null, limit = 100) {
    let h = _st.logHistory.slice(-limit);
    if (filter) h = h.filter(e =>
      e.level.toLowerCase().includes(filter.toLowerCase()) ||
      e.message.toLowerCase().includes(filter.toLowerCase())
    );
    return h;
  },
  clearHistory() { _st.logHistory = []; },

  // Log dışa aktar
  exportLogs(format = 'json') {
    const h = this.getHistory(null, _st.maxHistory);
    if (format === 'csv') {
      return ['timestamp,level,message'].concat(
        h.map(e => `${e.ts},${e.level},"${e.message.replace(/"/g, '""')}"`)
      ).join('\n');
    }
    if (format === 'ndjson') return h.map(e => JSON.stringify(e)).join('\n');
    return JSON.stringify(h, null, 2);
  },

  // İstatistikler
  stats(detailed = false) {
    const up    = fmtUptime();
    const avgT  = avg(_st.responseTimes);
    const p95v  = pct(_st.responseTimes, 0.95);
    const p99v  = pct(_st.responseTimes, 0.99);
    const minT  = _st.responseTimes.length ? Math.min(..._st.responseTimes) : 0;
    const maxT  = _st.responseTimes.length ? Math.max(..._st.responseTimes) : 0;
    const erRate = _st.requests ? ((_st.errors / _st.requests) * 100).toFixed(1) : '0.0';

    this.divider('Sistem İstatistikleri');
    _table(
      ['Metrik', 'Değer', ''],
      [
        ['Uptime',         up,       `${c.fg.bgreen}●${c.r}`],
        ['Toplam İstek',   String(_st.requests), `${c.fg.bblue}●${c.r}`],
        ['Hata Sayısı',    String(_st.errors),   _st.errors  > 0  ? `${c.fg.bred}●${c.r}`    : `${c.fg.bgreen}●${c.r}`],
        ['Hata Oranı',     `${erRate}%`,          parseFloat(erRate) > 5 ? `${c.fg.bred}●${c.r}` : `${c.fg.bgreen}●${c.r}`],
        ['Uyarı Sayısı',   String(_st.warns),    _st.warns   > 10 ? `${c.fg.byellow}●${c.r}` : `${c.fg.bgreen}●${c.r}`],
        ['─────────────',  '─────────', ''],
        ['Min Yanıt',      `${minT}ms`,  `${c.fg.bgreen}●${c.r}`],
        ['Ort Yanıt',      `${avgT}ms`,  avgT  > 1000 ? `${c.fg.byellow}●${c.r}` : `${c.fg.bgreen}●${c.r}`],
        ['P95 Yanıt',      `${p95v}ms`,  p95v  > 2000 ? `${c.fg.bred}●${c.r}`    : `${c.fg.bgreen}●${c.r}`],
        ['P99 Yanıt',      `${p99v}ms`,  p99v  > 5000 ? `${c.fg.bred}●${c.r}`    : `${c.fg.bgreen}●${c.r}`],
        ['Max Yanıt',      `${maxT}ms`,  maxT  > 5000 ? `${c.fg.bred}●${c.r}`    : `${c.fg.bgreen}●${c.r}`],
      ]
    );

    if (Object.keys(_st.methodCounts).length)
      _table(['Method','İstek','Oran'],
        Object.entries(_st.methodCounts).map(([k,v]) => [k, String(v), `${_st.requests ? ((v/_st.requests)*100).toFixed(1) : 0}%`]),
        'HTTP Method Dağılımı');

    if (Object.keys(_st.statusCounts).length)
      _table(['Status','Sayı','Oran'],
        Object.entries(_st.statusCounts)
          .sort(([a],[b]) => Number(a) - Number(b))
          .map(([k,v]) => {
            const col = k >= 500 ? c.fg.bred : k >= 400 ? c.fg.byellow : c.fg.bgreen;
            return [k, String(v), col + (_st.requests ? ((v/_st.requests)*100).toFixed(1) : 0) + '%' + c.r];
          }),
        'HTTP Status Dağılımı');

    if (_st.dbQueries.total > 0)
      _table(['DB Metrik','Değer','Oran'],
        [
          ['Toplam Sorgu',    String(_st.dbQueries.total),      '100%'],
          ['Yavaş (>1s)',     String(_st.dbQueries.slow),        `${((_st.dbQueries.slow/_st.dbQueries.total)*100).toFixed(1)}%`],
          ['Cache Hit',       String(_st.dbQueries.cacheHits),   `${((_st.dbQueries.cacheHits/_st.dbQueries.total)*100).toFixed(1)}%`],
          ['Ort Süre',        `${_st.dbQueries.avgTime.toFixed(1)}ms`, ''],
        ], 'Veritabanı İstatistikleri');

    if (detailed && _st.customCounters.size > 0)
      _table(['Counter','Değer'],
        Array.from(_st.customCounters.entries()).map(([k,v]) => [k, String(v)]),
        'Özel Sayaçlar');
  },

  getStats() { return { ..._st, uptime: fmtUptime(), avgResponseTime: avg(_st.responseTimes) }; },

  resetStats() {
    Object.assign(_st, {
      requests: 0, errors: 0, warns: 0, infos: 0, debugs: 0,
      methodCounts: {}, statusCounts: {}, responseTimes: [],
      dbQueries: { total: 0, slow: 0, cacheHits: 0, avgTime: 0 },
      wsConnections: { active: 0, total: 0, messages: 0 },
      queueStats: {}, eventsEmitted: 0, browserActions: 0,
    });
    _st.customCounters.clear();
  },

  // Banner — BUG FIX: ANSI-aware hizalama, TTY kontrolü
  banner(appName, version, port, extras = {}) {
    if (process.stdout.isTTY) process.stdout.write('\x1b[2J\x1b[0f');

    const art = [
      `${c.fg.bmagenta}  ██████╗ ███████╗███╗   ███╗${c.r}`,
      `${c.fg.magenta}  ██╔════╝ ██╔════╝████╗ ████║${c.r}`,
      `${c.fg.bblue}  ██║  ███╗█████╗  ██╔████╔██║${c.r}`,
      `${c.fg.blue}  ██║   ██║██╔══╝  ██║╚██╔╝██║${c.r}`,
      `${c.fg.bcyan}  ╚██████╔╝███████╗██║ ╚═╝ ██║${c.r}`,
      `${c.fg.cyan}   ╚═════╝ ╚══════╝╚═╝     ╚═╝${c.r}  v${version}${c.r}`,
    ];

    const memMB = Math.round(process.memoryUsage().rss / 1024 / 1024);
    const info = [
      `${c.fg.gray}  Platform  ${c.r}${c.fg.bwhite}${process.platform} ${process.arch}${c.r}`,
      `${c.fg.gray}  Node.js   ${c.r}${c.fg.bgreen}${process.version}${c.r}`,
      `${c.fg.gray}  PID       ${c.r}${c.fg.byellow}${process.pid}${c.r}`,
      `${c.fg.gray}  Bellek    ${c.r}${c.fg.cyan}${memMB} MB${c.r}`,
      `${c.fg.gray}  Mod       ${c.r}${c.fg.bmagenta}${process.env.NODE_ENV || 'development'}${c.r}`,
      ``,
      `${c.fg.gray}  🌐 Dashboard  ${c.r}${c.fg.bcyan}http://127.0.0.1:${port}${c.r}`,
      `${c.fg.gray}  📚 API Docs   ${c.r}${c.fg.bcyan}http://127.0.0.1:${port}/docs${c.r}`,
      `${c.fg.gray}  💓 Health     ${c.r}${c.fg.bcyan}http://127.0.0.1:${port}/api/health${c.r}`,
      ...(extras.websocket ? [`${c.fg.gray}  🔌 WebSocket  ${c.r}${c.fg.bcyan}ws://127.0.0.1:${port}${c.r}`] : []),
    ].filter(Boolean);

    const sep = `${c.fg.gray}${'═'.repeat(72)}${c.r}`;
    process.stdout.write(`\n${sep}\n`);
    const rows = Math.max(art.length, info.length);
    for (let i = 0; i < rows; i++) {
      // BUG FIX: ANSI-aware padding
      const left  = ansiPad(art[i] || '', 48);
      const right = info[i] || '';
      process.stdout.write(`  ${left}${right}\n`);
    }
    process.stdout.write(`${sep}\n\n`);
  },

  miniBanner(text, type = 'info') {
    const cmap = { info: c.fg.bcyan, success: c.fg.bgreen, warn: c.fg.byellow, error: c.fg.bred };
    const col  = cmap[type] || c.fg.bcyan;
    const line = '─'.repeat(vLen(text) + 4);
    process.stdout.write(`\n${col}┌${line}┐${c.r}\n${col}│  ${c.fg.bwhite}${text}${col}  │${c.r}\n${col}└${line}┘${c.r}\n\n`);
  },

  // Browser / playwright olayları
  browserAction(action, detail = '', ok = true) {
    _st.browserActions++;
    const mark = ok ? `${c.fg.bgreen}✔${c.r}` : `${c.fg.bred}✖${c.r}`;
    const ds   = detail ? ` ${c.fg.gray}${detail}${c.r}` : '';
    _out(L.browser, `${mark} ${c.fg.bwhite}${action}${c.r}${ds}`);
  },

  keyEvent(action, label, id = '') {
    const sid = id ? ` ${c.fg.gray}[${String(id).slice(0,8)}…]${c.r}` : '';
    const ac  = action === 'delete' ? c.fg.bred : c.fg.bcyan;
    _out(L.system, `${ac}key:${action}${c.r} ${c.b}${label}${c.r}${sid}`);
  },

  // SIGINT / SIGTERM: stats basıp temiz çıkış
  attachSignalHandlers() {
    const handle = (sig) => {
      process.stdout.write('\n');
      this.warn(`${sig} alındı — kapatılıyor`);
      this.stats();
      process.exit(0);
    };
    process.once('SIGINT',  () => handle('SIGINT'));
    process.once('SIGTERM', () => handle('SIGTERM'));
  },

  raw: (...a) => process.stdout.write(a.join(' ') + '\n'),
};

module.exports = logger;