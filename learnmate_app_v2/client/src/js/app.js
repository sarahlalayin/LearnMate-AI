// --- AI 設定 (Gemini 2.0 Flash) ---
const API_BASE = window.location.origin;

// 輔助函式：自訂 API 呼叫，自動帶上 JWT Token
async function apiFetch(url, options = {}) {
  const token = localStorage.getItem('learnmate_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const resp = await fetch(url, {
    ...options,
    headers
  });
  
  if (resp.status === 401) {
    console.warn('憑證過期或無效，請重新登入');
    localStorage.removeItem('learnmate_token');
    localStorage.removeItem('learnmate_family_id');
    logout();
    throw new Error('未授權，已自動登出');
  }
  
  return resp;
}

// 狀態同步：自後端拉取 MongoDB 的 Family 狀態，更新本地 LocalStorage
async function syncState() {
  const familyId = localStorage.getItem('learnmate_family_id');
  if (!familyId) return;
  try {
    const resp = await apiFetch(`${API_BASE}/api/sync/${familyId}`);
    if (resp.ok) {
      const data = await resp.json();
      if (data.success && data.db) {
        saveDB(data.db);
        updateScreenData(currentScreen);
        console.log('🔄 [State Sync] 已從 MongoDB 成功對齊前端 LocalStorage 狀態。');
      }
    }
  } catch (e) {
    console.error('狀態同步失敗：', e.message);
  }
}

// API Key 從 localStorage 動態讀取，支援 Demo 輸入框設定
// 預設備援 Key：為了安全考量，請勿將明文 API Key 寫死在程式碼中！
// 如果 localStorage 無設定，系統會要求使用者從 UI 輸入，或直接呼叫後端。
function getGeminiKey() {
  return localStorage.getItem('learnmate_gemini_key') || null;
}
function setGeminiKey(key) {
  localStorage.setItem('learnmate_gemini_key', key.trim());
}

// 通用 Gemini REST API 呼叫函式
async function callGeminiAPI(prompt) {
  const apiKey = getGeminiKey();
  if (!apiKey) { console.warn('尚未設定 Gemini API Key，切換 Mock 模式'); return null; }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    if (!resp.ok) { console.warn('Gemini 回傳錯誤:', resp.status); return null; }
    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return text.replace(/```json/g, '').replace(/```/g, '').trim();
  } catch (e) {
    console.warn('Gemini API 呼叫失敗，切換 Mock 模式:', e.message);
    return null;
  }
}

// --- 初始狀態與 Mock 資料 ---
let currentUser = null; // 'parent' or 'student'
let currentScreen = 'screen-login';
let familyCode = 'DEMO999';

// Mock DB in LocalStorage
const defaultDB = {
  childName: '小明',
  profile: {
    level: 'elementary', // 'elementary' or 'junior_high'
    grade: '6',
    editions: {
      '國語': '南一版',
      '數學': '康軒版',
      '社會': '翰林版',
      '自然': '翰林版',
      '英語': '康軒版'
    }
  },
  tasks: [
    { id: 1, subject: '國語', topic: '第十課', status: 'pending', points: 10 },
    { id: 2, subject: '數學', topic: '第一~六單元總複習', status: 'pending', points: 10 },
    { id: 3, subject: '社會', topic: '台灣歷史', status: 'pending', points: 10 },
    { id: 4, subject: '英語', topic: '現在進行式', status: 'pending', points: 10 },
    { id: 5, subject: '自然', topic: '植物的構造', status: 'pending', points: 10 }
  ],
  points: 320,
  streak: 5,
  messages: [], // 從家長傳來的留言
  alerts: [
    { id: 1, type: 'critical', title: '英語·現在進行式 連續卡住', desc: '可能真的卡住了，不是偷懶。連續9天偏低。' },
    { id: 2, type: 'warning', title: '自然 — 這週暫停了2次', desc: '兩次都說太累，建議今晚聊一聊。' },
    { id: 3, type: 'positive', title: '數學 — 本週進步了！', desc: '可以讓他知道你注意到了。' }
  ],
  extraTasks: [], // 家長派的加強題
  activities: [], // ★ 非學科活動範本 (才藝/運動/家事)
  rewards: [
    { id: 1, name: '週末電動 30分', cost: 100, icon: '🎮', proposedBy: 'parent', status: 'ready' },
    { id: 2, name: '壽司聚餐', cost: 500, icon: '🍣', proposedBy: 'parent', status: 'ready' },
    { id: 3, name: '自選書籍', cost: 300, icon: '📚', proposedBy: 'parent', status: 'ready' },
    { id: 4, name: '去看電影', cost: 0, icon: '🎬', proposedBy: 'student', status: 'proposed' } // student proposed, pending parent setting
  ],
  rewardRequests: [] // { id, rewardId, date, status: 'pending'|'approved' }
};

function initDB() {
  if (!localStorage.getItem('learnmate_db')) {
    localStorage.setItem('learnmate_db', JSON.stringify(defaultDB));
  }
}
function getDB() { 
  const db = JSON.parse(localStorage.getItem('learnmate_db')); 
  if(!db) return defaultDB;
  if(!db.rewardRequests) db.rewardRequests = [];
  if(!db.extraTasks) db.extraTasks = [];
  if(!db.messages) db.messages = [];
  if(!db.alerts) db.alerts = [];
  if(!db.rewards) db.rewards = defaultDB.rewards;
  if(!db.profile) db.profile = defaultDB.profile;
  if(!db.activities) db.activities = defaultDB.activities || [];
  return db;
}
function saveDB(db) { localStorage.setItem('learnmate_db', JSON.stringify(db)); }

// --- 導覽與畫面切換 ---
function navTo(screenId) {
  const current = document.getElementById(currentScreen);
  const next = document.getElementById(screenId);
  if (!next || screenId === currentScreen) return;
  
  current.classList.remove('active');
  current.classList.add('exit');
  setTimeout(() => current.classList.remove('exit'), 300);
  
  next.classList.add('active');
  currentScreen = screenId;
  
  // 更新資料並修正 nav 位置
  updateScreenData(screenId);
  setTimeout(updateNavPosition, 50); // nav 在新畫面出現後重新定位
}

function updateScreenData(screenId) {
  const db = getDB();
  if (screenId === 'screen-parent-home') renderParentHome(db);
  else if (screenId === 'screen-parent-alerts') renderParentAlerts(db);
  else if (screenId === 'screen-parent-msg') renderParentMsg(db);
  else if (screenId === 'screen-parent-insights') renderParentInsights(db);
  else if (screenId === 'screen-parent-settings') { renderParentSettings(db); renderHabitsScreen(db); }
  else if (screenId === 'screen-parent-rewards') renderParentRewards(db);
  else if (screenId === 'screen-student-home') renderStudentHome(db);
  else if (screenId === 'screen-student-choose') renderStudentChoose(db);
  else if (screenId === 'screen-student-rewards') renderStudentRewards(db);
  else if (screenId === 'screen-student-extra') renderStudentExtra(db);
  else if (screenId === 'screen-student-videos') renderStudentVideos(db);
}

// --- 登入邏輯 ---
async function loginAsParent() {
  const code = document.getElementById('family-code-input').value.trim();
  if (!code) { alert('請輸入家庭代碼'); return; }
  
  try {
    const resp = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ familyCode: code })
    });
    const data = await resp.json();
    if (data.success) {
      localStorage.setItem('learnmate_token', data.accessToken);
      localStorage.setItem('learnmate_family_id', data.family._id);
      currentUser = 'parent';
      
      saveDB(data.family);
      await syncState();
      
      document.getElementById('screen-login').classList.remove('active');
      document.getElementById('app-container').style.display = 'block';
      setTimeout(updateNavPosition, 50);
      navTo('screen-parent-home');
    } else {
      alert('登入失敗: ' + (data.error || '未知錯誤'));
    }
  } catch (e) {
    alert('無法連接至後端伺服器: ' + e.message);
  }
}

async function loginAsStudent() {
  const code = document.getElementById('family-code-input').value.trim();
  if (!code) { alert('請輸入家庭代碼'); return; }
  
  try {
    const resp = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ familyCode: code })
    });
    const data = await resp.json();
    if (data.success) {
      localStorage.setItem('learnmate_token', data.accessToken);
      localStorage.setItem('learnmate_family_id', data.family._id);
      currentUser = 'student';
      
      saveDB(data.family);
      await syncState();
      
      document.getElementById('screen-login').classList.remove('active');
      document.getElementById('app-container').style.display = 'block';
      setTimeout(updateNavPosition, 50);
      navTo('screen-student-home');
    } else {
      alert('登入失敗: ' + (data.error || '未知錯誤'));
    }
  } catch (e) {
    alert('無法連接至後端伺服器: ' + e.message);
  }
}

function logout() {
  document.getElementById('app-container').style.display = 'none';
  const current = document.getElementById(currentScreen);
  if(current) current.classList.remove('active');
  currentScreen = 'screen-login';
  document.getElementById('screen-login').classList.add('active');
  currentUser = null;
}

