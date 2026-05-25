require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const connectDB = require('./config/db');
connectDB();

const app = express();
app.use(cors());
app.use(express.json());

// ── 靜態檔案服務 ───────────────────────────────
const STATIC_CANDIDATES = [
  path.join(__dirname, '../../client/public'),
  path.join(__dirname, '..'),        
  path.join(__dirname, '../..'),     
  process.cwd(),                     
  path.join(process.cwd(), '..'),    
];

let STATIC_DIR = path.join(__dirname, '../../client/public');
let INDEX_FILE = 'index.html';

for (const dir of STATIC_CANDIDATES) {
  if (fs.existsSync(path.join(dir, 'index.html'))) {
    STATIC_DIR = dir; INDEX_FILE = 'index.html'; break;
  }
}
console.log(`📂 靜態目錄：${STATIC_DIR}（主頁：${INDEX_FILE}）`);

app.use(express.static(STATIC_DIR, { index: INDEX_FILE }));
app.use('/src', express.static(path.join(STATIC_DIR, '../src')));

// 根路由 → 回傳主頁
app.get('/', (req, res) => {
  res.sendFile(path.join(STATIC_DIR, INDEX_FILE));
});

// API 路由
app.use(require('./routes/api'));

// admin.html 專用路由
app.get('/admin', (req, res) => {
  const adminPath = path.join(STATIC_DIR, 'admin.html');
  if (fs.existsSync(adminPath)) res.sendFile(adminPath);
  else res.status(404).send('Admin page not found');
});

// 其他 GET 路由回到首頁（避免重新整理出現 404）
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    if (req.path === '/admin.html') {
      const adminPath = path.join(STATIC_DIR, 'admin.html');
      if (fs.existsSync(adminPath)) return res.sendFile(adminPath);
    }
    res.sendFile(path.join(STATIC_DIR, INDEX_FILE));
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 LearnMate 伺服器已啟動於 port ${PORT} (0.0.0.0)`);
});
