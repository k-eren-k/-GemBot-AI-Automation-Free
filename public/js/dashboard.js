if (typeof marked !== 'undefined') {
  marked.setOptions({ breaks: true, gfm: true });
}
let currentMode = 'chat';
let browserOpen = false;
let _keyCache   = null;
const tabTitles = { chat: 'Sohbet', keys: 'API Keys', stats: 'İstatistikler' };
function switchTab(name) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-item[id^="nav-"]').forEach(n => n.classList.remove('active'));
  const tabContent = document.getElementById('tab-'  + name);
  if (tabContent) tabContent.classList.add('active');
  const navEl = document.getElementById('nav-' + name);
  if (navEl) navEl.classList.add('active');
  const topbarTitle = document.getElementById('topbarTitle');
  if (topbarTitle) topbarTitle.textContent = tabTitles[name] || name;
  const clearChatBtn = document.getElementById('clearChatBtn');
  if (clearChatBtn) clearChatBtn.style.display = name === 'chat' ? '' : 'none';
  if (name === 'stats') refreshStats();
}
function setMode(m) {
  currentMode = m;
  document.querySelectorAll('.mode-chip').forEach(c => c.classList.remove('active'));
  const chip = document.getElementById('mode-' + m);
  if (chip) chip.classList.add('active');
}
let _keyPromise = null;
async function getFirstKey() {
  if (_keyCache) return _keyCache;
  if (_keyPromise) return _keyPromise;
  _keyPromise = fetch('/api/keys')
    .then(r => r.json())
    .then(r => {
      _keyCache = (r.keys && r.keys[0]) ? r.keys[0].keyFull : '';
      _keyPromise = null;
      return _keyCache;
    })
    .catch(() => { _keyPromise = null; return ''; });
  return _keyPromise;
}
function quickSend(text) {
  const input = document.getElementById('msgInput');
  if (input) {
    input.value = text;
    send();
  }
}
async function send() {
  const input = document.getElementById('msgInput');
  const msg   = input.value.trim();
  if (!msg) return;
  const sendBtn = document.getElementById('sendBtn');
  if (sendBtn) sendBtn.disabled = true;
  const welcomeState = document.getElementById('welcomeState');
  if (welcomeState) welcomeState.remove();
  addMsg('user', msg);
  input.value = '';
  autoResize(input);
  setStatus('busy', 'Gemini yazıyor…');
  const t0       = Date.now();
  const firstKey = await getFirstKey();
  const botEl    = addMsg('bot', '');
  const bubble   = botEl.querySelector('.msg-bubble');
  const msgsEl   = document.getElementById('msgs');
  try {
    const res = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Bearer ' + firstKey,
      },
      body: JSON.stringify({ message: msg, activityIds: [], mode: currentMode }),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const reader  = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let   buf     = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split('\n\n');
      buf = parts.pop();
      for (const part of parts) {
        if (!part.startsWith('data: ')) continue;
        const raw = part.slice(6).trim();
        if (raw === '[DONE]') continue;
        try {
          const data = JSON.parse(raw);
          if (data.error) {
            bubble.innerHTML = '<strong>Hata:</strong> ' + escHtml(data.error);
            bubble.classList.remove('streaming');
            setStatus('err', data.error);
          } else if (data.text !== undefined) {
            bubble.classList.add('streaming');
            bubble.innerHTML = typeof marked !== 'undefined'
              ? marked.parse(data.text)
              : escHtml(data.text);
            if (msgsEl) msgsEl.scrollTop = msgsEl.scrollHeight;
          }
          if (data.done) {
            bubble.classList.remove('streaming');
            setStatus('ok', 'Cevap alındı (' + (Date.now() - t0) + 'ms)');
          }
        } catch (_) { }
      }
    }
  } catch (err) {
    bubble.innerHTML = '<strong>Ağ Hatası:</strong> ' + escHtml(err.message);
    setStatus('err', err.message);
  }
  if (sendBtn) sendBtn.disabled = false;
}
async function resetChat() {
  const btn = document.getElementById('newChatBtn');
  if (btn) btn.disabled = true;
  setStatus('busy', 'Yeni sohbet hazırlanıyor…');
  try {
    const key = await getFirstKey();
    const r   = await fetch('/api/chat/new', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key },
    }).then(r => r.json());
    if (r.success) {
      clearChat();
      toast('Yeni sohbet başlatıldı!', 'ok');
      setStatus('ok', 'Yeni sohbet hazır');
    } else {
      toast('Sıfırlanamadı: ' + (r.error || 'bilinmeyen hata'), 'err');
      setStatus('err', 'Sıfırlama hatası');
    }
  } catch (err) {
    toast('Bağlantı hatası', 'err');
    setStatus('err', 'Bağlantı hatası');
  } finally {
    if (btn) btn.disabled = false;
  }
}
async function toggleBrowser() {
  const btn = document.getElementById('bwBtn');
  if (btn) btn.disabled = true;
  const key = await getFirstKey();
  const endpoint = browserOpen ? '/api/browser/reset' : '/api/browser/open';
  setStatus('busy', browserOpen ? 'Kapatılıyor…' : 'Açılıyor…');
  try {
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key },
    }).then(r => r.json());
    if (r.success) {
      setBrowserOpen(!browserOpen);
      setStatus('ok', browserOpen ? 'Tarayıcı açıldı' : 'Tarayıcı kapatıldı');
      toast(browserOpen ? 'Tarayıcı başlatıldı!' : 'Tarayıcı kapatıldı.', browserOpen ? 'ok' : 'info');
    } else {
      setStatus('err', r.error || 'Hata');
      toast(r.error || 'Hata', 'err');
    }
  } catch (err) {
    toast('Bağlantı hatası', 'err');
    setStatus('err', 'Bağlantı hatası');
  } finally {
    if (btn) btn.disabled = false;
  }
}
function setBrowserOpen(open) {
  browserOpen = open;
  const dot = document.getElementById('bwDot');
  if (dot) dot.className = 'bw-dot ' + (open ? 'open' : 'closed');
  const status = document.getElementById('bwStatus');
  if (status) status.textContent = open ? 'Açık' : 'Kapalı';
  const btn = document.getElementById('bwBtn');
  if (btn) {
    btn.className = 'bw-btn' + (open ? ' danger' : '');
    btn.innerHTML = open
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="11" height="11"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Tarayıcıyı Kapat`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="11" height="11"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> Tarayıcıyı Başlat`;
  }
}
async function setModelUI(name) {
  const map = { 'Hızlı': 'm-flash', 'Düşünen': 'm-thought', 'Pro': 'm-pro' };
  document.querySelectorAll('.model-opt').forEach(o => o.classList.remove('active'));
  const opt = document.getElementById(map[name]);
  if (opt) opt.classList.add('active');
  setStatus('busy', name + ' modeline geçiliyor…');
  try {
    const key = await getFirstKey();
    const r   = await fetch('/api/chat/model', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({ model: name }),
    }).then(r => r.json());
    if (r.success) {
      toast(name + ' model seçildi.', 'ok');
      setStatus('ok', name + ' hazır');
    } else {
      toast(r.error || 'Model hatası', 'err');
      setStatus('err', 'Model hatası');
    }
  } catch (err) {
    toast('Bağlantı hatası', 'err');
    setStatus('err', 'Bağlantı hatası');
  }
}
async function loadHistory() {
  const list = document.getElementById('historyList');
  if (list) list.innerHTML = '<div style="font-size:10px;color:var(--text3);padding:6px;">Yükleniyor…</div>';
  try {
    const key = await getFirstKey();
    const r   = await fetch('/api/chat/history', {
      headers: { 'Authorization': 'Bearer ' + key },
    }).then(r => r.json());
    if (list) {
      list.innerHTML = '';
      if (!r.success || !r.chats || r.chats.length === 0) {
        list.innerHTML = '<div style="font-size:10px;color:var(--text3);padding:6px;">Sohbet yok.</div>';
        return;
      }
      r.chats.forEach(chat => {
        const div = document.createElement('div');
        div.className = 'history-item' + (chat.active ? ' active' : '');
        div.textContent = chat.title || 'Başlıksız Sohbet';
        div.onclick = () => switchToChatUI(chat.id, chat.href, div);
        list.appendChild(div);
      });
    }
  } catch {
    if (list) list.innerHTML = '<div style="font-size:10px;color:var(--red);padding:6px;">Yüklenemedi.</div>';
  }
}
function showProgress(text) {
  const alert = document.getElementById('progressAlert');
  const txt = document.getElementById('progressText');
  const perc = document.getElementById('progressPerc');
  const fill = document.getElementById('progressFill');
  if (alert) alert.style.display = 'flex';
  if (txt) txt.textContent = text;
  if (perc) perc.textContent = '0%';
  if (fill) fill.style.width = '0%';
  let p = 0;
  if(window._progressInt) clearInterval(window._progressInt);
  window._progressInt = setInterval(() => {
    if (p < 90) {
      p += Math.floor(Math.random() * 8) + 2;
      if (p > 90) p = 90;
      if (perc) perc.textContent = p + '%';
      if (fill) fill.style.width = p + '%';
    }
  }, 150);
}
function finishProgress(text) {
  if(window._progressInt) clearInterval(window._progressInt);
  const txt = document.getElementById('progressText');
  const perc = document.getElementById('progressPerc');
  const fill = document.getElementById('progressFill');
  if (txt) txt.textContent = text || 'Tamamlandı';
  if (perc) perc.textContent = '100%';
  if (fill) fill.style.width = '100%';
  setTimeout(() => {
    const alert = document.getElementById('progressAlert');
    if (alert) alert.style.display = 'none';
  }, 1000);
}
function hideProgress() {
  if(window._progressInt) clearInterval(window._progressInt);
  const alert = document.getElementById('progressAlert');
  if (alert) alert.style.display = 'none';
}
async function switchToChatUI(index, href, el) {
  setStatus('busy', 'Sohbete geçiliyor…');
  document.querySelectorAll('.history-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
  try {
    const key = await getFirstKey();
    showProgress('Sohbete bağlanıyor...');
    const rSwitch = await fetch('/api/chat/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({ index }),
    }).then(r => r.json());
    if (!rSwitch.success) {
      hideProgress();
      toast(rSwitch.error || 'Geçiş hatası', 'err');
      setStatus('err', 'Geçiş hatası');
      return;
    }
    clearChat();
    showProgress('Mesaj geçmişi çekiliyor...');
    const rMsgs = await fetch('/api/chat/messages?href=' + encodeURIComponent(href), {
      headers: { 'Authorization': 'Bearer ' + key },
    }).then(r => r.json());
    if (rMsgs.success && rMsgs.messages) {
      finishProgress('Mesajlar Yüklendi');
      if (rMsgs.messages.length === 0) {
        toast('Önceki mesaj bulunamadı.', 'ok');
      } else {
        const welcomeState = document.getElementById('welcomeState');
        if (welcomeState) welcomeState.style.display = 'none';
        rMsgs.messages.forEach(m => {
          if (m.role === 'user') appendMessage('user', m.text, false);
          else appendMessage('bot', m.text, false);
        });
      }
      setStatus('ok', 'Sohbet hazır');
    } else {
      hideProgress();
      toast('Mesajlar çekilemedi', 'err');
      setStatus('ok', 'Yeni sohbet hazır');
    }
  } catch (err) {
    hideProgress();
    toast('Mesaj çekme hatası: ' + err.message, 'err');
    setStatus('err', 'Bağlantı hatası');
  }
}
async function createKey() {
  const input = document.getElementById('keyLabel');
  if (!input) return;
  const label = input.value.trim();
  if (!label) { toast('Etiket gir!', 'err'); return; }
  try {
    const r = await fetch('/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label }),
    }).then(r => r.json());
    if (r.success) {
      toast('Key oluşturuldu!', 'ok');
      input.value = '';
      _keyCache = null;
      addKeyCard(r.key);
      updateKeyCount(1);
    } else {
      toast(r.error || 'Hata', 'err');
    }
  } catch {
    toast('Bağlantı hatası', 'err');
  }
}
function addKeyCard(k) {
  const list  = document.getElementById('keysList');
  if (!list) return;
  const empty = list.querySelector('[style*="dashed"]');
  if (empty) empty.remove();
  const div = document.createElement('div');
  div.className = 'key-card';
  div.id = 'kcard-' + k.id;
  div.innerHTML = `
    <div class="key-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
    </div>
    <div class="key-info">
      <div class="key-label">${escHtml(k.label)}</div>
      <div class="key-value-row">
        <span class="key-value" id="kv-${k.id}">${escHtml(k.key || k.keyFull || '')}</span>
        <button class="btn-copy" onclick="copyKey('${escHtml(k.key || k.keyFull || '')}')">Kopyala</button>
      </div>
      <div class="key-meta">Oluşturuldu: <strong>${new Date(k.createdAt).toLocaleString('tr-TR')}</strong> · İstek: <strong>0</strong></div>
    </div>
    <div class="key-actions">
      <button class="btn btn-danger btn-sm" onclick="deleteKey('${k.id}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="11" height="11"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
        Sil
      </button>
    </div>`;
  list.insertBefore(div, list.firstChild);
}
async function deleteKey(id) {
  if (!confirm('Bu key silinsin mi?')) return;
  try {
    const r = await fetch('/api/keys/' + id, { method: 'DELETE' }).then(r => r.json());
    if (r.success) {
      const card = document.getElementById('kcard-' + id);
      if (card) card.remove();
      _keyCache = null;
      toast('Key silindi.', 'ok');
      updateKeyCount(-1);
    } else {
      toast(r.error || 'Hata', 'err');
    }
  } catch {
    toast('Bağlantı hatası', 'err');
  }
}
async function copyKey(key) {
  try {
    await navigator.clipboard.writeText(key);
    toast('Key kopyalandı!', 'ok');
  } catch {
    toast('Kopyalanamadı.', 'err');
  }
}
function updateKeyCount(delta) {
  const badge = document.getElementById('keyCount');
  if (badge) badge.textContent = Math.max(0, parseInt(badge.textContent || '0') + delta);
}
function addMsg(role, text) {
  const c   = document.getElementById('msgs');
  if (!c) return;
  const d   = document.createElement('div');
  d.className = 'msg ' + role;
  const content = (role === 'bot' && typeof marked !== 'undefined')
    ? marked.parse(text)
    : escHtml(text);
  d.innerHTML = `
    <div class="msg-bubble">${content}</div>
    <div class="msg-meta">${new Date().toLocaleTimeString('tr-TR')}</div>`;
  c.appendChild(d);
  c.scrollTop = c.scrollHeight;
  return d;
}
function clearChat() {
  const c = document.getElementById('msgs');
  if (!c) return;
  c.innerHTML = '';
  const ws = document.createElement('div');
  ws.className = 'welcome-state';
  ws.id = 'welcomeState';
  ws.innerHTML = `
    <div class="welcome-mark">
      <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
    </div>
    <div class="welcome-title">Sohbet Temizlendi</div>
    <div class="welcome-sub">Yeni bir konuşma başlatmaya hazırsın.</div>
    <div class="quick-btns">
      <button class="quick-btn" onclick="quickSend('Merhaba! Kendini tanıtır mısın?')">👋 Tanış</button>
      <button class="quick-btn" onclick="quickSend('Bugün ne yapabilirim?')">🎯 Görev öner</button>
      <button class="quick-btn" onclick="quickSend('Bana kısa bir özet hazırla')">📋 Özet yaz</button>
    </div>`;
  c.appendChild(ws);
}
function setStatus(type, text) {
  const sDot = document.getElementById('sDot');
  if (sDot) sDot.className = 'status-dot ' + type;
  const sText = document.getElementById('sText');
  if (sText) sText.textContent = text;
}
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 110) + 'px';
}
function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
}
async function refreshStats() {
  try {
    const key = await getFirstKey();
    if (!key) return;
    const r = await fetch('/api/stats', {
      headers: { 'Authorization': 'Bearer ' + key }
    }).then(r => r.json());
    if (!r.success || !r.stats) return;

    const s = r.stats;
    const elId = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    elId('stat-total', s.total);
    elId('stat-rate',  s.successRate + '%');
    elId('stat-avg',   s.avgResponseTime + 'ms');
    elId('stat-24h',   s.last24h);

    const hourlyWrap = document.getElementById('hourlyChartWrap');
    if (hourlyWrap) {
      if (s.total === 0) {
        hourlyWrap.innerHTML = '<div class="empty-chart">Henüz istatistik yok.</div>';
      } else {
        const hours = Object.entries(s.hourly || {});
        const maxH  = Math.max(...hours.map(([,v]) => v.ok + v.err), 1);
        let html = '<div class="bar-chart-wrap">';
        hours.forEach(([label, v]) => {
          const total = v.ok + v.err;
          const hOk   = total ? Math.max(Math.round((v.ok  / maxH) * 60), v.ok  ? 3 : 0) : 0;
          const hErr  = total ? Math.max(Math.round((v.err / maxH) * 60), v.err ? 3 : 0) : 0;
          html += `
            <div class="bar-col">
              <div class="bar-stack" style="height:60px;display:flex;flex-direction:column;justify-content:flex-end;">
                ${hErr > 0 ? `<div class="bar err" style="height:${hErr}px" title="${v.err} hata"></div>` : ''}
                ${hOk  > 0 ? `<div class="bar ok"  style="height:${hOk}px" title="${v.ok} başarılı"></div>` : ''}
              </div>
              <div class="bar-label">${label.slice(0, 2)}</div>
            </div>`;
        });
        html += '</div>';
        hourlyWrap.innerHTML = html;
      }
    }

    const recentWrap = document.getElementById('recentListWrap');
    if (recentWrap) {
      if (!s.recent || s.recent.length === 0) {
        recentWrap.innerHTML = '<div class="empty-chart">Henüz istek yok.</div>';
      } else {
        let html = '<div class="recent-list">';
        s.recent.slice(0, 15).forEach(req => {
          html += `
            <div class="recent-row">
              <span class="recent-status ${req.status >= 200 && req.status < 400 ? 'ok' : 'err'}">${req.status}</span>
              <span class="recent-method">${req.method}</span>
              <span class="recent-ep">${req.endpoint}</span>
              <span class="recent-key">${req.apiKeyLabel}</span>
              <span class="recent-rt">${req.responseTime}ms</span>
              <span class="recent-time">${new Date(req.timestamp).toLocaleTimeString('tr-TR')}</span>
            </div>`;
        });
        html += '</div>';
        recentWrap.innerHTML = html;
      }
    }

    const keyWrap = document.getElementById('keyTableWrap');
    if (keyWrap) {
      const byKey = s.byKey || {};
      if (Object.keys(byKey).length > 0) {
        let html = `
          <div class="chart-card">
            <div class="chart-header"><div class="chart-title">Key Bazlı</div></div>
            <table class="key-table">
              <tr><th>Key</th><th>Toplam</th><th>Başarılı</th><th>Oran</th></tr>`;
        Object.entries(byKey).forEach(([lbl, v]) => {
          html += `
            <tr>
              <td>${escHtml(lbl)}</td>
              <td style="color:var(--text2)">${v.total}</td>
              <td style="color:var(--green)">${v.success}</td>
              <td>${Math.round(v.success / v.total * 100)}%</td>
            </tr>`;
        });
        html += '</table></div>';
        keyWrap.innerHTML = html;
      } else {
        keyWrap.innerHTML = '';
      }
    }
  } catch {}
}
setInterval(refreshStats, 30000);

