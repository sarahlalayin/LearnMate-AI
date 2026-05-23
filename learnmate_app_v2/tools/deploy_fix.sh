## 問題修復：學生畫面全螢幕

### 更新檔案清單
1. `style.css` - 核心 CSS 修復
2. `index_api.html` - 移除重複 inline style
3. `app_api.js` - 修正 display:flex

### Git 指令（在 VSCode Terminal 或 Git Bash 執行）

```bash
cd "D:/行政/2026 AI PM班/第7組/learnmate_app"

git add style.css index_api.html app_api.js backend/server.js

git commit -m "fix: 修復學生畫面全螢幕問題 + 修復 Render ENOENT 錯誤"

git push origin main
```
