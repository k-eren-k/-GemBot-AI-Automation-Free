const { chromium } = require('playwright');
const path = require('path');
const logger = require('./src/logger');
const { CHROME_PROFILE_DIR, SELECTORS_FILE } = require('./src/config');

let browser = null;
let page    = null;
let isReady = false;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const DEFAULT_SELECTORS = {
  input:       'div[contenteditable="true"]',
  response:    'model-response, message-content, .message-content, .markdown',
  sendButton:  'button[aria-label*="Gönder"], button[aria-label*="Send"]',
  modelSelector: '[data-test-id="model-selector"]',
  modelOption:   '[data-test-id="model-option"]',
  chatList:    'a[data-test-id="conversation"]',
};

function loadSelectors() {
  try {
    if (fs.existsSync(SELECTORS_FILE))
      return { ...DEFAULT_SELECTORS, ...JSON.parse(fs.readFileSync(SELECTORS_FILE, 'utf8')) };
  } catch {}
  return DEFAULT_SELECTORS;
}

const EXTRACT_MD = `(selector) => {
  const trySelectors = selector.split(',').map(s => s.trim());
  let nodes = [];
  for (const sel of trySelectors) {
    const found = document.querySelectorAll(sel);
    if (found.length > 0) {
      nodes = Array.from(found);
      break;
    }
  }
  
  if (!nodes.length) return '';
  const node = nodes[nodes.length - 1];
  const clone = node.cloneNode(true);
  Object.assign(clone.style, { position:'absolute', left:'-9999px', opacity:'0' });
  document.body.appendChild(clone);
  
  clone.querySelectorAll('button, mat-icon, svg, .copy-button, code-copy-button, .action-container').forEach(n => n.remove());
  
  const fmt = (sel, fn) => clone.querySelectorAll(sel).forEach(n => { n.innerText = fn(n.innerText); });
  fmt('h1', t => '\\n# '  + t + '\\n');
  fmt('h2', t => '\\n## ' + t + '\\n');
  fmt('h3', t => '\\n### '+ t + '\\n');
  fmt('strong, b', t => '**' + t + '**');
  fmt('em, i',     t => '*'  + t + '*');
  
  clone.querySelectorAll('a').forEach(n => { n.innerText = '[' + n.innerText + '](' + n.href + ')'; });
  
  clone.querySelectorAll('pre, snack-bar-code-block, .code-block').forEach(n => {
    const lang = (n.className.match(/language-(\\w+)/) || [])[1] || '';
    const code = n.innerText.replace(/^Kopyala\\n/i,'').trim();
    n.innerText = '\\n\\n\`\`\`' + lang + '\\n' + code + '\\n\`\`\`\\n\\n';
  });
  
  clone.querySelectorAll('code').forEach(n => {
    if (!n.closest('pre, .code-block, snack-bar-code-block')) n.innerText = '\`' + n.innerText + '\`';
  });
  
  const result = clone.innerText.replace(/\\n{3,}/g, '\\n\\n').trim();
  clone.remove();
  return result;
}`;

function resetState() {
  browser = null;
  page    = null;
  isReady = false;
}

async function openBrowser() {
  if (browser) {
    try { await browser.pages(); }
    catch { resetState(); }
  }

  if (!browser) {
    logger.browser('Browser açılıyor...');
    browser = await chromium.launchPersistentContext(CHROME_PROFILE_DIR, {
      headless: false,
      viewport: null,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled', '--use-gl=desktop', '--start-maximized'],
    });

    logger.box('Browser Hazır', [`Profil: ${CHROME_PROFILE_DIR}`, `Status: Aktif`], 'success');

    browser.on('disconnected', () => {
      logger.warn('Browser bağlantısı kesildi.');
      resetState();
    });

    page = await browser.newPage();
    await page.goto('https://gemini.google.com/app', { waitUntil: 'domcontentloaded' });
    isReady = true;
  }

  return { success: true, message: 'Tarayıcı açık.' };
}