// --- 家長端邏輯 ---
function renderParentHome(db) {
  document.getElementById('p-child-name').textContent = db.childName;
  const completed = db.tasks.filter(t => t.status === 'completed').length;
  document.getElementById('p-stat-completed').textContent = `${completed}/${db.tasks.length}`;
  document.getElementById('p-stat-streak').textContent = `🔥${db.streak}`;
  
  // 橫幅邏輯
  const banner = document.getElementById('p-status-banner');
  const criticalAlerts = db.alerts.filter(a => a.type === 'critical');
  if (criticalAlerts.length > 0) {
    banner.innerHTML = `
      <div style="background:#FFFBEB;border:0.5px solid #ECC94B;border-radius:10px;padding:11px 13px;margin-bottom:10px;display:flex;align-items:center;gap:9px">
        <span style="font-size:18px">⚠</span>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:500;color:#744210;margin-bottom:2px">有一件事要留意</div>
          <div style="font-size:10px;color:#975A16;line-height:1.4">${criticalAlerts[0].title}</div>
        </div>
        <div onclick="navTo('screen-parent-alerts')" style="background:#744210;border-radius:16px;padding:5px 9px;cursor:pointer"><span style="font-size:10px;font-weight:500;color:#fff">查看</span></div>
      </div>`;
  } else {
    banner.innerHTML = `
      <div style="background:#F0FFF4;border:0.5px solid #9AE6B4;border-radius:10px;padding:11px 13px;margin-bottom:10px;display:flex;align-items:center;gap:9px">
        <span style="font-size:18px">✓</span>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:500;color:#276749;margin-bottom:2px">今天狀況不錯</div>
          <div style="font-size:10px;color:#22c55e;line-height:1.4">小明已完成 ${completed} 項任務。</div>
        </div>
      </div>`;
  }

  // ★ 待確認任務取得 (包含任務、獎勵兌換申請、獎勵許願)
  const dailySubmitted = (db.tasks || []).filter(t => t.status === 'submitted');
  const extraSubmitted = (db.extraTasks || []).filter(t => t.status === 'submitted');
  const submittedTasks = [...dailySubmitted, ...extraSubmitted];
  const pendingClaims = (db.rewardRequests || []).filter(r => r.status === 'pending');
  const proposedRewards = (db.rewards || []).filter(r => r.status === 'proposed');
  
  const totalPending = submittedTasks.length + pendingClaims.length + proposedRewards.length;
  const reviewPanel = document.getElementById('p-review-panel');
  if (reviewPanel) {
    if (totalPending > 0) {
      reviewPanel.style.display = 'block';
      let html = `<div style="font-size:13px;font-weight:600;color:#0f0f14;margin-bottom:8px">⏳ 待確認項目（${totalPending}）</div>`;
      
      // 1. 任務審核
      html += submittedTasks.map(t => `
          <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:10px;margin-bottom:6px">
            <div style="font-size:13px;font-weight:500;margin-bottom:6px">${t.isHabit ? '🏅' : '📝'} ${t.subject} · ${t.topic}</div>
            <div style="font-size:10px;color:#9ca3af;margin-bottom:8px">${t.isHabit ? '習慣打卡' : `答題完成 · 預計積分 ${t.points || 10} 點`}</div>
            <div style="display:flex;gap:6px">
              <button onclick="approveExtra('${t.id}')" class="p-btn p-btn-green" style="flex:1;font-size:11px;padding:6px;cursor:pointer;border:none;border-radius:6px;color:#fff;background:#2d4a3e">✅ 確認完成</button>
              <button onclick="rejectExtra('${t.id}')" class="p-btn p-btn-ghost" style="flex:1;font-size:11px;padding:6px;cursor:pointer;border:1px solid #d1d5db;border-radius:6px;background:#fff;color:#555">↩ 退回重做</button>
            </div>
          </div>
      `).join('');

      // 2. 獎勵兌換申請
      html += pendingClaims.map(req => {
        const r = db.rewards.find(x => x.id === req.rewardId) || {};
        return `
          <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:10px;margin-bottom:6px">
            <div style="font-size:13px;font-weight:500;margin-bottom:6px">🎁 兌換申請：${r.icon || ''} ${r.name || '獎勵'}</div>
            <div style="font-size:10px;color:#9ca3af;margin-bottom:8px">花費 ${r.cost || 0} 點</div>
            <div style="display:flex;gap:6px">
              <button onclick="approveRedeem('${req.id}')" class="p-btn p-btn-green" style="flex:1;font-size:11px;padding:6px;cursor:pointer;border:none;border-radius:6px;color:#fff;background:#2d4a3e">✅ 同意兌換</button>
              <button onclick="rejectRedeem('${req.id}')" class="p-btn p-btn-ghost" style="flex:1;font-size:11px;padding:6px;cursor:pointer;border:1px solid #d1d5db;border-radius:6px;background:#fff;color:#555">↩ 婉拒</button>
            </div>
          </div>
        `;
      }).join('');

      // 3. 獎勵許願
      html += proposedRewards.map(r => `
          <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:10px;margin-bottom:6px">
            <div style="font-size:13px;font-weight:500;margin-bottom:6px">✨ 新獎勵許願：${r.icon} ${r.name}</div>
            <div style="font-size:10px;color:#9ca3af;margin-bottom:8px">請設定目標點數</div>
            <div style="display:flex;gap:6px">
              <button onclick="approveProposal('${r.id}')" class="p-btn p-btn-dark" style="flex:1;font-size:11px;padding:6px;cursor:pointer;border:none;border-radius:6px;color:#fff;background:#1a1a2e">✍ 設定點數</button>
              <button onclick="rejectProposal('${r.id}')" class="p-btn p-btn-ghost" style="flex:1;font-size:11px;padding:6px;cursor:pointer;border:1px solid #d1d5db;border-radius:6px;background:#fff;color:#555">↩ 婉拒</button>
            </div>
          </div>
      `).join('');

      reviewPanel.innerHTML = html;
    } else {
      reviewPanel.style.display = 'none';
    }
  }

  // 預警預覽
  const preview = document.getElementById('p-alerts-preview');
  preview.innerHTML = db.alerts.slice(0,2).map(a => {
    const isReward = a.title.includes('獎勵許願') || a.title.includes('兌換申請');
    const actionBtn = isReward ? `<div style="margin-top:6px"><button onclick="navTo('screen-parent-rewards')" class="p-btn p-btn-green" style="font-size:10px;padding:5px 10px;border-radius:12px;width:100%">前往獎勵頁面審核 →</button></div>` : '';
    return `
    <div class="alert-row">
      <div class="alert-dot" style="background:${a.type==='critical'?'#ef4444':a.type==='warning'?'#f59e0b':'#22c55e'}"></div>
      <div style="flex:1"><div class="alert-title">${a.title}</div><div class="alert-desc">${a.desc}</div>${actionBtn}</div>
    </div>
    `;
  }).join('');
}

function renderParentAlerts(db) {
  const list = document.getElementById('p-alerts-list');
  list.innerHTML = '<div style="font-size:11px;color:#9ca3af;margin-bottom:12px;line-height:1.6">問題還小的時候就告訴你，不是段考後才發現。</div>';
  
  db.alerts.forEach(a => {
    let color, bgColor, borderColor, titleColor, label;
    if(a.type === 'critical') { color='#ef4444'; bgColor='#fff'; borderColor='#e5e7eb'; titleColor='#9B2C2C'; label='● 需要關注'; }
    else if(a.type === 'warning') { color='#f59e0b'; bgColor='#fff'; borderColor='#ECC94B'; titleColor='#744210'; label='◐ 留意中'; }
    else { color='#22c55e'; bgColor='#fff'; borderColor='#9AE6B4'; titleColor='#276749'; label='↑ 進步中'; }
    
    const isReward = a.title.includes('獎勵許願') || a.title.includes('兌換申請');
    const actionBtn = isReward ? `<div style="margin-top:6px"><button onclick="navTo('screen-parent-rewards')" class="p-btn p-btn-green" style="font-size:10px;padding:5px 10px;border-radius:12px;width:100%">前往獎勵頁面審核 →</button></div>` : '';

    list.innerHTML += `
      <div style="border:0.5px solid ${borderColor}; ${a.type==='critical'?'border-left:3px solid #ef4444;':''} border-radius:10px;background:${bgColor};padding:10px 12px;margin-bottom:8px">
        <div style="font-size:10px;font-weight:500;color:${titleColor};margin-bottom:8px">${label}</div>
        <div class="alert-row" style="border:none;padding:0">
          <div class="alert-dot" style="background:${color}"></div>
          <div style="flex:1"><div class="alert-title">${a.title}</div><div class="alert-desc">${a.desc}</div>${actionBtn}</div>
        </div>
      </div>
    `;
  });
}

function renderParentInsights(db) {
  const completed = db.tasks.filter(t => t.status === 'completed').length;
  const total = db.tasks.length;
  const completionRate = total === 0 ? 0 : Math.round((completed / total) * 100);
  
  let insightText = '';
  let tags = [];
  
  // 智能動態分析
  if (completionRate >= 80) {
    insightText = `太棒了！小明本週完成率達到 ${completionRate}%，表現非常穩定且積極。`;
    tags.push(`<span style="background:rgba(168,213,181,0.2);color:#2d4a3e;border-radius:12px;padding:3px 8px;font-size:10px;font-weight:500">🌟 狀態極佳</span>`);
  } else if (completionRate >= 50) {
    insightText = `小明目前完成率為 ${completionRate}%，進度在軌道上。`;
    tags.push(`<span style="background:rgba(214,158,46,0.2);color:#92600a;border-radius:12px;padding:3px 8px;font-size:10px;font-weight:500">👍 穩定發揮</span>`);
  } else {
    insightText = `小明目前的完成率較低 (${completionRate}%)，可能需要您給予一些鼓勵與陪伴。`;
    tags.push(`<span style="background:rgba(229,62,62,0.2);color:#c0392b;border-radius:12px;padding:3px 8px;font-size:10px;font-weight:500">❤️ 需要抱抱</span>`);
  }
  
  // 尋找被跳過或遇到困難的科目
  const skippedTask = db.tasks.find(t => t.status === 'skipped');
  if (skippedTask) {
    insightText += `<br><br>💡 **專屬建議**：小明在「${skippedTask.subject}」遇到了一點瓶頸，並且誠實地表達了出來！這是一個很好的自我察覺。建議今晚可以花 5 分鐘聽聽他的感覺，不要急著教，給他一個大大的擁抱！`;
    tags.push(`<span style="background:rgba(214,158,46,0.2);color:#92600a;border-radius:12px;padding:3px 8px;font-size:10px;font-weight:500">💪 ${skippedTask.subject}需協助</span>`);
  } else {
    const extra = db.extraTasks.length;
    if (extra > 0) {
      insightText += `<br><br>💡 **專屬建議**：您已經派發了加強練習，現在只要適時給予口頭鼓勵，讓他知道您看見了他的努力即可。`;
    } else {
      insightText += `<br><br>💡 **專屬建議**：目前學習節奏良好，您可以挑選一門他表現不錯的科目，具體稱讚他的進步（例如：看到你數學連續算對好多題，真的長大了！）。`;
    }
  }

  const pText = document.getElementById('p-ai-report-text');
  const pTags = document.getElementById('p-ai-report-tags');
  if(pText) pText.innerHTML = insightText;
  if(pTags) pTags.innerHTML = tags.join('');

  // ★ 非同步：呼叫 Gemini 生成真實週報（不阻塞畫面）
  loadAIWeeklyReport(db, completionRate, insightText);

  // 長條圖
  const barData = [
    { sub: '國語', val: 90, color: '#1a1a2e' },
    { sub: '數學', val: 84, color: '#22c55e' },
    { sub: '社會', val: 78, color: '#1a1a2e' },
    { sub: '自然', val: 85, color: '#1a1a2e' },
    { sub: '英語', val: 44, color: '#ef4444' }
  ];
  const list = document.getElementById('p-insights-bars');
  if(list) {
    list.innerHTML = barData.map(b => `
      <div class="bar-row">
        <div class="bar-label">${b.sub}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${b.val}%;background:${b.color}"></div></div>
        <div class="bar-pct" style="color:${b.val<60?'#ef4444':b.color}">${b.val}%</div>
      </div>
    `).join('');
  }
}

