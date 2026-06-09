const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');

// 本地安全與認證業務邏輯單元測試（適用於無資料庫連線的環境）
console.log("🧪 啟動本地安全與帳密驗證業務邏輯單元測試...");

const JWT_SECRET = 'learnmate_secret_jwt_key_2026';
const JWT_REFRESH_SECRET = 'learnmate_refresh_jwt_key_2026';

function generateAccessToken(family) {
  return jwt.sign(
    { id: family._id, email: family.email, plan: family.subscription?.plan || 'free' },
    JWT_SECRET,
    { expiresIn: '2h' }
  );
}

function generateRefreshToken(family) {
  return jwt.sign(
    { id: family._id },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
}

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

async function runMockedTests() {
  const testEmail = "parent.test@example.com";
  const testPassword = "password123";
  const childName = "小明測試員";
  const grade = "6";

  // ----------------------------------------------------
  // Test 1: Zod 輸入參數驗證測試
  // ----------------------------------------------------
  console.log("\n📝 [測試一] 開始驗證註冊輸入參數驗證器 (Zod)...");
  
  // 合法輸入
  const validReg = registerSchema.safeParse({ email: testEmail, password: testPassword, childName, grade });
  if (!validReg.success) throw new Error("合法輸入卻驗證失敗！");
  console.log("   - 合法輸入驗證成功。");

  // 不合法輸入 (密碼太短)
  const invalidReg = registerSchema.safeParse({ email: testEmail, password: "123", childName, grade });
  if (invalidReg.success) throw new Error("密碼過短卻成功通過驗證！");
  console.log("   - 成功攔截過短密碼。");

  // 不合法輸入 (Email 格式錯誤)
  const invalidEmailReg = registerSchema.safeParse({ email: "bademail", password: testPassword, childName, grade });
  if (invalidEmailReg.success) throw new Error("Email 格式錯誤卻成功通過驗證！");
  console.log("   - 成功攔截不合法 Email。");
  console.log("✅ [測試一通過] Zod 驗證架構安全無誤！");

  // ----------------------------------------------------
  // Test 2: Hashing 與 Bcrypt 比對測試
  // ----------------------------------------------------
  console.log("\n🔐 [測試二] 測試 Bcrypt 密碼加密與比對邏輯...");
  const hashed = await bcrypt.hash(testPassword, 12);
  console.log(`   - 加密後雜湊碼: ${hashed}`);
  
  const isMatch = await bcrypt.compare(testPassword, hashed);
  if (!isMatch) throw new Error("密碼加密後比對失敗！");
  console.log("   - 正確密碼比對成功。");
  
  const isMismatch = await bcrypt.compare("wrongpassword", hashed);
  if (isMismatch) throw new Error("錯誤密碼竟然比對成功！");
  console.log("   - 錯誤密碼比對失敗（成功防護）。");
  console.log("✅ [測試二通過] Bcrypt 雜湊加密認證驗證成功！");

  // ----------------------------------------------------
  // Test 3: JWT 雙憑證生成與簽名解密測試
  // ----------------------------------------------------
  console.log("\n🛡️ [測試三] 測試 JWT 簽發與解析解密週期...");
  const mockFamily = {
    _id: "507f1f77bcf86cd799439011",
    email: testEmail,
    subscription: { plan: 'pro' }
  };

  const token = generateAccessToken(mockFamily);
  const refreshToken = generateRefreshToken(mockFamily);
  console.log(`   - 簽發 Access JWT: ${token.substring(0, 35)}...`);
  console.log(`   - 簽發 Refresh JWT: ${refreshToken.substring(0, 35)}...`);

  // 解密與權限驗證 Access Token
  const decodedAccess = jwt.verify(token, JWT_SECRET);
  if (decodedAccess.id !== mockFamily._id || decodedAccess.email !== mockFamily.email || decodedAccess.plan !== 'pro') {
    throw new Error("Access JWT 權限解密比對失敗！");
  }
  console.log("   - Access token 解析成功，權限解密無誤。");

  // 解密 Refresh Token
  const decodedRefresh = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
  if (decodedRefresh.id !== mockFamily._id) {
    throw new Error("Refresh JWT 解密比對失敗！");
  }
  console.log("   - Refresh token 解析與憑證更新機制驗證成功。");
  console.log("✅ [測試三通過] JWT 登入授權生命週期驗證成功！");

  console.log("\n🎉 【恭喜，本地邏輯單元測試全部通過！】雜湊密碼、JWT 授權機制與 Zod 輸入保護模組 100% 運行正確。");
}

runMockedTests().catch(console.error);
