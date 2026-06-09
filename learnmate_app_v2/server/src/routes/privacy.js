const express = require('express');
const Family = require('../models/Family');
const Task = require('../models/Task');
const Reward = require('../models/Reward');
const Alert = require('../models/Alert');
const Message = require('../models/Message');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// ==========================================
// 1. 帳號一鍵完全刪除 API (DELETE /api/privacy/delete-account)
//    - 需要 JWT 登入憑證驗證
//    - 一鍵抹除該 familyId 關聯的 MongoDB 中所有數據
// ==========================================
router.delete('/api/privacy/delete-account', authMiddleware, async (req, res) => {
  try {
    const familyId = req.family.id;

    // 檢查帳戶是否存在
    const family = await Family.findById(familyId);
    if (!family) {
      return res.status(404).json({ success: false, error: '找不到該家庭帳戶。' });
    }

    // 1. 刪除該家庭關聯的測驗與任務紀錄
    const deletedTasks = await Task.deleteMany({ familyId });

    // 2. 刪除該家庭關聯的點數獎勵清單
    const deletedRewards = await Reward.deleteMany({ familyId });

    // 3. 刪除該家庭關聯的學習預警警示
    const deletedAlerts = await Alert.deleteMany({ familyId });

    // 4. 刪除該家庭關聯的親子留言紀錄
    const deletedMessages = await Message.deleteMany({ familyId });

    // 5. 刪除家庭主帳號紀錄
    await Family.findByIdAndDelete(familyId);

    // 印出稽核記錄
    console.log(`\n======================================================`);
    console.log(`[隱私合規 - 帳號完全刪除作業成功]`);
    console.log(`家庭帳戶 ID: ${familyId}`);
    console.log(`清除任務數: ${deletedTasks.deletedCount}`);
    console.log(`清除獎勵數: ${deletedRewards.deletedCount}`);
    console.log(`清除警示數: ${deletedAlerts.deletedCount}`);
    console.log(`清除留言數: ${deletedMessages.deletedCount}`);
    console.log(`======================================================\n`);

    res.json({
      success: true,
      message: '您的家庭帳戶以及所有相關學員資訊、答題紀錄、點數、獎勵申請與留言歷程已由資料庫完全抹除，無法復原。'
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
