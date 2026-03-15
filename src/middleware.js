const rateLimit = require('express-rate-limit');
const { validateKey } = require('./apikeys');
const { record } = require('./stats');
const logger = require('./logger'); // Added this line
const { RATE_LIMIT } = require('./config');

function requireApiKey(req, res, next) {
  const authHeader = req.headers['authorization'];
  const rawKey = (
    (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null) ||
    req.headers['x-api-key'] ||
    req.query.api_key ||
    ''
  ).trim();

  if (!rawKey) {
    return res.status(401).json({
      success: false,
      error: 'API key gerekli',
      hint: 'Authorization: Bearer <key> veya x-api-key header\'ı gönderin',
    });
  }

  const keyInfo = validateKey(rawKey);
  if (!keyInfo) {
    logger.warn(`Yetkisiz erişim denemesi: ${rawKey?.substring(0, 8)}...`); // Added logger.warn and corrected variable to rawKey
    return res.status(401).json({ success: false, error: 'Geçersiz API anahtarı' }); // Changed status to 401 and updated error message
  }

  req.apiKey = keyInfo;
  next();
}

function trackUsage(req, res, next) {
  const start = Date.now();
  const originalJson = res.json.bind(res);

  res.json = function (data) {
    record({
      apiKeyId:    req.apiKey?.id,
      apiKeyLabel: req.apiKey?.label,
      endpoint:    req.path,
      method:      req.method,
      responseTime: Date.now() - start,
      status:      res.statusCode,
      error:       data?.error ?? null,
    });
    return originalJson(data);
  };

  next();
}

const rateLimiter = rateLimit({
  windowMs:       RATE_LIMIT.windowMs,
  max:            RATE_LIMIT.max,
  standardHeaders: true,
  legacyHeaders:  false,
  message: {
    success: false,
    error: `Çok fazla istek. Limit: ${RATE_LIMIT.max} istek/dakika.`,
  },
});

module.exports = { requireApiKey, trackUsage, rateLimiter };