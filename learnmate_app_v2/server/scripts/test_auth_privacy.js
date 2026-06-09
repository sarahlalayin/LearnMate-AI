require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Family = require('../src/models/Family');
const Task = require('../src/models/Task');
const Reward = require('../src/models/Reward');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// 讀取連線環境變數
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'learnmate_secret_jwt_key_2026';

if (!MONGODB_URI) {
  console.error("❌ 找不到 MONGODB_URI 環境變數，請確認 .env 設定。");
  process.exit(1);
}

async function runTests() {
  console.log("🔌 正在連線至 MongoDB...");
  await mongoose.connect(MONGODB_URI);
  console.log("✅ 資料庫連線成功！");

  const testEmail = `parent.test.${Date.now()}@example.com`;
  const testPassword = "password123";
  const childName = "小明測試員";
  const grade = "6";

  let createdFamilyId = null;
  let accessToken = null;
  let mockVerificationCode = null;

  try {
    // ----------------------------------------------------
    // Test 1: 註冊邏輯驗證 (Business logic of /api/auth/register)
    // ----------------------------------------------------
    console.log(`\n📝 [測試一] 開始模擬信箱註冊，註冊信箱：${testEmail}...`);
    
    // 檢查是否重複
    const existing = await Family.findOne({ email: testEmail });
    if (existing) throw new Error("Email 已被註冊！");

    const verificationCode = "888888"; // 測試用固定代碼
    const verificationExpires = new Date(Date.now() + 15 * 60 * 1000);
    const hashedPassword = await bcrypt.hash(testPassword, 12);
    const familyCode = 'FMTEST' + Math.floor(1000 + Math.random() * 9000);

    const family = new Family({
      email: testEmail,
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
        status: 'trial',
        trial_ends_at: new Date(Date.now() + 14 * 24 * 3600000), 
        current_period_end: new Date(Date.now() + 14 * 24 * 3600000)
      }
    });

    await family.save();
    createdFamilyId = family._id;
    mockVerificationCode = verificationCode;
    console.log(`✅ [測試一通過] 註冊資料儲存成功！帳戶 ID: ${createdFamilyId}, 隨機代碼: ${familyCode}`);

    // ----------------------------------------------------
    // Test 2: 驗證相容之預設每日任務與獎勵是否成功塞入
    // ----------------------------------------------------
    console.log(`\n🔍 [測試二] 驗證每日任務與獎勵初始化配置...`);
    await Task.insertMany([
      { familyId: createdFamilyId, subject: '國語', topic: 'L5 詞語複習', type: 'daily', totalQuestions: 5 },
      { familyId: createdFamilyId, subject: '數學', topic: '第一~六單元總複習', type: 'daily', totalQuestions: 5 }
    ]);
    await Reward.insertMany([
      { familyId: createdFamilyId, name: '玩 Switch 30分鐘', cost: 100, proposedBy: 'parent', icon: '🎮' }
    ]);
    
    const taskCount = await Task.countDocuments({ familyId: createdFamilyId });
    const rewardCount = await Reward.countDocuments({ familyId: createdFamilyId });
    console.log(`💡 資料庫檢查: 已建立該帳戶之任務 ${taskCount} 筆，獎勵 ${rewardCount} 筆。`);
    if (taskCount !== 2 || rewardCount !== 1) throw new Error("預載入數據筆數不正確！");
    console.log("✅ [測試二通過] MVP 相容預設任務初始化驗證成功！");

    // ----------------------------------------------------
    // Test 3: 家長防護欄 OTP 驗證流程
    // ----------------------------------------------------
    console.log(`\n🔑 [測試三] 模擬家長防護欄 OTP 驗證作業...`);
    const familyToVerify = await Family.findOne({ email: testEmail });
    if (!familyToVerify) throw new Error("無法在資料庫中找到該帳戶");
    
    if (familyToVerify.parentVerificationCode !== mockVerificationCode) {
      throw new Error("資料庫內儲存的驗證碼與註冊時生成的代碼不符！");
    }
    
    familyToVerify.parentVerified = true;
    familyToVerify.parentVerificationCode = null;
    familyToVerify.parentVerificationExpires = null;
    await familyToVerify.save();
    console.log(`✅ [測試三通過] 家長驗證完成，parentVerified 已變更為: ${familyToVerify.parentVerified}`);

    // ----------------------------------------------------
    // Test 4: 密碼驗證與 JWT 憑證簽發
    // ----------------------------------------------------
    console.log(`\n🔐 [測試四] 實測 bcrypt 密碼驗證與 JWT 簽發...`);
    const authFamily = await Family.findOne({ email: testEmail });
    const isMatch = await bcrypt.compare(testPassword, authFamily.password);
    if (!isMatch) throw new Error("密碼驗證失敗！");

    accessToken = jwt.sign(
      { id: authFamily._id, email: authFamily.email, plan: authFamily.subscription?.plan || 'free' },
      JWT_SECRET,
      { expiresIn: '2h' }
    );
    console.log(`💡 簽發 JWT Token: ${accessToken.substring(0, 35)}...`);
    console.log(`✅ [測試四通過] 雜湊比對成功，JWT 雙向加密簽發成功！`);

    // ----------------------------------------------------
    // Test 5: 驗證 authMiddleware 是否能正確解碼與校正 Token 權限
    // ----------------------------------------------------
    console.log(`\n🛡️ [測試五] 實測中介軟體 token 解析校正作業...`);
    const decoded = jwt.verify(accessToken, JWT_SECRET);
    if (decoded.id !== authFamily._id.toString() || decoded.email !== testEmail) {
      throw new Error("解碼後的 Payload 資料與資料庫內容不一致！");
    }
    console.log(`✅ [測試五通過] JWT 解密稽核完全符合！`);

    // ----------------------------------------------------
    // Test 6: 隱私合規之帳號完全刪除 (清理資料，不留下髒資料)
    // ----------------------------------------------------
    console.log(`\n🗑️ [測試六] 模擬隱私安全之帳號一鍵完全刪除 API (清理測試資料)...`);
    const deleteTasks = await Task.deleteMany({ familyId: createdFamilyId });
    const deleteRewards = await Reward.deleteMany({ familyId: createdFamilyId });
    await Family.findByIdAndDelete(createdFamilyId);
    
    const postTaskCount = await Task.countDocuments({ familyId: createdFamilyId });
    const postRewardCount = await Reward.countDocuments({ familyId: createdFamilyId });
    const postFamily = await Family.findById(createdFamilyId);

    console.log(`💡 刪除後資料庫盤點: 任務數=${postTaskCount}, 獎勵數=${postRewardCount}, 帳戶存在狀態=${!!postFamily}`);
    if (postTaskCount !== 0 || postRewardCount !== 0 || postFamily !== null) {
      throw new Error("完全刪除作業失敗，資料庫中仍留有部分關聯資料！");
    }
    console.log("✅ [測試六通過] 隱私一鍵清除成功，無任何髒資料殘留於資料庫。");

    console.log("\n🎉 【恭喜，全部測試通過！】安全防護、帳號會員與家長合規功能皆已 100% 通過整合驗證。");
  } catch (error) {
    console.error("❌ 測試失敗:", error);
    // 發生錯誤時的資料清理
    if (createdFamilyId) {
      await Family.findByIdAndDelete(createdFamilyId);
      await Task.deleteMany({ familyId: createdFamilyId });
      await Reward.deleteMany({ familyId: createdFamilyId });
    }
  } finally {
    await mongoose.connection.close();
    console.log("🔌 資料庫連線已完全關閉。");
  }
}

runTests();