async function typeAndSend(p, text, sel) {
  await p.waitForSelector(sel.input, { state: 'visible', timeout: 20_000 });
  
  // Önceki metni temizle ve odaklan
  await p.click(sel.input);
  await p.evaluate(s => {
    const el = document.querySelector(s);
    if (el) { 
      el.focus(); 
      el.innerText = ''; 
      // Input eventini tetikle
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, sel.input);
  
  await sleep(100);
  await p.keyboard.insertText(text); // Tek seferde hızlıca yapıştır/ekle
  await sleep(300);

  // Gönder botununa basmayı dene, yoksa Enter bas
  const sent = await p.evaluate((s) => {
    const btn = document.querySelector(s);
    if (btn && !btn.disabled) {
      btn.click();
      return true;
    }
    return false;
  }, sel.sendButton || sel.send);

  if (!sent) {
    await p.keyboard.press('Enter');
    logger.debug('Gönder butonu bulunamadı, Enter ile gönderildi.');
  } else {
    logger.debug('Gönder butonu ile gönderildi.');
  }
}

async function waitForResponse(p, sel, onProgress, initialCount = 0) {
  logger.browser('Yeni cevap bekleniyor...');
  const startTime = Date.now();
  let lastText   = '';
  let stableCount = 0;
  
  // 1. Yeni mesaj elementinin oluşmasını bekle
  let foundNew = false;
  for (let i = 0; i < 15; i++) {
    const currentCount = await p.evaluate((s) => {
      const trySelectors = s.split(',').map(sel => sel.trim());
      for (const sel of trySelectors) {
        const nodes = document.querySelectorAll(sel);
        if (nodes.length > 0) return nodes.length;
      }
      return 0;
    }, sel.response);

    if (currentCount > initialCount) {
      foundNew = true;
      break;
    }
    await sleep(1000);
  }

  if (!foundNew) logger.warn('Yeni mesaj elementi henüz oluşmadı, yine de kontrole devam ediliyor...');

  // 2. Mesaj içeriğinin gelişmesini ve durulmasını bekle
  for (let i = 0; i < 90; i++) {
    const current = await p.evaluate(new Function('return ' + EXTRACT_MD)(), sel.response).catch(err => {
      logger.error('Extraction hatası:', err.message);
      return '';
    });

    if (current && current !== lastText) {
      lastText = current;
      stableCount = 0;
      onProgress?.(current);
      if (i % 5 === 0) logger.debug(`Akış devam ediyor... (${current.length} karakter)`);
    } else if (current && current === lastText && current.length > 5) {
      stableCount++;
      if (stableCount >= 2) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        logger.browser(`Cevap tamamlandı (${duration}s)`);
        return current;
      }
    } else if (!current && i > 10) {
      if (i % 10 === 0) logger.warn(`Cevap boş geliyor... (Saniye: ${i})`);
    }
    await sleep(1000);
  }

  return lastText || 'Cevap alınamadı (timeout).';
}

async function sendMessage(fullPrompt, onProgress) {
  const sel = loadSelectors();

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (!browser || !page) {
        await openBrowser();
        await sleep(1500);
      }

      // Göndermeden önce mesaj sayısını al
      const initialCount = await page.evaluate((s) => {
        const trySelectors = s.split(',').map(sel => sel.trim());
        for (const sel of trySelectors) {
          const nodes = document.querySelectorAll(sel);
          if (nodes.length > 0) return nodes.length;
        }
        return 0;
      }, sel.response);

      logger.api('Mesaj gönderiliyor...');
      await typeAndSend(page, fullPrompt, sel);
      const response = await waitForResponse(page, sel, onProgress, initialCount);

      if (response && response.length > 5 && !response.includes('timeout')) {
        logger.api('Yanıt başarıyla alındı.');
        return { success: true, response: response.trim() };
      }
      await sleep(2000);
    } catch (err) {
      console.error(`[Browser] Hata (deneme ${attempt}/3):`, err.message);

      const closed = ['Target page', 'context or browser has been closed', 'Browser closed', 'Connection closed']
        .some(s => err.message.includes(s));
      if (closed) resetState();
      if (attempt >= 3) return { success: false, error: err.message };
      await sleep(3000);
    }
  }

  return { success: false, error: 'Maksimum deneme sayısına ulaşıldı.' };
}

async function resetBrowser() {
  try {
    if (browser) await browser.close();
  } finally {
    resetState();
  }
  return { success: true, message: 'Tarayıcı sıfırlandı.' };
}

async function startNewChat() {
  try {
    if (!browser || !page) await openBrowser();
    await page.goto('https://gemini.google.com/app', { waitUntil: 'domcontentloaded', timeout: 15_000 });
    await sleep(1000);
    return { success: true, message: 'Yeni sohbet başlatıldı.' };
  } catch (err) {
    return { success: false, error: 'Yeni sohbet başlatılamadı: ' + err.message };
  }
}

