'use strict';
require('dotenv').config();

const express    = require('express');
const bodyParser = require('body-parser');
const helmet     = require('helmet');
const morgan     = require('morgan');
const path       = require('path');
const fs         = require('fs');
const { v4: uuidv4 } = require('uuid');

const { PORT, ACTIVITIES_FILE, DATA_DIR, APP_NAME, VERSION } = require('./src/config');
const { requireApiKey, trackUsage, rateLimiter }             = require('./src/middleware');
const logger = require('./src/logger');
const { createKey, listKeys, deleteKey, ensureDefaultKey, load: loadKeys } = require('./src/apikeys');
const { getSummary }  = require('./src/stats');
const { buildPrompt } = require('./src/promptBuilder');
const {
  sendMessage, openBrowser, resetBrowser, getBrowserStatus,
  startNewChat, switchModel, getChatHistory, switchToChat, getChatMessages,
} = require('./gemini-browser');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use((req, res, next) => {
  const start = Date.now();
  logger.request(req);
  res.on('finish', () => {
    logger.response(req, res, Date.now() - start);
  });
  next();
});
app.use(bodyParser.json({ limit: '2mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use('/api/', rateLimiter);

function loadActivities() {
  try {
    if (fs.existsSync(ACTIVITIES_FILE)) {
      const data = JSON.parse(fs.readFileSync(ACTIVITIES_FILE, 'utf8'));
      return Array.isArray(data) ? data : (Array.isArray(data.activities) ? data.activities : []);
    }
  } catch {}
  return [];
}

function saveActivities(acts) {
  fs.writeFileSync(ACTIVITIES_FILE, JSON.stringify(acts, null, 2));
}

app.get('/', (req, res) => {
  res.render('index', {
    activities:    loadActivities(),
    keys:          loadKeys(),
    stats:         getSummary(),
    browserStatus: getBrowserStatus(),
    version:       VERSION,
  });
});

app.get('/docs',     (req, res) => {
  const keys = loadKeys();
  res.render('docs', { exampleKey: keys[0]?.key ?? 'gmb_your_api_key_here', version: VERSION, appName: APP_NAME });
});
app.get('/tutorial', (req, res) => res.render('tutorial', { version: VERSION, appName: APP_NAME }));
app.get('/setup',    (req, res) => res.render('setup',    { version: VERSION, appName: APP_NAME }));

app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', app: APP_NAME, version: VERSION, browser: getBrowserStatus(), timestamp: new Date().toISOString() });
});

app.post('/api/chat/new', requireApiKey, trackUsage, async (req, res) => {
  try { res.json(await startNewChat()); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/chat/stream', requireApiKey, trackUsage, async (req, res) => {
  const { message, mode } = req.body;
  if (!message) return res.status(400).json({ success: false, error: 'Mesaj gerekli.' });

  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');

  try {
    const result = await sendMessage(
      buildPrompt({ userMessage: message, mode }),
      (chunk) => res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`)
    );
    res.write(`data: ${JSON.stringify(result.success ? { done: true, text: result.response } : { error: result.error })}\n\n`);
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
  } finally {
    res.end();
  }
});

app.post('/api/chat/model', requireApiKey, trackUsage, async (req, res) => {
  if (!req.body.model) return res.status(400).json({ success: false, error: 'Model adı gerekli.' });
  try { res.json(await switchModel(req.body.model)); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/chat/history', requireApiKey, trackUsage, async (req, res) => {
  try { res.json(await getChatHistory()); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/chat/switch', requireApiKey, trackUsage, async (req, res) => {
  if (req.body.index === undefined) return res.status(400).json({ success: false, error: 'Sohbet indexi gerekli.' });
  try { res.json(await switchToChat(req.body.index)); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/chat/messages', requireApiKey, trackUsage, async (req, res) => {
  if (!req.query.href) return res.status(400).json({ success: false, error: 'href parametresi gerekli.' });
  try { res.json(await getChatMessages(req.query.href)); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/keys', trackUsage, (req, res) => res.json({ success: true, keys: listKeys() }));

app.post('/api/keys', trackUsage, (req, res) => {
  const { label = 'default' } = req.body;
  if (!label?.trim()) return res.status(400).json({ success: false, error: 'label gerekli.' });
  res.json({ success: true, key: createKey(label.trim()) });
});

app.delete('/api/keys/:id', trackUsage, (req, res) => {
  if (!deleteKey(req.params.id))
    return res.status(404).json({ success: false, error: 'Key bulunamadı.' });
  res.json({ success: true, message: 'Key silindi.' });
});

app.get('/api/stats', requireApiKey, trackUsage, (req, res) => {
  try { res.json({ success: true, stats: getSummary() }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/activities', requireApiKey, trackUsage, (req, res) => {
  res.json({ success: true, activities: loadActivities() });
});

app.post('/api/activities', requireApiKey, trackUsage, (req, res) => {
  const { content, category = 'genel' } = req.body;
  if (!content?.trim()) return res.status(400).json({ success: false, error: 'content gerekli.' });
  const acts = loadActivities();
  const act  = { id: uuidv4(), content: content.trim(), category, timestamp: new Date().toISOString(), sentToGemini: false };
  acts.unshift(act);
  saveActivities(acts);
  res.json({ success: true, activity: act });
});

app.delete('/api/activities/:id', requireApiKey, (req, res) => {
  const acts = loadActivities();
  const idx  = acts.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Aktivite bulunamadı.' });
  acts.splice(idx, 1);
  saveActivities(acts);
  res.json({ success: true, message: 'Aktivite silindi.' });
});

app.get('/api/setup/check-chrome', (req, res) => {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
  ];
  const found = candidates.find(p => fs.existsSync(p));
  res.json(found ? { success: true, path: found } : { success: false, message: 'Chrome bulunamadı.' });
});

app.post('/api/setup/save-config', (req, res) => {
  if (!req.body.profile) return res.status(400).json({ success: false, error: 'Profil adı gerekli.' });
  try {
    const configPath = path.join(__dirname, 'src', 'config.js');
    let content = fs.readFileSync(configPath, 'utf8');
    
    // Çok satırlı veya tek satırlı CHROME_PROFILE_DIR tanımını bulup değiştirir
    const regex = /CHROME_PROFILE_DIR:[\s\S]*?\),/;
    const newVal = `CHROME_PROFILE_DIR: path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data', '${req.body.profile}'),`;
    
    if (regex.test(content)) {
      content = content.replace(regex, newVal);
    } else {
      // Eğer üstteki tutmazsa fallback (daha basit bir eşleşme denenebilir)
      content = content.replace(/CHROME_PROFILE_DIR:.*?,/, newVal);
    }
    
    fs.writeFileSync(configPath, content);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/add', (req, res) => {
  const { content, category = 'genel' } = req.body;
  if (content?.trim()) {
    const acts = loadActivities();
    acts.unshift({ id: uuidv4(), content: content.trim(), category, timestamp: new Date().toISOString(), sentToGemini: false });
    saveActivities(acts);
  }
  res.redirect('/');
});

app.delete('/activity/:id', (req, res) => {
  const acts = loadActivities();
  const idx  = acts.findIndex(a => a.id === req.params.id);
  if (idx !== -1) { acts.splice(idx, 1); saveActivities(acts); }
  res.json({ success: true });
});

app.post('/api/browser/open',  requireApiKey, trackUsage, async (req, res) => res.json(await openBrowser()));
app.post('/api/browser/reset', requireApiKey, trackUsage, async (req, res) => res.json(await resetBrowser()));
app.post('/open-gemini', async (req, res) => {
  const r = await openBrowser();
  res.json({ ok: r.success, msg: r.message || r.error });
});

app.use((req, res) => {
  if (req.path.startsWith('/api/'))
    return res.status(404).json({ success: false, error: `${req.method} ${req.path} bulunamadı.` });
  res.status(404).send('Sayfa bulunamadı.');
});

app.use((err, req, res, _next) => {
  logger.error('[Server Error]', err);
  res.status(500).json({ success: false, error: 'Sunucu hatası: ' + err.message });
});

// ── BAŞLAT ────────────────────────────────────────────────────────
;(async () => {
  logger.banner(APP_NAME, VERSION, PORT);
  
  logger.startTask('data-dir', 'Data dizini kontrol ediliyor');
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  logger.endTask('data-dir');

  logger.startTask('api-keys', 'API anahtarları doğrulanıyor');
  ensureDefaultKey();
  logger.endTask('api-keys');

  logger.startTask('server-init', 'Sunucu başlatılıyor');
  app.listen(PORT, '127.0.0.1', () => {
    logger.endTask('server-init');
    
    logger.box('SİSTEM ÇALIŞIYOR', [
      `🏠 Dashboard : http://127.0.0.1:${PORT}`,
      `📖 API Docs  : http://127.0.0.1:${PORT}/docs`,
      `❤️  Health   : http://127.0.0.1:${PORT}/api/health`,
      `──────────────────────────────────────────`,
      `MOD: ${process.env.NODE_ENV || 'development'}`,
      `VER: ${VERSION}`
    ], 'success');

    logger.info('Bağlantı bekleniyor...\n');
  });
})();