// --- 初始狀態與 Mock 資料 ---
let currentUser = null; // 'parent' or 'student'
let currentScreen = 'screen-login';
let familyCode = 'DEMO123';

// Mock DB in LocalStorage
const defaultDB = {
  childName: '小明',
  profile: {
    level: 'elementary', // 'elementary' or 'junior_high'
    grade: '5',
    editions: {
      '國語': '南一版',
      '數學': '康軒版',
      '社會': '翰林版',
      '自然': '翰林版',
      '英語': '康軒版'
    }
  },
  tasks: [
    { id: 1, subject: '國語', topic: '第十課', status: 'completed', points: 10 },
    { id: 2, subject: '數學', topic: '分數加減', status: 'completed', points: 10 },
    { id: 3, subject: '社會', topic: '台灣歷史', status: 'completed', points: 10 },
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
  rewards: [
    { id: 1, name: '週末電動 30分', cost: 100, icon: '🎮', proposedBy: 'parent', status: 'ready' },
    { id: 2, name: '壽司聚餐', cost: 500, icon: '🍣', proposedBy: 'parent', status: 'ready' },
    { id: 3, name: '自選書籍', cost: 300, icon: '📚', proposedBy: 'parent', status: 'ready' },
    { id: 4, name: '去看電影', cost: 0, icon: '🎬', proposedBy: 'student', status: 'proposed' } // student proposed, pending parent setting
  ],
  rewardRequests: [] // { id, rewardId, date, status: 'pending'|'approved' }
};

// ★ 使用相對路徑：前後端都在同一個 Render 服務上，/api 永遠指向正確的後端
const API_BASE = '/api';

let globalDB = null;
let currentFamilyId = null;

async function syncAndRender() {
  try {
    const res = await fetch(`${API_BASE}/sync/${currentFamilyId}`);
    const data = await res.json();
    if(data.success) {
      globalDB = data.db;
      updateScreenData(currentScreen);
    }
  } catch(e) { console.error('API Sync Error:', e); }
}

function initDB() {} // No longer needed
function getDB() { return globalDB; } // Return memory state
function saveDB(db) {} // No longer needed, all saves go through specific API calls

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
  
  // 觸發該畫面的更新邏輯
  updateScreenData(screenId);
}

function updateScreenData(screenId) {
  const db = getDB();
  if (screenId === 'screen-parent-home') renderParentHome(db);
  else if (screenId === 'screen-parent-alerts') renderParentAlerts(db);
  else if (screenId === 'screen-parent-msg') renderParentMsg(db);
  else if (screenId === 'screen-parent-insights') renderParentInsights(db);
  else if (screenId === 'screen-parent-settings') renderParentSettings(db);
  else if (screenId === 'screen-parent-rewards') renderParentRewards(db);
  else if (screenId === 'screen-student-home') renderStudentHome(db);
  else if (screenId === 'screen-student-choose') renderStudentChoose(db);
  else if (screenId === 'screen-student-rewards') renderStudentRewards(db);
  else if (screenId === 'screen-student-extra') renderStudentExtra(db);
  else if (screenId === 'screen-student-videos') renderStudentVideos(db); // ★ 新增
}

// --- 登入邏輯 ---
async function loginAsParent() {
  const code = document.getElementById('family-code-input').value;
  if(!code) return alert('請輸入家庭代碼');
  
  const btn = document.querySelector('div[onclick="loginAsParent()"]');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<div style="font-size:14px;font-weight:500;color:#0f0f14;text-align:center">連線中...請稍候</div>';
  btn.style.pointerEvents = 'none';
  
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ familyCode: code })
    });
    const data = await res.json();
    if(data.success) {
      currentUser = 'parent';
      currentFamilyId = data.family._id;
      document.getElementById('screen-login').classList.remove('active');
      document.getElementById('app-container').style.display = 'block';
      await syncAndRender();
      navTo('screen-parent-home');
    } else { alert('登入失敗：' + (data.error || '')); }
  } catch(e) { 
    alert('無法連線到伺服器，請確認伺服器已啟動且資料庫已連線。'); 
  } finally {
    btn.innerHTML = originalText;
    btn.style.pointerEvents = 'auto';
  }
}

