const express = require('express');
const Task = require('../models/Task');
const Family = require('../models/Family');
const Message = require('../models/Message');
const Alert = require('../models/Alert');

const router = express.Router();
const auth = require('../middleware/authMiddleware');
const checkSub = require('../middleware/authSubscription');

// ==========================================
// 1. 家長指派習慣任務 (POST /api/habits/assign)
// ==========================================
router.post('/api/habits/assign', auth, checkSub, async (req, res) => {
  try {
    const { familyId, category, subject, target_unit, target_value } = req.body;
    
    if (!familyId || !category || !subject) {
      return res.status(400).json({ success: false, error: '請提供完整參數' });
    }

    const newTask = await Task.create({
      familyId,
      type: 'daily',
      item_type: 'habit',
      subject,
      topic: `${category}習慣打卡`,
      status: 'pending',
      points: 10,
      habit_config: {
        category,
        target_unit: target_unit || '分鐘',
        target_value: parseInt(target_value) || 20,
        actual_value: 0,
        child_note: '',
        parent_confirmed: false,
        parent_note: ''
      }
    });

    res.status(201).json({ success: true, task: newTask });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 2. 學生端完成習慣打卡 (POST /api/habits/checkin)
//    - 學生提交打卡數據與自評
//    - 立刻加 10 點
//    - 狀態變更為 submitted，等待家長點擊確認獲得加成 +3 點
// ==========================================
router.post('/api/habits/checkin', auth, checkSub, async (req, res) => {
  try {
    const { taskId, actual_value, child_note } = req.body;
    
    if (!taskId) {
      return res.status(400).json({ success: false, error: '缺少 taskId 參數' });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ success: false, error: '找不到該任務' });
    }

    if (task.item_type !== 'habit') {
      return res.status(400).json({ success: false, error: '該任務不是習慣打卡項目' });
    }

    if (task.status === 'completed' || task.status === 'submitted') {
      return res.status(400).json({ success: false, error: '該習慣今天已經打過卡囉！' });
    }

    // 更新任務打卡資料與狀態為已送出 (submitted)
    task.status = 'submitted';
    task.habit_config.actual_value = parseInt(actual_value) || task.habit_config.target_value;
    task.habit_config.child_note = child_note || '';
    task.earnedPoints = 10; // 打卡立刻獲得 10 點
    await task.save();

    // 更新家庭金幣與 streak
    const family = await Family.findById(task.familyId);
    if (family) {
      family.points += 10;
      
      // 更新連勤天數 (Streak)
      const todayTW = new Date(Date.now() + 8 * 3600000).toISOString().split('T')[0];
      if (family.lastActiveDate !== todayTW) {
        const yesterday = new Date(Date.now() + 8 * 3600000 - 86400000).toISOString().split('T')[0];
        family.streak = (family.lastActiveDate === yesterday) ? (family.streak || 0) + 1 : 1;
        family.lastActiveDate = todayTW;
      }
      await family.save();
    }

    // 觸發家長端 positive/warning 預警系統通知
    await Alert.create({
      familyId: task.familyId,
      type: 'positive',
      title: `🏃 習慣打卡成功：${task.subject}`,
      desc: `小明今天完成了打卡：${task.habit_config.actual_value} ${task.habit_config.target_unit}！${child_note ? `備註：${child_note}` : ''}`
    });

    res.json({ 
      success: true, 
      task, 
      points: family ? family.points : 0, 
      streak: family ? family.streak : 0 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 3. 家長端確認習慣打卡 (POST /api/habits/confirm)
//    - 家長核准，給予額外 +3 點特別獎勵
//    - 可附帶評語，即時投遞到孩子首頁
// ==========================================
router.post('/api/habits/confirm', auth, checkSub, async (req, res) => {
  try {
    const { taskId, parent_note } = req.body;

    if (!taskId) {
      return res.status(400).json({ success: false, error: '缺少 taskId 參數' });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ success: false, error: '找不到該任務' });
    }

    if (task.status !== 'submitted') {
      return res.status(400).json({ success: false, error: '該打卡尚未送出或已核准完成' });
    }

    // 更新狀態為 completed
    task.status = 'completed';
    task.habit_config.parent_confirmed = true;
    task.habit_config.parent_note = parent_note || '';
    await task.save();

    // 給予加成特別獎勵 (+3 點)
    const family = await Family.findById(task.familyId);
    if (family) {
      family.points += 3;
      await family.save();
    }

    // 若有留言評語，同步寫入 Messages 板
    if (parent_note) {
      await Message.create({
        familyId: task.familyId,
        text: `「看到你今天完成了 ${task.habit_config.actual_value} ${task.habit_config.target_unit} 練習！${parent_note} 🌟」`,
        from: 'parent'
      });
    }

    res.json({ 
      success: true, 
      task, 
      points: family ? family.points : 0 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
