<div align="center">

<img src="https://img.shields.io/badge/version-2.0.0-orange?style=for-the-badge&logo=semver&logoColor=white" />
<img src="https://img.shields.io/badge/node-%3E%3D18-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" />
<img src="https://img.shields.io/badge/playwright-latest-45ba4b?style=for-the-badge&logo=playwright&logoColor=white" />
<img src="https://img.shields.io/badge/license-MIT-blue?style=for-the-badge" />
<img src="https://img.shields.io/badge/cost-FREE-brightgreen?style=for-the-badge" />

<br/><br/>

```
  ██████╗ ███████╗███╗   ███╗██████╗  ██████╗ ████████╗
 ██╔════╝ ██╔════╝████╗ ████║██╔══██╗██╔═══██╗╚══██╔══╝
 ██║  ███╗█████╗  ██╔████╔██║██████╔╝██║   ██║   ██║
 ██║   ██║██╔══╝  ██║╚██╔╝██║██╔══██╗██║   ██║   ██║
 ╚██████╔╝███████╗██║ ╚═╝ ██║██████╔╝╚██████╔╝   ██║
  ╚═════╝ ╚══════╝╚═╝     ╚═╝╚═════╝  ╚═════╝    ╚═╝
                                               API v2.0
```

## 🛸 GemBot — AI Otomasyonu, Bedavaya

### Playwright tabanlı Gemini AI asistan REST API'si
**Ücretsiz · API key gerektirmez · SSE streaming · 6 prompt modu**

> *Özgür yazılım, özgür ruh — tıpkı partizanlar gibi.*
>
> ```
> Bir sabah uyandığımda
> Çav Bella, Çav Bella, Çav Bella Çav Çav Çav
> Bir sabah uyandığımda
> İşgalcileri buldum yanı başımda
> ```

<br/>