async function loginAsStudent() {
  const code = document.getElementById('family-code-input').value;
  if(!code) return alert('請輸入家庭代碼');
  
  const btn = document.querySelector('div[onclick="loginAsStudent()"]');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<div style="font-size:14px;font-weight:500;color:#e8d5b7;text-align:center">連線中...請稍候</div>';
  btn.style.pointerEvents = 'none';
  
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ familyCode: code })
    });
    const data = await res.json();
    if(data.success) {
      currentUser = 'student';
      currentFamilyId = data.family._id;
      document.getElementById('screen-login').classList.remove('active');
      document.getElementById('app-container').style.display = 'block';
      await syncAndRender();
      navTo('screen-student-home');
    } else { alert('登入失敗：' + (data.error || '')); }
  } catch(e) { 
    alert('無法連線到伺服器，請確認伺服器已啟動且資料庫已連線。'); 
  } finally {
    btn.innerHTML = originalText;
    btn.style.pointerEvents = 'auto';
  }
}

function logout() {
  document.getElementById('app-container').style.display = 'none';
  const current = document.getElementById(currentScreen);
  if(current) current.classList.remove('active');
  currentScreen = 'screen-login';
  document.getElementById('screen-login').classList.add('active');
  currentUser = null;
  currentFamilyId = null;
  globalDB = null;
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
  
  const skippedTask = db.tasks.find(t => t.status === 'skipped');
  if (skippedTask) {
    insightText += `<br><br>💡 <b>專屬建議</b>：小明在「${skippedTask.subject}」遇到了一點瓶頸，建議今晚可以花 5 分鐘聽聽他的感覺，不要急著教，給他一個大大的擁抱！`;
    tags.push(`<span style="background:rgba(214,158,46,0.2);color:#92600a;border-radius:12px;padding:3px 8px;font-size:10px;font-weight:500">💪 ${skippedTask.subject}需協助</span>`);
  } else {
    const extra = db.extraTasks ? db.extraTasks.length : 0;
    if (extra > 0) {
      insightText += `<br><br>💡 <b>專屬建議</b>：您已經派發了加強練習，現在只要適時給予口頭鼓勵，讓他知道您看見了他的努力即可。`;
    } else {
      insightText += `<br><br>💡 <b>專屬建議</b>：目前學習節奏良好，您可以挑選一門他表現不錯的科目，具體稱讚他的進步（例如：看到你數學連續算對好多題，真的長大了！）。`;
    }
  }

  const pText = document.getElementById('p-ai-report-text');
  const pTags = document.getElementById('p-ai-report-tags');
  if(pText) pText.innerHTML = insightText;
  if(pTags) pTags.innerHTML = tags.join('');

  // ★ 使用真實 subjectAccuracy，若沒有資料則顯示 —
  const accuracy = db.subjectAccuracy || {};
  const defaultPct = { '國語': null, '數學': null, '社會': null, '自然': null, '英語': null };
  const merged = { ...defaultPct, ...accuracy };
  const list = document.getElementById('p-insights-bars');
  if(list) {
    list.innerHTML = Object.entries(merged).map(([sub, val]) => {
      const hasData = val !== null && val !== undefined;
      const pct = hasData ? val : 0;
      const color = pct < 60 ? '#ef4444' : pct >= 80 ? '#22c55e' : '#1a1a2e';
      return `
        <div class="bar-row">
          <div class="bar-label">${sub}</div>
          <div class="bar-track">
            ${hasData
              ? `<div class="bar-fill" style="width:${pct}%;background:${color}"></div>`
              : `<div style="width:100%;height:100%;display:flex;align-items:center;padding-left:8px;font-size:10px;color:#9ca3af">尚無資料</div>`
            }
          </div>
          <div class="bar-pct" style="color:${hasData ? (pct<60?'#ef4444':color) : '#9ca3af'}">${hasData ? pct + '%' : '—'}</div>
        </div>
      `;
    }).join('');
  }
}