// ★ AI 週報非同步載入（不阻塞主渲染）
async function loadAIWeeklyReport(db, completionRate, fallbackText) {
  const pText = document.getElementById('p-ai-report-text');
  if (!pText) return;

  const skipped = db.tasks.filter(t => t.status === 'skipped').map(t => t.subject).join('、');
  const grade = db.profile?.grade || '5';
  // 動態計算各科正確率（從 barData 取得，或使用 db 中儲存的資料）
  const accuracyMap = db.subjectAccuracy || { '英語': 44, '數學': 84, '國語': 90, '自然': 85, '社會': 78 };
  const accuracy = Object.entries(accuracyMap).map(([s, v]) => `${s}:${v}%`).join('、');

  const prompt = `你是 LearnMate 學習助理，請根據以下數據，用繁體中文寫一段 80-100 字的家長學習週報（溫暖專業語氣）。
包含：1.整體表現摘要 2.一個具體可執行的建議。
不要出現「AI」字樣，語氣像親切老師對家長說話。
學生：${db.childName}，${grade}年級 | 完成率：${completionRate}% | 各科正確率：${accuracy} | 跳過科目：${skipped || '無'} | 已有加強題：${db.extraTasks?.length > 0 ? '是' : '否'}
只回傳週報文字，不要 JSON 也不要標題。`;

  // 先顯示 loading 提示
  pText.innerHTML = `<span style="opacity:0.5;font-size:11px">✨ AI 正在生成週報...</span>`;

  const result = await callGeminiAPI(prompt);
  if (result && pText) {
    pText.innerHTML = result;
    // 更新徽章標籤
    const badgeEl = document.querySelector('#screen-parent-insights .ai-report div:first-child');
    if (badgeEl) badgeEl.textContent = 'AI 週報 · Gemini 生成';
  } else if (pText) {
    pText.innerHTML = fallbackText;
  }
}

function fillMsg(text) { document.getElementById('msg-input').value = text; }
function sendMsg() {
  const text = document.getElementById('msg-input').value;
  if(!text.trim()) return;
  const db = getDB();
  db.messages.push(text);
  saveDB(db);
  document.getElementById('msg-input').value = '';
  const sent = document.getElementById('msg-sent');
  sent.style.display = 'block';
  setTimeout(() => sent.style.display = 'none', 3000);
}