[🚀 Kurulum](#-kurulum) · [📖 API Referansı](#-api-referansı) · [💡 Örnekler](#-entegrasyon-örnekleri) · [🔧 Sorun Giderme](#-sorun-giderme)

</div>

---

## 📋 İçindekiler

| # | Bölüm |
|---|-------|
| 1 | [Genel Bakış](#-genel-bakış) |
| 2 | [Nasıl Çalışır](#-nasıl-çalışır) |
| 3 | [Kurulum](#-kurulum) |
| 4 | [İlk Çalıştırma](#-i̇lk-çalıştırma) |
| 5 | [Proje Yapısı](#-proje-yapısı) |
| 6 | [Konfigürasyon](#-konfigürasyon) |
| 7 | [API Referansı](#-api-referansı) |
| 8 | [Prompt Modları](#-prompt-modları) |
| 9 | [Authentication](#-authentication) |
| 10 | [Rate Limiting](#-rate-limiting) |
| 11 | [Hata Kodları](#-hata-kodları) |
| 12 | [Entegrasyon Örnekleri](#-entegrasyon-örnekleri) |
| 13 | [ngrok ile Dışa Açma](#-ngrok-ile-dışa-açma) |
| 14 | [Sorun Giderme](#-sorun-giderme) |

---

## 🌟 Genel Bakış

> **Gemini Bot API**, Google Gemini web arayüzünü **Playwright** aracılığıyla otomasyonla kontrol eden bir REST API sunucusudur. Kendi Chrome profilinizde halihazırda oturum açık olan Gemini hesabını kullanır — herhangi bir ücret veya harici API anahtarı gerektirmez.

<br/>

<table>
<tr>
<td width="50%">

### ✅ Ne Yapar?

- 🤖 Gemini AI ile tam REST API entegrasyonu
- 🌊 SSE ile gerçek zamanlı streaming yanıtlar
- 🧠 6 farklı akıllı prompt modu
- 📊 API key yönetimi ve kullanım istatistikleri
- 📝 Aktivite bağlamı ile zenginleştirilmiş sohbet
- 🔄 Otomatik tarayıcı yeniden bağlanma

</td>
<td width="50%">

### ❌ Ne Yapmaz?

- 💳 Gemini API ücreti ödemez
- 🔑 Harici API anahtarı gerektirmez
- ☁️ Bulut servise bağımlı değil
- 📡 Sadece `localhost` üzerinde çalışır
  _(ngrok ile dışa açılabilir)_

</td>
</tr>
</table>

---

## ⚙️ Nasıl Çalışır?

```
┌─────────────┐     POST /api/chat      ┌──────────────┐
│  İstemci    │ ──────────────────────► │  Express API │
│ (JS/Python/ │                         │  (server.js) │
│  curl vb.)  │ ◄────────────────────── │              │
└─────────────┘    JSON / SSE yanıt     └──────┬───────┘
                                               │
                                    promptBuilder.js
                                    (mod + sistem prompt)
                                               │
                                        ┌──────▼───────┐
                                        │   Playwright  │
                                        │  (Chromium)   │
                                        └──────┬───────┘
                                               │
                                    Gemini web arayüzüne
                                    mesajı yazar, DOM'u
                                    izler, yanıtı alır
                                               │
                                        ┌──────▼───────┐
                                        │ gemini.google │
                                        │     .com      │
                                        └──────────────┘
```

### Akış Adımları

```
1. İstek  →  POST /api/chat  { message, mode }
2. Auth   →  Bearer token doğrulandı
3. Build  →  promptBuilder, mesajı sistem promptu ile birleştirdi
4. Type   →  Playwright, Gemini input kutusuna metni yazdı
5. Watch  →  DOM gözlemleniyor, metin stabilize olana dek bekleniyor
6. Return →  Yanıt JSON olarak döndürüldü
```

---

## 🚀 Kurulum

### Gereksinimler

<table>
<tr>
<td><img src="https://img.shields.io/badge/Node.js-%3E%3D18-339933?style=flat-square&logo=nodedotjs" /></td>
<td>JavaScript runtime</td>
</tr>
<tr>
<td><img src="https://img.shields.io/badge/Google_Chrome-latest-4285F4?style=flat-square&logo=googlechrome&logoColor=white" /></td>
<td>Playwright'ın kontrol edeceği tarayıcı</td>
</tr>
<tr>
<td><img src="https://img.shields.io/badge/Gemini-oturum_açık-8E75B2?style=flat-square&logo=google&logoColor=white" /></td>
<td>Chrome'da aktif Google/Gemini oturumu</td>
</tr>
</table>

### Kurulum Adımları

```bash
# 1 — Repoyu klonla
git clone https://github.com/kullanici/gemini-bot-api.git
cd gemini-bot-api

# 2 — Bağımlılıkları yükle
npm install

# 3 — Playwright tarayıcı motorunu indir
npx playwright install chromium

# 4 — Ortam değişkenlerini yapılandır
cp .env.example .env
```

### `.env` Dosyası

```env
PORT=3000
```

---

## 🏃 İlk Çalıştırma

```bash
node server.js
```

Başarılı başlatma çıktısı:

```
══════════════════════════════════════════════════
  🚀 Gemini Bot API v2.0.0
  🌐 Dashboard : http://127.0.0.1:3000
  📖 API Docs  : http://127.0.0.1:3000/docs
  ❤  Health   : http://127.0.0.1:3000/api/health
══════════════════════════════════════════════════

🔑 İlk API Key oluşturuldu: gmb_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> [!IMPORTANT]
> İlk çalıştırmada otomatik olarak bir **default** API key oluşturulur. Bu key'i not alın — bir daha gösterilmez. `/api/keys` endpoint'inden tekrar alabilirsiniz.

### Tarayıcıyı Başlat

```bash
curl -X POST http://localhost:3000/api/browser/open \
  -H "Authorization: Bearer gmb_xxxxx"
```

Açılan Chrome penceresinde Gemini'ye giriş yapılı olmalıdır. Oturum kapalıysa manuel giriş yapın.

---

## 🗂️ Proje Yapısı

```
gemini-bot-api/
│
├── 📄 server.js                  # Express uygulaması, tüm route'lar
├── 🌐 gemini-browser.js          # Playwright otomasyonu (core)
│
├── 📁 src/
│   ├── config.js                 # Port, dosya yolları, rate limit
│   ├── apikeys.js                # Key oluşturma, doğrulama, listeleme
│   ├── middleware.js             # Auth, rate limiter, kullanım takibi
│   ├── promptBuilder.js          # Sistem promptu + 6 mod talimatı
│   └── stats.js                  # İstatistik kayıt ve özet
│
├── 📁 views/
│   ├── index.ejs                 # Ana dashboard
│   ├── docs.ejs                  # API dokümantasyonu
│   ├── tutorial.ejs              # Kullanım rehberi
│   └── setup.ejs                 # Kurulum sihirbazı
│
├── 📁 public/
│   ├── css/                      # Arayüz stilleri
│   └── js/                       # İstemci JavaScript
│
├── 📁 data/                      # Otomatik oluşturulur ⚡
│   ├── apikeys.json              # Kayıtlı API key'leri
│   ├── stats.json                # Kullanım istatistikleri
│   ├── activities.json           # Aktivite listesi
│   └── selectors.json            # Gemini DOM seçicileri
│
├── .env
└── package.json
```

---

## 🔧 Konfigürasyon

`src/config.js` üzerinden tüm ayarlar yönetilir:

```javascript
module.exports = {
  PORT:               3000,
  CHROME_PROFILE_DIR: path.join(process.env.LOCALAPPDATA, 'Google/Chrome/User Data/GeminiUser'),
  KEY_PREFIX:         'gmb_',
  RATE_LIMIT: {
    windowMs: 60_000,   // 1 dakika
    max:      60,       // dakika başına maksimum istek
  },
  APP_NAME: 'Gemini Bot API',
  VERSION:  '2.0.0',
};
```

### Chrome Profili

Farklı bir Chrome profili kullanmak için `CHROME_PROFILE_DIR` yolunu değiştirin ya da `/setup` sayfasından arayüzle yapılandırın:

```javascript
// Windows
CHROME_PROFILE_DIR: 'C:\\Users\\KULLANICI\\AppData\\Local\\Google\\Chrome\\User Data\\ProfilAdı'

// macOS
CHROME_PROFILE_DIR: '/Users/KULLANICI/Library/Application Support/Google/Chrome/ProfilAdı'
```

### Seçici Özelleştirme

Gemini DOM yapısı değişirse `data/selectors.json` dosyasını güncelleyin:

```json
{
  "input":       "div[contenteditable='true']",
  "response":    ".message-content",
  "sendButton":  "button[aria-label*='Gönder']",
  "modelSelector": "[data-test-id='model-selector']",
  "chatList":    "a[data-test-id='conversation']"
}
```

---

## 📖 API Referansı

<div align="center">

| 🔗 Base URL | 📦 Format | 🔐 Auth | ⚡ Streaming | 🚦 Rate Limit |
|:-----------:|:---------:|:-------:|:-----------:|:-------------:|
| `http://localhost:3000` | JSON | Bearer Token | SSE | 60 req/dk |

</div>

<br/>

> **Yanıt Formatı**
>
> ```json
> // ✅ Başarılı
> { "success": true, ...veri }
>
> // ❌ Hatalı
> { "success": false, "error": "Hata mesajı" }
> ```

---

### 🟢 `GET` /api/health

> Sunucu ve tarayıcı durumunu döndürür. **Authentication gerektirmez.**

```bash
curl http://localhost:3000/api/health
```

<details>
<summary>📤 Yanıt örneği</summary>

```json
{
  "success": true,
  "status": "ok",
  "app": "Gemini Bot API",
  "version": "2.0.0",
  "browser": {
    "open": true,
    "ready": true
  },
  "timestamp": "2026-03-15T10:00:00.000Z"
}
```
</details>

---

### 🟠 `POST` /api/chat

> Gemini'ye mesaj gönderir, yanıt tamamlandığında döndürür.

**Headers**

```http
Authorization: Bearer gmb_xxxxx
Content-Type: application/json
```

**Request Body**

| Alan | Tip | Zorunlu | Açıklama |
|------|-----|:-------:|----------|
| `message` | `string` | ✅ | Kullanıcı mesajı |
| `mode` | `string` | ➖ | Prompt modu. Varsayılan: `chat` |
| `activityIds` | `string[]` | ➖ | Bağlam için aktivite ID listesi |

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Authorization: Bearer gmb_xxxxx" \
  -H "Content-Type: application/json" \
  -d '{"message": "React hooks nedir?", "mode": "chat"}'
```

<details>
<summary>📤 Yanıt örneği</summary>

```json
{
  "success": true,
  "response": "React Hooks, fonksiyonel bileşenlerde state ve lifecycle...",
  "responseTime": 4231
}
```
</details>

---

### 🟠 `POST` /api/chat/stream

> Gemini yanıt yazarken her parçayı **Server-Sent Events (SSE)** ile gerçek zamanlı iletir.

**SSE Event Formatı**

```
data: {"text": "Yanıt parçası..."}      ← Her chunk
data: {"text": "Devamı..."}
data: {"done": true, "text": "..."}    ← Tamamlandı
data: {"error": "Hata mesajı"}         ← Hata
```

<details>
<summary>💻 JavaScript ile streaming örneği</summary>

```javascript
async function streamChat(message, onChunk, onDone) {
  const res = await fetch('http://localhost:3000/api/chat/stream', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer gmb_xxxxx',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ message, mode: 'chat' })
  });

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let   buffer  = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop();

    for (const part of parts) {
      if (!part.startsWith('data: ')) continue;
      const payload = JSON.parse(part.slice(6));

      if (payload.done)  onDone(payload.text);
      if (payload.text && !payload.done) onChunk(payload.text);
      if (payload.error) console.error(payload.error);
    }
  }
}

// Kullanım
let fullText = '';
await streamChat(
  'Bana bir proje planı yaz',
  chunk  => { fullText += chunk; outputEl.textContent = fullText; },
  result => console.log('✅ Tamamlandı')
);
```
</details>

---

### 🟠 `POST` /api/chat/new

> Tarayıcıda yeni sohbet başlatır, Gemini bağlamını sıfırlar.

```bash
curl -X POST http://localhost:3000/api/chat/new \
  -H "Authorization: Bearer gmb_xxxxx"
```

```json
{ "success": true, "message": "Yeni sohbet başlatıldı." }
```

---

### 🟢 `GET` /api/chat/history

> Gemini'deki mevcut sohbet listesini döndürür.

```bash
curl http://localhost:3000/api/chat/history \
  -H "Authorization: Bearer gmb_xxxxx"
```

<details>
<summary>📤 Yanıt örneği</summary>

```json
{
  "success": true,
  "chats": [
    {
      "id": 0,
      "chatId": "8911453ce98062c6",
      "href": "/app/8911453ce98062c6",
      "title": "React dashboard tasarımı",
      "active": true
    },
    {
      "id": 1,
      "chatId": "a3b2c1d0e9f87654",
      "href": "/app/a3b2c1d0e9f87654",
      "title": "Python hata ayıklama",
      "active": false
    }
  ]
}
```
</details>

---

### 🟠 `POST` /api/chat/switch

> Geçmişteki bir sohbete geçiş yapar.

| Alan | Tip | Zorunlu | Açıklama |
|------|-----|:-------:|----------|
| `index` | `number` | ✅ | `/api/chat/history` yanıtındaki `id` değeri |

```bash
curl -X POST http://localhost:3000/api/chat/switch \
  -H "Authorization: Bearer gmb_xxxxx" \
  -H "Content-Type: application/json" \
  -d '{"index": 1}'
```

---

### 🟢 `GET` /api/chat/messages

> Belirli bir sohbetin tüm mesajlarını döndürür.

```
GET /api/chat/messages?href=/app/CHAT_ID
```

| Query Param | Zorunlu | Açıklama |
|-------------|:-------:|----------|
| `href` | ✅ | `/api/chat/history` yanıtından alınan sohbet href'i |

```bash
curl "http://localhost:3000/api/chat/messages?href=/app/8911453ce98062c6" \
  -H "Authorization: Bearer gmb_xxxxx"
```

<details>
<summary>📤 Yanıt örneği</summary>

```json
{
  "success": true,
  "messages": [
    { "role": "user", "text": "React hooks nedir?" },
    { "role": "bot",  "text": "React Hooks, fonksiyonel bileşenlerde..." }
  ]
}
```
</details>

---

### 🟠 `POST` /api/chat/model

> Aktif Gemini modelini değiştirir.

| `model` | Açıklama |
|---------|----------|
| `flash` | Hızlı yanıtlar, günlük kullanım |
| `pro` | En güçlü model, karmaşık görevler |
| `thinking` | Adım adım mantıksal çıkarım |

```bash
curl -X POST http://localhost:3000/api/chat/model \
  -H "Authorization: Bearer gmb_xxxxx" \
  -H "Content-Type: application/json" \
  -d '{"model": "pro"}'
```

---

### 🔑 API Keys

#### `GET` /api/keys — Listelemek (Public)

```bash
curl http://localhost:3000/api/keys
```

<details>
<summary>📤 Yanıt örneği</summary>

```json
{
  "success": true,
  "keys": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "label": "default",
      "key": "gmb_****...****ab12",
      "keyFull": "gmb_abcdef1234567890abcdef1234567890",
      "totalRequests": 42,
      "createdAt": "2026-03-15T10:00:00.000Z",
      "lastUsed": "2026-03-15T14:30:00.000Z"
    }
  ]
}
```
</details>

#### `POST` /api/keys — Oluştur (Public)

```bash
curl -X POST http://localhost:3000/api/keys \
  -H "Content-Type: application/json" \
  -d '{"label": "production"}'
```

```json
{
  "success": true,
  "key": {
    "id": "550e8400-...",
    "key": "gmb_abcdef1234567890abcdef1234567890",
    "label": "production",
    "createdAt": "2026-03-15T10:00:00.000Z",
    "totalRequests": 0
  }
}
```

#### `DELETE` /api/keys/:id — Sil (Public)

```bash
curl -X DELETE http://localhost:3000/api/keys/550e8400-e29b-41d4-a716-446655440000
```

---

### 📊 `GET` /api/stats

> Tüm API key'lerinin toplu kullanım istatistikleri.

```bash
curl http://localhost:3000/api/stats \
  -H "Authorization: Bearer gmb_xxxxx"
```

<details>
<summary>📤 Yanıt örneği</summary>

```json
{
  "success": true,
  "stats": {
    "total": 124,
    "success": 119,
    "errors": 5,
    "successRate": 95,
    "avgResponseTime": 4231,
    "minResponseTime": 1200,
    "maxResponseTime": 18400,
    "last24h": 42,
    "last7d": 98,
    "lastHour": 7,
    "messages": 98,
    "peakHour": "14:00",
    "topEndpoints": [
      { "endpoint": "/api/chat", "count": 87 },
      { "endpoint": "/api/activities", "count": 22 }
    ],
    "byKey": {
      "default": { "total": 80, "success": 77, "errors": 3, "avgRt": 4100 }
    },
    "recent": [...]
  }
}
```
</details>

---

### 📋 Aktiviteler

#### `GET` /api/activities

```bash
curl http://localhost:3000/api/activities \
  -H "Authorization: Bearer gmb_xxxxx"
```

#### `POST` /api/activities

| Alan | Tip | Zorunlu | Değerler |
|------|-----|:-------:|----------|
| `content` | `string` | ✅ | Aktivite içeriği |
| `category` | `string` | ➖ | `görev` · `not` · `fikir` · `hata` · `gelişme` |

```bash
curl -X POST http://localhost:3000/api/activities \
  -H "Authorization: Bearer gmb_xxxxx" \
  -H "Content-Type: application/json" \
  -d '{"content": "Login sayfasında CSS hatası var", "category": "hata"}'
```

#### `DELETE` /api/activities/:id

```bash
curl -X DELETE http://localhost:3000/api/activities/UUID \
  -H "Authorization: Bearer gmb_xxxxx"
```

---

### 🌐 Tarayıcı Kontrolü

#### `POST` /api/browser/open

```bash
curl -X POST http://localhost:3000/api/browser/open \
  -H "Authorization: Bearer gmb_xxxxx"
```

#### `POST` /api/browser/reset

```bash
curl -X POST http://localhost:3000/api/browser/reset \
  -H "Authorization: Bearer gmb_xxxxx"
```

---

## 🧠 Prompt Modları

`mode` parametresi Gemini'ye gönderilen sistem promptunu değiştirir.

| Mod | Emoji | Kullanım Amacı | Çıktı Formatı |
|-----|:-----:|----------------|---------------|
| `chat` | 💬 | Genel sohbet, günlük sorular | Serbest metin |
| `analyze` | 🔍 | Derin analiz, SWOT, karar verme | Başlıklı bölümler + tablo |
| `plan` | 🗺️ | Proje ve aksiyon planlaması | Numaralı adımlar + risk tablosu |
| `summarize` | 📋 | Uzun içerikleri özetleme | Maks. 5 madde, 200 kelime |
| `code` | 💻 | Kod yazma ve inceleme | Kod bloğu + açıklamalar |
| `debug` | 🐛 | Hata ayıklama | Neden → Teşhis → Çözüm |

### Aktivite Bağlamı ile Analiz

`message` boş bırakılıp `activityIds` + `mode: "analyze"` gönderilirse aktivite listesini otomatik analiz eder:

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Authorization: Bearer gmb_xxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "activityIds": ["uuid-1", "uuid-2", "uuid-3"],
    "mode": "analyze"
  }'
```

---

## 🔐 Authentication

Korumalı endpoint'lere erişmek için her istekte geçerli bir API key gönderilmelidir.

### Yöntemler (Öncelik Sırasıyla)

```http
# 1️⃣ Authorization header — ÖNERİLEN
Authorization: Bearer gmb_xxxxx

# 2️⃣ x-api-key header — Alternatif
x-api-key: gmb_xxxxx

# 3️⃣ Query parametresi — SADECE TEST
GET /api/stats?api_key=gmb_xxxxx
```

### Public Endpoint'ler

Authentication **gerektirmeyen** endpoint'ler:

```
✅ GET  /api/health
✅ GET  /api/keys
✅ POST /api/keys
✅ DEL  /api/keys/:id
```

---

## 🚦 Rate Limiting

Tüm `/api/*` route'ları için IP başına aşağıdaki sınır uygulanır:

```
┌──────────────────────────────────────────────────┐
│  60 istek / dakika · IP başına · Tüm /api/* path  │
└──────────────────────────────────────────────────┘
```

Limit aşılınca:

```json
// 429 Too Many Requests
{
  "success": false,
  "error": "Çok fazla istek. Limit: 60 istek/dakika."
}
```

Response header'larında kalan limit:

```http
RateLimit-Limit: 60
RateLimit-Remaining: 42
RateLimit-Reset: 1710496800
```

Limiti `src/config.js`'den değiştirin:

```javascript
RATE_LIMIT: {
  windowMs: 60_000,  // 1 dakika
  max:      120,     // dakika başına 120 isteğe çıkar
}
```

---

## ❗ Hata Kodları

| Kod | Durum | Açıklama | Çözüm |
|:---:|-------|----------|-------|
| `200` | ✅ OK | Başarılı | — |
| `400` | ⚠️ Bad Request | Eksik veya geçersiz parametre | Request body'yi kontrol et |
| `401` | 🔒 Unauthorized | API key gönderilmedi | `Authorization` header ekle |
| `403` | 🚫 Forbidden | Geçersiz API key | `/api/keys` ile yeni key oluştur |
| `404` | 🔍 Not Found | Kaynak bulunamadı | Endpoint adresini kontrol et |
| `429` | 🚦 Too Many Requests | Rate limit aşıldı | 1 dakika bekle |
| `500` | 💥 Server Error | Sunucu hatası | Tarayıcı durumunu kontrol et |

---

## 💡 Entegrasyon Örnekleri

### Vanilla JavaScript — Basit

```html
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>Gemini Chat</title>
  <style>
    body { font-family: sans-serif; max-width: 600px; margin: 40px auto; padding: 0 16px; }
    textarea { width: 100%; height: 80px; margin-bottom: 8px; padding: 10px; }
    button { padding: 10px 24px; background: #e8650a; color: white; border: none; border-radius: 8px; cursor: pointer; }
    #answer { margin-top: 20px; white-space: pre-wrap; line-height: 1.7; }
  </style>
</head>
<body>
  <h2>Gemini Bot</h2>
  <textarea id="question" placeholder="Sorunuzu yazın…"></textarea>
  <button onclick="ask()">Gönder</button>
  <div id="answer"></div>

  <script>
    const API_BASE = 'http://localhost:3000';
    const API_KEY  = 'gmb_ANAHTARINIZ';

    async function ask() {
      const message = document.getElementById('question').value.trim();
      if (!message) return;

      const answerEl = document.getElementById('answer');
      answerEl.textContent = '⏳ Yanıt bekleniyor…';

      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message, mode: 'chat' })
      });

      const data = await res.json();
      answerEl.textContent = data.success ? data.response : '❌ Hata: ' + data.error;
    }
  </script>
</body>
</html>
```

---

### Node.js

```javascript
const API_BASE = 'http://localhost:3000';
const API_KEY  = 'gmb_ANAHTARINIZ';

async function chat(message, mode = 'chat') {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ message, mode })
  });

  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.response;
}

// Kullanım örnekleri
const genel   = await chat('React nedir?');
const kod     = await chat('Debounce fonksiyonu yaz', 'code');
const plan    = await chat('Mobil uygulama için plan yap', 'plan');
const analiz  = await chat('Bu kodu analiz et: ...', 'analyze');
```

---

### Python

```python
import httpx

API_BASE = "http://localhost:3000"
API_KEY  = "gmb_ANAHTARINIZ"

def chat(message: str, mode: str = "chat") -> str:
    """Gemini Bot API'ye istek gönderir."""
    response = httpx.post(
        f"{API_BASE}/api/chat",
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json"
        },
        json={"message": message, "mode": mode},
        timeout=60.0
    )
    data = response.json()
    if not data["success"]:
        raise ValueError(data["error"])
    return data["response"]


# Kullanım
print(chat("Python async/await açıkla", "code"))
print(chat("Bu haftanın planını yap", "plan"))
```

---

### React — Streaming Hook

```javascript
// hooks/useGeminiStream.js
import { useState, useCallback } from 'react';

const API_BASE = 'http://localhost:3000';
const API_KEY  = 'gmb_ANAHTARINIZ';

export function useGeminiStream() {
  const [response, setResponse] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  const send = useCallback(async (message, mode = 'chat') => {
    setLoading(true);
    setResponse('');
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/chat/stream`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message, mode })
      });

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop();

        for (const part of parts) {
          if (!part.startsWith('data: ')) continue;
          const p = JSON.parse(part.slice(6));

          if (p.error) { setError(p.error); return; }
          if (p.text && !p.done) setResponse(r => r + p.text);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { response, loading, error, send };
}
```

```jsx
// ChatComponent.jsx
import { useGeminiStream } from './hooks/useGeminiStream';

export default function Chat() {
  const { response, loading, error, send } = useGeminiStream();
  const [input, setInput] = useState('');

  return (
    <div>
      <textarea value={input} onChange={e => setInput(e.target.value)} />
      <button onClick={() => send(input, 'chat')} disabled={loading}>
        {loading ? '⏳ Bekleniyor…' : '🚀 Gönder'}
      </button>
      {error    && <p style={{color: 'red'}}>❌ {error}</p>}
      {response && <pre>{response}</pre>}
    </div>
  );
}
```

---

## 🌍 ngrok ile Dışa Açma

Sunucuyu başka cihazlardan veya internet üzerinden erişilebilir yapmak için:

```bash
# 1 — ngrok'u yükle
npm install -g ngrok

# 2 — ngrok hesabı varsa auth token ekle (opsiyonel ama önerilir)
ngrok config add-authtoken TOKEN_BURAYA

# 3 — Tüneli başlat
ngrok http 3000
```

Çıktı:

```
Session Status     online
Forwarding         https://xxxx-xx-xx-xxx-xx.ngrok-free.app -> http://localhost:3000

Connections        ttl=0  opn=0  rt1=0.00  rt5=0.00  p50=0.00  p90=0.00
```

Bu adresi API_BASE olarak kullanın:

```javascript
const API_BASE = 'https://xxxx-xx-xx-xxx-xx.ngrok-free.app';
```

> [!NOTE]
> ngrok ücretsiz planda her başlatmada URL değişir. Kalıcı URL için [ngrok Pro](https://ngrok.com/pricing) hesabı açın.

### CORS Ayarı (Farklı Domain'den Erişim)

Farklı bir origin'den istek yapıyorsanız `server.js`'e CORS ekleyin:

```bash
npm install cors
```

```javascript
// server.js — en üste ekle
const cors = require('cors');

app.use(cors({
  origin: [
    'https://siteniz.com',
    'http://localhost:5173',  // Vite dev server
    'http://localhost:3001',  // CRA dev server
  ],
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Authorization', 'Content-Type', 'x-api-key']
}));
```

---

## 🔧 Sorun Giderme

### 🔴 Tarayıcı açılmıyor

```
Error: Browser closed unexpectedly
Error: Target page, context or browser has been closed
```

**Neden:** Chrome'un başka bir örneği aynı profili kullanıyor.

**Çözüm:**

```bash
# 1 — Tüm Chrome pencerelerini kapat
# 2 — Tarayıcıyı sıfırla
curl -X POST http://localhost:3000/api/browser/reset \
  -H "Authorization: Bearer gmb_xxxxx"

# 3 — Yeniden aç
curl -X POST http://localhost:3000/api/browser/open \
  -H "Authorization: Bearer gmb_xxxxx"
```

---

### 🟡 Boş yanıt geliyor

**Neden:** Gemini DOM yapısı değişmiş, seçiciler eski.

**Çözüm:** Chrome DevTools ile Gemini'yi açın, input elementini inceleyin ve `data/selectors.json`'ı güncelleyin:

```json
{
  "input":    "div[contenteditable='true']",
  "response": ".response-container-content",
  "sendButton": "button[aria-label*='Send']"
}
```

---

### 🔴 403 Forbidden

**Neden:** API key silinmiş veya geçersiz.

**Çözüm:**

```bash
# Mevcut key'leri listele
curl http://localhost:3000/api/keys

# Yeni key oluştur
curl -X POST http://localhost:3000/api/keys \
  -H "Content-Type: application/json" \
  -d '{"label": "yeni"}'
```

---

### 🟡 Yanıt çok geç geliyor

**Neden:** `maxWait` bekleme süresi yetersiz.

**Çözüm:** `gemini-browser.js` içinde `maxWait` değerini artırın:

```javascript
const maxWait = 180; // 90'dan 180 saniyeye çıkar
```

---

### 🔴 CORS hatası

**Neden:** Farklı bir origin'den istek yapılıyor.

**Çözüm:** Yukarıdaki [CORS Ayarı](#cors-ayarı-farklı-domainden-erişim) bölümüne bakın.

---

### 🟡 `data` dizini yok hatası

**Neden:** Sunucu ilk kez çalıştırılıyor, `data/` dizini oluşturulmamış.

**Çözüm:** `server.js` otomatik oluşturur. Yine de hata alırsanız:

```bash
mkdir -p data
node server.js
```

---

## 📄 Lisans

```
MIT License

Copyright (c) 2026

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software.
```

---

<div align="center">

**Gemini Bot API v2.0.0**

Playwright · Express · Node.js

</div>