const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const crypto = require('crypto');
const Family = require('../models/Family');
const Task = require('../models/Task');
const Reward = require('../models/Reward');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'learnmate_secret_jwt_key_2026';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'learnmate_refresh_jwt_key_2026';

// 輔助函式：簽發 Access Token (2 小時效期)
function generateAccessToken(family) {
  return jwt.sign(
    { id: family._id, email: family.email, plan: family.subscription?.plan || 'free' },
    JWT_SECRET,
    { expiresIn: '2h' }
  );
}

// 輔助函式：簽發 Refresh Token (7 天效期)
function generateRefreshToken(family) {
  return jwt.sign(
    { id: family._id },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
}

// 輔助函式：隨機生成唯一 FamilyCode（相容 MVP 原本功能）
async function generateUniqueFamilyCode() {
  let isUnique = false;
  let code = '';
  while (!isUnique) {
    code = 'FM' + Math.floor(100000 + Math.random() * 900000); // e.g. FM123456
    const existing = await Family.findOne({ familyCode: code });
    if (!existing) {
      isUnique = true;
    }
  }
  return code;
}

// Zod 參數驗證綱要
const registerSchema = z.object({
  email: z.string().email({ message: '請輸入有效的 Email 地址' }),
  password: z.string().min(6, { message: '密碼長度必須至少為 6 個字元' }),
  childName: z.string().min(1, { message: '請輸入學員姓名' }),
  grade: z.string().default('5')
});

const loginSchema = z.object({
  email: z.string().email({ message: '請輸入有效的 Email 地址' }),
  password: z.string().min(1, { message: '請輸入密碼' })
});

const verifySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6, { message: '驗證碼必須為 6 位數' })
});

const oauthSchema = z.object({
  oauthId: z.string().min(1),
  provider: z.enum(['apple', 'google']),
  email: z.string().email().optional(),
  childName: z.string().optional()
});

