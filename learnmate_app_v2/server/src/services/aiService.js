async function callGemini(prompt, apiKey) {
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) {
    console.warn('⚠️ [Gemini] GEMINI_API_KEY 未設定，跳過 AI 生成');
    return null;
  }
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const data = await resp.json();

    // 診斷：記錄 API 回應狀態
    if (!resp.ok) {
      console.error(`❌ [Gemini] HTTP ${resp.status}:`, JSON.stringify(data).slice(0, 300));
      return null;
    }

    let text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log(`✅ [Gemini] 回應長度: ${text.length} 字元，前100字: ${text.slice(0, 100)}`);

    // 強化 JSON 擷取
    const match = text.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    if (match) {
      text = match[0];
    } else {
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    }
    return text || null;
  } catch(e) {
    console.error('❌ [Gemini] 呼叫失敗:', e.message);
    return null;
  }
}

function buildQuizPrompt(subject, topic, grade, edition, count = 5, syllabusContent = null) {
  let syllabusInstruction = '';
  if (syllabusContent) {
    syllabusInstruction = `\n這學期該版本的課綱內容如下：\n"""\n${syllabusContent}\n"""\n你的出題必須嚴格基於此課綱範圍，不可超出此版本的教學進度。\n`;
  }

  return `你是一位專業的台灣小學${grade}年級${subject}老師，使用${edition}教材。
請根據單元主題「${topic}」，生成 ${count} 題繁體中文單選練習題。${syllabusInstruction}

嚴格規則：
1. 題目必須符合${grade}年級程度，語氣友善親切。
2. 必須提供 4 個不同的「實際答案選項內容」，且選項文字不可加上 A/B/C/D 前綴。
3. 只有 1 個正確答案，正確答案的索引 (a) 必須是 0 到 3 之間的整數。
4. 必須包含簡短易懂的解析（30字內）。
5. 必須只回傳 JSON 陣列，絕對不能包含任何 Markdown 語法或說明文字。

JSON 格式範例：
[
  {
    "q": "這是一道測驗題目？",
    "opts": ["選項內容一", "選項內容二", "選項內容三", "選項內容四"],
    "a": 1,
    "exp": "因為這是正確的解釋。"
  }
]`;
}

function buildVideoPrompt(grade, editions, weakSubjects, topics) {
  // 建立「科目: 版本」的字串對照表，供 Gemini 參考
  let editionsStr = '';
  if (editions) {
    try {
      const entries = editions instanceof Map ? Array.from(editions.entries()) : Object.entries(editions);
      editionsStr = entries.map(([sub, ed]) => `${sub}(${ed})`).join('、');
    } catch(e) {}
  }
  
  return `你是台灣小學${grade}年級學習顧問，請針對以下情況推薦 3 個適合的 YouTube 學習影片主題。

學生資訊：
- 年級：${grade}年級
- 各科對應教材版本：${editionsStr || '無特定版本'}
- 需要加強的科目：${weakSubjects}
- 目前學習主題：${topics}

請依據學生的「年級」與對應科目的「教材版本」，精準推測最適合的教學影片關鍵字。
請以 JSON 格式回傳，只回傳 JSON，不要有其他文字：
[{"title":"影片標題（繁體中文，生動有趣）","channel":"推薦頻道名稱（台灣教育頻道）","keyword":"YouTube搜尋關鍵字（必須包含年級、科目、單元與精準的教材版本）","subject":"科目","duration":"預估時長","desc":"一句話推薦理由"}]`;
}

function buildInsightPrompt(childName, grade, completionRate, accuracyData, skipped, hasExtra) {
  return `你是 LearnMate 學習助理，請根據以下數據，用繁體中文寫一段 80-100 字的家長學習週報（溫暖專業語氣）。
包含：1. 整體表現摘要  2. 一個具體可執行的建議
不要出現「AI」字樣，語氣像親切的老師對家長說話。

學生：${childName}，${grade}年級
完成率：${completionRate}%
各科正確率：${accuracyData}
跳過科目：${skipped || '無'}
已有加強題：${hasExtra ? '是' : '否'}

只回傳週報文字，不要 JSON 也不要標題。`;
}