function fillTopic(subject, topic) { 
  document.getElementById('topic-subject').value = subject;
  document.getElementById('topic-input').value = topic; 
}
// --- AI 考題生成器 (Gemini + Mock Fallback) ---
async function fetchAIQuestions(subject, topic, count = 5) {
  const db = getDB();
  const edition = db.profile?.editions?.[subject] || '通用版';
  const grade = db.profile?.grade || '5';

  // 嘗試真實 Gemini API
  const prompt = `你是一位專業的台灣小學${grade}年級${subject}老師，使用${edition}教材。
請根據單元主題「${topic}」，生成 ${count} 題繁體中文單選練習題。

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

  const rawText = await callGeminiAPI(prompt);
  if (rawText) {
    try {
      const parsed = JSON.parse(rawText);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(0, count).map(q => ({ q: q.q, opts: q.opts, a: q.a, exp: q.exp || '太棒了！', aiGenerated: true }));
      }
    } catch(e) { console.warn('JSON 解析失敗，切換 mock'); }
  }

  // Fallback mock 題庫
  await new Promise(r => setTimeout(r, 800));
  const pool = [];
  if (subject === '英語') {
    pool.push({ q: 'Which sentence is correct?', opts: ['I am play.', 'I playing.', 'I am playing.', 'I plays.'], a: 2, exp: '現在進行式 = be動詞 + V-ing。' });
    pool.push({ q: 'He ___ TV now.', opts: ['watch', 'watching', 'is watching', 'are watching'], a: 2, exp: '主詞 He 用 is。' });
    pool.push({ q: 'They ___ (run) in the park.', opts: ['running', 'are running', 'is running', 'run'], a: 1, exp: '主詞 They 用 are。' });
    pool.push({ q: '___ she reading a book?', opts: ['Is', 'Are', 'Do', 'Does'], a: 0, exp: '疑問句把 be 動詞移到前面。' });
    pool.push({ q: 'I ___ not crying.', opts: ['is', 'are', 'am', 'do'], a: 2, exp: '主詞 I 搭配 am。' });
  } else if (subject === '數學') {
    pool.push({ q: '計算 10 + 6 x 2 的值是多少？', opts: ['32', '28', '20', '22'], a: 3, exp: '四則混合運算要先乘除後加減。' });
    pool.push({ q: '小明每分鐘走 71 公尺，走了 5 分鐘，共走幾公尺？', opts: ['284', '360', '355', '76'], a: 2, exp: '距離 = 速率 x 時間。' });
    pool.push({ q: '一個長方體長 11 公分、寬 5 公分、高 9 公分，體積是多少立方公分？', opts: ['500', '495', '64', '486'], a: 1, exp: '長方體體積 = 長 x 寬 x 高。' });
    pool.push({ q: '以 330 為基準量，若比較量是基準量的 40%，比較量是多少？', opts: ['132', '370', '290', '152'], a: 0, exp: '比較量 = 基準量 x 百分率。' });
    pool.push({ q: '有 7 件上衣和 4 件褲子，每次各選一件，共有幾種搭配方式？', opts: ['11', '35', '27', '28'], a: 3, exp: '搭配問題可用乘法原理。' });
  } else if (subject === '自然') {
    pool.push({ q: '植物行光合作用需要什麼氣體？', opts: ['氧氣', '二氧化碳', '氮氣', '氫氣'], a: 1, exp: '光合作用吸收二氧化碳，釋放氧氣。' });
    pool.push({ q: '哪一部分負責吸收水分？', opts: ['葉子', '莖', '根', '花'], a: 2, exp: '根部從土壤吸收水分。' });
    pool.push({ q: '植物的「血管」是哪部分？', opts: ['葉脈', '維管束', '表皮', '氣孔'], a: 1, exp: '維管束輸送水分和養分。' });
    pool.push({ q: '地球自轉一圈需要多少時間？', opts: ['一天', '一個月', '一年', '一小時'], a: 0, exp: '地球自轉一圈為一天（約24小時）。' });
    pool.push({ q: '下列哪種物質會被磁鐵吸引？', opts: ['銅線', '鋁罐', '鐵釘', '塑膠尺'], a: 2, exp: '磁鐵能吸引鐵製品。' });
  } else if (subject === '國語') {
    pool.push({ q: '下列哪個字的部首是「水」部？', opts: ['江', '樹', '山', '火'], a: 0, exp: '「江」的部首是水部。' });
    pool.push({ q: '「興高采烈」的意思是？', opts: ['生氣的樣子', '非常高興的樣子', '難過的樣子', '害怕的樣子'], a: 1, exp: '形容非常高興、興致勃勃的樣子。' });
    pool.push({ q: '下列哪個詞語是「反義詞」？', opts: ['高興/快樂', '黑/白', '美麗/漂亮', '大/巨大'], a: 1, exp: '黑和白意思相反。' });
    pool.push({ q: '「春眠不覺曉，處處聞啼鳥」是誰的詩句？', opts: ['李白', '杜甫', '孟浩然', '白居易'], a: 2, exp: '出自孟浩然的《春曉》。' });
    pool.push({ q: '下列何者的詞性與「跑步」相同？', opts: ['漂亮', '蘋果', '唱歌', '紅色'], a: 2, exp: '「跑步」與「唱歌」皆為動詞。' });
  } else if (subject === '社會') {
    pool.push({ q: '台灣最長的河流是？', opts: ['淡水河', '濁水溪', '大甲溪', '高屏溪'], a: 1, exp: '濁水溪是台灣最長的河流。' });
    pool.push({ q: '台灣的原住民族中，目前人口最多的是？', opts: ['阿美族', '排灣族', '泰雅族', '布農族'], a: 0, exp: '目前阿美族人口最多。' });
    pool.push({ q: '台灣的氣候主要屬於？', opts: ['寒帶氣候', '溫帶氣候', '熱帶/副熱帶季風氣候', '乾燥氣候'], a: 2, exp: '台灣主要為熱帶與副熱帶季風氣候。' });
    pool.push({ q: '下列哪個城市被稱為台灣的「首都」？', opts: ['高雄市', '台中市', '台北市', '台南市'], a: 2, exp: '台北市為台灣的政治與經濟中心。' });
    pool.push({ q: '鄭成功來台的主要目的是為了什麼？', opts: ['反清復明', '發展貿易', '尋找黃金', '建立國家'], a: 0, exp: '鄭成功以台灣為反清復明的基地。' });
  } else {
    for (let i = 0; i < count; i++) {
      pool.push({ q: `關於「${topic}」第 ${i+1} 題（${edition} ${grade}年級）`, opts: ['選項A', '選項B', '選項C', '選項D'], a: 0, exp: 'Mock 示範題。' });
    }
  }
  const shuffled = pool.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count).map(q => ({ q: q.q, opts: q.opts, a: q.a, exp: q.exp || '太棒了！', aiGenerated: false }));
}

// --- 派題選單動態生成 ---
function renderParentMsg(db) {
  const select = document.getElementById('topic-subject');
  const btn = document.getElementById('gen-btn');
  
  if (select) {
    const editions = db.profile?.editions || {};
    const subs = Object.keys(editions);
    const activityCategories = [...new Set((db.activities || []).map(a => a.category))];
    
    select.innerHTML = subs.map(s => `<option value="${s}">${s}</option>`).join('') +
                       activityCategories.map(c => `<option value="${c}">⭐ ${c}</option>`).join('');
                       
    select.onchange = (e) => {
      const isActivity = activityCategories.includes(e.target.value);
      if(btn) btn.textContent = isActivity ? '直接派發任務 →' : '從題庫生成 →';
    };
    
    // Trigger onchange to set initial button state
    if(select.value) {
      const isActivity = activityCategories.includes(select.value);
      if(btn) btn.textContent = isActivity ? '直接派發任務 →' : '從題庫生成 →';
    }
  }
}

let tempTaskId = null;
let mockGeneratedQuiz = [];

async function generateQuiz() {
  const topic = document.getElementById('topic-input').value;
  const subject = document.getElementById('topic-subject').value;
  if (!topic.trim()) return alert('請輸入主題');

  const db = getDB();
  const activityCategories = [...new Set((db.activities || []).map(a => a.category))];
  const isActivity = activityCategories.includes(subject);

  const btn = document.getElementById('gen-btn');
  btn.disabled = true;

  if (isActivity) {
    btn.textContent = '派發中...';
    try {
      const familyId = localStorage.getItem('learnmate_family_id');
      const resp = await apiFetch(`${API_BASE}/api/tasks/create-activity`, {
        method: 'POST',
        body: JSON.stringify({ familyId, subject, topic })
      });
      const data = await resp.json();
      if (data.success) {
        await syncState();
        alert('非學科任務已自動派發給學生！');
        document.getElementById('topic-input').value = '';
        updateScreenData(currentScreen);
      } else {
        alert('派發失敗：' + data.error);
      }
    } catch (e) {
      alert('網路連線失敗：' + e.message);
    }
    btn.disabled = false;
    btn.textContent = '直接派發任務 →';
    return;
  }

  btn.textContent = '✨ Gemini AI 生成中...';

  try {
    const familyId = localStorage.getItem('learnmate_family_id');
    const grade = db.profile?.grade || '5';
    const edition = db.profile?.editions?.[subject] || '康軒版';

    const resp = await apiFetch(`${API_BASE}/api/tasks/generate`, {
      method: 'POST',
      body: JSON.stringify({
        subject,
        topic,
        grade,
        edition,
        familyId,
        count: 4
      })
    });

    const data = await resp.json();
    if (data.success && data.task) {
      tempTaskId = data.task._id;
      mockGeneratedQuiz = data.task.questions;

      const isAI = data.aiGenerated;
      btn.disabled = false;
      btn.textContent = isAI ? '重新生成 (Gemini AI) →' : '重新生成 →';
      document.getElementById('preview-box').style.display = 'block';
      document.getElementById('published-box').style.display = 'none';

      const list = document.getElementById('quiz-preview-list');
      const badge = isAI
        ? `<span style="background:#e8f5e9;color:#2d4a3e;font-size:9px;font-weight:500;padding:2px 7px;border-radius:8px;margin-left:6px">✨ Gemini AI 生成 (經 Critic 審查 ${data.criticAttempts || 1} 次)</span>`
        : `<span style="background:#f3f4f6;color:#6b7280;font-size:9px;padding:2px 7px;border-radius:8px;margin-left:6px">題庫 DB 模式</span>`;
      
      list.innerHTML = `<div style="margin-bottom:8px">${badge}</div>` + mockGeneratedQuiz.map((mq, i) => `
        <div class="pq"><div class="pq-num">Q${i+1}</div><div class="pq-q">${mq.q}</div>
          ${mq.opts.map((opt, j) => `<div class="pq-opt ${j===mq.a?'correct-opt':''}">${String.fromCharCode(65+j)}. ${opt} ${j===mq.a?'✓':''}</div>`).join('')}
          <div style="font-size:10px;color:#888;margin-top:4px;border-top:1px dashed #ddd;padding-top:4px">解析: ${mq.exp || '太棒了！'}</div>
        </div>
      `).join('');
    } else {
      throw new Error(data.error || '後端生成出錯');
    }
  } catch (e) {
    btn.disabled = false;
    btn.textContent = '重試生成';
    alert('生成失敗，請再試一次。原因：' + e.message);
  }
}

async function hidePreview() {
  if (tempTaskId) {
    try {
      await apiFetch(`${API_BASE}/api/tasks/${tempTaskId}`, {
        method: 'DELETE'
      });
      console.log('🗑️ [Preview Cancel] 已清理臨時任務：', tempTaskId);
    } catch (e) {
      console.warn('清理臨時任務失敗：', e.message);
    }
    tempTaskId = null;
  }
  document.getElementById('preview-box').style.display = 'none';
}

async function publishQuiz() {
  tempTaskId = null; // 標記為正式確認
  await syncState();
  
  document.getElementById('preview-box').style.display = 'none';
  document.getElementById('published-box').style.display = 'block';
  setTimeout(() => document.getElementById('published-box').style.display = 'none', 3000);
  document.getElementById('topic-input').value = '';
}

// --- 家長設定與獎勵管理邏輯 ---
function renderParentSettings(db) {
  document.getElementById('set-grade').value = db.profile.grade;
  ['國語','數學','社會','自然','英語'].forEach(sub => {
    const el = document.getElementById(`set-ed-${sub}`);
    if(el) el.value = (db.profile.editions instanceof Map ? db.profile.editions.get(sub) : db.profile.editions[sub]) || '通用版';
  });
  loadProgressTuningPanel();
}

function saveSettings() {
  const db = getDB();
  db.profile.grade = document.getElementById('set-grade').value;
  ['國語','數學','社會','自然','英語'].forEach(sub => {
    const el = document.getElementById(`set-ed-${sub}`);
    if(el) db.profile.editions[sub] = el.value;
  });
  saveDB(db);
  alert('設定已儲存！');
}

// --- 習慣管理 (Mock) ---
function renderHabitsScreen(db) {
  const list = document.getElementById('habits-list');
  if (!list) return;
  const activities = db.activities || [];
  if (activities.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:20px;color:#9ca3af;font-size:12px">尚未設定任何習慣</div>';
    return;
  }
  const catIcon = { '才藝':'🎵', '運動':'🏃', '家事':'🏠', '其他':'⭐' };
  list.innerHTML = activities.map(a => `
    <div style="display:flex;align-items:center;gap:10px;background:#fff;border-radius:8px;padding:10px 12px;margin-bottom:6px;border:1px solid #e5e7eb">
      <div style="font-size:22px">${a.icon || catIcon[a.category] || '⭐'}</div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:500;color:#0f0f14">${a.name}</div>
        <div style="font-size:10px;color:#9ca3af">${catIcon[a.category] || ''} ${a.category} · ${a.points} 點</div>
      </div>
      <div onclick="deleteHabit('${a.id}')" style="color:#ef4444;font-size:18px;cursor:pointer;padding:0 4px">×</div>
    </div>
  `).join('');
}

function addHabit() {
  const name = document.getElementById('habit-name').value.trim();
  const icon = document.getElementById('habit-icon').value.trim() || '⭐';
  const category = document.getElementById('habit-category').value;
  const points = parseInt(document.getElementById('habit-points').value) || 10;
  if (!name) return alert('請輸入習慣名稱');
  const db = getDB();
  if(!db.activities) db.activities = [];
  const actId = Date.now().toString();
  db.activities.push({ id: actId, name, icon, category, points });
  
  // 同步派送到學生的任務清單中
  db.tasks.push({ 
    id: 'act_' + actId, 
    subject: category, 
    topic: name, 
    status: 'pending', 
    points: points, 
    isHabit: true, 
    icon: icon 
  });
  saveDB(db);
  document.getElementById('habit-name').value = '';
  document.getElementById('habit-icon').value = '⭐';
  document.getElementById('habit-points').value = '10';
  updateScreenData(currentScreen);
}

function deleteHabit(activityId) {
  if (!confirm('確定要刪除這個習慣嗎？')) return;
  const db = getDB();
  if(!db.activities) return;
  db.activities = db.activities.filter(a => a.id !== activityId);
  saveDB(db);
  updateScreenData(currentScreen);
}

function renderParentRewards(db) {
  const list = document.getElementById('p-rewards-list');
  const activeRewards = db.rewards.filter(r => r.status === 'ready');
  const proposedRewards = db.rewards.filter(r => r.status === 'proposed');
  const requests = db.rewardRequests.filter(r => r.status === 'pending');

  let html = `<div style="font-size:13px;font-weight:500;margin-bottom:8px">獎勵清單</div>`;
  activeRewards.forEach(r => {
    html += `
      <div class="alert-row" style="background:#fff;border-radius:8px;padding:10px;margin-bottom:6px;border:0.5px solid #e5e7eb;align-items:center">
        <div style="font-size:20px;margin-right:10px">${r.icon}</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:500">${r.name}</div>
          <div style="font-size:10px;color:#888">${r.cost} 點</div>
        </div>
      </div>
    `;
  });

  if(proposedRewards.length > 0) {
    html += `<div style="font-size:13px;font-weight:500;margin:14px 0 8px;color:#92600a">孩子提議的新獎勵</div>`;
    proposedRewards.forEach(r => {
      html += `
        <div style="background:#fffbeb;border:1px solid #f6c344;border-radius:8px;padding:10px;margin-bottom:6px">
          <div style="font-size:13px;font-weight:500;margin-bottom:4px">${r.icon} ${r.name}</div>
          <div style="display:flex;gap:6px">
            <button class="p-btn p-btn-dark" style="font-size:10px" onclick="approveProposal(${r.id})">同意並設定點數</button>
            <button class="p-btn p-btn-ghost" style="font-size:10px" onclick="rejectProposal(${r.id})">婉拒</button>
          </div>
        </div>
      `;
    });
  }

  if(requests.length > 0) {
    html += `<div style="font-size:13px;font-weight:500;margin:14px 0 8px;color:#276749">待審核兌換</div>`;
    requests.forEach(req => {
      const r = db.rewards.find(x => x.id === req.rewardId);
      if(r) {
        html += `
          <div style="background:#f0fff4;border:1px solid #9ae6b4;border-radius:8px;padding:10px;margin-bottom:6px;display:flex;align-items:center">
            <div style="font-size:20px;margin-right:10px">${r.icon}</div>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:500">${r.name}</div>
              <div style="font-size:10px;color:#276749">扣 ${r.cost} 點</div>
            </div>
            <div style="display:flex;gap:6px">
              <button class="p-btn p-btn-green" style="font-size:10px" onclick="approveRedeem(${req.id})">同意並留言</button>
              <button class="p-btn p-btn-ghost" style="font-size:10px" onclick="rejectRedeem(${req.id})">婉拒</button>
            </div>
          </div>
        `;
      }
    });
  }
  list.innerHTML = html;
}

function approveProposal(id) {
  const pts = prompt('請設定這個獎勵需要的點數 (例如: 200)');
  if(pts) {
    const db = getDB();
    const r = db.rewards.find(x => x.id === id);
    if(r) { 
      r.status = 'ready'; 
      r.cost = parseInt(pts, 10); 
      const defaultMsg = `太棒了！爸媽同意了你的新獎勵「${r.icon} ${r.name}」，目標是 ${r.cost} 點，繼續加油喔！`;
      const msg = prompt('要順便留言給孩子嗎？', defaultMsg);
      if (msg !== null && msg.trim() !== '') db.messages.push(msg);
      saveDB(db); 
      renderParentRewards(db); 
      alert('設定完成！即將切換回學生端看結果。');
      switchToStudentRewards();
    }
  }
}
function rejectProposal(id) {
  const msg = prompt('請告訴孩子為什麼婉拒這個提議？(例如：這個不適合現在)');
  const db = getDB();
  const r = db.rewards.find(x => x.id === id);
  if (msg && msg.trim() !== '' && r) db.messages.push(`關於「${r.icon} ${r.name}」的許願：${msg}`);
  db.rewards = db.rewards.filter(x => x.id !== id);
  saveDB(db); renderParentRewards(db);
}
function approveRedeem(reqId) {
  const db = getDB();
  const req = db.rewardRequests.find(x => x.id === reqId);
  if(req) { 
    req.status = 'approved'; 
    const r = db.rewards.find(x => x.id === req.rewardId);
    if(r) {
      const defaultMsg = `恭喜！爸媽同意了你的兌換「${r.icon} ${r.name}」，請去跟爸媽領取獎勵吧！`;
      const msg = prompt('要順便留個言給孩子嗎？', defaultMsg);
      if (msg !== null && msg.trim() !== '') db.messages.push(msg);
    }
    saveDB(db); 
    renderParentRewards(db); 
    alert('已同意兌換！即將切換回學生端看結果。'); 
    switchToStudentRewards();
  }
}
function rejectRedeem(reqId) {
  const msg = prompt('請告訴孩子為什麼婉拒這個兌換？(例如：今天太晚了，明天再換)');
  if (msg !== null) {
    const db = getDB();
    const req = db.rewardRequests.find(x => x.id === reqId);
    if(req) {
      const r = db.rewards.find(x => x.id === req.rewardId);
      if (msg.trim() !== '' && r) db.messages.push(`關於「${r.icon} ${r.name}」的兌換：${msg}`);
      if(r) db.points += r.cost; // Refund points
      db.rewardRequests = db.rewardRequests.filter(x => x.id !== reqId);
      saveDB(db);
      renderParentRewards(db);
      alert('已婉拒，點數已退還！');
    }
  }
}

async function approveExtra(taskId) {
  const msg = prompt('確認完成！要順便給孩子留言鼓勵嗎？(可留空不填)', '');
  if (msg === null) return;
  
  try {
    const familyId = localStorage.getItem('learnmate_family_id');
    const resp = await apiFetch(`${API_BASE}/api/tasks/approve-extra`, {
      method: 'POST',
      body: JSON.stringify({
        familyId,
        taskId,
        message: msg
      })
    });
    if (resp.ok) {
      await syncState();
      alert('已確認完成！積分已成功發放給孩子。');
    }
  } catch (e) {
    alert('操作失敗：' + e.message);
  }
}

async function rejectExtra(taskId) {
  const msg = prompt('請告訴孩子為什麼需要重做？', '請再認真完成一次！');
  if (msg === null) return;
  
  try {
    const familyId = localStorage.getItem('learnmate_family_id');
    const resp = await apiFetch(`${API_BASE}/api/tasks/reject-extra`, {
      method: 'POST',
      body: JSON.stringify({
        familyId,
        taskId,
        message: msg
      })
    });
    if (resp.ok) {
      await syncState();
      alert('已退回，孩子會收到通知。');
    }
  } catch (e) {
    alert('操作失敗：' + e.message);
  }
}

function switchToStudentRewards() {
  const current = document.getElementById(currentScreen);
  if(current) current.classList.remove('active');
  currentUser = 'student';
  currentScreen = 'screen-student-rewards';
  document.getElementById('screen-student-rewards').classList.add('active');
  updateScreenData(currentScreen);
}

// --- 學生端邏輯 ---
function renderStudentHome(db) {
  document.getElementById('s-streak-days').textContent = db.streak;
  
  const completed = db.tasks.filter(t => t.status === 'completed').length;
  const total = db.tasks.length;
  document.getElementById('s-tasks-completed').textContent = completed;
  document.getElementById('s-tasks-total').textContent = `/${total}`;
  
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  // CSS hack for progress ring, just visual approx
  const deg = 45 + (pct/100)*360; 
  document.getElementById('s-progress-ring').style.transform = `rotate(${deg>225?225:deg}deg)`;

  // Messages
  const msgContainer = document.getElementById('s-messages-container');
  if(db.messages.length > 0) {
    const lastMsg = db.messages[db.messages.length-1];
    msgContainer.innerHTML = `
      <div style="background:#F0FFF4;border:0.5px solid #9AE6B4;border-radius:10px;padding:9px 12px;margin-bottom:9px">
        <div style="font-size:10px;font-weight:500;color:#276749;margin-bottom:3px">爸媽留言：</div>
        <div style="font-size:12px;color:#0f0f14;line-height:1.5;">${lastMsg}</div>
      </div>
    `;
  } else {
    msgContainer.innerHTML = '';
  }

  // Tasks
  const taskList = document.getElementById('s-tasks-list');
  taskList.innerHTML = db.tasks.map(t => {
    let icon = '📖';
    if(t.subject==='數學') icon='🔢'; else if(t.subject==='社會') icon='🌍'; else if(t.subject==='英語') icon='💬'; else if(t.subject==='自然') icon='🔬';
    if(t.isHabit && t.icon) icon = t.icon;
    
    let edition = db.profile && db.profile.editions ? db.profile.editions[t.subject] || '通用版' : '通用版';
    if(t.isHabit) edition = '習慣與活動';

    if(t.status === 'completed') {
      return `
        <div class="subj-row">
          <div class="subj-icon" style="background:#e5e7eb"><span style="font-size:15px">${icon}</span></div>
          <div style="flex:1"><div class="subj-name">${t.subject}</div><div class="subj-meta">${t.topic} · ${edition} ✓</div></div>
          <span style="background:#C6F6D5;color:#276749;font-size:9px;font-weight:500;padding:2px 7px;border-radius:10px">✓ 完成</span>
        </div>
      `;
    } else {
      return `
        <div class="subj-row" style="background:rgba(26,26,46,0.03);border-radius:8px;padding:8px;margin:4px -2px;border:1px solid #1a1a2e">
          <div class="subj-icon" style="background:#FEFCBF"><span style="font-size:15px">${icon}</span></div>
          <div style="flex:1"><div class="subj-name">${t.subject}</div><div class="subj-meta">${t.topic} · ${edition}</div></div>
          <div style="display:flex;gap:5px">
            <div onclick="${t.isHabit ? `finishHabit('${t.id}')` : `startQuiz('${t._id || t.id}', '${t.subject}')`}" class="p-btn p-btn-dark" style="font-size:11px;padding:5px 10px">${t.isHabit ? '完成打卡' : '開始'}</div>
            <div onclick="prepSkip('${t._id || t.id}', '${t.subject}')" class="p-btn p-btn-ghost" style="font-size:11px;padding:5px 10px">先跳過?</div>
          </div>
        </div>
      `;
    }
  }).join('');
}

function renderStudentChoose(db) {
  const list = document.getElementById('s-choose-list');
  const pending = db.tasks.filter(t => t.status === 'pending');
  
  if(pending.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:20px;color:#9ca3af;font-size:12px;">今天任務已全數完成！🎉</div>';
    return;
  }
  
  list.innerHTML = pending.map(t => {
    let icon = '📖';
    if(t.subject==='數學') icon='🔢'; else if(t.subject==='社會') icon='🌍'; else if(t.subject==='英語') icon='💬'; else if(t.subject==='自然') icon='🔬';
    if(t.isHabit && t.icon) icon = t.icon;
    return `
      <div class="drag-card" onclick="${t.isHabit ? `finishHabit('${t.id}')` : `startQuiz('${t._id || t.id}', '${t.subject}')`}">
        <div style="font-size:15px;color:#d1d5db;padding-right:2px">⋮⋮</div>
        <div class="subj-icon" style="background:#f3f4f6;width:34px;height:34px"><span style="font-size:15px">${icon}</span></div>
        <div style="flex:1"><div style="font-size:13px;font-weight:500;color:#0f0f14">${t.subject} · ${t.topic}</div></div>
        <div class="p-btn p-btn-dark" style="font-size:11px;padding:5px 10px">${t.isHabit ? '打卡' : '開始'}</div>
      </div>
    `;
  }).join('');
}

function renderStudentRewards(db) {
  document.getElementById('s-rewards-pts').textContent = db.points;
  document.getElementById('s-rewards-streak').textContent = db.streak;
  
  const list = document.getElementById('s-rewards-list');
  const readyRewards = db.rewards.filter(r => r.status === 'ready');
  const proposedRewards = db.rewards.filter(r => r.status === 'proposed');
  const approvedRequests = db.rewardRequests.filter(r => r.status === 'approved');
  
  let html = '';
  
  // 已核准兌換的獎勵 (可使用)
  if(approvedRequests.length > 0) {
    html += `<div style="font-size:13px;font-weight:500;margin-bottom:8px;color:#276749">✨ 已經可以去領取的獎勵</div>`;
    approvedRequests.forEach(req => {
      const r = db.rewards.find(x => x.id === req.rewardId);
      if(r) {
        html += `
          <div class="reward-item" style="background:#F0FFF4;border:1px solid #9AE6B4;border-radius:10px;padding:10px;margin-bottom:8px">
            <div style="font-size:24px;flex-shrink:0">${r.icon}</div>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:500;color:#0f0f14">${r.name}</div>
              <div style="font-size:10px;color:#276749;margin-top:3px">爸媽已同意，趕快去領取！</div>
            </div>
            <div class="p-btn p-btn-ghost" style="font-size:10px;padding:5px 9px;opacity:0.6" onclick="useApprovedReward(${req.id})">標記為已使用</div>
          </div>
        `;
      }
    });
    html += `<div style="height:1px;background:#e5e7eb;margin:12px 0"></div>`;
  }

  // 等待家長審核的提議
  if(proposedRewards.length > 0) {
    html += `<div style="font-size:13px;font-weight:500;margin-bottom:8px;color:#92600a">⏳ 等待爸媽設定點數的提議</div>`;
    proposedRewards.forEach(r => {
      html += `
        <div class="reward-item" style="background:#FFFBEB;border:1px dashed #ECC94B;border-radius:10px;padding:10px;margin-bottom:8px">
          <div style="font-size:24px;flex-shrink:0">${r.icon}</div>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:500;color:#0f0f14">${r.name}</div>
            <div style="font-size:10px;color:#975A16;margin-top:3px">審核中...</div>
          </div>
        </div>
      `;
    });
    html += `<div style="height:1px;background:#e5e7eb;margin:12px 0"></div>`;
  }

  html += `<div style="font-size:13px;font-weight:500;margin-bottom:8px">所有可兌換項目</div>`;
  
  html += readyRewards.map(r => {
    const canAfford = db.points >= r.cost;
    const isPending = db.rewardRequests.some(req => req.rewardId === r.id && req.status === 'pending');
    const pct = Math.min(100, Math.round((db.points/r.cost)*100));
    
    let btnHtml = '';
    if(isPending) {
      btnHtml = `<div class="p-btn p-btn-ghost" style="font-size:10px;padding:5px 9px;flex-shrink:0;opacity:0.6">審核中...</div>`;
    } else if(canAfford) {
      btnHtml = `<div onclick="claimReward(${r.id})" class="p-btn p-btn-green" style="font-size:10px;padding:5px 9px;flex-shrink:0">申請兌換</div>`;
    } else {
      btnHtml = `<div class="p-btn p-btn-ghost" style="font-size:10px;padding:5px 9px;flex-shrink:0;opacity:0.5">尚未解鎖</div>`;
    }

    return `
      <div class="reward-item">
        <div style="font-size:24px;flex-shrink:0">${r.icon}</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:500;color:#0f0f14">${r.name}</div>
          <div style="font-size:10px;color:#9ca3af;margin-top:1px">${r.cost}點</div>
          <div class="pbar" style="width:100%;margin-top:5px"><div class="pbar-fill" style="width:${pct}%;background:${canAfford?'#22c55e':'#1a1a2e'}"></div></div>
          <div style="font-size:10px;color:${canAfford?'#22c55e':'#9ca3af'};margin-top:3px">${canAfford?'✓ 可以換了！':`還差 ${r.cost - db.points} 點`}</div>
        </div>
        ${btnHtml}
      </div>
    `;
  }).join('');
  
  list.innerHTML = html;
}

function useApprovedReward(reqId) {
  const db = getDB();
  db.rewardRequests = db.rewardRequests.filter(req => req.id !== reqId);
  saveDB(db);
  renderStudentRewards(db);
}

function claimReward(id) {
  const db = getDB();
  const reward = db.rewards.find(r => r.id === id);
  if(reward && db.points >= reward.cost) {
    db.points -= reward.cost;
    db.rewardRequests.push({ id: Date.now(), rewardId: id, date: new Date().toISOString(), status: 'pending' });
    db.alerts.unshift({ id: Date.now(), type: 'positive', title: `🎁 兌換申請：${reward.name}`, desc: `孩子花費了 ${reward.cost} 點申請兌換「${reward.icon} ${reward.name}」，請前往獎勵設定審核。` });
    saveDB(db);
    renderStudentRewards(db);
    alert('已送出兌換申請！爸媽會收到通知。');
  }
}

function proposeReward() {
  const name = prompt('你想新增什麼獎勵？');
  if(!name) return;
  const icon = prompt('選一個表情符號代表它？', '🎁') || '🎁';
  const db = getDB();
  db.rewards.push({ id: Date.now(), name, icon, cost: 0, proposedBy: 'student', status: 'proposed' });
  db.alerts.unshift({ id: Date.now(), type: 'positive', title: `✨ 新獎勵許願：${name}`, desc: `孩子提議將「${icon} ${name}」加入獎勵清單，前往設定這需要多少點數吧！` });
  saveDB(db);
  alert('提議已送出！等待爸媽同意並設定點數。');
}

function renderStudentExtra(db) {
  const list = document.getElementById('s-extra-list');
  const pendingExtra = (db.extraTasks || []).filter(t => !t.status || t.status === 'pending');
  if(pendingExtra.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:20px;color:#9ca3af;font-size:12px;">目前沒有加強練習。</div>';
    return;
  }
  
  const clearBtn = `<div style="text-align: right; margin-bottom: 8px;"><span onclick="clearExtraTasks()" style="font-size: 11px; color: #ef4444; cursor: pointer; padding: 4px;">🗑️ 清除所有派題</span></div>`;
  
  list.innerHTML = clearBtn + pendingExtra.map(t => `
    <div class="p-card">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="flex:1">
          <div style="font-size:13px;font-weight:500;color:#0f0f14;margin-bottom:5px">${t.subject} · ${t.topic}</div>
          <div style="font-size:10px;color:#9ca3af">${t.questions.length} 題 · +15點</div>
        </div>
        <div onclick="startExtraQuiz('${t._id || t.id}')" class="p-btn p-btn-green" style="font-size:12px;padding:8px 14px;flex-shrink:0">開始練習</div>
      </div>
    </div>
  `).join('');
}

function clearExtraTasks() {
  if(!confirm('確定要清除所有家長派題(加強練習)嗎？')) return;
  const db = getDB();
  db.extraTasks = [];
  saveDB(db);
  alert('已清除所有加強練習！');
  updateScreenData(currentScreen);
}

// --- 測驗系統邏輯 ---
let activeQuiz = null; // { type: 'daily'|'extra', id, questions: [], currentIdx: 0 }
let selectedOption = null;

const MOCK_QUESTIONS = [
  { q:'哪一個句子正確使用了「現在進行式」？', opts:['She play basketball now.','He is eating lunch at school.','They are run in the park.','I am watches TV.'], a:1, exp:'現在進行式 = be動詞 + V-ing。B 完全正確。' },
  { q:'Tom ___ (run) in the park right now.', opts:['run','is running','runs','running'], a:1, exp:'主詞 Tom 用 is，run → is running。' },
  { q:'以下哪個句子是錯誤的？', opts:['She is dancing.','We are playing.','He are reading.','I am writing.'], a:2, exp:'主詞 He 應用 is 而非 are。' }
];

async function startQuiz(taskId, subject) {
  const db = getDB();
  const familyId = localStorage.getItem('learnmate_family_id');
  const grade = db.profile?.grade || '5';
  const edition = db.profile?.editions?.[subject] || '康軒版';

  // 先切換畫面，顯示 loading
  document.getElementById('s-quiz-subject').textContent = subject;
  activeQuiz = { type: 'daily', id: taskId, questions: [], currentIdx: 0, correctCount: 0 };
  navTo('screen-student-quiz');

  // 顯示 loading 狀態
  document.getElementById('qtext').textContent = '✨ AI 正在為你生成專屬題目...';
  document.getElementById('opts').innerHTML = `
    <div style="text-align:center;padding:20px;color:#9ca3af;font-size:12px">
      <div style="font-size:24px;margin-bottom:8px">🤖</div>
      Gemini AI 多 Agent 協同命題與進度偵測中...
    </div>`;
  document.getElementById('qdots').innerHTML = '';
  document.getElementById('explain').style.display = 'none';
  document.getElementById('next-btn').style.display = 'none';
  document.getElementById('pts-label').textContent = '準備中...';

  try {
    const resp = await apiFetch(`${API_BASE}/api/tasks/generate`, {
      method: 'POST',
      body: JSON.stringify({
        subject,
        topic: '', // 留空以觸發後端的教材進度預估與偏差微調
        grade,
        edition,
        familyId,
        count: 5
      })
    });
    
    if (!resp.ok) {
      throw new Error('伺服器出題失敗');
    }
    
    const data = await resp.json();
    if (data.success && data.task && data.task.questions) {
      activeQuiz.id = data.task._id;
      activeQuiz.questions = data.task.questions.map(q => ({
        q: q.q,
        opts: q.opts,
        a: q.a,
        exp: q.exp || '太棒了！'
      }));
      renderQuizQ();
      
      // 同步最新狀態
      await syncState();
    } else {
      throw new Error(data.error || '後端回傳格式錯誤');
    }
  } catch (e) {
    console.error('出題失敗，改採 Mock 備用題庫：', e.message);
    const questions = await fetchAIQuestions(subject, subject, 5);
    activeQuiz.questions = questions;
    renderQuizQ();
  }
}

function startExtraQuiz(extraId) {
  const db = getDB();
  const task = db.extraTasks.find(t => String(t.id) === String(extraId) || String(t._id) === String(extraId));
  if(!task) return;
  document.getElementById('s-quiz-subject').textContent = task.subject + ' (加強)';
  activeQuiz = { type: 'extra', id: extraId, questions: task.questions.map(q => ({q:q.q, opts:q.opts, a:q.a, exp:'很棒！'})), currentIdx: 0 };
  navTo('screen-student-quiz');
  renderQuizQ();
}

function renderQuizQ() {
  if (!activeQuiz.questions || activeQuiz.questions.length === 0) return; // AI 尚未載入
  const q = activeQuiz.questions[activeQuiz.currentIdx];
  document.getElementById('qnum').textContent = `QUESTION ${activeQuiz.currentIdx + 1}`;
  document.getElementById('qcounter').textContent = `${activeQuiz.currentIdx + 1} / ${activeQuiz.questions.length} 題`;
  document.getElementById('qtext').textContent = q.q;
  
  const dots = document.getElementById('qdots');
  dots.innerHTML = activeQuiz.questions.map((_, i) => `<div class="sdot ${i < activeQuiz.currentIdx ? 'done' : i === activeQuiz.currentIdx ? 'cur' : ''}"></div>`).join('');
  
  const optsEl = document.getElementById('opts');
  optsEl.innerHTML = q.opts.map((opt, i) => `
    <div class="opt" onclick="selectOpt(this, ${i})">
      <div class="opt-letter">${String.fromCharCode(65+i)}</div>
      <div class="opt-text">${opt}</div>
    </div>
  `).join('');
  
  document.getElementById('explain').style.display = 'none';
  document.getElementById('next-btn').style.display = 'none';
  document.getElementById('pts-label').textContent = '選擇你的答案';
  selectedOption = null;
  
  const fbBtn = document.getElementById('feedback-trigger-btn');
  if (fbBtn) fbBtn.style.display = 'none';
}

function selectOpt(el, idx) {
  if (selectedOption !== null) return; // 已經選過了
  selectedOption = idx;
  const q = activeQuiz.questions[activeQuiz.currentIdx];
  const isCorrect = idx === q.a;
  
  const opts = document.querySelectorAll('#opts .opt');
  opts.forEach((o, i) => {
    if(i === q.a) o.classList.add('correct');
    else if(i === idx && !isCorrect) o.classList.add('wrong');
  });
  
  const exp = document.getElementById('explain');
  exp.style.display = 'block';
  if(isCorrect) {
    exp.style.cssText = 'display:block;border-left:3px solid #22c55e;border-radius:0 8px 8px 0;background:#F0FFF4;padding:9px 11px;margin-bottom:10px';
    exp.innerHTML = `<div style="font-size:11px;font-weight:500;color:#276749;margin-bottom:3px">答對了！</div><div style="font-size:11px;color:#276749;line-height:1.5">${q.exp}</div>`;
    
    // 統計答對題數
    activeQuiz.correctCount = (activeQuiz.correctCount || 0) + 1;
    
    document.getElementById('pts-label').innerHTML = `+2 點 獲得中...<span class="points-float">+2 點！</span>`;
  } else {
    exp.style.cssText = 'display:block;border-left:3px solid #ef4444;border-radius:0 8px 8px 0;background:#FFF5F5;padding:9px 11px;margin-bottom:10px';
    exp.innerHTML = `<div style="font-size:11px;font-weight:500;color:#9B2C2C;margin-bottom:3px">沒關係，來看看解釋！</div><div style="font-size:11px;color:#9B2C2C;line-height:1.5">${q.exp}</div>`;
    document.getElementById('pts-label').textContent = '繼續加油！';
  }
  
  const fbBtn = document.getElementById('feedback-trigger-btn');
  if (fbBtn) fbBtn.style.display = 'block';
  
  document.getElementById('next-btn').style.display = 'block';
  if(activeQuiz.currentIdx === activeQuiz.questions.length - 1) {
    document.getElementById('next-btn').textContent = '完成測驗 →';
  }
}

function nextQ() {
  if(activeQuiz.currentIdx < activeQuiz.questions.length - 1) {
    activeQuiz.currentIdx++;
    renderQuizQ();
  } else {
    finishQuiz();
  }
}

async function finishQuiz() {
  const db = getDB();
  const familyId = localStorage.getItem('learnmate_family_id');
  const correctCount = activeQuiz.correctCount || 0;
  const totalCount = activeQuiz.questions.length || 5;
  const subject = document.getElementById('s-quiz-subject').textContent.replace(' (加強)', '');
  const earnedPoints = activeQuiz.type === 'daily' ? 10 : 15;

  try {
    // 1. 調用 complete API：新增答對點數（每題 2 點）、更新學科正確率、連勝 streak，以及判定徽章
    await apiFetch(`${API_BASE}/api/tasks/complete`, {
      method: 'POST',
      body: JSON.stringify({
        familyId,
        taskId: activeQuiz.id,
        pointsToAdd: correctCount * 2,
        correctCount,
        totalCount,
        subject
      })
    });

    // 2. 調用 submit API：將任務狀態設為 submitted，供家長審核
    await apiFetch(`${API_BASE}/api/tasks/submit`, {
      method: 'POST',
      body: JSON.stringify({
        taskId: activeQuiz.id,
        earnedPoints
      })
    });

    // 3. 同步最新狀態
    await syncState();
    alert(`測驗完成！您答對了 ${correctCount}/${totalCount} 題，獲得了 ${correctCount * 2} 答題金幣！任務已送交家長審核。`);
  } catch (e) {
    console.error('提交測驗失敗：', e.message);
    alert('網路異常，已將結果暫存於本地。');
  }

  navTo('screen-student-home');
}

function cancelQuiz() {
  if(confirm('確定要放棄當前測驗嗎？進度將不會保存。')) {
    navTo('screen-student-home');
  }
}

// --- 暫停功能邏輯 ---
let skipTaskId = null;
let skipReason = null;


function resetDemo() {
  if (confirm('確定要將測試資料完全還原到初始狀態嗎？\n這將會清除目前所有測試進度、已完成任務及自訂習慣。')) {
    localStorage.removeItem('learnmate_db');
    alert('資料已重置！系統將自動重新整理。');
    window.location.reload();
  }
}

function prepSkip(taskId, subject) {
  skipTaskId = taskId;
  document.getElementById('s-skip-subject').textContent = subject;
  document.getElementById('confirm-box').style.display = 'none';
  document.querySelectorAll('.reason').forEach(r => r.classList.remove('sel'));
  navTo('screen-student-skip');
}

function selReason(el, reason) {
  document.querySelectorAll('.reason').forEach(r => { r.classList.remove('sel'); r.querySelector('.radio').innerHTML=''; });
  el.classList.add('sel');
  el.querySelector('.radio').innerHTML = '<div class="radio-inner"></div>';
  skipReason = reason;
  document.getElementById('confirm-box').style.display = 'block';
  
  const text = document.getElementById('confirm-text');
  if(reason === '看不懂') {
    text.textContent = '跳過：扣 5 點 + 媽媽會立即收到緊急通知！明天優先排這科。';
  } else {
    text.textContent = '跳過：扣 5 點 + 爸媽會看到你選的原因。明天優先排這科。';
  }
}

async function confirmSkip() {
  try {
    const familyId = localStorage.getItem('learnmate_family_id');
    const resp = await apiFetch(`${API_BASE}/api/tasks/skip`, {
      method: 'POST',
      body: JSON.stringify({
        familyId,
        taskId: skipTaskId,
        reason: skipReason
      })
    });
    if (resp.ok) {
      await syncState();
      alert('已確認暫停，扣除 5 點，家長將會收到預警通知。');
    }
  } catch (e) {
    console.error('跳過任務失敗：', e.message);
    alert('操作失敗，請稍後重試。');
  }
  navTo('screen-student-home');
}

async function finishHabit(taskId) {
  const db = getDB();
  const task = db.tasks.find(t => String(t.id) === String(taskId));
  if(task) {
    try {
      const familyId = localStorage.getItem('learnmate_family_id');
      const resp = await apiFetch(`${API_BASE}/api/tasks/complete`, {
        method: 'POST',
        body: JSON.stringify({
          familyId,
          taskId,
          pointsToAdd: task.points || 10,
          correctCount: 0,
          totalCount: 0,
          subject: task.subject
        })
      });
      if (resp.ok) {
        // 完成打卡後，將狀態設為 submitted 送交家長確認
        await apiFetch(`${API_BASE}/api/tasks/submit`, {
          method: 'POST',
          body: JSON.stringify({ taskId, earnedPoints: task.points || 10 })
        });
        await syncState();
        alert(`打卡成功！已送出審查並獲得 ${task.points || 10} 點！`);
      }
    } catch (e) {
      console.error('打卡失敗：', e.message);
    }
  }
}

// --- 監聽 Storage 事件，實現跨分頁即時同步 ---
window.addEventListener('storage', (e) => {
  if (e.key === 'learnmate_db') {
    if (currentScreen !== 'screen-login') {
      updateScreenData(currentScreen);
    }
  }
});

// =========================================================
// ★ AI 影片推薦功能
// =========================================================
const SUBJECT_COLORS = { '英語':'#3b82f6','數學':'#f59e0b','自然':'#10b981','國語':'#8b5cf6','社會':'#ef4444' };

async function fetchAIVideoRecommendations(db) {
  const grade = db.profile?.grade || '5';
  const weakSubjects = db.tasks
    .filter(t => t.status === 'skipped' || t.subject === '英語')
    .map(t => t.subject)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join('、') || '英語';
  const topics = db.tasks.map(t => `${t.subject}:${t.topic}`).join('、');

  const prompt = `你是台灣小學${grade}年級學習顧問，請針對以下情況推薦 3 個適合的 YouTube 學習影片主題。
學生資訊：年級${grade}年級、需加強科目：${weakSubjects}、目前學習：${topics}
請以 JSON 格式回傳，只回傳 JSON，不要其他文字：
[{"title":"影片標題（繁體中文，生動有趣）","channel":"推薦頻道名稱","keyword":"YouTube搜尋關鍵字","subject":"科目","duration":"預估時長","desc":"一句話推薦理由"}]`;

  const rawText = await callGeminiAPI(prompt);
  if (rawText) {
    try {
      const parsed = JSON.parse(rawText);
      if (Array.isArray(parsed) && parsed.length > 0) return { videos: parsed, aiGenerated: true };
    } catch(e) { console.warn('影片推薦 JSON 解析失敗'); }
  }

  // Fallback
  return {
    aiGenerated: false,
    videos: [
      { title: '英語現在進行式超簡單！5分鐘學會', channel: '學習王國 LearnKing', keyword: '小學英語現在進行式教學', subject: '英語', duration: '5分鐘', desc: '用生動動畫讓你秒懂 am/is/are + V-ing，例句超豐富！' },
      { title: '分數加減法圖解教學，披薩不說謊', channel: '數感實驗室', keyword: '小學分數加減法 圖解', subject: '數學', duration: '8分鐘', desc: '用披薩和蛋糕圖解讓分數運算變得超直覺，一看就懂！' },
      { title: '植物的構造完整講解：根莖葉花果', channel: '科學小達人', keyword: '小學自然 植物構造 教學', subject: '自然', duration: '7分鐘', desc: '根莖葉花果種子一次搞定，附超清晰對照圖！' }
    ]
  };
}

function renderStudentVideos(db) {
  const list = document.getElementById('s-videos-list');
  if (!list) return;

  list.innerHTML = `<div style="text-align:center;padding:28px 0;color:#9ca3af;font-size:12px">
    <div style="font-size:26px;margin-bottom:8px;animation:spin 2s linear infinite">✨</div>
    Gemini AI 正在依據你的學習狀況分析推薦...
  </div>`;

  fetchAIVideoRecommendations(db).then(({ videos, aiGenerated }) => {
    const badge = aiGenerated
      ? `<div style="display:inline-block;background:#e8f5e9;color:#2d4a3e;font-size:9px;font-weight:500;padding:3px 9px;border-radius:8px;margin-bottom:12px">✨ Gemini AI 個人化推薦</div>`
      : `<div style="display:inline-block;background:#f3f4f6;color:#6b7280;font-size:9px;padding:3px 9px;border-radius:8px;margin-bottom:12px">示範推薦（離線模式）</div>`;

    list.innerHTML = badge + videos.map((v, i) => {
      const color = SUBJECT_COLORS[v.subject] || '#6b7280';
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(v.keyword)}`;
      return `
        <div style="background:#fff;border-radius:14px;padding:14px;margin-bottom:10px;box-shadow:0 1px 6px rgba(0,0,0,0.07);border:0.5px solid #e5e7eb">
          <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:9px">
            <div style="width:38px;height:38px;border-radius:10px;background:${color}15;display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <span style="font-size:18px">🎬</span>
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:500;color:#0f0f14;line-height:1.4;margin-bottom:3px">${v.title}</div>
              <div style="font-size:10px;color:#9ca3af">${v.channel} · ${v.duration}</div>
            </div>
            <span style="background:${color}15;color:${color};font-size:9px;font-weight:500;padding:2px 7px;border-radius:8px;flex-shrink:0">${v.subject}</span>
          </div>
          <div style="font-size:11px;color:#4b5563;line-height:1.5;margin-bottom:10px;padding:8px;background:#f9fafb;border-radius:8px">💡 ${v.desc}</div>
          <div style="display:flex;gap:7px">
            <a href="${searchUrl}" target="_blank" style="flex:1;background:#1a1a2e;color:#e8d5b7;border:none;border-radius:16px;padding:8px;font-size:11px;font-weight:500;cursor:pointer;text-align:center;text-decoration:none">
              📺 去 YouTube 搜尋
            </a>
            <div style="background:#f3f4f6;border-radius:16px;padding:8px 12px;font-size:10px;color:#888;cursor:default">${v.keyword}</div>
          </div>
        </div>
      `;
    }).join('');
  });
}