async function switchModel(modelName) {
  try {
    if (!browser || !page) await openBrowser();
    const sel = loadSelectors();
    await page.waitForSelector(sel.modelSelector, { state: 'visible', timeout: 5_000 });
    await page.click(sel.modelSelector);
    await sleep(400);

    const options = await page.$$(sel.modelOption);
    for (const opt of options) {
      const text = await opt.innerText();
      if (text.toLowerCase().includes(modelName.toLowerCase())) {
        await opt.click();
        await sleep(800);
        return { success: true, message: `Model '${modelName}' seçildi.` };
      }
    }
    return { success: false, error: `Model '${modelName}' bulunamadı.` };
  } catch (err) {
    return { success: false, error: 'Model değiştirilemedi: ' + err.message };
  }
}

async function getChatHistory() {
  try {
    if (!browser || !page) await openBrowser();
    await page.waitForSelector('a[data-test-id="conversation"]', { timeout: 5_000 }).catch(() => null);

    const chats = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[data-test-id="conversation"]')).map((item, idx) => {
        const titleEl = item.querySelector('.conversation-title');
        const title   = (titleEl?.textContent ?? '').replace(/\s+/g, ' ').trim() || 'Başlıksız Sohbet';
        const href    = item.getAttribute('href') || '';
        const chatId  = href.split('/').pop();
        return {
          id: idx, chatId, href, title,
          active: window.location.href.includes(chatId),
        };
      }).filter(c => c.title.length > 2)
    );

    return { success: true, chats };
  } catch (err) {
    return { success: false, error: 'Geçmiş alınamadı: ' + err.message };
  }
}

async function switchToChat(index) {
  try {
    if (!browser || !page) await openBrowser();

    const chats = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[data-test-id="conversation"]'))
        .map(el => ({ href: el.getAttribute('href') }))
    );

    if (!chats[index])
      return { success: false, error: `Sohbet ${index} bulunamadı (toplam: ${chats.length}).` };

    await page.goto(`https://gemini.google.com${chats[index].href}`, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    await sleep(1000);
    return { success: true, message: 'Sohbete geçildi.' };
  } catch (err) {
    return { success: false, error: 'Sohbete geçilemedi: ' + err.message };
  }
}

async function getChatMessages(chatHref) {
  try {
    if (!browser || !page) await openBrowser();

    const targetUrl = `https://gemini.google.com${chatHref}`;
    if (!page.url().includes(chatHref)) {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 });
      await sleep(1500);
    }

    const messages = await page.evaluate(() => {
      const result = [];
      const turns  = document.querySelectorAll('user-query, model-response, conversation-turn, [class*="message-content"]');

      if (turns.length) {
        turns.forEach(turn => {
          const tag = turn.tagName.toLowerCase();
          if (tag === 'conversation-turn') {
            const u = turn.querySelector('user-query,[class*="user"]');
            const b = turn.querySelector('model-response,message-content');
            if (u?.textContent.trim()) result.push({ role: 'user', text: u.textContent.trim() });
            if (b?.textContent.trim()) result.push({ role: 'bot',  text: b.textContent.trim() });
          } else if (tag === 'user-query') {
            if (turn.textContent.trim()) result.push({ role: 'user', text: turn.textContent.trim() });
          } else {
            if (turn.textContent.trim()) result.push({ role: 'bot',  text: turn.textContent.trim() });
          }
        });
      } else {
        document.querySelectorAll('.user-query-container,[data-test-id="user-query"]')
          .forEach(el => { if (el.textContent.trim()) result.push({ role: 'user', text: el.textContent.trim() }); });
        document.querySelectorAll('message-content .markdown,.model-response-text')
          .forEach(el => { if (el.textContent.trim()) result.push({ role: 'bot',  text: el.textContent.trim() }); });
      }

      return result.filter((m, i, a) => i === 0 || m.text !== a[i - 1].text);
    });

    return { success: true, messages };
  } catch (err) {
    return { success: false, error: 'Mesajlar alınamadı: ' + err.message };
  }
}

function getBrowserStatus() {
  return { open: !!browser, ready: isReady };
}

module.exports = {
  sendMessage, openBrowser, resetBrowser, getBrowserStatus,
  startNewChat, switchModel, getChatHistory, switchToChat, getChatMessages,
};