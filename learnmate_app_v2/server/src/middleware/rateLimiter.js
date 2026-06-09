const rateLimit = require('express-rate-limit');

// 建立 API 限流中介軟體
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 分鐘計算視窗
  max: 60, // 限制單一 IP 在該視窗內最多 60 次請求
  message: {
    success: false,
    error: '您發送的請求過於頻繁，為了保護服務品質，請稍候一分鐘再試。'
  },
  standardHeaders: true, // 回傳 RateLimit-* 系列標頭資訊
  legacyHeaders: false, // 禁用 X-RateLimit-* 舊版標頭
});

module.exports = { apiLimiter };
