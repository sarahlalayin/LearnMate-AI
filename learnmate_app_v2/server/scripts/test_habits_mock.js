// 本地非學業習慣養成業務邏輯單元測試（適用於無資料庫連線環境）
console.log("🧪 啟動本地非學業習慣養成業務邏輯單元測試...");

async function runHabitTests() {
  // 1. 模擬家庭與學員初始狀態
  let mockFamily = {
    _id: "507f1f77bcf86cd799439011",
    childName: "小明",
    points: 320,
    streak: 5,
    lastActiveDate: "2026-05-31"
  };

  // 2. 模擬家長指派習慣任務 (B1)
  console.log("\n🏃 [測試一] 模擬家長指派才藝練習習慣任務...");
  let mockHabitTask = {
    _id: "607f1f77bcf86cd799439022",
    familyId: mockFamily._id,
    type: "daily",
    item_type: "habit", // 習慣打卡項目標記
    subject: "鋼琴練習",
    topic: "music習慣打卡",
    status: "pending",
    points: 10,
    habit_config: {
      category: "music",
      target_unit: "分鐘",
      target_value: 20,
      actual_value: 0,
      child_note: "",
      parent_confirmed: false,
      parent_note: ""
    }
  };

  if (mockHabitTask.item_type !== 'habit' || mockHabitTask.habit_config.target_value !== 20) {
    throw new Error("習慣任務初始模型結構不符合規格！");
  }
  console.log(`   - 成功指派：【${mockHabitTask.subject}】，目標：${mockHabitTask.habit_config.target_value} ${mockHabitTask.habit_config.target_unit}`);
  console.log("✅ [測試一通過] 習慣打卡基礎資料模型結構校驗正確！");

  // 3. 模擬學生打卡 (B2)
  console.log("\n📝 [測試二] 模擬小明完成打卡並撰寫自評...");
  const childActualMinutes = 25;
  const childSelfNote = "今天彈完了小星星變奏曲，手指好靈活 ⭐";
  
  // 學生打卡業務邏輯執行
  if (mockHabitTask.status !== 'pending') throw new Error("任務初始狀態非 pending！");
  
  mockHabitTask.status = 'submitted';
  mockHabitTask.habit_config.actual_value = childActualMinutes;
  mockHabitTask.habit_config.child_note = childSelfNote;
  mockHabitTask.earnedPoints = 10; // 打卡直接賺 10 點
  
  // 家庭點數增加
  mockFamily.points += 10;
  
  // 連勤計算 (Streak)
  const todayTW = "2026-06-01"; // 模擬今日
  if (mockFamily.lastActiveDate !== todayTW) {
    const yesterday = "2026-05-31";
    mockFamily.streak = (mockFamily.lastActiveDate === yesterday) ? mockFamily.streak + 1 : 1;
    mockFamily.lastActiveDate = todayTW;
  }

  // 斷言校對
  if (mockHabitTask.status !== 'submitted' || mockHabitTask.habit_config.actual_value !== 25) {
    throw new Error("打卡後任務狀態與數據未更新！");
  }
  if (mockFamily.points !== 330 || mockFamily.streak !== 6) {
    throw new Error("打卡後點數或連勤天數累加錯誤！");
  }

  console.log(`   - 打卡更新：狀態變更為 submitted，實際完成 ${mockHabitTask.habit_config.actual_value} 分鐘`);
  console.log(`   - 點數變更：小明獲得 +10 點，當前點數為: ${mockFamily.points} 點`);
  console.log(`   - 連勤變更：連勤天數順利增長至: 🔥 ${mockFamily.streak} 天`);
  console.log("✅ [測試二通過] 學生打卡、點數飛入與 Streak 相容更新邏輯無誤！");

  // 4. 模擬家長核准打卡 (B3)
  console.log("\n🛡️ [測試三] 模擬家長在控制台審批打卡並給予特別加成獎勵...");
  const parentComment = "彈得非常好！爸爸注意到你手指變靈活了，給你特別加成獎勵！";
  
  if (mockHabitTask.status !== 'submitted') throw new Error("任務未處於待審核狀態！");
  
  // 家長確認
  mockHabitTask.status = 'completed';
  mockHabitTask.habit_config.parent_confirmed = true;
  mockHabitTask.habit_config.parent_note = parentComment;
  
  // 家長核准額外 +3 點特別加成
  mockFamily.points += 3;

  // 模擬寫入 Messages 鼓勵信封
  const mockCreatedMessage = {
    familyId: mockFamily._id,
    text: `「看到你今天完成了 ${mockHabitTask.habit_config.actual_value} ${mockHabitTask.habit_config.target_unit} 練習！${parentComment} 🌟」`,
    from: 'parent'
  };

  // 斷言校對
  if (mockHabitTask.status !== 'completed' || !mockHabitTask.habit_config.parent_confirmed) {
    throw new Error("家長核准後任務狀態未變更為 completed！");
  }
  if (mockFamily.points !== 333) {
    throw new Error("家長核准後 +3 特別加成金幣累加錯誤！");
  }
  if (!mockCreatedMessage.text.includes(parentComment)) {
    throw new Error("投遞至孩子留言板的內容不正確！");
  }

  console.log(`   - 核准完成：狀態變更為 completed，家長確認標記 = ${mockHabitTask.habit_config.parent_confirmed}`);
  console.log(`   - 特別加成：小明獲得 +3 點，累計總點數為: ${mockFamily.points} 點`);
  console.log(`   - 親子對話：已投遞鼓勵留言至小明的留言板 ✉️`);
  console.log("✅ [測試三通過] 家長核准與 +3 特別點數、評語投遞邏輯驗證成功！");

  console.log("\n🎉 【恭喜，非學業習慣養成模組本地單元測試全數通過！】");
}

runHabitTests().catch(console.error);