function refreshVideoRecommendations() {
  const db = getDB();
  renderStudentVideos(db);
}

// =========================================================
// ★ 底部導覽列（已改用 flex layout，此函數保留相容性）
// =========================================================
function updateNavPosition() {
  // 已改用 CSS flex column layout，不需要 JS 計算位置
}

window.addEventListener('resize', updateNavPosition);
window.addEventListener('DOMContentLoaded', () => { setTimeout(updateNavPosition, 100); });

// =========================================================
// ★ 新增功能：題目錯誤/超綱回報、進度微調與成長護照 PDF 匯出
// =========================================================

// 1. 題目錯誤與超綱回報 (Feedback Loop)
async function reportQuizQuestion() {
  if (!activeQuiz || !activeQuiz.questions) return;
  const q = activeQuiz.questions[activeQuiz.currentIdx];
  if (!q) return;

  const feedbackType = prompt(
    "請選擇回報的問題類型：\n1. 答案錯誤 / 解析有誤\n2. 題目超綱（不符合此年級）\n3. 題目語意不清 / 選項有瑕疵\n(請輸入數字 1, 2 或 3)"
  );
  if (!feedbackType) return;

  let typeString = "";
  if (feedbackType === "1") typeString = "答案錯誤";
  else if (feedbackType === "2") typeString = "超綱";
  else if (feedbackType === "3") typeString = "語意不清";
  else {
    alert("輸入錯誤，回報已取消。");
    return;
  }

  const parentNote = prompt("請提供您的具體回報意見（可留空）：");
  if (parentNote === null) return; // 按取消

  const familyId = localStorage.getItem("learnmate_family_id");
  const subject = document.getElementById("s-quiz-subject").textContent.replace(" (加強)", "");

  try {
    const resp = await apiFetch(`${API_BASE}/api/quiz/feedback`, {
      method: "POST",
      body: JSON.stringify({
        familyId,
        subject,
        q: q.q,
        opts: q.opts,
        a: q.a,
        userAnswer: selectedOption,
        feedback_type: typeString,
        parent_note: parentNote
      })
    });
    const data = await resp.json();
    if (data.success) {
      alert("感謝您的回報！此題目已記錄，AI 出題 Agent 下次生成考題時將會自動避開此類錯誤（Bad Cases 避雷針）。");
    } else {
      alert("回報失敗：" + data.error);
    }
  } catch (e) {
    console.error("提交題目回報出錯：", e.message);
    alert("網路錯誤，無法送出回報。");
  }
}