function escHtml(t) {
  return String(t)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function toast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className   = 'toast ' + type;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => {
    t.style.transition = 'opacity .2s';
    t.style.opacity    = '0';
    setTimeout(() => t.remove(), 220);
  }, 2800);
}
const clearChatBtn = document.getElementById('clearChatBtn');
if (clearChatBtn) clearChatBtn.style.display = '';
fetch('/api/health')
  .then(r => r.json())
  .then(d => {
    if (d.browser && d.browser.open) {
      setBrowserOpen(true);
      loadHistory();
    }
  })
  .catch(() => {});
const MODE_LABELS = {
  chat:      'Genel',
  plan:      'Planlama',
  summarize: 'Özet',
  analyze:   'Analiz',
  code:      'Kod',
  debug:     'Debug',
};
function toggleModeMenu(e) {
  e.stopPropagation();
  const menu = document.getElementById('modeMenu');
  const btn  = document.getElementById('modeToggle');
  const open = menu.classList.toggle('open');
  btn.classList.toggle('open', open);
}
function pickMode(mode) {
  currentMode = mode;
  document.querySelectorAll('.mode-menu-item').forEach(el => {
    el.classList.toggle('active', el.dataset.mode === mode);
  });
  const btn   = document.getElementById('modeToggle');
  const label = document.getElementById('modeLabelBtn');
  if (mode === 'chat') {
    btn.classList.remove('has-mode');
    label.style.display = 'none';
  } else {
    btn.classList.add('has-mode');
    label.textContent  = MODE_LABELS[mode];
    label.style.display = 'inline';
  }
  const bar      = document.getElementById('modeActiveBar');
  const barLabel = document.getElementById('modeActiveName');
  if (mode === 'chat') {
    bar.style.display = 'none';
  } else {
    barLabel.textContent = MODE_LABELS[mode] + ' modu aktif';
    bar.style.display    = 'flex';
  }
  document.getElementById('modeMenu').classList.remove('open');
  btn.classList.remove('open');
  document.getElementById('msgInput').focus();
}
document.addEventListener('click', () => {
  document.getElementById('modeMenu')?.classList.remove('open');
  document.getElementById('modeToggle')?.classList.remove('open');
});