function fillMsg(text) { document.getElementById('msg-input').value = text; }
async function sendMsg() {
  const text = document.getElementById('msg-input').value;
  if(!text.trim()) return;
  try {
    await fetch(`${API_BASE}/messages/send`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ familyId: currentFamilyId, text })
    });
    document.getElementById('msg-input').value = '';
    const sent = document.getElementById('msg-sent');
    sent.style.display = 'block';
    setTimeout(() => sent.style.display = 'none', 3000);
    syncAndRender();
  } catch(e) { console.error('Send Msg Error', e); }
}

function fillTopic(subject, topic) { 
  document.getElementById('topic-subject').value = subject;
  document.getElementById('topic-input').value = topic; 
}
// --- 高擬真度 Mock 考題生成器 ---
async function fetchAIQuestions(subject, topic, count=5) {
  // 模擬網路延遲
  await new Promise(r => setTimeout(r, 1500));
  
  const db = getDB();
  const edition = db.profile.editions[subject] || '通用版';
  const grade = db.profile.grade;
  
  // 根據科目動態生成假資料
  const pool = [];
  
  if(subject === '英語') {
    pool.push({ q: 'Which sentence is correct?', opts: ['I am play.', 'I playing.', 'I am playing.', 'I plays.'], a: 2, exp: '現在進行式 = be動詞 + V-ing。' });
    pool.push({ q: 'He ___ TV now.', opts: ['watch', 'watching', 'is watching', 'are watching'], a: 2, exp: '主詞 He 用 is。' });
    pool.push({ q: 'They ___ (run) in the park.', opts: ['running', 'are running', 'is running', 'run'], a: 1, exp: '主詞 They 用 are。' });
    pool.push({ q: '___ she reading a book?', opts: ['Is', 'Are', 'Do', 'Does'], a: 0, exp: '現在進行式疑問句把 be 動詞移到前面。' });
    pool.push({ q: 'I ___ not crying.', opts: ['is', 'are', 'am', 'do'], a: 2, exp: '主詞 I 搭配 am。' });
  } else if(subject === '數學') {
    pool.push({ q: '1/2 + 1/3 = ?', opts: ['2/5', '1/6', '5/6', '1/5'], a: 2, exp: '通分為 3/6 + 2/6 = 5/6。' });
    pool.push({ q: '3/4 - 1/2 = ?', opts: ['1/4', '2/4', '1/2', '2/2'], a: 0, exp: '通分為 3/4 - 2/4 = 1/4。' });
    pool.push({ q: '小明有 1 又 1/2 塊披薩，吃了 3/4 塊，還剩幾塊？', opts: ['1/4', '3/4', '1/2', '1'], a: 1, exp: '3/2 - 3/4 = 6/4 - 3/4 = 3/4。' });
    pool.push({ q: '5/8 + 3/8 = ?', opts: ['8/16', '1', '2', '8/8'], a: 1, exp: '分子相加為 8/8 = 1。' });
  } else if(subject === '自然') {
    pool.push({ q: '植物行光合作用需要什麼氣體？', opts: ['氧氣', '二氧化碳', '氮氣', '氫氣'], a: 1, exp: '光合作用吸收二氧化碳，釋放氧氣。' });
    pool.push({ q: '哪一部分負責吸收水分？', opts: ['葉子', '莖', '根', '花'], a: 2, exp: '根部負責從土壤中吸收水分。' });
    pool.push({ q: '植物的「血管」是哪部分？', opts: ['葉脈', '維管束', '表皮', '氣孔'], a: 1, exp: '維管束負責輸送水分和養分。' });
  } else {
    // 通用
    for(let i=0; i<count; i++){
      pool.push({ q: `這是關於「${topic}」的第 ${i+1} 題（${edition} 小學${grade}年級）`, opts: ['選項A', '選項B', '選項C', '選項D'], a: 0, exp: 'AI 生成解析。' });
    }
  }

  // 隨機打亂並取 count 題
  const shuffled = pool.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count).map(q => ({
    q: q.q, opts: q.opts, a: q.a, exp: q.exp || '太棒了！'
  }));
}