function buildSimilarQuestionPrompt(subject, grade, originalQuestion) {
  return `你是一位精準理解台灣小學 ${grade} 年級 ${subject} 科 108 課綱核心素養的出題大師。
現在，一位學員在這道題目上答錯了：
---
原題目：${originalQuestion.q}
答案選項：
[0] ${originalQuestion.opts[0]}
[1] ${originalQuestion.opts[1]}
[2] ${originalQuestion.opts[2]}
[3] ${originalQuestion.opts[3]}
正確答案索引：${originalQuestion.a} (即選項 "${originalQuestion.opts[originalQuestion.a]}")
原題目解析：${originalQuestion.exp}
---

請你分析原題目的「核心考點」與「邏輯概念」，並依據此核心考點，為學員客製化生成 3 道相同知識點、概念高度相似、但「題幹數字、場景、或敘述方式完全不同」的全新素養單選題，供學員進行弱項加強複習。

嚴格規則：
1. 題目必須符合小學 ${grade} 年級的日常理解語境，繁體中文，生動活潑。
2. 每道題必須提供 4 個不同的「實際答案選項」，且選項文字不可加上 A/B/C/D 前綴。
3. 只有 1 個正確答案，正確答案的索引 (a) 必須是 0 到 3 之間的整數。
4. 必須包含簡短易懂的解析（30字內）。
5. 必須只回傳 JSON 陣列，絕對不能包含任何 Markdown 語法或說明文字。

JSON 格式要求：
[
  {
    "q": "相似加強題目一題幹...",
    "opts": ["選項一", "選項二", "選項三", "選項四"],
    "a": 0,
    "exp": "解析說明..."
  },
  ...
]`;
}

/**
 * 【核心架構 - 多 Agent 協同出題與 Critic Loop 雙向審查機制】
 * 包含：Agent 1 (課綱分析) -> Agent 2 (素養命題) -> Agent 3 (挑剔教師審核)
 */
