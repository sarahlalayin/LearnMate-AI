# ===================================================
# LearnMate — 修復 Render 部署 ENOENT 錯誤
# 在 Git Bash 或 VSCode Terminal 中執行以下指令
# ===================================================

# 1. 切換到專案目錄
cd "D:/行政/2026 AI PM班/第7組/learnmate_app"

# 2. 確認 index_api.html 存在
ls -la index_api.html
ls -la index.html

# 3. 把所有修改的檔案加入 Git
git add index_api.html
git add app_api.js
git add index.html
git add backend/server.js
git add style.css

# 4. 查看狀態確認
git status

# 5. Commit
git commit -m "fix: 修復 Render 部署 ENOENT 錯誤 (index_api.html 未 commit) + 補全 approveProposal/rejectProposal API"

# 6. 推送到 GitHub (會自動觸發 Render 重新部署)
git push origin main

# ===================================================
# 如果 push 時問帳號密碼，請輸入 GitHub 的
# Username 和 Personal Access Token (不是密碼)
# ===================================================
