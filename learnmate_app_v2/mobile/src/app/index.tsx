import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  View, 
  Dimensions, 
  Platform,
  TextInput,
  Modal,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { PaywallModal } from '@/components/paywall-modal';
import { useRouter } from 'expo-router';

// 取得螢幕寬度以便做響應式排版
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 模擬學生與任務資料 (包含學業與自律習慣，後續可輕鬆介接 Express API)
const INITIAL_TASKS = [
  { id: '1', subject: '國語', edition: '南一版', topic: 'L5 詞語複習', status: 'pending', type: 'daily', item_type: 'academic' },
  { id: '2', subject: '數學', edition: '康軒版', topic: '第一~六單元總複習', status: 'completed', type: 'daily', item_type: 'academic' },
  { id: '3', subject: '英語', edition: '康軒版', topic: '現在進行式', status: 'pending', type: 'daily', item_type: 'academic' },
  { id: '4', subject: '自然', edition: '翰林版', status: 'skipped', reason: '今天功課太多了', type: 'daily', item_type: 'academic' },
  { id: '5', subject: '社會', edition: '翰林版', topic: '台灣地理', status: 'pending', type: 'daily', item_type: 'academic' },
  // 習慣打卡項目
  { 
    id: 'h1', 
    subject: '鋼琴練習', 
    topic: '才藝習慣打卡', 
    status: 'pending', 
    type: 'daily', 
    item_type: 'habit',
    points: 10,
    habit_config: {
      category: '才藝',
      target_unit: '分鐘',
      target_value: 20,
      actual_value: 0,
      child_note: '',
      parent_confirmed: false,
      parent_note: ''
    }
  },
  { 
    id: 'h2', 
    subject: '每日慢跑', 
    topic: '運動自律打卡', 
    status: 'pending', 
    type: 'daily', 
    item_type: 'habit',
    points: 10,
    habit_config: {
      category: '運動',
      target_unit: '分鐘',
      target_value: 15,
      actual_value: 0,
      child_note: '',
      parent_confirmed: false,
      parent_note: ''
    }
  },
  { 
    id: 'h3', 
    subject: '閱讀課外書', 
    topic: '自我成長閱讀', 
    status: 'completed', 
    type: 'daily', 
    item_type: 'habit',
    points: 10,
    habit_config: {
      category: '閱讀',
      target_unit: '頁',
      target_value: 10,
      actual_value: 12,
      child_note: '今天讀了十頁三國演義，諸葛亮真聰明！',
      parent_confirmed: true,
      parent_note: '讚！維持閱讀好習慣。'
    }
  }
];

