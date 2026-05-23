import re

with open('index.html', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Remove AI panel
text = re.sub(r'<div style="display:flex;align-items:center;gap:7px">.*?<div id="ai-key-hint".*?</div>\s*</div>', '', text, flags=re.DOTALL)
text = re.sub(r'<span id="ai-panel-arrow".*?</span>', '', text)
text = text.replace('Demo v2.0 · AI 加持', 'Demo v1.0 · API Mode')

# Remove toggleAIPanel script completely
text = re.sub(r'function toggleAIPanel\(\) \{.*?\}\s*function previewKeyStatus.*?\}\s*window\.addEventListener\(\'DOMContentLoaded\', \(\) => \{.*?\}\);', '', text, flags=re.DOTALL)


# 2. Replace the app_final.js with app_api.js
text = text.replace('app_final.js', 'app_api.js?v=8')

# 3. Text replacements to reduce cognitive load
text = text.replace('你需要知道的', '今天需要你關注')
text = text.replace('出補強練習題', '給孩子出題')
text = text.replace('從題庫生成 →', 'AI 幫你出題 →')
text = text.replace('<div class="p-topbar-title">學習洞察</div>', '<div class="p-topbar-title">學習報告</div>')
text = text.replace('今天的任務', '今天要完成的任務')
text = text.replace('你決定從哪個開始', '點擊「開始」進入測驗')
text = text.replace('<div onclick="navTo(\'screen-student-choose\')" style="background:#2d4a3e;border-radius:16px;padding:5px 12px;display:inline-block;cursor:pointer;font-size:11px;font-weight:500;color:#a8d5b5">我來選順序 →</div>', '')

# Diagram
diagram = """
          <div style="background:#f9fafb;border-radius:8px;padding:10px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;font-size:10px;color:#6b7280;text-align:center">
            <div><div style="font-size:16px;margin-bottom:2px">✏️</div><div>你出題</div></div>
            <div style="font-size:12px;color:#d1d5db;margin-top:4px">▶</div>
            <div><div style="font-size:16px;margin-bottom:2px">📱</div><div>傳給孩子</div></div>
            <div style="font-size:12px;color:#d1d5db;margin-top:4px">▶</div>
            <div><div style="font-size:16px;margin-bottom:2px">✓</div><div>孩子作答</div></div>
            <div style="font-size:12px;color:#d1d5db;margin-top:4px">▶</div>
            <div><div style="font-size:16px;margin-bottom:2px">⭐</div><div>你給點數</div></div>
          </div>
"""
text = text.replace('<div style="font-size:13px;font-weight:500;color:#0f0f14;margin-bottom:8px">給孩子出題</div>',
                    '<div style="font-size:13px;font-weight:500;color:#0f0f14;margin-bottom:8px">給孩子出題</div>' + diagram)


# 4. Modify Bottom Navigation
# Using simple string replace for the EXACT blocks of p-bottom-nav
parent_nav_home = """      <div class="p-bottom-nav">
        <div class="p-nav-item active" onclick="navTo('screen-parent-home')"><div class="p-nav-icon">🏠</div><div class="p-nav-label">今日</div></div>
        <div class="p-nav-item" onclick="navTo('screen-parent-msg')"><div class="p-nav-icon">💬</div><div class="p-nav-label">派題</div></div>
        <div class="p-nav-item" onclick="navTo('screen-parent-insights')"><div class="p-nav-icon">📊</div><div class="p-nav-label">報告</div></div>
        <div class="p-nav-item" onclick="navTo('screen-parent-settings')"><div class="p-nav-icon">⚙️</div><div class="p-nav-label">設定</div></div>
        <div class="p-nav-item" onclick="logout()"><div class="p-nav-icon">🚪</div><div class="p-nav-label">登出</div></div>
      </div>"""

parent_nav_msg = parent_nav_home.replace('active" onclick="navTo(\'screen-parent-home\')', '" onclick="navTo(\'screen-parent-home\')').replace('" onclick="navTo(\'screen-parent-msg\')', 'active" onclick="navTo(\'screen-parent-msg\')')
parent_nav_insights = parent_nav_home.replace('active" onclick="navTo(\'screen-parent-home\')', '" onclick="navTo(\'screen-parent-home\')').replace('" onclick="navTo(\'screen-parent-insights\')', 'active" onclick="navTo(\'screen-parent-insights\')')
parent_nav_settings = parent_nav_home.replace('active" onclick="navTo(\'screen-parent-home\')', '" onclick="navTo(\'screen-parent-home\')').replace('" onclick="navTo(\'screen-parent-settings\')', 'active" onclick="navTo(\'screen-parent-settings\')')

# In index.html, there are exactly 6 parent bottom navs. 
# screen-parent-home, screen-parent-alerts, screen-parent-msg, screen-parent-insights, screen-parent-rewards, screen-parent-settings
def get_parent_nav(active_screen):
    if active_screen == 'home': return parent_nav_home
    if active_screen == 'msg': return parent_nav_msg
    if active_screen == 'insights': return parent_nav_insights
    if active_screen == 'settings': return parent_nav_settings
    return parent_nav_home

# We will just regex replace the `<div class="p-bottom-nav">...</div>` strictly.
def repl_nav(m):
    block = m.group(0)
    if 'screen-parent-alerts' in block and 'screen-parent' in block:
        # Parent nav
        if 'active" onclick="navTo(\'screen-parent-msg\')"' in block: return parent_nav_msg
        if 'active" onclick="navTo(\'screen-parent-insights\')"' in block: return parent_nav_insights
        if 'active" onclick="navTo(\'screen-parent-settings\')"' in block: return parent_nav_settings
        if 'active" onclick="navTo(\'screen-parent-alerts\')"' in block: return parent_nav_home
        if 'active" onclick="navTo(\'screen-parent-rewards\')"' in block: return parent_nav_home
        return parent_nav_home
    elif 'screen-student-choose' in block and 'screen-student' in block:
        # Student nav
        if 'active" onclick="navTo(\'screen-student-rewards\')"' in block: return student_nav_rewards
        return student_nav_home
    return block

student_nav_home = """      <div class="p-bottom-nav">
        <div class="p-nav-item active" onclick="navTo('screen-student-home')"><div class="p-nav-icon">🏠</div><div class="p-nav-label">今日任務</div></div>
        <div class="p-nav-item" onclick="navTo('screen-student-rewards')"><div class="p-nav-icon">⭐</div><div class="p-nav-label">我的獎勵</div></div>
        <div class="p-nav-item" onclick="navTo('screen-student-profile')"><div class="p-nav-icon">👤</div><div class="p-nav-label">進階</div></div>
        <div class="p-nav-item" onclick="logout()"><div class="p-nav-icon">🚪</div><div class="p-nav-label">登出</div></div>
      </div>"""
student_nav_rewards = student_nav_home.replace('active" onclick="navTo(\'screen-student-home\')', '" onclick="navTo(\'screen-student-home\')').replace('" onclick="navTo(\'screen-student-rewards\')', 'active" onclick="navTo(\'screen-student-rewards\')')
student_nav_profile = student_nav_home.replace('active" onclick="navTo(\'screen-student-home\')', '" onclick="navTo(\'screen-student-home\')').replace('" onclick="navTo(\'screen-student-profile\')', 'active" onclick="navTo(\'screen-student-profile\')')

# Carefully replace without touching outer closing divs
text = re.sub(r'      <div class="p-bottom-nav">\s*(?:<div class="p-nav-item".*?</div>\s*)+</div>', repl_nav, text)

# Add student profile screen
profile_screen = f"""
    <!-- S8: 進階 (Profile) -->
    <div id="screen-student-profile" class="screen s-screen">
      <div class="p-topbar"><div class="p-topbar-title">👤 進階功能</div></div>
      <div class="p-content">
        <div class="p-card" style="margin-bottom:12px">
          <div style="font-size:13px;font-weight:500;color:#0f0f14;margin-bottom:8px">加強與個人化</div>
          <div onclick="navTo('screen-student-extra')" style="display:flex;align-items:center;padding:12px 0;border-bottom:0.5px solid #e5e7eb;cursor:pointer">
            <div style="font-size:20px;margin-right:12px">💪</div>
            <div style="flex:1"><div style="font-size:14px;color:#0f0f14">補強題</div><div style="font-size:11px;color:#9ca3af">爸媽指定的額外練習</div></div>
            <div style="color:#9ca3af">→</div>
          </div>
          <div onclick="navTo('screen-student-videos')" style="display:flex;align-items:center;padding:12px 0;cursor:pointer">
            <div style="font-size:20px;margin-right:12px">📹</div>
            <div style="flex:1"><div style="font-size:14px;color:#0f0f14">AI 推薦影片</div><div style="font-size:11px;color:#9ca3af">專屬你的學習影片</div></div>
            <div style="color:#9ca3af">→</div>
          </div>
        </div>
      </div>
{student_nav_profile}
    </div>
"""

text = text.replace('  </div><!-- /app-container -->', profile_screen + '  </div><!-- /app-container -->')

with open('index_api.html', 'w', encoding='utf-8') as f:
    f.write(text)