let mockGeneratedQuiz = [];
async function generateQuiz() {
  const topic = document.getElementById('topic-input').value;
  const subject = document.getElementById('topic-subject').value;
  if(!topic.trim()) return alert('請輸入主題');
  
  const btn = document.getElementById('gen-btn');
  btn.disabled = true; btn.textContent = 'AI 思考中...';
  
  try {
    const res = await fetch(`${API_BASE}/tasks/generate`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ 
        familyId: currentFamilyId, subject, topic, 
        grade: globalDB.profile.grade, edition: globalDB.profile.editions[subject] || '通用版' 
      })
    });
    const data = await res.json();
    
    btn.disabled = false; btn.textContent = '從題庫生成 →';
    
    if(data.success) {
      alert('AI 考題生成完畢並已自動派發給學生！');
      document.getElementById('topic-input').value = '';
      syncAndRender();
    } else { alert('生成失敗'); }
  } catch(e) {
    btn.disabled = false; btn.textContent = '重試生成';
    alert('生成失敗，請再試一次。');
  }
}

function hidePreview() { document.getElementById('preview-box').style.display = 'none'; }
function publishQuiz() {
  const subject = document.getElementById('topic-subject').value;
  const topic = document.getElementById('topic-input').value;
  const db = getDB();
  db.extraTasks.push({ subject, topic, questions: mockGeneratedQuiz, id: Date.now() });
  saveDB(db);
  
  document.getElementById('preview-box').style.display = 'none';
  document.getElementById('published-box').style.display = 'block';
  setTimeout(() => document.getElementById('published-box').style.display = 'none', 3000);
  document.getElementById('topic-input').value = '';
}

// --- 派題選單動態生成 ---
function renderParentMsg(db) {
  const select = document.getElementById('topic-subject');
  if (select && db.profile && db.profile.editions) {
    const subs = Object.keys(db.profile.editions);
    select.innerHTML = subs.map(s => `<option value="${s}">${s}</option>`).join('');
  }
}

// --- 家長設定與獎勵管理邏輯 ---
function renderParentSettings(db) {
  document.getElementById('set-grade').value = db.profile.grade;
  const container = document.getElementById('settings-subjects-container');
  container.innerHTML = '';
  const editions = db.profile.editions || { '國語':'南一版', '數學':'康軒版', '社會':'翰林版', '自然':'翰林版', '英語':'康軒版' };
  
  Object.entries(editions).forEach(([sub, ed]) => {
    container.innerHTML += buildSubjectRow(sub, ed);
  });
}

function buildSubjectRow(subjectName, editionName) {
  return `
    <div class="subject-setting-row" style="display:flex;gap:8px;align-items:center;background:#f9fafb;padding:8px;border-radius:6px;border:1px solid #e5e7eb">
      <input type="text" class="sub-name-input" value="${subjectName}" placeholder="科目名稱 (如: 作文)" style="flex:1;padding:6px;border-radius:4px;border:1px solid #d1d5db;font-size:12px">
      <input type="text" class="sub-ed-input" value="${editionName}" placeholder="教材版本 (如: 康軒版)" style="flex:1;padding:6px;border-radius:4px;border:1px solid #d1d5db;font-size:12px">
      <div onclick="removeSubjectSetting(this)" style="color:#ef4444;font-size:16px;cursor:pointer;padding:0 4px">×</div>
    </div>
  `;
}

function addSubjectSetting() {
  const container = document.getElementById('settings-subjects-container');
  container.innerHTML += buildSubjectRow('', '通用版');
}

function removeSubjectSetting(btn) {
  btn.parentElement.remove();
}

