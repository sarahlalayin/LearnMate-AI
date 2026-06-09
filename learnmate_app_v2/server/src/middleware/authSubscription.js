const Family = require('../models/Family');

module.exports = async function(req, res, next) {
  // 1. 本地開發與零成本測試模擬 (MOCK_SUBSCRIPTION)
  if (process.env.MOCK_SUBSCRIPTION === 'true') {
    console.log('🛡️ [Subscription Bypass] 偵測到 MOCK_SUBSCRIPTION 開啟，已自動解鎖 Pro 專屬功能。');
    return next();
  }

  try {
    if (!req.family || !req.family.familyId) {
      return res.status(401).json({ success: false, error: '未認證帳戶，無法進行訂閱校驗。' });
    }

    // 2. 從資料庫中讀取最新的訂閱狀態
    const family = await Family.findById(req.family.familyId);
    if (!family) {
      return res.status(404).json({ success: false, error: '找不到該家庭帳戶。' });
    }

    // 3. 校驗訂閱是否為 active 或 pro
    const isPro = family.subscription && (
      family.subscription.status === 'active' || 
      family.subscription.status === 'trial' || 
      family.subscription.plan === 'pro' || 
      family.subscription.plan === 'team'
    );

    if (isPro) {
      return next();
    }

    // 4. 未訂閱，攔截並提示升級付費牆
    return res.status(403).json({ 
      success: false, 
      error: 'upgrade_required', 
      message: '此功能為 Pro 會員專屬自律與 AI 客製化模組。請升級解鎖无限生題與習慣養成！' 
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: '付費牆中介軟體驗證出錯: ' + error.message });
  }
};