// 2. 下載兒童成長護照 PDF
function downloadPassportPDF() {
  const familyId = localStorage.getItem("learnmate_family_id");
  if (!familyId) {
    alert("請先登入！");
    return;
  }
  const url = `${API_BASE}/api/insights/passport-pdf/${familyId}`;
  window.open(url, "_blank");
}

// 3. 載入教材進度預估與微調面板
async function loadProgressTuningPanel() {
  const panel = document.getElementById("progress-prediction-panel");
  if (!panel) return;

  const familyId = localStorage.getItem("learnmate_family_id");
  if (!familyId) return;

  panel.innerHTML = `<div style="font-size:11px;color:#9ca3af;text-align:center">✨ AI 正在依據週進度庫預估學校單元...</div>`;

  try {
    const resp = await apiFetch(`${API_BASE}/api/progress/predict?familyId=${familyId}`);
    const data = await resp.json();
    if (data.success && data.progressList) {
      if (data.progressList.length === 0) {
        panel.innerHTML = `<div style="font-size:11px;color:#9ca3af;text-align:center">目前無課綱設定</div>`;
        return;
      }

      panel.innerHTML = data.progressList.map(p => {
        const offset = p.offset || 0;
        return `
          <div style="background:#fff;border-radius:6px;padding:8px;margin-bottom:6px;border:1.5px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between">
            <div style="flex:1;min-width:0;padding-right:6px">
              <div style="font-size:12px;font-weight:600;color:#0f0f14;display:flex;align-items:center;gap:4px">
                <span>${p.subject}</span>
                <span style="font-size:9px;background:#e2e8f0;color:#4a5568;padding:1px 5px;border-radius:4px">${p.edition}</span>
              </div>
              <div style="font-size:10px;color:#6b7280;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                第 ${p.currentWeek} 週進度：<b>${p.unit}</b>
              </div>
              <div style="font-size:9px;color:#9ca3af;margin-top:1px">
                官方第 ${p.targetWeek} 週 · 微調：${offset >= 0 ? '+' : ''}${offset} 週
              </div>
            </div>
            <div style="display:flex;flex-direction:column;gap:3px;flex-shrink:0">
              <button onclick="adjustProgressOffset('${p.subject}', ${offset + 1})" style="background:#2d4a3e;color:#a8d5b5;border:none;border-radius:4px;padding:3px 6px;font-size:9px;cursor:pointer;font-weight:500">快一週 +1</button>
              <button onclick="adjustProgressOffset('${p.subject}', ${offset - 1})" style="background:#fff;border:1px solid #d1d5db;color:#555;border-radius:4px;padding:2px 6px;font-size:9px;cursor:pointer">慢一週 -1</button>
            </div>
          </div>
        `;
      }).join('');
    } else {
      panel.innerHTML = `<div style="font-size:11px;color:#ef4444;text-align:center">無法加載進度預測</div>`;
    }
  } catch (e) {
    console.error("預測進度出錯：", e.message);
    panel.innerHTML = `<div style="font-size:11px;color:#ef4444;text-align:center">網路連線異常</div>`;
  }
}

// 4. 微調偏差週數 API 呼叫
async function adjustProgressOffset(subject, offset) {
  const familyId = localStorage.getItem("learnmate_family_id");
  if (!familyId) return;

  try {
    const resp = await apiFetch(`${API_BASE}/api/progress/adjust`, {
      method: "POST",
      body: JSON.stringify({
        familyId,
        subject,
        offset
      })
    });
    const data = await resp.json();
    if (data.success) {
      console.log(`🎯 [Progress Adjusted] ${subject} Offset 調整為 ${offset}`);
      await syncState();
    } else {
      alert("微調失敗：" + data.error);
    }
  } catch (e) {
    alert("微調進度時發生網路錯誤：" + e.message);
  }
}