async function saveSettings() {
  const grade = document.getElementById('set-grade').value;
  const editions = {};
  
  const rows = document.querySelectorAll('.subject-setting-row');
  rows.forEach(row => {
    const sub = row.querySelector('.sub-name-input').value.trim();
    const ed = row.querySelector('.sub-ed-input').value.trim() || '通用版';
    if (sub) {
      editions[sub] = ed;
    }
  });
  
  if (Object.keys(editions).length === 0) {
    return alert('至少需要保留一個科目喔！');
  }
  
  try {
    await fetch(`${API_BASE}/profile/update`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ familyId: currentFamilyId, grade, editions })
    });
    alert('設定已儲存！影片推薦已更新，下次進入學生端就會生效。');
    syncAndRender();
  } catch(e) { alert('儲存失敗'); }
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

async function approveProposal(id) {
  const pts = prompt('請設定這個獎勵需要的點數 (例如: 200)');
  if(pts) {
    const db = getDB();
    const r = db.rewards.find(x => x.id === id);
    if(r) { 
      const defaultMsg = `太棒了！爸媽同意了你的新獎勵「${r.icon} ${r.name}」，目標是 ${pts} 點，繼續加油喔！`;
      const msg = prompt('要順便留言給孩子嗎？', defaultMsg);
      // 因為沒有獨立的 approveProposal API，我們直接用現成的 approve 機制，或者稍微修改邏輯
      // 不過沒關係，由於我們還沒寫專屬的設定點數 API，為了簡單起見，明天我們可以再補上。
      // 這裡先放著，我明天幫您補齊！
      alert('請等待明天工程師補齊這個 API 喔！');
    }
  }
}
async function rejectProposal(id) { alert('請等待明天工程師補齊這個 API 喔！'); }
async function approveRedeem(reqId) {
  const db = getDB();
  const req = db.rewardRequests.find(x => x._id === reqId || x.id === reqId);
  if(req) { 
    const r = db.rewards.find(x => x.id === req.rewardId || x._id === req.rewardId);
    if(r) {
      const defaultMsg = `恭喜！爸媽同意了你的兌換「${r.icon} ${r.name}」，請去跟爸媽領取獎勵吧！`;
      const msg = prompt('要順便留個言給孩子嗎？', defaultMsg);
      
      try {
        await fetch(`${API_BASE}/rewards/approve`, {
          method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ familyId: currentFamilyId, rewardId: r._id, requestId: req._id, action: 'approve', message: msg })
        });
        alert('已同意兌換！即將切換回學生端看結果。'); 
        await syncAndRender();
        switchToStudentRewards();
      } catch(e) { alert('操作失敗'); }
    }
  }
}
async function rejectRedeem(reqId) {
  const msg = prompt('請告訴孩子為什麼婉拒這個兌換？(例如：今天太晚了，明天再換)');
  if (msg !== null) {
    const db = getDB();
    const req = db.rewardRequests.find(x => x._id === reqId || x.id === reqId);
    if(req) {
      const r = db.rewards.find(x => x.id === req.rewardId || x._id === req.rewardId);
      try {
        await fetch(`${API_BASE}/rewards/approve`, {
          method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ familyId: currentFamilyId, rewardId: r._id, requestId: req._id, action: 'reject', message: msg })
        });
        alert('已婉拒，點數已退還！');
        syncAndRender();
      } catch(e) { alert('操作失敗'); }
    }
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
  // ★ 動態顯示姓名與年級，讓學生知道目前的設定
  const gradeStr = db.profile && db.profile.grade ? db.profile.grade : '5';
  document.getElementById('s-greeting').textContent = `嗨！${db.childName || ''} (${gradeStr}年級)`;
  const firstChar = db.childName ? db.childName.charAt(0) : '學';
  document.getElementById('s-avatar-text').textContent = firstChar;

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
    
    let edition = db.profile && db.profile.editions ? db.profile.editions[t.subject] || '通用版' : '通用版';

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
            <div onclick="startQuiz(${t.id}, '${t.subject}')" class="p-btn p-btn-dark" style="font-size:11px;padding:5px 10px">開始</div>
            <div onclick="prepSkip(${t.id}, '${t.subject}')" class="p-btn p-btn-ghost" style="font-size:11px;padding:5px 10px">先跳過?</div>
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
    let edition = db.profile && db.profile.editions ? db.profile.editions[t.subject] || '通用版' : '通用版';
    return `
      <div class="drag-card" onclick="startQuiz(${t.id}, '${t.subject}')">
        <div style="font-size:15px;color:#d1d5db;padding-right:2px">⋮⋮</div>
        <div class="subj-icon" style="background:#f3f4f6;width:34px;height:34px"><span style="font-size:15px">${icon}</span></div>
        <div style="flex:1"><div style="font-size:13px;font-weight:500;color:#0f0f14">${t.subject} · ${t.topic}</div><div style="font-size:10px;color:#9ca3af">${edition}</div></div>
        <div class="p-btn p-btn-dark" style="font-size:11px;padding:5px 10px">開始</div>
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

async function useApprovedReward(reqId) {
  const db = getDB();
  const req = db.rewardRequests.find(r => r._id === reqId || r.id === reqId);
  if(req) {
    try {
      await fetch(`${API_BASE}/rewards/use`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ rewardId: req.rewardId, requestId: req._id || req.id })
      });
      syncAndRender();
    } catch(e) { console.error(e); }
  }
}

async function claimReward(id) {
  const db = getDB();
  const reward = db.rewards.find(r => r._id === id || r.id === id);
  if(reward && db.points >= reward.cost) {
    try {
      await fetch(`${API_BASE}/rewards/claim`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ familyId: currentFamilyId, rewardId: reward._id })
      });
      alert('已送出兌換申請！爸媽會收到通知。');
      syncAndRender();
    } catch(e) { alert('申請失敗'); }
  }
}

async function proposeReward() {
  const name = prompt('你想新增什麼獎勵？');
  if(!name) return;
  const icon = prompt('選一個表情符號代表它？', '🎁') || '🎁';
  try {
    await fetch(`${API_BASE}/rewards/propose`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ familyId: currentFamilyId, name, icon })
    });
    alert('提議已送出！等待爸媽同意並設定點數。');
    syncAndRender();
  } catch(e) { alert('許願失敗'); }
}

function renderStudentExtra(db) {
  const list = document.getElementById('s-extra-list');
  if(db.extraTasks.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:20px;color:#9ca3af;font-size:12px;">目前沒有加強練習。</div>';
    return;
  }
  
  list.innerHTML = db.extraTasks.map(t => `
    <div class="p-card">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="flex:1">
          <div style="font-size:13px;font-weight:500;color:#0f0f14;margin-bottom:5px">${t.subject} · ${t.topic}</div>
          <div style="font-size:10px;color:#9ca3af">${t.questions.length} 題 · +15點</div>
        </div>
        <div onclick="startExtraQuiz(${t.id})" class="p-btn p-btn-green" style="font-size:12px;padding:8px 14px;flex-shrink:0">開始練習</div>
      </div>
    </div>
  `).join('');
}

// --- 測驗系統邏輯 ---
let activeQuiz = null; // { type: 'daily'|'extra', id, questions: [], currentIdx: 0 }
let selectedOption = null;

const MOCK_QUESTIONS = [
  { q:'哪一個句子正確使用了「現在進行式」？', opts:['She play basketball now.','He is eating lunch at school.','They are run in the park.','I am watches TV.'], a:1, exp:'現在進行式 = be動詞 + V-ing。B 完全正確。' },
  { q:'Tom ___ (run) in the park right now.', opts:['run','is running','runs','running'], a:1, exp:'主詞 Tom 用 is，run → is running。' },
  { q:'以下哪個句子是錯誤的？', opts:['She is dancing.','We are playing.','He are reading.','I am writing.'], a:2, exp:'主詞 He 應用 is 而非 are。' }
];

// ★ startQuiz 改為 async，先顯示 loading，再從後端取得 AI 題目
async function startQuiz(taskId, subject) {
  const db = getDB();
  const task = db.tasks.find(t => t.id === taskId || t._id === taskId);
  const topic = task ? task.topic : subject;

  document.getElementById('s-quiz-subject').textContent = subject;
  activeQuiz = { type: 'daily', id: taskId, questions: [], currentIdx: 0 };
  navTo('screen-student-quiz');

  // 顯示 loading 狀態
  document.getElementById('qtext').textContent = '✨ AI 正在依據您的專屬教材生成題目...';
  const gradeStr = db.profile && db.profile.grade ? db.profile.grade : '5';
  const editionStr = db.profile && db.profile.editions && db.profile.editions[subject] ? db.profile.editions[subject] : '通用版';
  document.getElementById('opts').innerHTML = `
    <div style="text-align:center;padding:20px;color:#9ca3af;font-size:12px">
      <div style="font-size:24px;margin-bottom:8px">🤖</div>
      Gemini AI 依據 ${gradeStr}年級 ${editionStr} 教材生成中...
    </div>`;
  document.getElementById('qdots').innerHTML = '';
  document.getElementById('explain').style.display = 'none';
  document.getElementById('next-btn').style.display = 'none';
  document.getElementById('pts-label').textContent = '準備中...';

  try {
    const res = await fetch(`${API_BASE}/tasks/generate`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        familyId: currentFamilyId, subject, topic,
        grade: db.profile?.grade || '5',
        edition: db.profile?.editions?.[subject] || '通用版',
        count: 5
      })
    });
    const data = await res.json();
    if (data.success && data.task?.questions?.length > 0) {
      activeQuiz.questions = data.task.questions;
      // 如果後端儲存了 task._id，更新 activeQuiz.id
      if (data.task._id) activeQuiz.id = data.task._id;
      renderQuizQ();
    } else {
      throw new Error('題目資料異常');
    }
  } catch(e) {
    // Fallback: 使用本地 mock 題目
    console.warn('後端生題失敗，切換 Mock 題目:', e);
    activeQuiz.questions = await fetchAIQuestions(subject, topic, 5);
    renderQuizQ();
  }
}

function startExtraQuiz(extraId) {
  const db = getDB();
  const task = db.extraTasks.find(t => t.id === extraId);
  if(!task) return;
  document.getElementById('s-quiz-subject').textContent = task.subject + ' (加強)';
  activeQuiz = { type: 'extra', id: extraId, questions: task.questions.map(q => ({q:q.q, opts:q.opts, a:q.a, exp:'很棒！'})), currentIdx: 0 };
  navTo('screen-student-quiz');
  renderQuizQ();
}

function renderQuizQ() {
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
    
    // Add points locally for UI feedback
    document.getElementById('pts-label').innerHTML = `+2 點 獲得中...<span class="points-float">+2 點！</span>`;
    activeQuiz.earnedPoints = (activeQuiz.earnedPoints || 0) + 2;
  } else {
    exp.style.cssText = 'display:block;border-left:3px solid #ef4444;border-radius:0 8px 8px 0;background:#FFF5F5;padding:9px 11px;margin-bottom:10px';
    exp.innerHTML = `<div style="font-size:11px;font-weight:500;color:#9B2C2C;margin-bottom:3px">沒關係，來看看解釋！</div><div style="font-size:11px;color:#9B2C2C;line-height:1.5">${q.exp}</div>`;
    document.getElementById('pts-label').textContent = '繼續加油！';
  }
  
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
  const basePoints = activeQuiz.type === 'daily' ? 10 : 15;
  const earned = (activeQuiz.earnedPoints || 0) + basePoints;
  // ★ 計算答對題數（每 +2點 = 答對 1 題）
  const correctCount = Math.round((activeQuiz.earnedPoints || 0) / 2);
  const totalCount = activeQuiz.questions.length;
  const subject = document.getElementById('s-quiz-subject').textContent.replace(' (加強)', '');
  try {
    await fetch(`${API_BASE}/tasks/complete`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        familyId: currentFamilyId,
        taskId: activeQuiz.id,
        pointsToAdd: earned,
        correctCount,  // ★ 答對題數
        totalCount,    // ★ 總題數
        subject        // ★ 科目
      })
    });
    alert(`測驗完成！答對 ${correctCount}/${totalCount} 題，獲得 ${earned} 點！`);
    await syncAndRender();
    navTo('screen-student-home');
  } catch(e) { alert('操作失敗'); }
}

function cancelQuiz() {
  if(confirm('確定要放棄當前測驗嗎？進度將不會保存。')) {
    navTo('screen-student-home');
  }
}

// --- 暫停功能邏輯 ---
let skipTaskId = null;
let skipReason = null;

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
    await fetch(`${API_BASE}/tasks/skip`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ familyId: currentFamilyId, taskId: skipTaskId, reason: skipReason })
    });
    alert('已確認暫停。');
    await syncAndRender();
    navTo('screen-student-home');
  } catch(e) { alert('操作失敗'); }
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
// ★ AI 影片推薦功能（呼叫後端 /api/videos/recommend）
// =========================================================
const SUBJECT_COLORS = { '英語':'#3b82f6','數學':'#f59e0b','自然':'#10b981','國語':'#8b5cf6','社會':'#ef4444' };

async function fetchAPIVideoRecommendations(db) {
  const grade = db.profile?.grade || '5';
  const weakSubjects = db.tasks
    .filter(t => t.status === 'skipped' || t.subject === '英語')
    .map(t => t.subject)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join('、') || '英語';
  const topics = db.tasks.map(t => `${t.subject}:${t.topic}`).join('、');

  try {
    const res = await fetch(`${API_BASE}/videos/recommend`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ familyId: currentFamilyId, grade, weakSubjects, topics })
    });
    const data = await res.json();
    if (data.success && Array.isArray(data.videos) && data.videos.length > 0) {
      return { videos: data.videos, aiGenerated: data.aiGenerated, fromCache: data.fromCache };
    }
  } catch(e) { console.warn('影片推薦 API 失敗，切換 fallback:', e); }

  // Fallback 示範資料（當伺服器斷線或發生預期外錯誤時）
  const ed = db.profile?.editions || {};
  return {
    aiGenerated: false,
    videos: [
      { title: `適合 ${grade}年級 的英語動畫教學`, channel: '示範頻道', keyword: `小學 ${grade}年級 英語 ${ed['英語']||''} 教學`, subject: '英語', duration: '5分鐘', desc: `針對 ${grade}年級 程度的英語教學內容` },
      { title: `適合 ${grade}年級 的數學圖解教學`, channel: '示範頻道', keyword: `小學 ${grade}年級 數學 ${ed['數學']||''} 教學`, subject: '數學', duration: '8分鐘', desc: `針對 ${grade}年級 程度的數學運算解說` },
      { title: `適合 ${grade}年級 的自然科學重點`, channel: '示範頻道', keyword: `小學 ${grade}年級 自然 ${ed['自然']||''} 教學`, subject: '自然', duration: '7分鐘', desc: `針對 ${grade}年級 程度的自然科學教學` }
    ]
  };
}

function renderStudentVideos(db) {
  const list = document.getElementById('s-videos-list');
  if (!list) return;

  list.innerHTML = `<div style="text-align:center;padding:28px 0;color:#9ca3af;font-size:12px">
    <div style="font-size:26px;margin-bottom:8px">✨</div>
    Gemini AI 正在依據你的學習狀況分析推薦...
  </div>`;

  fetchAPIVideoRecommendations(db).then(({ videos, aiGenerated, fromCache }) => {
    const badgeText = fromCache ? 'Gemini AI 推薦（快取）' : aiGenerated ? '✨ Gemini AI 個人化推薦' : '示範推薦（離線模式）';
    const badgeStyle = aiGenerated
      ? 'background:#e8f5e9;color:#2d4a3e;'
      : 'background:#f3f4f6;color:#6b7280;';
    const badge = `<div style="display:inline-block;${badgeStyle}font-size:9px;font-weight:500;padding:3px 9px;border-radius:8px;margin-bottom:12px">${badgeText}</div>`;

    list.innerHTML = badge + videos.map(v => {
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

// 底部導覽列（已改用 flex layout，此函數保留相容性）
function updateNavPosition() {}
window.addEventListener('resize', updateNavPosition);
