const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
  // 取得 Authorization 標頭
  const authHeader = req.header('Authorization');
  if (!authHeader) {
    return res.status(401).json({ success: false, error: '未提供認證憑證，拒絕存取。' });
  }

  // 格式必須為 Bearer <token>
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ success: false, error: '憑證格式錯誤，必須為 Bearer 標記。' });
  }

  const token = parts[1];

  try {
    // 驗證 Token（使用環境變數中的 JWT_SECRET）
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'learnmate_secret_jwt_key_2026');
    
    // 將解碼後的資料注入 req.family (包含 familyId, email 等)
    req.family = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: '您的登入憑證已過期，請重新登入。' });
    }
    return res.status(401).json({ success: false, error: '無效的登入憑證。' });
  }
};