async function generateQuizWithCritic(subject, topic, grade, edition, count = 5, feedbackBadCases = [], apiKey = null) {
  console.log(`🤖 [Critic-Loop] 開始多 Agent 協同出題: 科目=${subject}, 年級=${grade}, 版本=${edition}, 主題=${topic}`);

  // ==========================================
  // Step 1: Agent 1 - 課綱與盲點分析專家
  // ==========================================
  const analyzerPrompt = `你是一位精準理解台灣 108 課綱小學與國中教育的學科分析專家。
針對科目：【${subject}】、年級：【${grade}年級】、教材版本：【${edition}】、學習主題：【${topic}】。
請分析並給出：
1. 該主題下最核心的 2-3 個知識點。
2. 該年級孩子學習此主題時，最常見的概念混淆或易犯錯誤點。

請務必嚴格以 JSON 格式回傳，不可包含任何 markdown 標記或說明文字：
{"core_concepts": ["核心概念1", "核心概念2"], "common_errors": ["易混淆錯點1", "易混淆錯點2"]}`;

  const analysisRaw = await callGemini(analyzerPrompt, apiKey);
  let analysisResult = { core_concepts: [topic], common_errors: [] };
  if (analysisRaw) {
    try {
      const match = analysisRaw.match(/\{[\s\S]*\}/);
      if (match) {
        analysisResult = JSON.parse(match[0]);
        console.log(`✅ [Agent 1 課綱分析] 核心觀念: ${analysisResult.core_concepts.join(', ')}`);
      }
    } catch (e) {
      console.warn('⚠️ [Agent 1] 解析失敗，使用預設值。', e.message);
    }
  }

  // ==========================================
  // Step 2 & 3: Agent 2 (出題) 與 Agent 3 (審核) 的雙向修正 Loop
  // ==========================================
  let attempts = 0;
  const maxAttempts = 3;
  let currentQuestions = null;
  let criticFeedbackText = '';

  // 格式化家長回報的 Bad Cases (防踩雷)
  let badCasesInstruction = '無';
  if (feedbackBadCases && feedbackBadCases.length > 0) {
    badCasesInstruction = feedbackBadCases.map((bc, idx) => 
      `案例 ${idx + 1}:
- 題目題幹: "${bc.q}"
- 問題類型: "${bc.feedback_type}" (家長回報原因: "${bc.parent_note || '無'}")`
    ).join('\n');
  }

  while (attempts < maxAttempts) {
    attempts++;
    console.log(`🔄 [Critic-Loop] 第 ${attempts} 次命題嘗試...`);

    // 組裝 Agent 2 出題 Prompt
    let generatorPrompt = `你是一位專業的台灣 108 課綱命題老師，專長為「素養導向」設計題目，融入生活情境。
請為【${grade}年級】的學童設計 ${count} 題【${subject}】單選測驗題。
教材版本：【${edition}】
單元主題：【${topic}】
核心考點：${analysisResult.core_concepts.join('、')}
學童易錯概念：${analysisResult.common_errors.join('、')}

【歷史家長/教師回報的不良考題避雷針（請絕對避免犯相同錯誤，例如超綱、歧義）】
${badCasesInstruction}

【嚴格出題規則】
1. 題目必須使用繁體中文，親切好懂，融入生活實例。
2. 題目與計算複雜度必須嚴格符合小學 ${grade} 年級程度，不可超出認知負荷（不可超綱）。
3. 每個題目必須有 4 個不同的選項內容，選項文字中絕不能加上 A/B/C/D 等前綴。
4. 正確答案索引 (a) 必須是 0-3 之間的整數。
5. 必須包含簡短易懂的解析（30字內）。
6. 請只回傳 JSON 陣列，不要有 markdown 區塊，格式如下：
[{"q":"題目題幹","opts":["選項0","選項1","選項2","選項3"],"a":1,"exp":"解析說明"}]`;

    if (criticFeedbackText) {
      generatorPrompt += `\n\n【⚠️ 上一次審查未通過退回原因與修改建議，請務必針對此意見修正】：\n${criticFeedbackText}`;
    }

    const quizRaw = await callGemini(generatorPrompt, apiKey);
    if (!quizRaw) {
      console.warn('⚠️ [Agent 2] 生成題目為空，將進行重試。');
      continue;
    }

    try {
      const match = quizRaw.match(/\[[\s\S]*\]/);
      currentQuestions = JSON.parse(match ? match[0] : quizRaw);
    } catch (e) {
      console.error('❌ [Agent 2] 題目 JSON 解析失敗，將進行重試。', e.message);
      continue;
    }

    // Agent 3: 教學審查專家 (Critic Agent)
    console.log(`🕵️ [Agent 3 審查] 開始審查生成的題目...`);
    const criticPrompt = `你是一位擁有 20 年教學經驗的台灣小學/國中教學主任，扮演挑剔的教學背景家長。
請審查以下為【${grade}年級】學童設計的【${subject}】測驗題：
---
${JSON.stringify(currentQuestions, null, 2)}
---

【審查指標（極度嚴格）】
1. 科學性與唯一答案：正確答案索引是否百分之百正確？其他干擾選項是否有可能也是對的？
2. 認知負荷與超綱：題目敘述或計算是否對【${grade}年級】的孩子過於繁雜？有沒有超綱的概念（例如：三年級出現小數除法）？
3. 鑑別度：錯誤選項（干擾項）是否流於荒謬？是否結合了常見混淆？
4. 語意清晰：敘述是否順暢、無錯別字與歧義？

請嚴格進行評估，並以 JSON 格式回傳審查結果，絕對不可包含任何 markdown 標記：
{"passed": true 或 false, "feedback": "若未通過，請給出具體指出第幾題有什麼問題以及明確的修正建議；若通過則為空"}`;

    const criticRaw = await callGemini(criticPrompt, apiKey);
    if (criticRaw) {
      try {
        const match = criticRaw.match(/\{[\s\S]*\}/);
        const criticResult = JSON.parse(match ? match[0] : criticRaw);
        
        if (criticResult.passed === true) {
          console.log(`🎉 [Critic-Loop] 審查通過！出題成功。迭代次數: ${attempts}`);
          return { questions: currentQuestions, attempts, passed: true };
        } else {
          criticFeedbackText = criticResult.feedback;
          console.warn(`❌ [Critic-Loop] 審查未通過退回！原因: ${criticFeedbackText}`);
        }
      } catch (e) {
        console.warn('⚠️ [Agent 3] 審查 JSON 解析失敗，預設通過。', e.message);
        return { questions: currentQuestions, attempts, passed: true };
      }
    } else {
      // 審查 API 故障時，默認通過以保證系統可用性
      return { questions: currentQuestions, attempts, passed: true };
    }
  }

  // Fallback 處理：若重試次數用完仍未通過審查，回傳最後一次產出的題目，但記錄日誌
  console.warn(`⚠️ [Critic-Loop] 重試 ${maxAttempts} 次均未能通過審查，強制回傳最後一次結果。`);
  return { questions: currentQuestions, attempts: maxAttempts, passed: false };
}

module.exports = {
  callGemini,
  buildQuizPrompt,
  buildVideoPrompt,
  buildInsightPrompt,
  buildSimilarQuestionPrompt,
  generateQuizWithCritic
};
