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

module.exports = {
  callGemini,
  buildQuizPrompt,
  buildVideoPrompt,
  buildInsightPrompt
};