export default function HomeScreen() {
  const router = useRouter();
  const { colors, gradeTheme, setGradeTheme, themeMode, setThemeMode } = useTheme();
  
  // 本地狀態管理
  const [points, setPoints] = useState(320);
  const [isPro, setIsPro] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [streak, setStreak] = useState(5);
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [parentMessage, setParentMessage] = useState('「看到你今天完成了 12 頁 閱讀課外書 練習！太棒了，多讀書有益身心！ 🌟 — 媽媽」');

  // 段考複習模式狀態 (Phase D2)
  const [examPrepData, setExamPrepData] = useState<any>({
    examDate: '2026-06-15',
    countdownActive: true,
    subjects: [
      { subjectName: '國語', range: '第一~四課' },
      { subjectName: '數學', range: '第一~三單元' },
      { subjectName: '英語', range: '現在進行式' }
    ]
  });

  const fetchExamPrep = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/exam-prep/mock_family_123');
      const data = await response.json();
      if (data.success && data.examPrep) {
        setExamPrepData(data.examPrep);
      }
    } catch (e) {
      console.log('學生端獲取段考設定連線失敗，使用本地沙盒');
    }
  };

  useEffect(() => {
    fetchExamPrep();
  }, []);

  // 習慣打卡互動 State (B2)
  const [selectedHabit, setSelectedHabit] = useState<any>(null);
  const [showHabitModal, setShowHabitModal] = useState(false);
  const [actualValue, setActualValue] = useState('');
  const [childNote, setChildNote] = useState('');

  // 計時器 State
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerRef = useRef<any>(null);

  // 任務統計 (將 completed 與 submitted 都計入，因打卡就算完成，待審核)
  const completedCount = tasks.filter(t => t.status === 'completed' || t.status === 'submitted').length;
  const totalCount = tasks.length;
  const completionRate = Math.round((completedCount / totalCount) * 100);

  // 模擬答題完成一個任務
  const handleCompleteTask = (id: string, subject: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        if (t.status === 'completed') return t;
        // 點數回饋機制 (+10 點，答對一題額外加成等模擬)
        setPoints(p => p + 10);
        return { ...t, status: 'completed', topic: t.topic || '已完成測驗' };
      }
      return t;
    }));
  };

  // 模擬跳過/暫停一個任務 (A5)
  const handleSkipTask = (id: string, reason: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        // 扣除點數代價 (-5 點防濫用)
        setPoints(p => Math.max(0, p - 5));
        return { ...t, status: 'skipped', reason };
      }
      return t;
    }));
  };

  // 計時器秒數遞增 (B2)
  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => {
        setTimerSeconds(s => s + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isTimerRunning]);

  // 格式化時間 (MM:SS)
  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 習慣打卡送出 (B2)
  const handleCheckInHabit = async (taskId: string, actualVal: string, childComment: string) => {
    const val = parseInt(actualVal) || 0;
    if (val <= 0) {
      if (Platform.OS === 'web') alert('❌ 請輸入大於 0 的完成數值！');
      else Alert.alert('輸入無效 ⚠️', '請輸入大於 0 的完成數值！');
      return;
    }

    // 關閉 Modal 與計時器
    setIsTimerRunning(false);
    setTimerSeconds(0);
    setShowHabitModal(false);
    setSelectedHabit(null);
    setActualValue('');
    setChildNote('');

    // 呼叫 API 或進行 Mock 模擬
    try {
      const response = await fetch('http://localhost:5000/api/habits/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, actual_value: val, child_note: childComment })
      });
      const data = await response.json();
      if (data.success) {
        setPoints(data.points);
        setStreak(data.streak);
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'submitted', habit_config: { ...t.habit_config, actual_value: val, child_note: childComment } } : t));
        if (Platform.OS === 'web') alert(`🎉 打卡成功！獲得 +10 點！當前連勤：🔥 ${data.streak} 天`);
        else Alert.alert('打卡成功 🏃', `獲得 +10 點！當前連勤：🔥 ${data.streak} 天`);
        return;
      }
    } catch (e) {
      console.log('無法連線到伺服器，使用本地沙盒模擬完成打卡');
    }

    // 本地模擬
    setPoints(p => p + 10);
    setStreak(s => s + 1);
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          status: 'submitted',
          habit_config: {
            ...t.habit_config,
            actual_value: val,
            child_note: childComment
          }
        };
      }
      return t;
    }));

    if (Platform.OS === 'web') {
      alert(`🎉 【沙盒模擬】打卡成功！獲得 +10 點！請通知爸媽前往控制台審核加碼額外 +3 點！`);
    } else {
      Alert.alert('打卡成功 🏃', '【沙盒模擬】獲得 +10 點！請通知爸媽前往控制台審核加碼額外 +3 點！');
    }
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        
        {/* ── 頂部自訂 Header ─────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {/* 圓形姓名大頭貼 (PRD 6.1: 第一字圓形大頭貼) */}
            <View style={[styles.avatarCircle, { backgroundColor: colors.primary }]}>
              <ThemedText style={styles.avatarText} themeColor="background">小</ThemedText>
            </View>
            <View style={styles.headerTitleContainer}>
              <View style={styles.gradeBadge}>
                <ThemedText style={styles.gradeBadgeText}>{gradeTheme === 'lowGrade' ? '低年級' : '高年級'}</ThemedText>
              </View>
              <ThemedText style={styles.welcomeText} type="smallBold">
                嗨，小明！這是你的學習基地 🏠
              </ThemedText>
            </View>
          </View>
          
          {/* 點數錢包顯示與 Pro 狀態 (C2/C3) */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {isPro ? (
              <View style={{ backgroundColor: '#F59E0B22', borderColor: '#F59E0B', borderWidth: 1, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 8 }}>
                <ThemedText style={{ color: '#F59E0B', fontSize: 11 }} type="smallBold">👑 Pro</ThemedText>
              </View>
            ) : (
              <TouchableOpacity 
                style={{ backgroundColor: colors.primary + '15', borderColor: colors.primary, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 8 }}
                onPress={() => setShowPaywall(true)}
              >
                <ThemedText style={{ color: colors.primary, fontSize: 11 }} type="smallBold">💎 升級 Pro</ThemedText>
              </TouchableOpacity>
            )}

            <View style={[styles.pointsContainer, { backgroundColor: colors.backgroundSelected }]}>
              <ThemedText style={styles.pointsLabel} type="small">學習點數</ThemedText>
              <ThemedText style={[styles.pointsValue, { color: colors.primary }]} type="smallBold">
                💎 {points} 點
              </ThemedText>
            </View>
          </View>
        </View>

        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* ── 狀態動態橫幅 (PRD 6.1: Dynamic Banner) ───────────────── */}
          <View style={[
            styles.bannerContainer, 
            { 
              backgroundColor: completionRate === 100 
                ? colors.success + '22' // 綠色背景
                : colors.warning + '22', // 橘色背景
              borderColor: completionRate === 100 ? colors.success : colors.warning
            }
          ]}>
            <ThemedText style={[
              styles.bannerText,
              { color: completionRate === 100 ? colors.success : colors.warning }
            ]} type="smallBold">
              {completionRate === 100 
                ? '🎉 太棒了！今天所有學習基地任務全數達標！快去換獎勵吧 🎁' 
                : `💡 今天還有任務等著你喔！已完成 ${completedCount}/${totalCount} 科，繼續加油！`
              }
            </ThemedText>
          </View>

          {/* ── 連勤環形進度條 (PRD 6.1 / 8.3 Streak Circle) ─────────────── */}
          <ThemedView type="backgroundElement" style={[styles.streakCard, { borderColor: colors.border }]}>
            <View style={styles.streakRow}>
              {/* 環形連勤指標 (純原生 CSS 動態模擬) */}
              <View style={[styles.circleProgressOutline, { borderColor: colors.border }]}>
                {/* 漸變發光火苗圈 */}
                <View style={[styles.circleProgressFill, { borderColor: colors.primary }]}>
                  <ThemedText style={styles.streakFire} type="subtitle">🔥</ThemedText>
                  <ThemedText style={styles.streakDayValue} type="smallBold">{streak} 天</ThemedText>
                </View>
              </View>

              <View style={styles.streakInfo}>
                <ThemedText type="smallBold" style={{ color: colors.text }}>連續自律連勤</ThemedText>
                <ThemedText type="small" style={[styles.streakSubText, { color: colors.textSecondary }]}>
                  再持續 <ThemedText type="smallBold" style={{ color: colors.primary }}>{7 - (streak % 7)} 天</ThemedText> 即可獲得 <ThemedText type="smallBold" style={{ color: colors.warning }}>100 點金幣連勤獎</ThemedText>！
                </ThemedText>
                {/* Streak 進度條 */}
                <View style={[styles.barBg, { backgroundColor: colors.backgroundSelected }]}>
                  <View style={[styles.barFill, { backgroundColor: colors.primary, width: `${(streak / 7) * 100}%` }]} />
                </View>
              </View>
            </View>
          </ThemedView>

          {/* ── 🎯 段考複習大作戰 Widget (Phase D2) ─────────────── */}
          {examPrepData && examPrepData.countdownActive && examPrepData.examDate && (
            (() => {
              const getDaysLeft = () => {
                const diff = new Date(examPrepData.examDate).getTime() - Date.now();
                return Math.max(0, Math.ceil(diff / 86400000));
              };
              const daysLeft = getDaysLeft();
              const isUrgent = daysLeft <= 7;

              return (
                <ThemedView 
                  type="backgroundElement" 
                  style={[
                    styles.streakCard, 
                    { 
                      borderColor: isUrgent ? colors.critical : colors.warning, 
                      borderWidth: 1.5,
                      padding: Spacing.three,
                      gap: 8
                    }
                  ]}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <ThemedText style={{ fontSize: 20 }}>🎯</ThemedText>
                      <ThemedText type="smallBold" style={{ color: colors.text }}>
                        段考大作戰衝刺中！
                      </ThemedText>
                    </View>
                    <View style={{ backgroundColor: isUrgent ? colors.critical + '22' : colors.warning + '22', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                      <ThemedText style={{ color: isUrgent ? colors.critical : colors.warning, fontSize: 12 }} type="smallBold">
                        倒數 {daysLeft} 天 🔥
                      </ThemedText>
                    </View>
                  </View>

                  <ThemedText style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 16 }}>
                    AI 老師已為你開啟「段考衝刺出題」！隨堂測驗中會自動加重爸媽為你設定的段考複習單元喔。加油衝刺賺取高額金幣！
                  </ThemedText>

                  {/* 複習科目範圍展示 */}
                  {examPrepData.subjects && examPrepData.subjects.length > 0 && (
                    <View style={{ borderTopWidth: 0.5, borderTopColor: colors.border + '33', paddingTop: 8, gap: 4 }}>
                      <ThemedText style={{ fontSize: 11, color: colors.text, fontWeight: '700' }}>
                        📌 今日複習重點範圍：
                      </ThemedText>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {examPrepData.subjects.map((sub: any, idx: number) => (
                          <View 
                            key={idx} 
                            style={{ 
                              backgroundColor: colors.backgroundSelected, 
                              paddingHorizontal: 8, 
                              paddingVertical: 3, 
                              borderRadius: 6,
                              borderWidth: 0.5,
                              borderColor: colors.border
                            }}
                          >
                            <ThemedText style={{ fontSize: 10, color: colors.primary }} type="smallBold">
                              {sub.subjectName}：{sub.range || '全範圍'}
                            </ThemedText>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </ThemedView>
              );
            })()
          )}

          {/* ── 爸媽留言板 (PRD 6.1 / 12.1 Parents Letterbox) ─────────────── */}
          {parentMessage && (
            <View style={[styles.messageBoard, { borderColor: colors.success }]}>
              <View style={[styles.messageTitleRow, { backgroundColor: colors.success + '15' }]}>
                <ThemedText style={[styles.messageTitle, { color: colors.success }]} type="smallBold">
                  ✉️ 爸媽留言板（給寶貝的一封信）
                </ThemedText>
              </View>
              <View style={styles.messageContent}>
                <ThemedText style={[styles.messageText, { color: colors.text }]} type="small">
                  {parentMessage}
                </ThemedText>
              </View>
            </View>
          )}

          {/* ── AI 智慧首科推薦 (PRD 6.2/6.3: 自主感 > 控制感 建議) ───────────────── */}
          <View style={[styles.recommendBubble, { backgroundColor: colors.backgroundSelected }]}>
            <ThemedText type="small" style={[styles.recommendText, { color: colors.text }]}>
              💡 <ThemedText type="smallBold" style={{ color: colors.primary }}>AI 老師建議</ThemedText>：依據你最近的學習情況，建議今天可以先挑戰【<ThemedText type="smallBold" style={{ color: colors.primary }}>英語</ThemedText>】，它有最適合你的專屬新題目喔！
            </ThemedText>
          </View>

          {/* ── 今日任務列表 (PRD 6.2/6.3: Textbook-Aligned Tasks) ─────────────── */}
          <View style={styles.tasksSection}>
            <ThemedText style={styles.sectionTitle} type="smallBold">
              今天想從哪個科目開始？(自主選順序)
            </ThemedText>

            {tasks.map((task) => {
              const isCompleted = task.status === 'completed';
              const isSkipped = task.status === 'skipped';
              
              return (
                <ThemedView 
                  key={task.id} 
                  type="backgroundElement" 
                  style={[
                    styles.taskCard, 
                    { 
                      borderColor: colors.border,
                      opacity: isCompleted ? 0.75 : 1
                    }
                  ]}
                >
                  <View style={styles.taskCardLeft}>
                    {/* 科目 Avatar 標章 */}
                    <View style={[
                      styles.subjectBadge, 
                      { backgroundColor: isCompleted ? colors.success + '22' : colors.primary + '15' }
                    ]}>
                      <ThemedText style={{ color: isCompleted ? colors.success : colors.primary }} type="smallBold">
                        {task.subject[0]}
                      </ThemedText>
                    </View>
                    <View style={styles.taskDetails}>
                      <View style={styles.taskTitleRow}>
                        <ThemedText style={[styles.taskSubject, { color: colors.text }]} type="smallBold">
                          {task.subject}
                        </ThemedText>
                        <View style={[styles.editionBadge, { backgroundColor: colors.backgroundSelected }]}>
                          <ThemedText style={styles.editionText} type="small">{task.edition}</ThemedText>
                        </View>
                      </View>
                      <ThemedText style={[styles.taskTopic, { color: colors.textSecondary }]} type="small">
                        {isSkipped ? `已暫停：${task.reason}` : (task.topic || 'AI 自適應出題')}
                      </ThemedText>
                    </View>
                  </View>

                  {/* 互動按鈕 */}
                  <View style={styles.taskCardRight}>
                    {isCompleted ? (
                      <View style={[styles.statusLabel, { backgroundColor: colors.success + '22' }]}>
                        <ThemedText style={{ color: colors.success }} type="smallBold">✓ 已完成</ThemedText>
                      </View>
                    ) : isSkipped ? (
                      <TouchableOpacity 
                        style={[styles.actionButton, { backgroundColor: colors.primary }]}
                        onPress={() => handleCompleteTask(task.id, task.subject)}
                      >
                        <ThemedText themeColor="background" type="smallBold">重啟</ThemedText>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.actionRow}>
                        {/* 跳過按鈕 (PRD 6.4: Skip Trigger) */}
                        <TouchableOpacity 
                          style={[styles.skipButton, { borderColor: colors.border }]}
                          onPress={() => handleSkipTask(task.id, '看不懂')}
                        >
                          <ThemedText style={{ color: colors.textSecondary }} type="small">暫停</ThemedText>
                        </TouchableOpacity>

                        {/* 開始按鈕 */}
                        <TouchableOpacity 
                          style={[styles.actionButton, { backgroundColor: colors.primary }]}
                          onPress={() => handleCompleteTask(task.id, task.subject)}
                        >
                          <ThemedText themeColor="background" type="smallBold">開始</ThemedText>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </ThemedView>
              );
            })}
          </View>

          {/* ── 🏃 自律習慣打卡列表 (PRD 6.1 / Phase B) ─────────────── */}
          <View style={[styles.tasksSection, { marginTop: Spacing.two }]}>
            <ThemedText style={styles.sectionTitle} type="smallBold">
              🏃 自律習慣養成 (打卡累積點數)
            </ThemedText>

            {tasks.filter(t => t.item_type === 'habit').map((habit) => {
              const isPending = habit.status === 'pending';
              const isSubmitted = habit.status === 'submitted';
              const isCompleted = habit.status === 'completed';
              
              // 取得習慣類別的對應 icon
              const getHabitIcon = (cat: string) => {
                switch(cat) {
                  case '運動': return '🏃';
                  case '才藝': return '🎹';
                  case '閱讀': return '📚';
                  default: return '✨';
                }
              };

              return (
                <ThemedView 
                  key={habit.id} 
                  type="backgroundElement" 
                  style={[
                    styles.taskCard, 
                    { 
                      borderColor: isCompleted ? colors.success : isSubmitted ? colors.warning : colors.border,
                      opacity: isCompleted ? 0.75 : 1
                    }
                  ]}
                >
                  <View style={styles.taskCardLeft}>
                    {/* 習慣類別 Icon 標章 */}
                    <View style={[
                      styles.subjectBadge, 
                      { backgroundColor: isCompleted ? colors.success + '22' : isSubmitted ? colors.warning + '15' : colors.primary + '15' }
                    ]}>
                      <ThemedText style={{ fontSize: 20 }}>
                        {getHabitIcon(habit.habit_config?.category || '')}
                      </ThemedText>
                    </View>
                    <View style={styles.taskDetails}>
                      <View style={styles.taskTitleRow}>
                        <ThemedText style={[styles.taskSubject, { color: colors.text }]} type="smallBold">
                          {habit.subject}
                        </ThemedText>
                        <View style={[
                          styles.editionBadge, 
                          { 
                            backgroundColor: isCompleted ? colors.success + '15' : isSubmitted ? colors.warning + '15' : colors.backgroundSelected 
                          }
                        ]}>
                          <ThemedText style={[
                            styles.editionText, 
                            { color: isCompleted ? colors.success : isSubmitted ? colors.warning : colors.primary }
                          ]} type="small">
                            {habit.habit_config?.category || '自律'}
                          </ThemedText>
                        </View>
                      </View>
                      <ThemedText style={[styles.taskTopic, { color: colors.textSecondary }]} type="small">
                        {isCompleted 
                          ? `已核准：實際完成 ${habit.habit_config?.actual_value} ${habit.habit_config?.target_unit} (目標 ${habit.habit_config?.target_value})`
                          : isSubmitted
                            ? `已打卡：回報 ${habit.habit_config?.actual_value} ${habit.habit_config?.target_unit}，等待爸媽確認中`
                            : `今日目標：${habit.habit_config?.target_value} ${habit.habit_config?.target_unit}`
                        }
                      </ThemedText>
                      {isCompleted && habit.habit_config?.parent_note && (
                        <ThemedText style={{ color: colors.success, fontSize: 11, fontStyle: 'italic', marginTop: 2 }}>
                          💬 爸媽留言：{habit.habit_config.parent_note}
                        </ThemedText>
                      )}
                    </View>
                  </View>

                  {/* 習慣右側互動按鈕 */}
                  <View style={styles.taskCardRight}>
                    {isCompleted ? (
                      <View style={[styles.statusLabel, { backgroundColor: colors.success + '22' }]}>
                        <ThemedText style={{ color: colors.success }} type="smallBold">✓ 已核准 (+13)</ThemedText>
                      </View>
                    ) : isSubmitted ? (
                      <View style={[styles.statusLabel, { backgroundColor: colors.warning + '22' }]}>
                        <ThemedText style={{ color: colors.warning }} type="smallBold">⌛ 待核准 (+10)</ThemedText>
                      </View>
                    ) : (
                      <TouchableOpacity 
                        style={[styles.actionButton, { backgroundColor: colors.primary }]}
                        onPress={() => {
                          if (!isPro) {
                            setShowPaywall(true);
                            return;
                          }
                          setSelectedHabit(habit);
                          setActualValue(habit.habit_config.target_value.toString());
                          setShowHabitModal(true);
                        }}
                      >
                        <ThemedText themeColor="background" type="smallBold">⏱️ 打卡</ThemedText>
                      </TouchableOpacity>
                    )}
                  </View>
                </ThemedView>
              );
            })}
          </View>
        </ScrollView>

        {/* ── 彈窗二：習慣打卡與計時器 Modal (B2) ─────────────────────────── */}
        <Modal
          visible={showHabitModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => {
            setIsTimerRunning(false);
            setTimerSeconds(0);
            setShowHabitModal(false);
          }}
        >
          <View style={styles.modalOverlay}>
            <ThemedView type="backgroundElement" style={styles.habitModalContent}>
              <ThemedText style={styles.priceTitle} type="subtitle">
                🏃 習慣打卡回報
              </ThemedText>
              
              {selectedHabit && (
                <View style={{ width: '100%', gap: Spacing.two, marginVertical: 10 }}>
                  <ThemedText style={{ textAlign: 'center', fontSize: 18 }} type="smallBold">
                    {selectedHabit.subject}
                  </ThemedText>
                  <ThemedText style={{ textAlign: 'center', color: colors.textSecondary }} type="small">
                    🎯 今日打卡目標：{selectedHabit.habit_config.target_value} {selectedHabit.habit_config.target_unit}
                  </ThemedText>

                  {/* ⏱️ 自律計時器 (Stopwatch Timer Widget) */}
                  {selectedHabit.habit_config.target_unit === '分鐘' && (
                    <View style={[styles.timerCard, { backgroundColor: colors.backgroundSelected, borderColor: colors.border }]}>
                      <ThemedText style={{ fontSize: 12, color: colors.textSecondary }}>⏱️ 自律練習計時器</ThemedText>
                      <ThemedText style={[styles.timerNumber, { color: colors.primary }]}>
                        {formatTime(timerSeconds)}
                      </ThemedText>
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity 
                          style={[styles.timerButton, { backgroundColor: colors.primary }]}
                          onPress={() => setIsTimerRunning(!isTimerRunning)}
                        >
                          <ThemedText themeColor="background" type="smallBold">
                            {isTimerRunning ? '⏸️ 暫停' : '▶️ 開始計時'}
                          </ThemedText>
                        </TouchableOpacity>

                        {timerSeconds > 0 && (
                          <TouchableOpacity 
                            style={[styles.timerButton, { backgroundColor: colors.success }]}
                            onPress={() => {
                              // 將秒數轉成分鐘，最少 1 分鐘
                              const mins = Math.max(1, Math.ceil(timerSeconds / 60));
                              setActualValue(mins.toString());
                              setIsTimerRunning(false);
                              if (Platform.OS === 'web') alert(`已將計時時間帶入打卡：${mins} 分鐘！`);
                              else Alert.alert('計時帶入 ⏱️', `已自動帶入實際練習時間：${mins} 分鐘！`);
                            }}
                          >
                            <ThemedText themeColor="background" type="smallBold">⏹️ 帶入打卡</ThemedText>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  )}

                  {/* 實際數值輸入框 */}
                  <View style={{ gap: 4 }}>
                    <ThemedText style={{ color: colors.text }} type="smallBold">實際完成數量：</ThemedText>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <TextInput
                        style={[styles.modalInput, { borderColor: colors.border, color: colors.text, flex: 1 }]}
                        keyboardType="number-pad"
                        placeholder="請輸入完成數量"
                        placeholderTextColor={colors.textSecondary}
                        value={actualValue}
                        onChangeText={setActualValue}
                      />
                      <ThemedText style={{ color: colors.text }}>
                        {selectedHabit.habit_config.target_unit}
                      </ThemedText>
                    </View>
                  </View>

                  {/* 自評心得 */}
                  <View style={{ gap: 4, marginTop: 4 }}>
                    <ThemedText style={{ color: colors.text }} type="smallBold">孩子練習自評與心得：</ThemedText>
                    <TextInput
                      style={[
                        styles.modalTextArea, 
                        { 
                          borderColor: colors.border, 
                          color: colors.text, 
                          backgroundColor: colors.backgroundSelected + '22'
                        }
                      ]}
                      multiline={true}
                      numberOfLines={3}
                      placeholder="今天練習得很棒！(寫點悄悄話給爸媽，選填)"
                      placeholderTextColor={colors.textSecondary}
                      value={childNote}
                      onChangeText={setChildNote}
                    />
                  </View>
                </View>
              )}

              {/* 操作按鈕 */}
              <View style={styles.modalBtnRow}>
                <TouchableOpacity 
                  style={[styles.modalBtn, { borderColor: colors.border }]}
                  onPress={() => {
                    setIsTimerRunning(false);
                    setTimerSeconds(0);
                    setShowHabitModal(false);
                    setSelectedHabit(null);
                    setActualValue('');
                    setChildNote('');
                  }}
                >
                  <ThemedText style={{ color: colors.textSecondary }} type="smallBold">取消</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    if (selectedHabit) {
                      handleCheckInHabit(selectedHabit.id, actualValue, childNote);
                    }
                  }}
                >
                  <ThemedText themeColor="background" type="smallBold">提交打卡</ThemedText>
                </TouchableOpacity>
              </View>
            </ThemedView>
          </View>
        </Modal>

        {/* ── 底部多維主題沙盒切換面板 (PRD 7.6 / 13.1 Sandbox Toggles) ──────────────── */}
        <ThemedView type="backgroundElement" style={[styles.sandboxPanel, { borderTopColor: colors.border }]}>
          <ThemedText style={styles.sandboxTitle} type="small">
            🎨 動態主題與端點控制面板（沙盒連調）
          </ThemedText>
          <View style={styles.sandboxButtonRow}>
            <TouchableOpacity 
              style={[
                styles.sandboxButton, 
                { backgroundColor: gradeTheme === 'lowGrade' ? colors.primary : colors.backgroundSelected }
              ]}
              onPress={() => setGradeTheme('lowGrade')}
            >
              <ThemedText 
                style={{ color: gradeTheme === 'lowGrade' ? '#FFFFFF' : colors.text }} 
                type="small"
              >
                🎒 低年級
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.sandboxButton, 
                { backgroundColor: gradeTheme === 'highGrade' ? colors.primary : colors.backgroundSelected }
              ]}
              onPress={() => setGradeTheme('highGrade')}
            >
              <ThemedText 
                style={{ color: gradeTheme === 'highGrade' ? '#FFFFFF' : colors.text }} 
                type="small"
              >
                🚀 高年級
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.sandboxButton, 
                { backgroundColor: gradeTheme === 'parent' ? colors.primary : colors.backgroundSelected }
              ]}
              onPress={() => setGradeTheme('parent')}
            >
              <ThemedText 
                style={{ color: gradeTheme === 'parent' ? '#FFFFFF' : colors.text }} 
                type="small"
              >
                🛡️ 家長端
              </ThemedText>
            </TouchableOpacity>
          </View>

          {/* 教師端 & 營運端專屬跳轉 (E2 & E1 Sandbox Entry Hooks) */}
          <View style={[styles.sandboxButtonRow, { marginTop: 4 }]}>
            <TouchableOpacity 
              style={[styles.sandboxButton, { backgroundColor: colors.backgroundSelected }]}
              onPress={() => router.push('/teacher')}
            >
              <ThemedText style={{ color: colors.text, fontSize: 11 }} type="small">
                🎒 教師端 Dashboard
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.sandboxButton, { backgroundColor: colors.backgroundSelected }]}
              onPress={() => router.push('/admin')}
            >
              <ThemedText style={{ color: colors.text, fontSize: 11 }} type="small">
                🛡️ 營運端 Admin
              </ThemedText>
            </TouchableOpacity>
          </View>

          {/* 明暗模式切換 */}
          <TouchableOpacity 
            style={[styles.darkModeToggle, { backgroundColor: colors.backgroundSelected }]}
            onPress={() => setThemeMode(themeMode === 'light' ? 'dark' : 'light')}
          >
            <ThemedText type="small" style={{ color: colors.text }}>
              {themeMode === 'light' ? '🌙 切換深色模式' : '☀️ 切換淺色模式'}
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>

        <PaywallModal 
          visible={showPaywall}
          onClose={() => setShowPaywall(false)}
          onUnlockSuccess={() => {
            setIsPro(true);
            setShowPaywall(false);
          }}
        />

      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB22',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerTitleContainer: {
    gap: 2,
  },
  gradeBadge: {
    backgroundColor: '#8B5CF622',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  gradeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  welcomeText: {
    fontSize: 14,
  },
  pointsContainer: {
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    borderRadius: 10,
  },
  pointsLabel: {
    fontSize: 10,
  },
  pointsValue: {
    fontSize: 13,
  },
  scrollContent: {
    padding: Spacing.three,
    paddingBottom: 250, // 避免底部遮擋
    gap: Spacing.three,
  },
  bannerContainer: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
  },
  bannerText: {
    fontSize: 13,
    textAlign: 'center',
  },
  streakCard: {
    borderRadius: 16,
    padding: Spacing.three,
    borderWidth: 1,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  circleProgressOutline: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleProgressFill: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 3.5,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  streakFire: {
    fontSize: 22,
    lineHeight: 26,
    marginBottom: -2,
  },
  streakDayValue: {
    fontSize: 12,
    marginTop: -2,
  },
  streakInfo: {
    flex: 1,
    gap: 4,
  },
  streakSubText: {
    fontSize: 11,
    lineHeight: 15,
  },
  barBg: {
    height: 6,
    borderRadius: 3,
    alignSelf: 'stretch',
    marginTop: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  messageBoard: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  messageTitleRow: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 8,
  },
  messageTitle: {
    fontSize: 12,
  },
  messageContent: {
    padding: Spacing.three,
    backgroundColor: 'transparent',
  },
  messageText: {
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  recommendBubble: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    borderRadius: 12,
  },
  recommendText: {
    fontSize: 12,
    lineHeight: 16,
  },
  tasksSection: {
    gap: Spacing.two,
  },
  sectionTitle: {
    fontSize: 14,
    marginBottom: 4,
  },
  taskCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: 16,
    borderWidth: 1,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  taskCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    flex: 1,
  },
  subjectBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  taskDetails: {
    flex: 1,
    gap: 2,
  },
  taskTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  taskSubject: {
    fontSize: 15,
  },
  editionBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  editionText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  taskTopic: {
    fontSize: 12,
  },
  taskCardRight: {
    marginLeft: Spacing.two,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipButton: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusLabel: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  sandboxPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    padding: Spacing.three,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    gap: Spacing.two,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sandboxTitle: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  sandboxButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  sandboxButton: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  darkModeToggle: {
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#00000066',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  habitModalContent: {
    borderRadius: 20,
    padding: Spacing.four,
    width: '100%',
    maxWidth: 400,
    gap: Spacing.three,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  timerCard: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.three,
    alignItems: 'center',
    marginVertical: 4,
    gap: 8,
  },
  timerNumber: {
    fontSize: 36,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  timerButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalInput: {
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  modalTextArea: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    fontSize: 13,
    textAlignVertical: 'top',
    height: 60,
  },
  modalBtnRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
    marginTop: 8,
  },
  modalBtn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  priceTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
});
