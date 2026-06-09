const express = require('express');
const Family = require('../models/Family');
const Question = require('../models/Question');
const auth = require('../middleware/authMiddleware');

const router = express.Router();

// ==========================================
// 1. 查詢所有家庭帳戶 (GET /api/admin/families)
// ==========================================
router.get('/api/admin/families', async (req, res) => {
  try {
    const families = await Family.find().select('-password');
    res.json({ success: true, count: families.length, families });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 2. 手動更新贈送 Pro 會員 (POST /api/admin/families/update-subscription)
// ==========================================
router.post('/api/admin/families/update-subscription', async (req, res) => {
  try {
    const { familyId, plan, days } = req.body;
    const family = await Family.findById(familyId);
    if (!family) {
      return res.status(404).json({ success: false, error: '找不到該家庭帳戶' });
    }

    const durationMs = (days || 30) * 86400000;
    family.subscription = {
      plan: plan || 'pro',
      status: 'active',
      trial_ends_at: family.subscription.trial_ends_at || new Date(),
      current_period_end: new Date(Date.now() + durationMs),
      revenuecat_id: family.subscription.revenuecat_id || `admin_gift_${familyId}`,
      platform: 'web'
    };

    await family.save();
    console.log(`🎁 [Admin] 成功贈送家庭 ${familyId} 共 ${days || 30} 天 Pro 會員！`);
    res.json({ success: true, subscription: family.subscription });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 3. 手動修改點數點包 (POST /api/admin/families/update-points)
// ==========================================
router.post('/api/admin/families/update-points', async (req, res) => {
  try {
    const { familyId, pointsToAdd } = req.body;
    const family = await Family.findById(familyId);
    if (!family) {
      return res.status(404).json({ success: false, error: '找不到該家庭帳戶' });
    }

    family.points = Math.max(0, family.points + parseInt(pointsToAdd || 0));
    await family.save();
    console.log(`💎 [Admin] 成功手動修改家庭 ${familyId} 的金幣，加減值：${pointsToAdd}，目前總額：${family.points}`);
    res.json({ success: true, points: family.points });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 4. AI 題目品質報錯佇列 (GET /api/admin/questions/reported)
//    - 篩選報錯率 >= 5% 且舉報次數 >= 1 的有問題題目
// ==========================================
router.get('/api/admin/questions/reported', async (req, res) => {
  try {
    // 取得所有有被做過且有被報錯過的題目
    const questions = await Question.find({ reportCount: { $gt: 0 } });
    
    // 計算報錯率並篩選
    const warnedQuestions = questions.filter(q => {
      const rate = q.reportCount / Math.max(1, q.attemptsCount);
      return rate >= 0.05;
    }).map(q => {
      return {
        _id: q._id,
        subject: q.subject,
        grade: q.grade,
        edition: q.edition,
        q: q.q,
        opts: q.opts,
        a: q.a,
        exp: q.exp,
        attemptsCount: q.attemptsCount,
        reportCount: q.reportCount,
        errorRate: Math.round((q.reportCount / Math.max(1, q.attemptsCount)) * 100),
        isBlacklisted: q.isBlacklisted
      };
    });

    // 依報錯率降序排列
    warnedQuestions.sort((a, b) => b.errorRate - a.errorRate);

    res.json({ success: true, count: warnedQuestions.length, questions: warnedQuestions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 5. 移入品質黑名單 (POST /api/admin/questions/blacklist)
// ==========================================
router.post('/api/admin/questions/blacklist', async (req, res) => {
  try {
    const { questionId } = req.body;
    const question = await Question.findByIdAndUpdate(
      questionId,
      { isBlacklisted: true },
      { new: true }
    );
    if (!question) {
      return res.status(404).json({ success: false, error: '找不到該題目' });
    }
    console.log(`⛔ [Admin] 成功將 AI 瑕疵題目一鍵黑名單移入！ID: ${questionId}`);
    res.json({ success: true, question });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 6. 模擬舉報題目 API (POST /api/admin/questions/report)
//    - 模擬學生答題時，覺得題目出得爛，點擊「舉報題目」
// ==========================================
router.post('/api/admin/questions/report', async (req, res) => {
  try {
    const { questionId } = req.body;
    const question = await Question.findById(questionId);
    if (question) {
      question.reportCount += 1;
      question.attemptsCount = Math.max(question.attemptsCount + 1, question.reportCount); // 確保 attemptsCount >= reportCount
      await question.save();
    }
    res.json({ success: true, message: '感謝舉報！題目已納入品管佇列。', question });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
