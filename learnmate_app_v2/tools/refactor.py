import os
import re

base_dir = r"D:\行政\2026 AI PM班\第7組\learnmate_app_v2\server"
src_server = os.path.join(base_dir, "server.js")
dest_api = os.path.join(base_dir, "src", "routes", "api.js")
dest_server = os.path.join(base_dir, "src", "server.js")

with open(src_server, "r", encoding="utf-8") as f:
    code = f.read()

# 1. Generate api.js
api_code = code

# Replace app with router for routes
api_code = api_code.replace("const app = express();", "const router = express.Router();")
api_code = api_code.replace("app.use(cors());", "")
api_code = api_code.replace("app.use(express.json());", "")
api_code = api_code.replace("app.post(", "router.post(")
api_code = api_code.replace("app.get(", "router.get(")
api_code = api_code.replace("app.delete(", "router.delete(")

# Remove static serving and DB connection from api.js since it will be in server.js/config
db_pattern = re.compile(r"const MONGODB_URI = process\.env\.MONGODB_URI[\s\S]*?catch\(err => console\.error\('❌ MongoDB 連線失敗:', err\)\);", re.MULTILINE)
api_code = db_pattern.sub("", api_code)

static_pattern = re.compile(r"// ── 靜態檔案服務 ───────────────────────────────[\s\S]*?app\.use\(express\.static\(STATIC_DIR, { index: INDEX_FILE }\)\);", re.MULTILINE)
api_code = static_pattern.sub("", api_code)

# Remove app.listen from api.js
listen_pattern = re.compile(r"const PORT = process\.env\.PORT[\s\S]*?}\);", re.MULTILINE)
api_code = listen_pattern.sub("module.exports = router;", api_code)

# Add require to aiService and youtubeService
service_imports = """
const { callGemini, buildQuizPrompt, buildVideoPrompt, buildInsightPrompt } = require('../services/aiService');
const { searchYouTubeVideo } = require('../services/youtubeService');
"""
api_code = api_code.replace("const Question = require('./models/Question');", "const Question = require('../models/Question');" + service_imports)

# Fix model requires
api_code = api_code.replace("require('./models/", "require('../models/")

# Remove original service functions from api.js
gemini_pattern = re.compile(r"// ── 通用 Gemini REST 呼叫函式 ──────────────────────────────[\s\S]*?function buildInsightPrompt[\s\S]*?}\n", re.MULTILINE)
api_code = gemini_pattern.sub("", api_code)

yt_pattern = re.compile(r"// ── YouTube Data API v3 工具函式 ──────────────────────────[\s\S]*?}\n\n", re.MULTILINE)
api_code = yt_pattern.sub("", api_code)

# Handle the root route in api.js (we should remove it since server.js will handle it)
root_route_pattern = re.compile(r"// 根路由 → 回傳主頁[\s\S]*?}\);\n", re.MULTILINE)
api_code = root_route_pattern.sub("", api_code)

# Write api.js
with open(dest_api, "w", encoding="utf-8") as f:
    f.write(api_code)


# 2. Generate new server.js
server_code = """require('dotenv').config();
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
"""

with open(dest_server, "w", encoding="utf-8") as f:
    f.write(server_code)

print("Refactoring complete.")
