import React, { useState } from 'react';
import { 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  View, 
  TextInput, 
  Modal, 
  Dimensions, 
  Alert,
  Platform,
  Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { PaywallModal } from '@/components/paywall-modal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 預設家長預警列表
const INITIAL_ALERTS = [
  {
    id: 'a1',
    subject: '英語',
    type: 'critical',
    title: '英語・現在進行式 連續卡住 🚨',
    desc: '小明表示「看不懂，需要爸媽合力解釋」。',
    aiSuggest: '建議今晚給孩子一個擁抱，跟他說：『文法本來就像繞口令，我們不用背的，今晚爸爸媽媽和你用畫圖來把 ing 變簡單！』先同理他的挫折，再一起看看詳解，不要指責正確率喔。',
    time: '今天 16:45',
    isRead: false
  },
  {
    id: 'a2',
    subject: '自然',
    type: 'warning',
    title: '自然科 暫停打卡 ⚠️',
    desc: '小明選擇暫停，原因：「今天學校功課太多了」。',
    aiSuggest: '孩子今天學校作業負擔較重，主動選擇大腦休息。這是非常棒的時間管理嘗試！建議今晚稱讚他懂得規劃精力，並溫和提醒他明天補上即可，維持自律節奏。',
    time: '昨天 17:10',
    isRead: false
  }
];

// 預設模擬待審核的獎勵許願與兌換申請
const INITIAL_PROPOSALS = [
  { id: 'p1', name: '去吃麥當勞快樂餐 🍔', icon: '🍔', status: 'proposed', cost: 0, requestedBy: 'student' },
  { id: 'p2', name: '玩 Switch 30分鐘', icon: '🎮', status: 'pending_claim', cost: 100, requestedBy: 'student' }
];

// 預設待家長審核確認的習慣打卡任務 (B3)
const INITIAL_HABIT_TASKS = [
  { 
    id: 'h1', 
    subject: '鋼琴練習', 
    item_type: 'habit', 
    status: 'submitted', 
    points: 10,
    habit_config: {
      category: '才藝',
      target_unit: '分鐘',
      target_value: 20,
      actual_value: 25,
      child_note: '今天把貝多芬奏鳴曲彈了三遍，很流暢！',
      parent_confirmed: false,
      parent_note: ''
    }
  },
  { 
    id: 'h2', 
    subject: '每日慢跑', 
    item_type: 'habit', 
    status: 'submitted', 
    points: 10,
    habit_config: {
      category: '運動',
      target_unit: '分鐘',
      target_value: 15,
      actual_value: 20,
      child_note: '今天跑得很快，而且沒有覺得很累！',
      parent_confirmed: false,
      parent_note: ''
    }
  }
];

// 預設模擬錯題本數據 (D1.3)
const MOCK_ERROR_LOGS = [
  {
    _id: 'e1',
    subject: '數學',
    grade: '6',
    topic: '分數的除法',
    q: '小明有 3/4 包糖果，平分給 3 個人，每個人可以分得多少包糖果？',
    opts: ["1/4 包", "1/3 包", "1/2 包", "2/3 包"],
    a: 0,
    userAnswer: 1, // 孩子錯誤的答案
    exp: '計算方式為 (3/4) ÷ 3 = (3/4) × (1/3) = 1/4 包。',
    incorrectCount: 3
  },
  {
    _id: 'e2',
    subject: '英語',
    grade: '6',
    topic: '現在進行式',
    q: 'What are you doing? I ___ reading a book.',
    opts: ["am", "is", "are", "be"],
    a: 0,
    userAnswer: 1, // 錯答成 is
    exp: '主詞為 I，Be動詞應配 am。',
    incorrectCount: 2
  },
  {
    _id: 'e3',
    subject: '自然',
    grade: '6',
    topic: '植物的身體',
    q: '下列哪一種植物具有氣根，可以幫助呼吸與攀爬？',
    opts: ["榕樹", "椰子樹", "杜鵑花", "向日葵"],
    a: 0,
    userAnswer: 2, // 錯答成 杜鵑花
    exp: '榕樹具有發達的氣根與支持根。',
    incorrectCount: 1
  }
];

export default function ParentScreen() {
  const router = useRouter();
  const { colors, gradeTheme, setGradeTheme } = useTheme();

  // 1. 家長防護鎖狀態 (Parental Gate)
  const [gateUnlocked, setGateUnlocked] = useState(false);
  const [gateAnswer, setGateAnswer] = useState('');
  const [gateMathQuestion] = useState({ q: '7 x 8 = ?', a: '56' });

  // 2. 切換副面板 (overview: 今日快覽, alerts: 學習預警, assign: 家長派題, rewards: 獎勵核准, settings: 科目配置, errorLog: 智能錯題本)
  const [parentTab, setParentTab] = useState<'overview' | 'alerts' | 'assign' | 'rewards' | 'settings' | 'errorLog'>('overview');

  // 3. 業務資料狀態
  const [alerts, setAlerts] = useState(INITIAL_ALERTS);
  const [proposals, setProposals] = useState(INITIAL_PROPOSALS);
  const [points, setPoints] = useState(320); // 隨時同步
  const [editions, setEditions] = useState<{ [key: string]: string }>({
    '國語': '南一版', '數學': '康軒版', '英語': '康軒版', '社會': '翰林版', '自然': '翰林版'
  });

  // 習慣打卡待審核狀態 (B3)
  const [habitTasks, setHabitTasks] = useState(INITIAL_HABIT_TASKS);
  const [isPro, setIsPro] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedHabitTask, setSelectedHabitTask] = useState<any>(null);
  const [parentNote, setParentNote] = useState('');

  // 錯題本狀態與 AI 相似題加強狀態
  const [errorLogs, setErrorLogs] = useState<any[]>(MOCK_ERROR_LOGS);
  const [loadingErrorLogs, setLoadingErrorLogs] = useState(false);
  const [isGeneratingSimilar, setIsGeneratingSimilar] = useState<{ [key: string]: boolean }>({});

  // 動態增設科目欄位狀態
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectEdition, setNewSubjectEdition] = useState('自編版');

  // 5. 段考複習設定狀態 (Phase D2)
  const [examDate, setExamDate] = useState('2026-06-15');
  const [countdownActive, setCountdownActive] = useState(false);
  const [examSubjectsRange, setExamSubjectsRange] = useState<{ [key: string]: string }>({
    '國語': '第一~四課', '數學': '第一~三單元', '英語': '現在進行式', '社會': '台灣地理', '自然': '植物的構造'
  });

  // 4. 家長派題表單狀態
  const [assignSubject, setAssignSubject] = useState('英語');
  const [assignDifficulty, setAssignDifficulty] = useState('standard');
  const [assignPrompt, setAssignPrompt] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  // 許願定價 Modal 狀態
  const [selectedProposal, setSelectedProposal] = useState<any>(null);
  const [wishPrice, setWishPrice] = useState('');
  const [showPriceModal, setShowPriceModal] = useState(false);

  // 獲取錯題本 (D1.3)
  const fetchErrorLogs = async () => {
    setLoadingErrorLogs(true);
    try {
      const response = await fetch('http://localhost:5000/api/error-log/mock_family_123');
      const data = await response.json();
      if (data.success) {
        setErrorLogs(data.errorLogs);
      }
    } catch (e) {
      console.log('獲取錯題本連線失敗，使用本地沙盒模擬數據');
    } finally {
      setLoadingErrorLogs(false);
    }
  };

  // 獲取段考設定 (D2)
  const fetchExamPrep = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/exam-prep/mock_family_123');
      const data = await response.json();
      if (data.success && data.examPrep) {
        setExamDate(data.examPrep.examDate ? data.examPrep.examDate.split('T')[0] : '2026-06-15');
        setCountdownActive(data.examPrep.countdownActive);
        if (data.examPrep.subjects && data.examPrep.subjects.length > 0) {
          const ranges: { [key: string]: string } = {};
          data.examPrep.subjects.forEach((s: any) => {
            ranges[s.subjectName] = s.range;
          });
          setExamSubjectsRange(prev => ({ ...prev, ...ranges }));
        }
      }
    } catch (e) {
      console.log('獲取段考設定連線失敗，使用本地沙盒');
    }
  };

  // 儲存段考設定 (D2)
  const handleSaveExamPrep = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/exam-prep/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          familyId: 'mock_family_123',
          examDate,
          countdownActive,
          subjects: Object.entries(examSubjectsRange).map(([sub, rng]) => ({
            subjectName: sub,
            range: rng
          }))
        })
      });
      const data = await response.json();
      if (data.success) {
        if (Platform.OS === 'web') {
          alert('🎯 段考複習模式設定成功！已同步至 AI 出題權重與學生端倒數 Widget！');
        } else {
          Alert.alert('設定成功 🎯', '段考複習模式設定成功！已同步至 AI 出題權重與學生端倒數 Widget！');
        }
        return;
      }
    } catch (e) {
      console.log('儲存段考設定連線失敗，啟動本地沙盒儲存');
    }

    if (Platform.OS === 'web') {
      alert('🎯 【沙盒模擬】段考複習模式設定成功！已同步至 AI 出題權重與學生端倒數 Widget！');
    } else {
      Alert.alert('設定成功 🎯', '【沙盒模擬】段考複習模式設定成功！已同步至 AI 出題權重與學生端倒數 Widget！');
    }
  };

  // 實施一鍵 AI 相似題加強派題 (D1.3)
  const handleGenerateSimilar = async (errorLogId: string, subject: string) => {
    if (!isPro) {
      setShowPaywall(true);
      return;
    }

    setIsGeneratingSimilar(prev => ({ ...prev, [errorLogId]: true }));

    try {
      const response = await fetch('http://localhost:5000/api/error-log/generate-similar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ errorLogId })
      });
      const data = await response.json();
      if (data.success) {
        if (Platform.OS === 'web') {
          alert(`🚀 AI 相似題派題成功！已自動為小明指派 3 題【${subject}】相同考點的全新素養挑戰題，完成可獲得 15 點金幣！`);
        } else {
          Alert.alert('加強派題成功 🚀', `已自動為小明指派 3 題【${subject}】相同考點的全新素養挑戰題，完成可獲得 15 點金幣！`);
        }
        return;
      }
    } catch (e) {
      console.log('連線失敗，啟動本地沙盒模擬派題');
    } finally {
      // 模擬轉圈圈動畫，讓家長有深刻的「AI 正在生成」的儀式感
      setTimeout(() => {
        setIsGeneratingSimilar(prev => ({ ...prev, [errorLogId]: false }));
        if (Platform.OS === 'web') {
          alert(`🚀 【沙盒模擬】AI 相似題派題成功！已自動為小明指派 3 題【${subject}】相同考點的全新素養挑戰題，並派發至學生首頁今日任務！`);
        } else {
          Alert.alert('加強派題成功 🚀', `【沙盒模擬】已自動為小明指派 3 題【${subject}】相同考點的全新素養挑戰題，並派發至學生首頁今日任務！`);
        }
      }, 1500);
    }
  };

  React.useEffect(() => {
    if (gateUnlocked) {
      if (parentTab === 'errorLog') fetchErrorLogs();
      if (parentTab === 'settings') fetchExamPrep();
    }
  }, [parentTab, gateUnlocked]);

  // 家長確認習慣打卡 (B3)
  const handleConfirmHabit = async (taskId: string, commentNote: string) => {
    // 關閉 Modal
    setShowConfirmModal(false);
    setSelectedHabitTask(null);
    setParentNote('');

    try {
      const response = await fetch('http://localhost:5000/api/habits/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, parent_note: commentNote })
      });
      const data = await response.json();
      if (data.success) {
        setPoints(data.points);
        setHabitTasks(prev => prev.filter(t => t.id !== taskId));
        if (Platform.OS === 'web') alert(`✅ 習慣審核核准！已額外發放 +3 點獎勵！評語投遞成功 ✉️`);
        else Alert.alert('核准成功 🌟', `習慣審核核准！已額外發放 +3 點獎勵！評語投遞成功 ✉️`);
        return;
      }
    } catch (e) {
      console.log('連線失敗，使用本地沙盒模式');
    }

    // 本地模擬
    setPoints(p => p + 3);
    setHabitTasks(prev => prev.filter(t => t.id !== taskId));
    
    if (Platform.OS === 'web') {
      alert(`✅ 【沙盒模擬】習慣審核核准！已額外發放 +3 點獎勵給孩子！鼓勵評語已送達 ✉️`);
    } else {
      Alert.alert('核准成功 🌟', '【沙盒模擬】習慣審核核准！已額外發放 +3 點獎勵給孩子！鼓勵評語已送達 ✉️');
    }
  };

  // 驗證家長安全鎖 (Parental Gate Math)
  const handleVerifyGate = () => {
    if (gateAnswer.trim() === gateMathQuestion.a) {
      setGateUnlocked(true);
      // 強制將用 Theme 切換為家長綠色溫馨皮膚
      setGradeTheme('parent');
    } else {
      if (Platform.OS === 'web') alert('❌ 答案錯誤！學員請返回學生基地，此區為爸媽專用。');
      else Alert.alert('驗證失敗 ⚠️', '答案錯誤！學員請返回學生基地，此區為爸媽專用。');
      setGateAnswer('');
    }
  };

  // 標記預警已讀
  const handleResolveAlert = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, isRead: true } : a));
  };

  // 核准孩子提議的新獎勵定價 (BUG-08修復邏輯)
  const handleApproveWish = () => {
    const price = parseInt(wishPrice);
    if (isNaN(price) || price <= 0) {
      if (Platform.OS === 'web') alert('❌ 請設定合理的金幣點數價格！');
      else Alert.alert('提示 💡', '請設定合理的金幣點數價格！');
      return;
    }

    setProposals(prev => prev.filter(p => p.id !== selectedProposal.id));
    setShowPriceModal(false);
    setSelectedProposal(null);
    setWishPrice('');

    if (Platform.OS === 'web') {
      alert(`✅ 許願核准成功！【${selectedProposal.name}】已設定價格為 ${price} 點，並正式上架到學生兌換商店！`);
    } else {
      Alert.alert('核准成功 🎁', `【${selectedProposal.name}】已設定價格為 ${price} 點，並正式上架到學生兌換商店！`);
    }
  };

  // 核准兌換申請
  const handleApproveClaim = (id: string, name: string) => {
    setProposals(prev => prev.filter(p => p.id !== id));
    if (Platform.OS === 'web') {
      alert(`✅ 已同意孩子兌換【${name}】！獎勵券已發放至孩子手機。`);
    } else {
      Alert.alert('核准兌換 🎮', `已同意孩子兌換【${name}】！獎勵券已發放至孩子手機。`);
    }
  };

  // 拒絕兌換 (退回點數)
  const handleRejectClaim = (id: string, name: string, cost: number) => {
    setProposals(prev => prev.filter(p => p.id !== id));
    setPoints(p => p + cost); // 退回點數
    if (Platform.OS === 'web') {
      alert(`💡 已拒絕兌換申請。${cost} 點金幣已退還回孩子的帳戶中。`);
    } else {
      Alert.alert('申請已退回', `${cost} 點金幣已退還回孩子的帳戶中。`);
    }
  };

  // 執行 AI 客製化派題
  const handleAssignQuiz = () => {
    if (!isPro) {
      setShowPaywall(true);
      return;
    }
    setIsAssigning(true);
    // 模擬 3 秒 Gemini 骨架生成動畫 (PRD 7.3 Step 2)
    setTimeout(() => {
      setIsAssigning(false);
      setAssignPrompt('');
      if (Platform.OS === 'web') {
        alert(`🚀 AI 派題成功！已為小明出好 5 題【${assignSubject} - ${assignDifficulty === 'basic' ? '基礎' : '標準'}】專屬素養挑戰題，並派發至學生首頁！`);
      } else {
        Alert.alert('派發成功 📝', `已為小明出好 5 題【${assignSubject} - ${assignDifficulty === 'basic' ? '基礎' : '標準'}】專屬素養挑戰題，並派發至學生首頁！`);
      }
    }, 2500);
  };

  // 動態科目配置增設 (PRD 7.6 / 13.1 Dynamic Subjects)
  const handleAddNewSubject = () => {
    if (!newSubjectName.trim()) {
      if (Platform.OS === 'web') alert('❌ 請輸入科目名稱！');
      else Alert.alert('提示 💡', '請輸入科目名稱！');
      return;
    }

    setEditions(prev => ({ ...prev, [newSubjectName]: newSubjectEdition }));
    setNewSubjectName('');
    
    if (Platform.OS === 'web') {
      alert(`✨ 科目新增成功！【${newSubjectName} (${newSubjectEdition})】已即時同步至 AI 出題與影片推薦系統！`);
    } else {
      Alert.alert('新增成功 🎒', `【${newSubjectName} (${newSubjectEdition})】已即時同步至 AI 出題與影片推薦系統！`);
    }
  };

  const activeAlerts = alerts.filter(a => !a.isRead);
  const criticalCount = activeAlerts.filter(a => a.type === 'critical').length;
  const warningCount = activeAlerts.filter(a => a.type === 'warning').length;

  // ── 階段零：家長防護門鎖介面 (Parental Gate) ───────────────────────────
  if (!gateUnlocked) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.gateWrapper}>
            <ThemedText style={styles.gateTrophy} type="subtitle">🛡️</ThemedText>
            <ThemedText style={styles.gateTitle} type="subtitle">家長專屬控制區</ThemedText>
            <ThemedText style={[styles.gateDesc, { color: colors.textSecondary }]} type="small">
              為了保護您的金幣與獎勵審核權，請回答以下計算題驗證您的家長身份：
            </ThemedText>

            <ThemedView type="backgroundElement" style={[styles.gateMathCard, { borderColor: colors.border }]}>
              <ThemedText style={{ color: colors.primary, fontSize: 32 }} type="subtitle">
                {gateMathQuestion.q}
              </ThemedText>
            </ThemedView>

            <TextInput
              style={[styles.gateInput, { borderColor: colors.border, color: colors.text }]}
              keyboardType="number-pad"
              placeholder="請填入計算答案"
              placeholderTextColor={colors.textSecondary}
              value={gateAnswer}
              onChangeText={setGateAnswer}
            />

            <TouchableOpacity 
              style={[styles.gateVerifyBtn, { backgroundColor: colors.primary }]}
              onPress={handleVerifyGate}
            >
              <ThemedText themeColor="background" type="smallBold">🔓 解鎖家長控制台</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.gateBackBtn}
              onPress={() => router.replace('/')}
            >
              <ThemedText style={{ color: colors.textSecondary }} type="smallBold">返回學生基地</ThemedText>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  // ── 階段一：已解鎖家長控制面板 ─────────────────────────────────────
  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        
        {/* ── 家長端頂部導航 ─────────────────────────────── */}
        <View style={[styles.parentHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => {
            setGateUnlocked(false);
            setGradeTheme('highGrade'); // 切回學生預設高年級
            router.replace('/');
          }} style={styles.logoutBtn}>
            <ThemedText style={{ color: colors.textSecondary }} type="smallBold">🔒 鎖定退出</ThemedText>
          </TouchableOpacity>

          <ThemedText type="smallBold" style={{ color: colors.primary }}>
            守護者家長控制台
          </ThemedText>

          {isPro ? (
            <View style={{ backgroundColor: '#F59E0B22', borderColor: '#F59E0B', borderWidth: 1, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 8 }}>
              <ThemedText style={{ color: '#F59E0B', fontSize: 10 }} type="smallBold">👑 Pro</ThemedText>
            </View>
          ) : (
            <TouchableOpacity 
              style={{ backgroundColor: colors.primary + '15', borderColor: colors.primary, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 8 }}
              onPress={() => setShowPaywall(true)}
            >
              <ThemedText style={{ color: colors.primary, fontSize: 10 }} type="smallBold">💎 升級 Pro</ThemedText>
            </TouchableOpacity>
          )}
        </View>

        {/* ── 家長端側欄/滑動導航選單 (overview, alerts, assign, rewards, settings) ── */}
        <View style={[styles.subMenu, { borderBottomColor: colors.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subMenuScroll}>
            {[
              { key: 'overview', name: '今日快覽' },
              { key: 'alerts', name: `學習預警 (${activeAlerts.length})` },
              { key: 'errorLog', name: '❌ 智能錯題本' },
              { key: 'assign', name: '家長派題' },
              { key: 'rewards', name: `獎勵審核 (${proposals.length})` },
              { key: 'settings', name: '科目配置' }
            ].map(tab => (
              <TouchableOpacity 
                key={tab.key}
                style={[
                  styles.subMenuItem, 
                  parentTab === tab.key && { borderBottomColor: colors.primary, borderBottomWidth: 3 }
                ]}
                onPress={() => setParentTab(tab.key as any)}
              >
                <ThemedText 
                  style={{ color: parentTab === tab.key ? colors.primary : colors.textSecondary }}
                  type="smallBold"
                >
                  {tab.name}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* ────────────────── SUB-TAB 1: 今日快覽 ────────────────── */}
          {parentTab === 'overview' && (
            <View style={styles.tabContent}>
              {/* 今日快覽三態橫幅 (PRD 7.1 Overview Banner) */}
              <View style={[
                styles.overviewBanner,
                { 
                  backgroundColor: criticalCount > 0 
                    ? colors.critical + '22' // 有看不懂 (紅色)
                    : warningCount > 0 
                      ? colors.warning + '22' // 有暫停 (橘色)
                      : colors.success + '22', // 一切順利 (綠色)
                  borderColor: criticalCount > 0 ? colors.critical : warningCount > 0 ? colors.warning : colors.success
                }
              ]}>
                <ThemedText style={[
                  styles.overviewBannerText,
                  { color: criticalCount > 0 ? colors.critical : warningCount > 0 ? colors.warning : colors.success }
                ]} type="smallBold">
                  {criticalCount > 0 
                    ? '🚨 今天需要你溫暖介入！小明表示有科目「看不懂」，需要你的幫助與擁抱。'
                    : warningCount > 0 
                      ? '⚠️ 有一件事需要留意：小明今天有些任務選擇了暫停休息喔。'
                      : '🟢 小明今天狀態絕佳！今日任務正在朝目標穩定推進中 ✓'
                  }
                </ThemedText>
              </View>

              {/* 4張快速統計卡 (PRD 7.1 Stats cards) */}
              <View style={styles.statsGrid}>
                <ThemedView type="backgroundElement" style={[styles.statsCard, { borderColor: colors.border }]}>
                  <ThemedText type="small" style={{ color: colors.textSecondary }}>今日完成率</ThemedText>
                  <ThemedText type="subtitle" style={{ color: colors.primary }}>20%</ThemedText>
                  <ThemedText type="small" style={{ color: colors.textSecondary }}>已完成 1/5 科</ThemedText>
                </ThemedView>

                <ThemedView type="backgroundElement" style={[styles.statsCard, { borderColor: colors.border }]}>
                  <ThemedText type="small" style={{ color: colors.textSecondary }}>連續自律連勤</ThemedText>
                  <ThemedText type="subtitle" style={{ color: colors.warning }}>🔥 5 天</ThemedText>
                  <ThemedText type="small" style={{ color: colors.textSecondary }}>距連勤獎勵 2 天</ThemedText>
                </ThemedView>

                <ThemedView type="backgroundElement" style={[styles.statsCard, { borderColor: colors.border }]}>
                  <ThemedText type="small" style={{ color: colors.textSecondary }}>本月答題正確率</ThemedText>
                  <ThemedText type="subtitle" style={{ color: colors.success }}>🎯 82%</ThemedText>
                  <ThemedText type="small" style={{ color: colors.textSecondary }}>加權移動平均值</ThemedText>
                </ThemedView>

                <ThemedView type="backgroundElement" style={[styles.statsCard, { borderColor: colors.border }]}>
                  <ThemedText type="small" style={{ color: colors.textSecondary }}>累積點數錢包</ThemedText>
                  <ThemedText type="subtitle" style={{ color: colors.text }}>💎 {points} 點</ThemedText>
                  <ThemedText type="small" style={{ color: colors.textSecondary }}>足夠兌換多項獎勵</ThemedText>
                </ThemedView>
              </View>

              {/* 錯題複習洞察引導 */}
              <ThemedView type="backgroundElement" style={[styles.insightRedirectCard, { borderColor: colors.border }]}>
                <ThemedText type="smallBold" style={{ color: colors.text }}>錯題與弱項分析（Pro 核心功能）</ThemedText>
                <ThemedText type="small" style={{ color: colors.textSecondary, marginTop: 4 }}>
                  根據近7天答題權重，小明在【英語-現在進行式】有較多錯題紀錄，建議可以使用「家長派題」為小明出 3 題相似題進行溫和概念加強。
                </ThemedText>
                <TouchableOpacity 
                  style={[styles.assignQuickBtn, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    if (!isPro) {
                      setShowPaywall(true);
                      return;
                    }
                    setParentTab('assign');
                  }}
                >
                  <ThemedText themeColor="background" type="smallBold">📝 針對弱點快速出題</ThemedText>
                </TouchableOpacity>
              </ThemedView>

              {/* 👑 兒童自律成長護照 PDF 報告匯出 (D3.3) */}
              <ThemedView 
                type="backgroundElement" 
                style={[
                  styles.insightRedirectCard, 
                  { 
                    borderColor: '#8B5CF6', 
                    borderWidth: 1.5,
                    shadowColor: '#8B5CF6',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 10,
                    elevation: 3,
                    marginTop: Spacing.three
                  }
                ]}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <ThemedText type="smallBold" style={{ color: '#8B5CF6' }}>
                    👑 108課綱 兒童自律學習成長護照
                  </ThemedText>
                  <View style={{ backgroundColor: '#8B5CF622', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                    <ThemedText style={{ color: '#8B5CF6', fontSize: 10 }} type="smallBold">
                      PDF 匯出 (Pro)
                    </ThemedText>
                  </View>
                </View>
                
                <ThemedText type="small" style={{ color: colors.textSecondary, marginTop: 4 }}>
                  整合孩子本學期的「科目答題率」、「自律自控 Streak 連勤軌跡」、以及「解鎖成就徽章牆大數據」，由 AI 生成極具溫度的親子教育回饋評語，一鍵匯出為精美的成長護照報告！
                </ThemedText>
                
                <TouchableOpacity 
                  style={[styles.assignQuickBtn, { backgroundColor: '#8B5CF6', flexDirection: 'row', alignItems: 'center', gap: 6 }]}
                  onPress={async () => {
                    if (!isPro) {
                      setShowPaywall(true);
                      return;
                    }
                    
                    const url = 'http://localhost:5000/api/insights/passport-pdf/mock_family_123';
                    try {
                      // 打開瀏覽器
                      const supported = await Linking.canOpenURL(url);
                      if (supported) {
                        await Linking.openURL(url);
                      } else {
                        Alert.alert('無法開啟 ⚠️', `無法在您的裝置上直接開啟：${url}`);
                      }
                    } catch (e) {
                      // 離線 Mock 警告儀式感
                      if (Platform.OS === 'web') {
                        alert(`📂 【沙盒模擬】已為小明成功匯出「108課綱兒童自律學習成長護照」報告！\n本月累積正確率 82%、解鎖徽章 3 款、Streak連勤 5 天！正在生成 PDF 下載頁面...`);
                      } else {
                        Alert.alert('成長護照匯出成功 📂', `【沙盒模擬】已成功產出小明的學習護照報告！\n本月累積正確率 82%、解鎖徽章 3 款、Streak連勤 5 天！正在生成 PDF 頁面...`);
                      }
                    }
                  }}
                >
                  <ThemedText themeColor="background" type="smallBold">
                    🏆 產生並下載小明專屬成長護照
                  </ThemedText>
                </TouchableOpacity>
              </ThemedView>

              {/* ── 🏃 今日自律習慣審核池 (PRD 7.1 / Phase B) ─────────────── */}
              <View style={[styles.assignCard, { marginTop: Spacing.three, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: Spacing.three }]}>
                <ThemedText style={styles.assignTitle} type="smallBold">
                  🏃 孩子自律習慣審核與獎勵 (B3)
                </ThemedText>
                <ThemedText style={styles.assignSubtitle} type="small">
                  當孩子在手機上完成運動、才藝或閱讀練習並打卡後，您會在此看到回報。核准可為孩子額外加碼 +3 點點數，並能回傳鼓勵溫暖悄悄話！
                </ThemedText>

                {habitTasks.length === 0 ? (
                  <View style={[styles.emptyContainer, { paddingVertical: Spacing.two }]}>
                    <ThemedText style={{ color: colors.success, fontSize: 13, textAlign: 'center' }}>
                      🎉 今日習慣回報已全數審核完畢！孩子今天表現極佳，記得多鼓勵他喔！
                    </ThemedText>
                  </View>
                ) : (
                  <View style={{ gap: Spacing.two, marginTop: 8 }}>
                    {habitTasks.map((habit) => {
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
                            styles.alertCard, 
                            { 
                              borderColor: colors.warning, 
                              borderWidth: 1,
                              borderRadius: 12,
                              padding: Spacing.three,
                              marginBottom: 4
                            }
                          ]}
                        >
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <ThemedText style={{ fontSize: 24 }}>{getHabitIcon(habit.habit_config.category)}</ThemedText>
                              <View>
                                <ThemedText type="smallBold" style={{ color: colors.text }}>
                                  {habit.subject}
                                </ThemedText>
                                <ThemedText type="small" style={{ color: colors.textSecondary }}>
                                  回報完成：{habit.habit_config.actual_value} {habit.habit_config.target_unit} (目標：{habit.habit_config.target_value})
                                </ThemedText>
                              </View>
                            </View>
                            <TouchableOpacity 
                              style={{ 
                                backgroundColor: colors.success, 
                                paddingHorizontal: 12, 
                                paddingVertical: 6, 
                                borderRadius: 8 
                              }}
                              onPress={() => {
                                if (!isPro) {
                                  setShowPaywall(true);
                                  return;
                                }
                                setSelectedHabitTask(habit);
                                setShowConfirmModal(true);
                              }}
                            >
                              <ThemedText themeColor="background" type="smallBold" style={{ fontSize: 12 }}>
                                🌟 核准打卡
                              </ThemedText>
                            </TouchableOpacity>
                          </View>
                          {habit.habit_config.child_note ? (
                            <View style={{ 
                              backgroundColor: colors.backgroundSelected + '22', 
                              padding: 8, 
                              borderRadius: 8, 
                              marginTop: 8 
                            }}>
                              <ThemedText type="small" style={{ color: colors.text, fontStyle: 'italic' }}>
                                💬 孩子自評：「{habit.habit_config.child_note}」
                              </ThemedText>
                            </View>
                          ) : null}
                        </ThemedView>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* 📊 自律養成統計分析 (PRD 7.1 / Phase B) */}
              <ThemedView type="backgroundElement" style={[styles.insightRedirectCard, { borderColor: colors.border, marginTop: Spacing.three }]}>
                <ThemedText type="smallBold" style={{ color: colors.text }}>📊 自律養成完成度分析</ThemedText>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                  <ThemedText type="small" style={{ color: colors.textSecondary }}>
                    今日自律打卡率：
                  </ThemedText>
                  <ThemedText type="smallBold" style={{ color: colors.primary }}>
                    {habitTasks.length === 0 ? '100%' : '33%'}
                  </ThemedText>
                </View>
                {/* 模擬圓餅圖 CSS 條 */}
                <View style={[styles.barBg, { backgroundColor: colors.backgroundSelected, marginTop: 6 }]}>
                  <View style={[styles.barFill, { backgroundColor: colors.success, width: habitTasks.length === 0 ? '100%' : '33%' }]} />
                </View>
                <ThemedText type="small" style={{ color: colors.textSecondary, marginTop: 6, fontSize: 11 }}>
                  💡 統計指出，維持 21 天以上習慣打卡可以讓大腦形成「自動化反射」，目前小明在才藝與閱讀習慣表現卓越，請家長溫和鼓勵，切忌功利性責備喔。
                </ThemedText>
              </ThemedView>
            </View>
          )}

          {/* ────────────────── SUB-TAB 2: 學習預警 ────────────────── */}
          {parentTab === 'alerts' && (
            <View style={styles.tabContent}>
              <ThemedText style={styles.sectionTitle} type="smallBold">
                小明的學習卡關事件與 AI 應對指南 (陪伴 &gt; 監控)
              </ThemedText>

              {activeAlerts.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <ThemedText style={{ color: colors.textSecondary }}>🎉 目前沒有任何卡關預警，小明推進得非常順利！</ThemedText>
                </View>
              ) : (
                activeAlerts.map((a) => (
                  <ThemedView 
                    key={a.id} 
                    type="backgroundElement" 
                    style={[
                      styles.alertCard, 
                      { borderColor: a.type === 'critical' ? colors.critical : colors.warning }
                    ]}
                  >
                    <View style={styles.alertHeader}>
                      <View style={[
                        styles.alertBadge, 
                        { backgroundColor: a.type === 'critical' ? colors.critical + '15' : colors.warning + '15' }
                      ]}>
                        <ThemedText style={{ color: a.type === 'critical' ? colors.critical : colors.warning }} type="smallBold">
                          {a.type === 'critical' ? '🚨 緊急卡關' : '⚠️ 暫停休息'}
                        </ThemedText>
                      </View>
                      <ThemedText style={{ color: colors.textSecondary }} type="small">{a.time}</ThemedText>
                    </View>

                    <ThemedText style={[styles.alertTitle, { color: colors.text }]} type="smallBold">
                      {a.title}
                    </ThemedText>
                    <ThemedText style={[styles.alertDesc, { color: colors.textSecondary }]} type="small">
                      {a.desc}
                    </ThemedText>

                    {/* Gemini 應對溫度語言建議 (PRD 7.2 Alerts AI Response) */}
                    <View style={[styles.aiSuggestBox, { backgroundColor: colors.backgroundSelected }]}>
                      <ThemedText style={[styles.aiSuggestTitle, { color: colors.primary }]} type="smallBold">
                        💡 兒童心理專家與 AI 應對建議：
                      </ThemedText>
                      <ThemedText style={[styles.aiSuggestText, { color: colors.text }]} type="small">
                        {a.aiSuggest}
                      </ThemedText>
                    </View>

                    <View style={styles.alertActions}>
                      <TouchableOpacity 
                        style={[styles.readBtn, { borderColor: colors.border }]}
                        onPress={() => handleResolveAlert(a.id)}
                      >
                        <ThemedText style={{ color: colors.textSecondary }} type="smallBold">我已知道</ThemedText>
                      </TouchableOpacity>
                    </View>
                  </ThemedView>
                ))
              )}
            </View>
          )}

          {/* ────────────────── SUB-TAB 2.5: 智能錯題本 (D1.3) ────────────────── */}
          {parentTab === 'errorLog' && (
            <View style={styles.tabContent}>
              <View style={[styles.aiSuggestBox, { backgroundColor: colors.backgroundSelected, borderRadius: 16 }]}>
                <ThemedText type="small" style={{ color: colors.text }}>
                  ❌ <ThemedText type="smallBold" style={{ color: colors.primary }}>小明的智能錯題本 (卡關大數據)</ThemedText>
                  {'\n'}這裡自動收集了小明在隨堂測驗中答錯的死穴題目。依錯誤次數遞減排序，您可以「一鍵 AI 加強派題」為小明出 3 題相似素養題！
                </ThemedText>
              </View>

              {loadingErrorLogs ? (
                <View style={styles.emptyContainer}>
                  <ThemedText style={{ color: colors.textSecondary }}>正在載入錯題本大數據...</ThemedText>
                </View>
              ) : errorLogs.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <ThemedText style={{ color: colors.success }}>🎉 太棒了！小明目前沒有任何錯題紀錄！</ThemedText>
                </View>
              ) : (
                errorLogs.map((error) => (
                  <ThemedView 
                    key={error._id} 
                    type="backgroundElement" 
                    style={[
                      styles.alertCard, 
                      { 
                        borderColor: error.incorrectCount >= 2 ? colors.critical : colors.border,
                        borderWidth: 1.5,
                        borderRadius: 18,
                        padding: Spacing.three,
                        marginBottom: 4
                      }
                    ]}
                  >
                    <View style={styles.alertHeader}>
                      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                        <View style={[styles.alertBadge, { backgroundColor: colors.primary + '15' }]}>
                          <ThemedText style={{ color: colors.primary, fontSize: 10 }} type="smallBold">
                            {error.subject}
                          </ThemedText>
                        </View>
                        <ThemedText style={{ color: colors.textSecondary, fontSize: 11 }} type="small">
                          單元：{error.topic || '通用'}
                        </ThemedText>
                      </View>
                      
                      {error.incorrectCount >= 2 ? (
                        <View style={{ backgroundColor: colors.critical + '22', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                          <ThemedText style={{ color: colors.critical, fontSize: 10 }} type="smallBold">
                            🔥 死穴題卡關 {error.incorrectCount} 次
                          </ThemedText>
                        </View>
                      ) : (
                        <View style={{ backgroundColor: colors.warning + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                          <ThemedText style={{ color: colors.warning, fontSize: 10 }} type="smallBold">
                            ⚠️ 卡關 {error.incorrectCount} 次
                          </ThemedText>
                        </View>
                      )}
                    </View>

                    <ThemedText style={[styles.alertTitle, { color: colors.text, marginTop: 4 }]} type="smallBold">
                      {error.q}
                    </ThemedText>

                    {/* 選項列表，標記正確答案與孩子錯答 */}
                    <View style={{ gap: 6, marginVertical: 6 }}>
                      {error.opts.map((opt, optIndex) => {
                        const isCorrectOpt = optIndex === error.a;
                        const isUserWrongOpt = optIndex === error.userAnswer;
                        
                        return (
                          <View 
                            key={optIndex}
                            style={[
                              styles.pickerOption,
                              {
                                width: '100%',
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                borderColor: isCorrectOpt 
                                  ? colors.success 
                                  : isUserWrongOpt 
                                    ? colors.critical 
                                    : colors.border + '33',
                                backgroundColor: isCorrectOpt
                                  ? colors.success + '11'
                                  : isUserWrongOpt
                                    ? colors.critical + '11'
                                    : 'transparent',
                                borderWidth: (isCorrectOpt || isUserWrongOpt) ? 1.5 : 1,
                                paddingVertical: 8,
                                paddingHorizontal: 12
                              }
                            ]}
                          >
                            <ThemedText style={{ 
                              color: isCorrectOpt 
                                ? colors.success 
                                : isUserWrongOpt 
                                  ? colors.critical 
                                  : colors.text,
                              flex: 1,
                              fontSize: 12
                            }} type="small">
                              {optIndex + 1}. {opt}
                            </ThemedText>
                            
                            {isCorrectOpt && (
                              <View style={{ backgroundColor: colors.success + '22', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                <ThemedText style={{ color: colors.success, fontSize: 9 }} type="smallBold">✓ 正確答案</ThemedText>
                              </View>
                            )}
                            {isUserWrongOpt && (
                              <View style={{ backgroundColor: colors.critical + '22', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                <ThemedText style={{ color: colors.critical, fontSize: 9 }} type="smallBold">🚨 小明錯答</ThemedText>
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>

                    <View style={[styles.aiSuggestBox, { backgroundColor: colors.backgroundSelected }]}>
                      <ThemedText style={{ color: colors.text, fontSize: 12 }} type="small">
                        💡 <ThemedText type="smallBold" style={{ color: colors.primary }}>題目詳解</ThemedText>：{error.exp}
                      </ThemedText>
                    </View>

                    {/* 一鍵 AI 相似題加強按鈕 */}
                    <TouchableOpacity 
                      style={[
                        styles.submitAssignBtn, 
                        { 
                          backgroundColor: colors.primary,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          height: 38,
                          marginTop: 6
                        }
                      ]}
                      onPress={() => handleGenerateSimilar(error._id, error.subject)}
                      disabled={isGeneratingSimilar[error._id]}
                    >
                      <ThemedText themeColor="background" type="smallBold">
                        {isGeneratingSimilar[error._id] ? '🤖 AI 正在生成相似題...' : '🚀 一鍵 AI 相似題加強 (+15點任務)'}
                      </ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                ))
              )}
            </View>
          )}

          {/* ────────────────── SUB-TAB 3: 家長派題 ────────────────── */}
          {parentTab === 'assign' && (
            <View style={styles.tabContent}>
              <ThemedView type="backgroundElement" style={[styles.assignCard, { borderColor: colors.border }]}>
                <ThemedText style={styles.assignTitle} type="smallBold">
                  📝 AI 智慧客製化派題 (PRD 7.3)
                </ThemedText>
                <ThemedText style={styles.assignSubtitle} type="small">
                  您可以指定科目與程度，讓 Gemini AI 馬上生成精準綁定台灣 108 課綱教材版本的小測驗，直接加入孩子的今日任務列表！
                </ThemedText>

                {/* 選擇科目 */}
                <View style={styles.formGroup}>
                  <ThemedText style={styles.label} type="smallBold">選擇科目：</ThemedText>
                  <View style={styles.pickerRow}>
                    {Object.keys(editions).map(sub => (
                      <TouchableOpacity 
                        key={sub}
                        style={[
                          styles.pickerOption,
                          assignSubject === sub && { backgroundColor: colors.primary, borderColor: colors.primary }
                        ]}
                        onPress={() => setAssignSubject(sub)}
                      >
                        <ThemedText style={{ color: assignSubject === sub ? '#FFFFFF' : colors.text }}>
                          {sub}
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* 選擇難度 */}
                <View style={styles.formGroup}>
                  <ThemedText style={styles.label} type="smallBold">調整難度：</ThemedText>
                  <View style={styles.pickerRow}>
                    {[
                      { key: 'basic', name: '🌟 基礎複習' },
                      { key: 'standard', name: '✨ 標準核心' },
                      { key: 'advanced', name: '🚀 挑戰進階' }
                    ].map(diff => (
                      <TouchableOpacity 
                        key={diff.key}
                        style={[
                          styles.pickerOption,
                          assignDifficulty === diff.key && { backgroundColor: colors.primary, borderColor: colors.primary }
                        ]}
                        onPress={() => setAssignDifficulty(diff.key)}
                      >
                        <ThemedText style={{ color: assignDifficulty === diff.key ? '#FFFFFF' : colors.text }}>
                          {diff.name}
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* 自然語言補充條件 */}
                <View style={styles.formGroup}>
                  <ThemedText style={styles.label} type="smallBold">自訂補充主題與叮嚀 (選填)：</ThemedText>
                  <TextInput
                    style={[
                      styles.textArea, 
                      { 
                        borderColor: colors.border, 
                        color: colors.text,
                        backgroundColor: colors.backgroundSelected + '44'
                      }
                    ]}
                    multiline={true}
                    numberOfLines={3}
                    placeholder="例如：請著重出『英語現在進行式的主詞與Be動詞縮寫』題目，並用親切加油的語氣出題。"
                    placeholderTextColor={colors.textSecondary}
                    value={assignPrompt}
                    onChangeText={setAssignPrompt}
                  />
                </View>

                {/* 發送出題 (含 Skeleton Loading 動畫) */}
                <TouchableOpacity 
                  style={[styles.submitAssignBtn, { backgroundColor: colors.primary }]}
                  onPress={handleAssignQuiz}
                  disabled={isAssigning}
                >
                  <ThemedText themeColor="background" type="smallBold">
                    {isAssigning ? '🤖 Gemini 素養出題中 (約需 3 秒)...' : '🚀 產生測驗並派發'}
                  </ThemedText>
                </TouchableOpacity>

                {isAssigning && (
                  <View style={styles.skeletonContainer}>
                    <View style={[styles.skeletonLine, { backgroundColor: colors.backgroundSelected }]} />
                    <View style={[styles.skeletonLine, { backgroundColor: colors.backgroundSelected, width: '80%' }]} />
                    <View style={[styles.skeletonLine, { backgroundColor: colors.backgroundSelected, width: '60%' }]} />
                  </View>
                )}
              </ThemedView>
            </View>
          )}

          {/* ────────────────── SUB-TAB 4: 獎勵審核 ────────────────── */}
          {parentTab === 'rewards' && (
            <View style={styles.tabContent}>
              <ThemedText style={styles.sectionTitle} type="smallBold">
                核准兌換與獎勵許願審核池 (親子契約養成)
              </ThemedText>

              {proposals.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <ThemedText style={{ color: colors.textSecondary }}>🎉 目前孩子沒有任何待處理的兌換或許願申請。</ThemedText>
                </View>
              ) : (
                proposals.map((p) => {
                  const isWish = p.status === 'proposed';
                  
                  return (
                    <ThemedView key={p.id} type="backgroundElement" style={[styles.proposalCard, { borderColor: colors.border }]}>
                      <View style={styles.proposalHeader}>
                        <View style={[
                          styles.proposalBadge,
                          { backgroundColor: isWish ? colors.primary + '15' : colors.warning + '15' }
                        ]}>
                          <ThemedText style={{ color: isWish ? colors.primary : colors.warning }} type="smallBold">
                            {isWish ? '🎁 新的願望卡' : '💎 兌換申請卡'}
                          </ThemedText>
                        </View>
                        <ThemedText style={{ color: colors.textSecondary }} type="small">來自：小明</ThemedText>
                      </View>

                      <View style={styles.proposalBody}>
                        <ThemedText style={{ fontSize: 32 }}>{p.icon}</ThemedText>
                        <View style={styles.proposalDetails}>
                          <ThemedText style={{ color: colors.text }} type="smallBold">{p.name}</ThemedText>
                          <ThemedText style={{ color: colors.textSecondary }} type="small">
                            {isWish ? '孩子自己設計的許願，等待您審批上架點數' : `申請消耗：${p.cost} 點`}
                          </ThemedText>
                        </View>
                      </View>

                      <View style={styles.proposalActions}>
                        {isWish ? (
                          <TouchableOpacity 
                            style={[styles.actionBtnApprove, { backgroundColor: colors.primary }]}
                            onPress={() => {
                              setSelectedProposal(p);
                              setShowPriceModal(true);
                            }}
                          >
                            <ThemedText themeColor="background" type="smallBold">同意上架定價</ThemedText>
                          </TouchableOpacity>
                        ) : (
                          <View style={styles.claimActionRow}>
                            <TouchableOpacity 
                              style={[styles.actionBtnReject, { borderColor: colors.border }]}
                              onPress={() => handleRejectClaim(p.id, p.name, p.cost)}
                            >
                              <ThemedText style={{ color: colors.textSecondary }} type="smallBold">退回點數</ThemedText>
                            </TouchableOpacity>

                            <TouchableOpacity 
                              style={[styles.actionBtnApprove, { backgroundColor: colors.success }]}
                              onPress={() => handleApproveClaim(p.id, p.name)}
                            >
                              <ThemedText themeColor="background" type="smallBold">核准發放</ThemedText>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </ThemedView>
                  );
                })
              )}
            </View>
          )}

          {/* ────────────────── SUB-TAB 5: 科目配置 ────────────────── */}
          {parentTab === 'settings' && (
            <View style={styles.tabContent}>
              {/* 動態科目設定清單 (PRD 7.6 / 13.1 Dynamic Editions) */}
              <ThemedView type="backgroundElement" style={[styles.settingsCard, { borderColor: colors.border }]}>
                <ThemedText style={styles.settingsTitle} type="smallBold">
                  🎒 科目教材版本配置 (動態個人化) ★ 核心亮點
                </ThemedText>
                <ThemedText style={styles.settingsSubtitle} type="small">
                  在此增減科目或更改教材版本。設定將會「即時同步」至 AI 隨堂考題與影片精選推薦！
                </ThemedText>

                {/* 既有配置展示 */}
                <View style={styles.editionsList}>
                  {Object.entries(editions).map(([sub, ed]) => (
                    <View key={sub} style={[styles.editionItem, { borderBottomColor: colors.backgroundSelected }]}>
                      <ThemedText style={{ color: colors.text }} type="smallBold">{sub}</ThemedText>
                      <View style={[styles.editionLabel, { backgroundColor: colors.backgroundSelected }]}>
                        <ThemedText style={{ color: colors.primary }} type="smallBold">{ed}</ThemedText>
                      </View>
                    </View>
                  ))}
                </View>

                {/* + 新訂科目與版本 (Chapter 13.1 Dynamic Adding) */}
                <View style={[styles.addSubjectBox, { borderTopColor: colors.border }]}>
                  <ThemedText type="smallBold" style={{ color: colors.text }}>➕ 新增自訂特色科目 (作文/心算/程式設計)</ThemedText>
                  
                  <TextInput
                    style={[styles.gateInput, { borderColor: colors.border, color: colors.text, marginTop: 8 }]}
                    placeholder="輸入科目名稱，如：程式邏輯、鋼琴練習"
                    placeholderTextColor={colors.textSecondary}
                    value={newSubjectName}
                    onChangeText={setNewSubjectName}
                  />

                  <View style={styles.editionSelectorRow}>
                    {['康軒版', '南一版', '翰林版', '自編版'].map(ed => (
                      <TouchableOpacity 
                        key={ed}
                        style={[
                          styles.editionOption,
                          newSubjectEdition === ed && { backgroundColor: colors.primary, borderColor: colors.primary }
                        ]}
                        onPress={() => setNewSubjectEdition(ed)}
                      >
                        <ThemedText style={{ color: newSubjectEdition === ed ? '#FFFFFF' : colors.text, fontSize: 11 }}>
                          {ed}
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity 
                    style={[styles.addBtn, { backgroundColor: colors.primary }]}
                    onPress={handleAddNewSubject}
                  >
                    <ThemedText themeColor="background" type="smallBold">確認同步生效</ThemedText>
                  </TouchableOpacity>
                </View>
              </ThemedView>

              {/* 🎯 段考複習模式設定卡 (Phase D2) */}
              <ThemedView type="backgroundElement" style={[styles.settingsCard, { borderColor: colors.border, marginTop: Spacing.three }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <ThemedText style={styles.settingsTitle} type="smallBold">
                    🎯 段考衝刺複習模式設定
                  </ThemedText>
                  {/* 開關提示 */}
                  <TouchableOpacity 
                    style={{ 
                      backgroundColor: countdownActive ? colors.success + '22' : colors.backgroundSelected, 
                      borderColor: countdownActive ? colors.success : colors.border,
                      borderWidth: 1,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 10
                    }}
                    onPress={() => setCountdownActive(!countdownActive)}
                  >
                    <ThemedText style={{ color: countdownActive ? colors.success : colors.textSecondary, fontSize: 11 }} type="smallBold">
                      {countdownActive ? '🟢 倒數啟用中' : '⚪ 已關閉'}
                    </ThemedText>
                  </TouchableOpacity>
                </View>
                
                <ThemedText style={styles.settingsSubtitle} type="small">
                  設定段考考期，系統將在段考前 14 天內啟動「段考衝刺出題」，針對您設定的各科段考複習範圍加重 AI 隨堂出題比例！
                </ThemedText>

                <View style={{ gap: Spacing.two, marginTop: 4 }}>
                  <View style={{ gap: 4 }}>
                    <ThemedText style={styles.label} type="smallBold">📅 段考日期設定 (YYYY-MM-DD)：</ThemedText>
                    <TextInput
                      style={[styles.gateInput, { borderColor: colors.border, color: colors.text, height: 38, fontSize: 13, marginTop: 0 }]}
                      placeholder="請輸入日期，例如：2026-06-15"
                      placeholderTextColor={colors.textSecondary}
                      value={examDate}
                      onChangeText={setExamDate}
                    />
                  </View>

                  <View style={{ borderTopWidth: 0.5, borderTopColor: colors.border + '33', paddingTop: Spacing.two, gap: Spacing.two }}>
                    <ThemedText style={styles.label} type="smallBold">📚 配置各學科段考複習單元範圍：</ThemedText>
                    
                    {Object.keys(editions).map(sub => (
                      <View key={sub} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <ThemedText style={{ color: colors.text, fontSize: 12, width: 80 }} type="smallBold">
                          {sub} 範圍：
                        </ThemedText>
                        <TextInput
                          style={[
                            styles.gateInput, 
                            { 
                              flex: 1, 
                              height: 34, 
                              fontSize: 12, 
                              textAlign: 'left', 
                              paddingHorizontal: 8, 
                              marginTop: 0,
                              borderColor: colors.border, 
                              color: colors.text
                            }
                          ]}
                          placeholder="例如：第一~三單元"
                          placeholderTextColor={colors.textSecondary}
                          value={examSubjectsRange[sub] || ''}
                          onChangeText={(txt) => setExamSubjectsRange(prev => ({ ...prev, [sub]: txt }))}
                        />
                      </View>
                    ))}
                  </View>
                </View>

                <TouchableOpacity 
                  style={[styles.addBtn, { backgroundColor: colors.primary, marginTop: Spacing.three }]}
                  onPress={handleSaveExamPrep}
                >
                  <ThemedText themeColor="background" type="smallBold">💾 儲存段考衝刺設定</ThemedText>
                </TouchableOpacity>
              </ThemedView>
            </View>
          )}

        </ScrollView>

        {/* ── 彈窗一：核准孩子許願定價 Modal ── */}
        <Modal
          visible={showPriceModal}
          transparent={true}
          animationType="fade"
        >
          <View style={styles.modalOverlay}>
            <ThemedView type="backgroundElement" style={styles.priceModalContent}>
              <ThemedText style={styles.priceTitle} type="smallBold">
                核准孩子提出的願望 🎁
              </ThemedText>
              {selectedProposal && (
                <ThemedText style={[styles.priceSubtitle, { color: colors.textSecondary }]} type="small">
                  請幫孩子許願的【{selectedProposal.icon} {selectedProposal.name}】設定兌換所需的金幣點數價格：
                </ThemedText>
              )}

              <TextInput
                style={[styles.gateInput, { borderColor: colors.border, color: colors.text }]}
                keyboardType="number-pad"
                placeholder="例如：200"
                placeholderTextColor={colors.textSecondary}
                value={wishPrice}
                onChangeText={setWishPrice}
              />

              <View style={styles.modalBtnRow}>
                <TouchableOpacity 
                  style={[styles.modalBtn, { borderColor: colors.border }]}
                  onPress={() => {
                    setShowPriceModal(false);
                    setSelectedProposal(null);
                    setWishPrice('');
                  }}
                >
                  <ThemedText style={{ color: colors.textSecondary }} type="smallBold">取消</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                  onPress={handleApproveWish}
                >
                  <ThemedText themeColor="background" type="smallBold">確認上架</ThemedText>
                </TouchableOpacity>
              </View>
            </ThemedView>
          </View>
        </Modal>

        {/* ── 彈窗二：核准孩子習慣打卡與留言 Modal (B3) ── */}
        <Modal
          visible={showConfirmModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => {
            setShowConfirmModal(false);
            setSelectedHabitTask(null);
            setParentNote('');
          }}
        >
          <View style={styles.modalOverlay}>
            <ThemedView type="backgroundElement" style={styles.priceModalContent}>
              <ThemedText style={styles.priceTitle} type="smallBold">
                核准自律習慣打卡 🌟
              </ThemedText>
              
              {selectedHabitTask && (
                <View style={{ width: '100%', gap: Spacing.one, marginVertical: 8 }}>
                  <ThemedText style={{ textAlign: 'center', fontSize: 16 }} type="smallBold">
                    【{selectedHabitTask.subject}】
                  </ThemedText>
                  <ThemedText style={{ textAlign: 'center', color: colors.textSecondary }} type="small">
                    孩子今天練習了：{selectedHabitTask.habit_config.actual_value} {selectedHabitTask.habit_config.target_unit}！
                  </ThemedText>
                  {selectedHabitTask.habit_config.child_note ? (
                    <View style={{ backgroundColor: colors.backgroundSelected + '22', padding: 8, borderRadius: 8, marginTop: 4 }}>
                      <ThemedText type="small" style={{ fontStyle: 'italic', fontSize: 12 }}>
                        孩子自評心得：「{selectedHabitTask.habit_config.child_note}」
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
              )}

              {/* 家長寫評語 */}
              <View style={{ width: '100%', gap: 4, marginTop: 4 }}>
                <ThemedText type="smallBold" style={{ color: colors.text }}>投遞給孩子的鼓勵悄悄話 (選填)：</ThemedText>
                <TextInput
                  style={[
                    styles.textArea, 
                    { 
                      borderColor: colors.border, 
                      color: colors.text,
                      backgroundColor: colors.backgroundSelected + '44',
                      height: 60,
                      borderRadius: 8,
                      padding: 8,
                      textAlignVertical: 'top'
                    }
                  ]}
                  multiline={true}
                  numberOfLines={3}
                  placeholder="例如：看到你今天練習鋼琴非常認真，爸爸媽媽為你感到驕傲！加油喔！"
                  placeholderTextColor={colors.textSecondary}
                  value={parentNote}
                  onChangeText={setParentNote}
                />
              </View>

              <View style={styles.modalBtnRow}>
                <TouchableOpacity 
                  style={[styles.modalBtn, { borderColor: colors.border }]}
                  onPress={() => {
                    setShowConfirmModal(false);
                    setSelectedHabitTask(null);
                    setParentNote('');
                  }}
                >
                  <ThemedText style={{ color: colors.textSecondary }} type="smallBold">取消</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.modalBtn, { backgroundColor: colors.success }]}
                  onPress={() => {
                    if (selectedHabitTask) {
                      handleConfirmHabit(selectedHabitTask.id, parentNote);
                    }
                  }}
                >
                  <ThemedText themeColor="background" type="smallBold">🌟 確認核准 (+3)</ThemedText>
                </TouchableOpacity>
              </View>
            </ThemedView>
          </View>
        </Modal>

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
  gateWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  gateTrophy: {
    fontSize: 72,
    lineHeight: 80,
  },
  gateTitle: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  gateDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: Spacing.two,
  },
  gateMathCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.three,
    marginTop: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  gateInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    width: '100%',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 6,
  },
  gateVerifyBtn: {
    height: 48,
    borderRadius: 12,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  gateBackBtn: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  parentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: 0.5,
  },
  logoutBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  subMenu: {
    height: 44,
    borderBottomWidth: 1,
  },
  subMenuScroll: {
    paddingHorizontal: Spacing.two,
  },
  subMenuItem: {
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
    height: '100%',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  scrollContent: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  tabContent: {
    gap: Spacing.three,
  },
  overviewBanner: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
  },
  overviewBannerText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statsCard: {
    width: (SCREEN_WIDTH - Spacing.three * 2 - 10) / 2,
    borderRadius: 16,
    padding: Spacing.three,
    borderWidth: 1,
    gap: 2,
  },
  insightRedirectCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.three,
  },
  assignQuickBtn: {
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  sectionTitle: {
    fontSize: 14,
    marginBottom: 2,
  },
  emptyContainer: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
  alertCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  alertTitle: {
    fontSize: 14,
  },
  alertDesc: {
    fontSize: 12,
  },
  aiSuggestBox: {
    padding: Spacing.three,
    borderRadius: 12,
    gap: 4,
  },
  aiSuggestTitle: {
    fontSize: 12,
  },
  aiSuggestText: {
    fontSize: 12,
    lineHeight: 16,
  },
  alertActions: {
    alignItems: 'flex-end',
  },
  readBtn: {
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
  },
  assignCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  assignTitle: {
    fontSize: 15,
  },
  assignSubtitle: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: -8,
  },
  formGroup: {
    gap: Spacing.one,
  },
  label: {
    fontSize: 13,
  },
  pickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB33',
  },
  textArea: {
    height: 72,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.three,
    paddingVertical: 8,
    fontSize: 13,
  },
  submitAssignBtn: {
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  skeletonContainer: {
    gap: 8,
    marginTop: 4,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
  },
  proposalCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  proposalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  proposalBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  proposalBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  proposalDetails: {
    flex: 1,
    gap: 2,
  },
  proposalActions: {
    alignItems: 'flex-end',
    marginTop: 4,
  },
  claimActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtnApprove: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  actionBtnReject: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  settingsCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  settingsTitle: {
    fontSize: 15,
  },
  settingsSubtitle: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: -8,
  },
  editionsList: {
    gap: Spacing.one,
  },
  editionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 40,
    borderBottomWidth: 1,
  },
  editionLabel: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  addSubjectBox: {
    borderTopWidth: 1,
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  editionSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: 4,
  },
  editionOption: {
    flex: 1,
    height: 32,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#E5E7EB33',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtn: {
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  priceModalContent: {
    width: '100%',
    borderRadius: 20,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  priceTitle: {
    fontSize: 15,
    textAlign: 'center',
  },
  priceSubtitle: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: -8,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginTop: 4,
  },
  modalBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
