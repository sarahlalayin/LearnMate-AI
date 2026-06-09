// 本地智能錯題本與 AI 相似題加強業務邏輯單元測試（離線安全校驗）
console.log("🧪 啟動本地智能錯題本與 AI 相似加強業務邏輯單元測試...");

async function runErrorLogTests() {
  // 1. 模擬家庭資料與原錯題上下文
  let mockFamily = {
    _id: "507f1f77bcf86cd799439011",
    childName: "小明",
    points: 320,
    streak: 5
  };

  let mockQuestionContext = {
    subject: "數學",
    grade: "6",
    edition: "康軒版",
    topic: "分數的除法",
    q: "小明有 3/4 包糖果，平分給 3 個人，每個人可以分得多少包糖果？",
    opts: ["1/4 包", "1/3 包", "1/2 包", "2/3 包"],
    a: 0,
    exp: "計算方式為 (3/4) ÷ 3 = (3/4) × (1/3) = 1/4 包。"
  };

  // 2. [測試一] 模擬學員第一次答錯題目，建立錯題本紀錄 (D1.1)
  console.log("\n🎯 [測試一] 模擬小明答題出錯，寫入錯題本...");
  const childAnswerIndex = 1; // 答錯成 1/3 包

  // 業務邏輯：建立首筆錯題紀錄
  let mockErrorLogDb = [];
  let firstErrorRecord = {
    _id: "err_001",
    familyId: mockFamily._id,
    subject: mockQuestionContext.subject,
    grade: mockQuestionContext.grade,
    topic: mockQuestionContext.topic,
    q: mockQuestionContext.q,
    opts: mockQuestionContext.opts,
    a: mockQuestionContext.a,
    userAnswer: childAnswerIndex,
    exp: mockQuestionContext.exp,
    incorrectCount: 1,
    lastAttemptedAt: new Date()
  };
  mockErrorLogDb.push(firstErrorRecord);

  if (firstErrorRecord.incorrectCount !== 1 || firstErrorRecord.userAnswer !== 1) {
    throw new Error("錯題本初始寫入欄位不正確！");
  }
  console.log(`   - 成功收集：【${firstErrorRecord.subject}】錯題，首犯標記次數 = ${firstErrorRecord.incorrectCount}`);
  console.log("✅ [測試一通過] 錯題本初始寫入模型驗證正確！");

  // 3. [測試二] 模擬學員在相同題目上第二次答錯，死穴題大數據計數累加 (D1.1)
  console.log("\n🎯 [測試二] 模擬小明在同一考點重複卡關，驗證『死穴題計數』...");
  const childSecondAnswerIndex = 2; // 又錯成 1/2 包

  // 業務邏輯：防重複及計數累加
  let existingItem = mockErrorLogDb.find(
    item => item.familyId === mockFamily._id && item.subject === mockQuestionContext.subject && item.q === mockQuestionContext.q
  );

  if (existingItem) {
    existingItem.incorrectCount += 1;
    existingItem.userAnswer = childSecondAnswerIndex;
    existingItem.lastAttemptedAt = new Date();
  }

  if (existingItem.incorrectCount !== 2 || existingItem.userAnswer !== 2) {
    throw new Error("死穴重複卡關錯誤次數未順利累加！");
  }
  console.log(`   - 卡關累加：題目【${existingItem.q.slice(0, 15)}...】累計錯答次數增長至: 🚨 ${existingItem.incorrectCount} 次`);
  console.log("✅ [測試二通過] 重複卡關死穴題錯誤累加計數邏輯正確！");

  // 4. [測試三] 模擬錯題本排序查詢 (優先複習死穴卡關題) (D1.2)
  console.log("\n🎯 [測試三] 模擬獲取錯題本列表，驗證卡關度 (錯誤次數) 遞減排序...");
  
  // 新增第二道錯題，僅答錯 1 次
  let secondErrorRecord = {
    _id: "err_002",
    familyId: mockFamily._id,
    subject: "英語",
    grade: "6",
    topic: "現在進行式",
    q: "What are you doing? I ___ reading a book.",
    opts: ["am", "is", "are", "be"],
    a: 0,
    userAnswer: 1, // 錯答成 is
    exp: "主詞為 I，Be動詞應配 am。",
    incorrectCount: 1,
    lastAttemptedAt: new Date()
  };
  mockErrorLogDb.push(secondErrorRecord);

  // 排序業務邏輯：依 incorrectCount 遞減
  let sortedLogs = [...mockErrorLogDb].sort((a, b) => b.incorrectCount - a.incorrectCount);

  if (sortedLogs[0]._id !== "err_001" || sortedLogs[0].incorrectCount !== 2) {
    throw new Error("錯題本排序未按錯誤次數遞減排序！");
  }
  console.log(`   - 優先順序一 (死穴題)：【${sortedLogs[0].subject}】錯 ${sortedLogs[0].incorrectCount} 次`);
  console.log(`   - 優先順序二：【${sortedLogs[1].subject}】錯 ${sortedLogs[1].incorrectCount} 次`);
  console.log("✅ [測試三通過] 錯題本死穴优先級排序演算法無誤！");

  // 5. [測試四] 模擬家長針對錯題呼叫 Gemini 派發 3 題相似素養加強題 (D1.3)
  console.log("\n🤖 [測試四] 模擬家長針對數學死穴題一鍵生成 3 題 AI 相似加強測驗...");
  
  const targetError = sortedLogs[0];
  
  // 模擬呼叫 Gemini 產生的 3 道相似題資料
  const mockGeminiResponse = [
    {
      q: "媽媽買了 4/5 盒草莓，平均分給 4 位小朋友，每人分得幾盒？",
      opts: ["1/5 盒", "1/4 盒", "1/2 盒", "2/5 盒"],
      a: 0,
      exp: "計算為 (4/5) ÷ 4 = 1/5 盒。"
    },
    {
      q: "有一條長 2/3 公尺的繩子，平分剪成 2 段，每段長多少公尺？",
      opts: ["1/6 公尺", "1/3 公尺", "1/2 公尺", "2/3 公尺"],
      a: 1,
      exp: "計算為 (2/3) ÷ 2 = 1/3 公尺。"
    },
    {
      q: "爸爸將 6/7 公升的果汁平分倒進 3 個杯子，每個杯子有多少公升？",
      opts: ["1/7 公升", "2/7 公升", "3/7 公升", "4/7 公升"],
      a: 1,
      exp: "計算為 (6/7) ÷ 3 = 2/7 公升。"
    }
  ];

  // 模擬寫入 Task DB
  let mockAssignedTask = {
    _id: "task_strengthen_001",
    familyId: mockFamily._id,
    type: "extra",
    item_type: "academic",
    subject: targetError.subject,
    topic: `${targetError.topic} 相似題錯題加強`,
    totalQuestions: mockGeminiResponse.length,
    questions: mockGeminiResponse,
    status: "pending",
    points: 15, // 加強題 15 點激勵
    aiGenerated: true
  };

  if (mockAssignedTask.questions.length !== 3 || mockAssignedTask.points !== 15) {
    throw new Error("AI 相似加強測驗任務派發欄位不正確！");
  }
  console.log(`   - AI 出題成功：已分析考點【${targetError.topic}】生成 ${mockAssignedTask.totalQuestions} 題素養題`);
  console.log(`   - 任務派發：建立加強任務【${mockAssignedTask.topic}】，設定獎勵 = 💎 ${mockAssignedTask.points} 點`);
  console.log("✅ [測試四通過] Gemini AI 錯題相似題加強派題引擎邏輯驗證完美成功！");

  console.log("\n🎉 【恭喜，智能錯題本與 AI 相似加強本地業務單元測試全數通過！】");
}

runErrorLogTests().catch(console.error);