// ==========================================
// 1. 會員註冊 (Email + Password) - 家長防護 OTP 觸發
// ==========================================
router.post('/api/auth/register', async (req, res) => {
  try {
    const result = registerSchema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map(err => err.message).join('; ');
      return res.status(400).json({ success: false, error: errors });
    }

    const { email, password, childName, grade } = result.data;

    // 檢查信箱是否重複
    const existingEmail = await Family.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ success: false, error: '此 Email 已被註冊' });
    }

    // 生成隨機驗證碼 (6位數字)
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 分鐘後過期

    // 加密密碼 (bcryptjs Rounds = 12)
    const hashedPassword = await bcrypt.hash(password, 12);

    // 建立隨機相容的 familyCode
    const familyCode = await generateUniqueFamilyCode();

    // 建立資料庫紀錄
    const family = new Family({
      email,
      password: hashedPassword,
      familyCode,
      childName,
      parentVerified: false,
      parentVerificationCode: verificationCode,
      parentVerificationExpires: verificationExpires,
      profile: {
        grade,
        editions: { '數學': '康軒版', '國語': '南一版', '英語': '康軒版', '社會': '翰林版', '自然': '翰林版' }
      },
      points: 0,
      streak: 0,
      subscription: {
        plan: 'free',
        status: 'trial', // 註冊即送 14 天 Pro 試用
        trial_ends_at: new Date(Date.now() + 14 * 24 * 3600000), 
        current_period_end: new Date(Date.now() + 14 * 24 * 3600000)
      }
    });

    await family.save();

    // ── 初始化預設每日任務與獎勵 ────────────────
    await Task.insertMany([
      { familyId: family._id, subject: '國語', topic: 'L5 詞語複習', type: 'daily', totalQuestions: 5 },
      { familyId: family._id, subject: '數學', topic: '第一~六單元總複習', type: 'daily', totalQuestions: 5 },
      { familyId: family._id, subject: '英語', topic: '現在進行式', type: 'daily', totalQuestions: 5 },
      { familyId: family._id, subject: '自然', topic: '植物的構造', type: 'daily', totalQuestions: 5 },
      { familyId: family._id, subject: '社會', topic: '台灣地理', type: 'daily', totalQuestions: 5 }
    ]);
    await Reward.insertMany([
      { familyId: family._id, name: '玩 Switch 30分鐘', cost: 100, proposedBy: 'parent', icon: '🎮' },
      { familyId: family._id, name: '看卡通一集', cost: 50, proposedBy: 'parent', icon: '📺' },
      { familyId: family._id, name: '週末去公園', cost: 300, proposedBy: 'parent', icon: '⚽' }
    ]);

    // 零成本本地發信模擬日誌
    console.log(`\n======================================================`);
    console.log(`[家長防護欄 - Parental Gate 模擬發信]`);
    console.log(`收件人信箱: ${email}`);
    console.log(`主旨: 驗證您在 LearnMate AI 的家長身份`);
    console.log(`驗證代碼: ${verificationCode} (15分鐘效期)`);
    console.log(`======================================================\n`);

    // 簽發 Token
    const accessToken = generateAccessToken(family);
    const refreshToken = generateRefreshToken(family);

    res.status(201).json({
      success: true,
      message: '註冊成功，請輸入家長信箱收到的 6 位數驗證碼。',
      accessToken,
      refreshToken,
      family: {
        id: family._id,
        email: family.email,
        childName: family.childName,
        parentVerified: family.parentVerified,
        // 開發環境下，回應中附帶 mock 碼方便測試
        mockVerificationCode: process.env.NODE_ENV !== 'production' ? verificationCode : undefined
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 2. 驗證家長身份 (OTP 驗證)
// ==========================================
router.post('/api/auth/verify-parent', async (req, res) => {
  try {
    const result = verifySchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ success: false, error: '驗證碼格式不正確，必須為 6 位數' });
    }

    const { email, code } = result.data;
    const family = await Family.findOne({ email });

    if (!family) {
      return res.status(404).json({ success: false, error: '找不到此帳戶' });
    }

    if (family.parentVerified) {
      return res.json({ success: true, message: '此帳戶已完成家長認證' });
    }

    // 檢查代碼
    if (family.parentVerificationCode !== code) {
      return res.status(400).json({ success: false, error: '驗證碼不正確' });
    }

    // 檢查過期
    if (new Date() > family.parentVerificationExpires) {
      return res.status(400).json({ success: false, error: '驗證碼已過期，請重新發送' });
    }

    // 通過驗證
    family.parentVerified = true;
    family.parentVerificationCode = null;
    family.parentVerificationExpires = null;
    await family.save();

    res.json({
      success: true,
      message: '家長身份驗證完成！帳戶已完全啟用。',
      family: {
        id: family._id,
        email: family.email,
        childName: family.childName,
        parentVerified: true
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 2b. 重新發送驗證碼
// ==========================================
router.post('/api/auth/resend-code', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: '請提供帳戶 Email' });

    const family = await Family.findOne({ email });
    if (!family) return res.status(404).json({ success: false, error: '找不到此帳戶' });

    if (family.parentVerified) {
      return res.status(400).json({ success: false, error: '此帳戶已完成驗證，無需重新發送' });
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    family.parentVerificationCode = verificationCode;
    family.parentVerificationExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 分鐘
    await family.save();

    console.log(`\n======================================================`);
    console.log(`[家長防護欄 - 重新發送模擬發信]`);
    console.log(`收件人信箱: ${email}`);
    console.log(`新驗證碼: ${verificationCode}`);
    console.log(`======================================================\n`);

    res.json({
      success: true,
      message: '新驗證碼已發送至您的信箱。',
      mockVerificationCode: process.env.NODE_ENV !== 'production' ? verificationCode : undefined
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 3. 信箱密碼登入
// ==========================================
router.post('/api/auth/login-email', async (req, res) => {
  try {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ success: false, error: '請完整填寫信箱與密碼' });
    }

    const { email, password } = result.data;
    const family = await Family.findOne({ email });

    if (!family || !family.password) {
      return res.status(401).json({ success: false, error: '帳號或密碼輸入錯誤' });
    }

    // 比對雜湊密碼
    const isMatch = await bcrypt.compare(password, family.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: '帳號或密碼輸入錯誤' });
    }

    // 簽發 JWT 雙憑證
    const accessToken = generateAccessToken(family);
    const refreshToken = generateRefreshToken(family);

    res.json({
      success: true,
      accessToken,
      refreshToken,
      family: {
        id: family._id,
        email: family.email,
        childName: family.childName,
        parentVerified: family.parentVerified,
        points: family.points,
        streak: family.streak,
        profile: family.profile,
        subscription: family.subscription
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 4. 第三方登入 SSO (Apple / Google) MOCK
// ==========================================
router.post('/api/auth/sso', async (req, res) => {
  try {
    const result = oauthSchema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map(err => err.message).join('; ');
      return res.status(400).json({ success: false, error: errors });
    }

    const { oauthId, provider, email, childName } = result.data;
    let family = null;

    if (provider === 'apple') {
      family = await Family.findOne({ appleId: oauthId });
    } else if (provider === 'google') {
      family = await Family.findOne({ googleId: oauthId });
    }

    if (!family && email) {
      // 嘗試綁定已存在的信箱帳戶
      family = await Family.findOne({ email });
      if (family) {
        if (provider === 'apple') family.appleId = oauthId;
        else family.googleId = oauthId;
        family.parentVerified = true; // 經由第三方授權視為通過家長審查
        await family.save();
      }
    }

    // 若為全新第三方帳號，則自動註冊 (自動通過 Parental Gate)
    if (!family) {
      const familyCode = await generateUniqueFamilyCode();
      const newFamilyData = {
        familyCode,
        childName: childName || '小明',
        parentVerified: true, // SSO 自帶家長安全認證
        profile: {
          grade: '5',
          editions: { '數學': '康軒版', '國語': '南一版', '英語': '康軒版', '社會': '翰林版', '自然': '翰林版' }
        },
        points: 0,
        streak: 0,
        subscription: {
          plan: 'free',
          status: 'trial',
          trial_ends_at: new Date(Date.now() + 14 * 24 * 3600000),
          current_period_end: new Date(Date.now() + 14 * 24 * 3600000)
        }
      };

      if (email) newFamilyData.email = email;
      if (provider === 'apple') newFamilyData.appleId = oauthId;
      else if (provider === 'google') newFamilyData.googleId = oauthId;

      family = new Family(newFamilyData);
      await family.save();

      // 初始化任務與獎勵
      await Task.insertMany([
        { familyId: family._id, subject: '國語', topic: 'L5 詞語複習', type: 'daily', totalQuestions: 5 },
        { familyId: family._id, subject: '數學', topic: '第一~六單元總複習', type: 'daily', totalQuestions: 5 },
        { familyId: family._id, subject: '英語', topic: '現在進行式', type: 'daily', totalQuestions: 5 },
        { familyId: family._id, subject: '自然', topic: '植物的構造', type: 'daily', totalQuestions: 5 },
        { familyId: family._id, subject: '社會', topic: '台灣地理', type: 'daily', totalQuestions: 5 }
      ]);
      await Reward.insertMany([
        { familyId: family._id, name: '玩 Switch 30分鐘', cost: 100, proposedBy: 'parent', icon: '🎮' },
        { familyId: family._id, name: '看卡通一集', cost: 50, proposedBy: 'parent', icon: '📺' },
        { familyId: family._id, name: '週末去公園', cost: 300, proposedBy: 'parent', icon: '⚽' }
      ]);
    }

    // 簽發憑證
    const accessToken = generateAccessToken(family);
    const refreshToken = generateRefreshToken(family);

    res.json({
      success: true,
      accessToken,
      refreshToken,
      family: {
        id: family._id,
        email: family.email,
        childName: family.childName,
        parentVerified: family.parentVerified,
        points: family.points,
        streak: family.streak,
        profile: family.profile,
        subscription: family.subscription
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 5. 憑證刷新 (Refresh Token)
// ==========================================
router.post('/api/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, error: '請提供刷新憑證' });
    }

    jwt.verify(refreshToken, JWT_REFRESH_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(403).json({ success: false, error: '憑證無效或已過期，請重新登入' });
      }

      const family = await Family.findById(decoded.id);
      if (!family) {
        return res.status(404).json({ success: false, error: '找不到家庭帳戶' });
      }

      const newAccessToken = generateAccessToken(family);
      res.json({
        success: true,
        accessToken: newAccessToken
      });
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
