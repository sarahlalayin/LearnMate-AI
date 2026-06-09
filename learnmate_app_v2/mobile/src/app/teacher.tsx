import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  View, 
  TextInput, 
  Dimensions, 
  Alert,
  Platform,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 預設模擬班級學童資料 (E2.1)
const MOCK_CLASS_STUDENTS = [
  {
    _id: 'ts_1',
    childName: '張小涵',
    points: 450,
    streak: 6,
    completionRate: 85,
    accuracies: { '國語': 82, '數學': 75, '英語': 90, '自然': 80, '社會': 88 }
  },
  {
    _id: 'ts_2',
    childName: '李小宇',
    points: 210,
    streak: 3,
    completionRate: 60,
    accuracies: { '國語': 68, '數學': 60, '英語': 72, '自然': 65, '社會': 70 }
  },
  {
    _id: 'ts_3',
    childName: '王寶兒',
    points: 590,
    streak: 10,
    completionRate: 100,
    accuracies: { '國語': 95, '數學': 92, '英語': 98, '自然': 96, '社會': 94 }
  }
];

const MOCK_CLASS_ACCURACIES = {
  '國語': 82,
  '數學': 76,
  '英語': 87,
  '自然': 80,
  '社會': 84
};

export default function TeacherScreen() {
  const router = useRouter();
  const { colors, setGradeTheme } = useTheme();

  // 1. 特權登入認證 (E2.1)
  const [teacherUnlocked, setTeacherUnlocked] = useState(false);
  const [teacherUsername, setTeacherUsername] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');
  const [teacherInfo, setTeacherInfo] = useState<any>(null);

  // 2. 業務資料狀態
  const [students, setStudents] = useState<any[]>(MOCK_CLASS_STUDENTS);
  const [classAccuracies, setClassAccuracies] = useState<any>(MOCK_CLASS_ACCURACIES);
  const [averageCompletion, setAverageCompletion] = useState<number>(82);
  const [loading, setLoading] = useState(false);

  // 3. Tab 切換 (stats: 班級數據, import: 批次匯入, aiCompile: AI講義出題)
  const [teacherTab, setTeacherTab] = useState<'stats' | 'import' | 'aiCompile'>('stats');

  // 4. CSV 批次匯入 States
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);

  // 5. AI 講義出題 States (E2.2)
  const [lectureSubject, setLectureSubject] = useState('自然');
  const [lectureGrade, setLectureGrade] = useState('6');
  const [lectureEdition, setLectureEdition] = useState('自編版');
  const [lectureText, setLectureText] = useState('');
  const [compiling, setCompiling] = useState(false);
  const [compiledQuestions, setCompiledQuestions] = useState<any[]>([]);

  // 獲取班級數據看板 (E2.1)
  const fetchClassStats = async (tId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/school/class-stats/${tId}`);
      const data = await response.json();
      if (data.success) {
        setStudents(data.students || []);
        setClassAccuracies(data.classAccuracies || MOCK_CLASS_ACCURACIES);
        setAverageCompletion(data.averageCompletion || 82);
      }
    } catch (e) {
      console.log('獲取教師端班級數據失敗，啟用離線沙盒模式');
    } finally {
      setLoading(false);
    }
  };

  // 登入或創建教師帳號 (E2.1)
  const handleTeacherLogin = async () => {
    if (!teacherUsername || !teacherPassword) {
      if (Platform.OS === 'web') alert('❌ 請填寫教師帳號與登入密碼！');
      else Alert.alert('輸入未完整 ⚠️', '請填寫教師帳號與登入密碼！');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/school/teacher-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: teacherUsername, password: teacherPassword })
      });
      const data = await response.json();
      if (data.success) {
        setTeacherInfo(data.teacher);
        setTeacherUnlocked(true);
        setGradeTheme('parent'); // 進入管理專屬綠色溫馨皮膚
        fetchClassStats(data.teacher._id);
        return;
      }
    } catch (e) {
      console.log('API登入連線失敗，啟動本地教師沙盒解鎖');
    } finally {
      setLoading(false);
    }

    // 本地沙盒模擬解鎖 (為了 Demo 體驗無比順暢，若密碼為 teacher888 或後端未啟動，依然可正常進入)
    if (teacherPassword === 'teacher888') {
      const sandboxTeacher = {
        _id: 'sandbox_t_123',
        username: teacherUsername,
        name: '林老師',
        schoolName: '愛智文理安親班',
        classCode: 'CLASS_SANDBOX888'
      };
      setTeacherInfo(sandboxTeacher);
      setTeacherUnlocked(true);
      setGradeTheme('parent'); // 進入管理綠色溫馨皮膚
      if (Platform.OS === 'web') {
        alert(`🎒 【沙盒解鎖】歡迎林老師登入！已啟用離線教師演示功能。✓`);
      } else {
        Alert.alert('解鎖成功 🎒', `【沙盒解鎖】歡迎林老師登入！已啟用離線教師演示功能。✓`);
      }
    } else {
      if (Platform.OS === 'web') {
        alert('❌ 【驗證失敗】演示特權密碼請填入「teacher888」進行 Demo。');
      } else {
        Alert.alert('驗證失敗 ⚠️', '演示特權密碼請填入「teacher888」進行 Demo。');
      }
    }
  };

  // CSV 貼上批次剖析匯入學童 (E2.1)
  const handleImportCSV = async () => {
    if (!csvText.trim()) {
      if (Platform.OS === 'web') alert('❌ 請輸入要導入的學童 CSV 資料！');
      else Alert.alert('內容為空 ⚠️', '請輸入要導入的學童 CSV 資料！');
      return;
    }

    setImporting(true);
    try {
      const response = await fetch('http://localhost:5000/api/school/import-students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          teacherId: teacherInfo?._id || 'sandbox_t_123', 
          csvText: csvText 
        })
      });
      const data = await response.json();
      if (data.success) {
        if (Platform.OS === 'web') alert(`🎒 成功 batch 導入 ${data.count} 名學童入班！`);
        else Alert.alert('匯入成功 🎉', `成功為班級批量匯入 ${data.count} 名學童！`);
        setCsvText('');
        fetchClassStats(teacherInfo?._id || 'sandbox_t_123');
        return;
      }
    } catch (e) {
      console.log('API匯入失敗，啟動本地 CSV 剖析沙盒');
    } finally {
      setImporting(false);
    }

    // 本地沙盒 CSV 剖析
    const rows = csvText.split('\n');
    const newAdded: any[] = [];
    rows.forEach((row, index) => {
      const parts = row.split(',');
      const childName = parts[0]?.trim();
      const familyCode = parts[1]?.trim() || `fc_sb_${Math.random().toString(36).substr(2, 4)}`;
      if (childName && childName !== '姓名' && childName !== '') {
        newAdded.push({
          _id: `ts_sb_${Date.now()}_${index}`,
          childName,
          points: 100,
          streak: 0,
          completionRate: 0,
          accuracies: { '國語': 75, '數學': 75, '英語': 75, '自然': 75, '社會': 75 }
        });
      }
    });

    if (newAdded.length > 0) {
      setStudents(prev => [...prev, ...newAdded]);
      setCsvText('');
      if (Platform.OS === 'web') {
        alert(`🎒 【沙盒模擬】成功剖析 CSV，已動態追加 ${newAdded.length} 位學生至本地列表！✓`);
      } else {
        Alert.alert('匯入成功 🎉', `【沙盒模擬】成功剖析 CSV，已動態追加 ${newAdded.length} 位學生至本地列表！✓`);
      }
    } else {
      if (Platform.OS === 'web') alert('❌ CSV 格式剖析失敗，請檢查欄位或使用「一鍵載入模擬」測試。');
      else Alert.alert('剖析失敗 ⚠️', 'CSV 格式剖析失敗，請檢查欄位或使用「一鍵載入模擬」測試。');
    }
  };

  // 📖 課堂講義 AI 出題系統 (Pro) (E2.2)
  const handleAICompileLecture = async () => {
    if (!lectureText.trim()) {
      if (Platform.OS === 'web') alert('❌ 請填寫講義大綱或教材文字內容！');
      else Alert.alert('內容為空 ⚠️', '請填寫講義大綱或教材文字內容！');
      return;
    }

    setCompiling(true);
    setCompiledQuestions([]);

    try {
      const response = await fetch('http://localhost:5000/api/school/upload-lecture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          subject: lectureSubject,
          grade: lectureGrade,
          edition: lectureEdition,
          lectureText: lectureText 
        })
      });
      const data = await response.json();
      if (data.success) {
        setCompiledQuestions(data.questions);
        if (Platform.OS === 'web') alert('✨ Gemini 講義解析成功！5 道核心素養考題已成功發布至平台題庫！');
        else Alert.alert('編譯成功 ✨', 'Gemini 講義解析成功！5 道核心素養考題已成功發布至平台題庫！');
        return;
      }
    } catch (e) {
      console.log('API出題編譯失敗，啟動本地 AI 離線沙盒');
    } finally {
      setCompiling(false);
    }

    // 本地離線沙盒模擬出題 (Gemini 出題高擬真模擬)
    setTimeout(() => {
      const mockCompiled = [
        {
          _id: 'mq_1',
          q: `【情境素養題】${lectureSubject}領域中有關「${lectureText.slice(0, 15)}...」的延伸探究，請問以下敘述何者最正確？`,
          opts: ['符合科學邏輯的精準核心選項（正確解答）', '僅憑直覺的表面干擾誘答項 A', '混淆物理/化學因果關係的誘答項 B', '日常生活中常見迷思的誘答項 C'],
          a: 0,
          exp: `【解析說明】恭喜你答對囉！這是針對講義考點『${lectureText.slice(0, 8)}...』的精華點撥。維持優良的自律閱讀好習慣，你就離科學大師不遠了！🌟`
        },
        {
          _id: 'mq_2',
          q: `【生活實踐題】小明在課堂講義中讀到關於本單元的知識，若他想在週末進行野外探查驗證，他應該優先注意哪一項指標？`,
          opts: ['環境控制變因與觀測儀器的精準校正', '只要天氣晴朗就可以直接出發', '帶上最貴的實驗器材出門', '完全不需要準備，現場發揮創意'],
          a: 0,
          exp: `【解析說明】進行任何學術或生活實作探查時，保持科學實驗的『控制變因』與『精確校正』是獲得信賴數據的基礎。太棒了，給自己一個讚！👍`
        },
        {
          _id: 'mq_3',
          q: `【探究與實作】根據講義內容，若我們將主要觀測對象的頻率提高一倍，則在相同時間內，所收集到的資訊量會產生什麼變化？`,
          opts: ['資訊量增加，且能夠描繪出更精細的變化趨勢', '資訊量不變，因為觀測總時間是一樣的', '資訊量反而減少，因為系統會過載當機', '資訊量會隨機亂跳，無法預測'],
          a: 0,
          exp: `【解析說明】頻率（Sampling Rate）增加代表取樣點變多，自然能夠在相同時段中記錄更多微小的變化波動。你真是個科學小天才！🧬`
        },
        {
          _id: 'mq_4',
          q: `【跨領域思考】在學習「${lectureText.slice(0, 8)}...」時，小華發現這與社會課學到的資源永續利用非常有關係，你認為最關鍵的交集點是？`,
          opts: ['利用科學知識進行高效率且低污染的綠色能源轉換', '只要追求經濟利潤極大化即可', '這兩個學科是完全獨立的，沒有任何關聯', '永續發展只是課本上的口號，不需要在意'],
          a: 0,
          exp: `【解析說明】科學的本質是用來改善人類福祉，將自然學科的發現應用在環境永續與資源維護，是現代公民最核心的素養！🌿`
        },
        {
          _id: 'mq_5',
          q: `【觀念總複習】在本課學習後，哪一位同學對於該單元的核心價值理解最為深刻且正確？`,
          opts: ['小美說：『我們要將所學原理連結生活經驗，解決真實世界中的問題。』', '小明說：『只要把課本的公式跟大綱死記下來，考試考高分就好了。』', '阿寶說：『這門學科太難了，我以後長大絕對用不到。』', '小華說：『這些知識都是科學家發現的，我們照抄就好不用思考。』'],
          a: 0,
          exp: `【解析說明】沒錯！十二年國教素養的核心，就是帶領孩子們學以致用、用以致學。你完全抓到了精髓！恭喜完成本單元 AI 編譯出題！🎓`
        }
      ];

      setCompiledQuestions(mockCompiled);
      setCompiling(false);

      if (Platform.OS === 'web') {
        alert('✨ 【沙盒模擬】Gemini 離線編譯出題成功！已虛擬生成 5 道核心素養好題並呈現在列表。');
      } else {
        Alert.alert('編譯成功 ✨', '【沙盒模擬】Gemini 離線編譯出題成功！已虛擬生成 5 道核心素養好題並呈現在列表。');
      }
    }, 1500);
  };

  // ── 階段零：教師安全密碼鎖屏 ─────────────────────────────────
  if (!teacherUnlocked) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.gateWrapper}>
            <ThemedText style={styles.gateTrophy} type="subtitle">🎒</ThemedText>
            <ThemedText style={styles.gateTitle} type="subtitle">LearnMate 學校班級管理端</ThemedText>
            <ThemedText style={[styles.gateDesc, { color: colors.textSecondary }]} type="small">
              本區域為 LearnMate B2B 學校與安親班管理后台，老師可在此追蹤班級進度並利用 AI 解析出題。
            </ThemedText>

            <TextInput
              style={[styles.gateInput, { borderColor: colors.border, color: colors.text }]}
              placeholder="請填入教師帳號名稱"
              placeholderTextColor={colors.textSecondary}
              value={teacherUsername}
              onChangeText={setTeacherUsername}
            />

            <TextInput
              style={[styles.gateInput, { borderColor: colors.border, color: colors.text }]}
              secureTextEntry={true}
              placeholder="請填入特權密碼"
              placeholderTextColor={colors.textSecondary}
              value={teacherPassword}
              onChangeText={setTeacherPassword}
            />

            <TouchableOpacity 
              style={[styles.gateVerifyBtn, { backgroundColor: colors.primary }]}
              onPress={handleTeacherLogin}
            >
              <ThemedText themeColor="background" type="smallBold">🔒 教師特權驗證登入</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.gateBackBtn}
              onPress={() => router.replace('/')}
            >
              <ThemedText style={{ color: colors.textSecondary }} type="smallBold">返回學生首頁</ThemedText>
            </TouchableOpacity>

            <ThemedText style={{ fontSize: 10, color: colors.textSecondary, marginTop: 10 }}>
              💡 小提示：Demo 演示請輸入任何帳密（如 `teacher`），密碼輸入 `teacher888` 即可解鎖。
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  // ── 階段一：已解鎖教師管理面板 ──────────────────────────────────────
  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        
        {/* 頂部導航 */}
        <View style={[styles.adminHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => {
            setTeacherUnlocked(false);
            setGradeTheme('highGrade'); // 切回學生高年級主題
            router.replace('/');
          }} style={styles.logoutBtn}>
            <ThemedText style={{ color: colors.textSecondary }} type="smallBold">🔒 鎖定退出</ThemedText>
          </TouchableOpacity>

          <View style={{ alignItems: 'center' }}>
            <ThemedText type="smallBold" style={{ color: colors.primary }}>
              {teacherInfo?.schoolName || '愛智文理安親班'}
            </ThemedText>
            <ThemedText type="small" style={{ color: colors.textSecondary, fontSize: 10 }}>
              班級代碼：{teacherInfo?.classCode || 'CLASS_888'} | {teacherInfo?.name || '林老師'}
            </ThemedText>
          </View>

          <View style={{ backgroundColor: colors.success + '22', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 8 }}>
            <ThemedText style={{ color: colors.success, fontSize: 10 }} type="smallBold">🟢 教師端</ThemedText>
          </View>
        </View>

        {/* Tab 欄 (stats: 班級數據, import: 批次匯入, aiCompile: AI講義出題) */}
        <View style={[styles.subMenu, { borderBottomColor: colors.border }]}>
          {[
            { key: 'stats', name: '📊 班級數據大看板' },
            { key: 'import', name: '👥 CSV 學生匯入' },
            { key: 'aiCompile', name: '📖 AI 講義出題' }
          ].map(tab => (
            <TouchableOpacity 
              key={tab.key}
              style={[
                styles.subMenuItem, 
                teacherTab === tab.key && { borderBottomColor: colors.primary, borderBottomWidth: 3 }
              ]}
              onPress={() => setTeacherTab(tab.key as any)}
            >
              <ThemedText 
                style={{ color: teacherTab === tab.key ? colors.primary : colors.textSecondary }}
                type="smallBold"
              >
                {tab.name}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* ==================== SUB-TAB 1: 班級數據大看板 ==================== */}
          {teacherTab === 'stats' && (
            <View style={styles.tabContent}>
              
              {/* 班級大數據摘要 */}
              <ThemedView type="backgroundElement" style={[styles.classSummaryCard, { borderColor: colors.border }]}>
                <ThemedText style={styles.cardTitle} type="smallBold">📈 班級學習自律概況</ThemedText>
                
                <View style={styles.summaryStatsRow}>
                  {/* 今日完成率 */}
                  <View style={styles.statCircleBox}>
                    <View style={[styles.microCircleProgress, { borderColor: colors.primary }]}>
                      <ThemedText style={{ color: colors.primary }} type="subtitle">{averageCompletion}%</ThemedText>
                    </View>
                    <ThemedText type="small" style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4 }}>
                      今日任務完成率
                    </ThemedText>
                  </View>

                  {/* 班級學員數 */}
                  <View style={styles.statCircleBox}>
                    <View style={[styles.microCircleProgress, { borderColor: colors.success }]}>
                      <ThemedText style={{ color: colors.success }} type="subtitle">{students.length}人</ThemedText>
                    </View>
                    <ThemedText type="small" style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4 }}>
                      班級總學生數
                    </ThemedText>
                  </View>
                </View>

                {/* 各學科平均正確率 (Micro Charts using Native Views) */}
                <View style={{ gap: Spacing.two, marginTop: Spacing.two, borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: Spacing.two }}>
                  <ThemedText style={{ fontSize: 12, color: colors.text, fontWeight: '700' }}>
                    📚 各科目班級平均正確率分佈：
                  </ThemedText>

                  {Object.entries(classAccuracies).map(([subject, val]: [string, any]) => (
                    <View key={subject} style={{ gap: 4 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <ThemedText style={{ fontSize: 11, color: colors.text }} type="smallBold">
                          {subject}
                        </ThemedText>
                        <ThemedText style={{ fontSize: 11, color: colors.primary }} type="smallBold">
                          {val}%
                        </ThemedText>
                      </View>
                      <View style={[styles.barBg, { backgroundColor: colors.backgroundSelected }]}>
                        <View style={[styles.barFill, { backgroundColor: colors.primary, width: `${val}%` }]} />
                      </View>
                    </View>
                  ))}
                </View>
              </ThemedView>

              {/* 學童名冊清單 */}
              <ThemedText style={styles.sectionTitle} type="smallBold">
                🏫 班級學生學習清單 ({students.length}位)
              </ThemedText>

              {loading ? (
                <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
              ) : (
                students.map((student) => (
                  <ThemedView key={student._id} type="backgroundElement" style={[styles.familyCard, { borderColor: colors.border }]}>
                    <View style={styles.studentHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={[styles.avatarCircle, { backgroundColor: colors.success }]}>
                          <ThemedText style={{ color: '#FFFFFF' }} type="smallBold">{student.childName[0]}</ThemedText>
                        </View>
                        <View>
                          <ThemedText type="smallBold" style={{ color: colors.text }}>
                            {student.childName}
                          </ThemedText>
                          <ThemedText type="small" style={{ color: colors.textSecondary, fontSize: 10 }}>
                            🔥 自律連勤：{student.streak} 天 | 💎 點數：{student.points} 點
                          </ThemedText>
                        </View>
                      </View>

                      {/* 個人完成度 */}
                      <View style={{ alignItems: 'flex-end' }}>
                        <ThemedText style={{ color: colors.primary, fontSize: 12 }} type="smallBold">
                          完成率 {student.completionRate}%
                        </ThemedText>
                        <View style={[styles.microBarBg, { backgroundColor: colors.backgroundSelected }]}>
                          <View style={[styles.microBarFill, { backgroundColor: colors.primary, width: `${student.completionRate}%` }]} />
                        </View>
                      </View>
                    </View>

                    {/* 科目正確率速覽 */}
                    <View style={styles.studentAccRow}>
                      {Object.entries(student.accuracies || {}).slice(0, 3).map(([sub, acc]: [string, any]) => (
                        <View key={sub} style={[styles.accMiniCard, { backgroundColor: colors.backgroundSelected + '22' }]}>
                          <ThemedText style={{ fontSize: 9, color: colors.textSecondary }}>{sub}</ThemedText>
                          <ThemedText style={{ fontSize: 10, color: acc >= 80 ? colors.success : colors.text, fontWeight: '700' }}>
                            {acc}%
                          </ThemedText>
                        </View>
                      ))}
                      <ThemedText style={{ fontSize: 9, color: colors.textSecondary, marginLeft: 4 }}>...</ThemedText>
                    </View>
                  </ThemedView>
                ))
              )}

            </View>
          )}

          {/* ==================== SUB-TAB 2: CSV 學生批次匯入 ==================== */}
          {teacherTab === 'import' && (
            <View style={styles.tabContent}>
              
              <View style={[styles.alertHeaderCard, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}>
                <ThemedText style={{ color: colors.primary }} type="smallBold">
                  👥 批量 CSV 貼上匯入系統
                </ThemedText>
                <ThemedText type="small" style={{ color: colors.textSecondary, marginTop: 4, fontSize: 11, lineHeight: 15 }}>
                  透過將 Excel / 安親班名冊轉換為 CSV 格式（每行一筆：『姓名,家庭代碼』），在此處直接進行大段文字貼上，LearnMate 會秒級為每位新入班學童開設專屬帳戶，並自動贈送新班迎新任務與 100 點入班金幣！
                </ThemedText>
              </View>

              {/* CSV 輸入框 */}
              <View style={{ gap: Spacing.one }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <ThemedText style={{ color: colors.text }} type="smallBold">貼上 CSV 資料內容：</ThemedText>
                  <TouchableOpacity 
                    onPress={() => {
                      setCsvText('陳大同,fc_datong\n黃小美,fc_xiaomei\n林阿昌,\n');
                    }}
                    style={{ backgroundColor: colors.backgroundSelected, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}
                  >
                    <ThemedText style={{ color: colors.primary, fontSize: 10 }} type="smallBold">📋 帶入範本名單</ThemedText>
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={[
                    styles.csvTextArea, 
                    { 
                      borderColor: colors.border, 
                      color: colors.text, 
                      backgroundColor: colors.backgroundElement
                    }
                  ]}
                  multiline={true}
                  numberOfLines={10}
                  placeholder={`請輸入 CSV 格式文字，例如：\n姓名,家庭代碼(選填)\n王小明,fc_xiaoming\n李小華,fc_xiaohua\n張阿寶,`}
                  placeholderTextColor={colors.textSecondary}
                  value={csvText}
                  onChangeText={setCsvText}
                />
              </View>

              {/* 匯入操作按鈕 */}
              <TouchableOpacity 
                style={[styles.importBtn, { backgroundColor: colors.primary }]}
                onPress={handleImportCSV}
                disabled={importing}
              >
                {importing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <ThemedText themeColor="background" type="smallBold">
                    👥 立即批次匯入學童入班
                  </ThemedText>
                )}
              </TouchableOpacity>

            </View>
          )}

          {/* ==================== SUB-TAB 3: AI 講義出題 ==================== */}
          {teacherTab === 'aiCompile' && (
            <View style={styles.tabContent}>
              
              <View style={[styles.alertHeaderCard, { backgroundColor: '#F59E0B15', borderColor: '#F59E0B' }]}>
                <ThemedText style={{ color: '#F59E0B' }} type="smallBold">
                  📖 AI 課堂講義編譯出題 (十二年國教素養)
                </ThemedText>
                <ThemedText type="small" style={{ color: colors.textSecondary, marginTop: 4, fontSize: 11, lineHeight: 15 }}>
                  輸入您的教材講義、大綱或複習重點，LearnMate 的 **Gemini 2.0 Flash** 引擎會為您批次解析，針對重點抽取 5 道綁定素養的選擇題並自動存入題庫，孩子們回家即可抽取作答，自適應提煉！
                </ThemedText>
              </View>

              {/* 出題參數篩選 */}
              <View style={[styles.filterContainer, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
                
                {/* 科目 */}
                <View style={styles.filterRow}>
                  <ThemedText style={{ fontSize: 12, color: colors.textSecondary }}>選擇學科：</ThemedText>
                  <View style={styles.btnGroup}>
                    {['國語', '數學', '英語', '自然', '社會'].map(sub => (
                      <TouchableOpacity 
                        key={sub} 
                        style={[
                          styles.filterItem, 
                          lectureSubject === sub && { backgroundColor: colors.primary }
                        ]}
                        onPress={() => setLectureSubject(sub)}
                      >
                        <ThemedText style={{ color: lectureSubject === sub ? '#FFFFFF' : colors.text, fontSize: 11 }}>
                          {sub}
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* 年級 */}
                <View style={styles.filterRow}>
                  <ThemedText style={{ fontSize: 12, color: colors.textSecondary }}>適用年級：</ThemedText>
                  <View style={styles.btnGroup}>
                    {['1', '2', '3', '4', '5', '6'].map(g => (
                      <TouchableOpacity 
                        key={g} 
                        style={[
                          styles.filterItem, 
                          lectureGrade === g && { backgroundColor: colors.primary }
                        ]}
                        onPress={() => setLectureGrade(g)}
                      >
                        <ThemedText style={{ color: lectureGrade === g ? '#FFFFFF' : colors.text, fontSize: 11 }}>
                          {g}年級
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* 版本 */}
                <View style={styles.filterRow}>
                  <ThemedText style={{ fontSize: 12, color: colors.textSecondary }}>選用版本：</ThemedText>
                  <View style={styles.btnGroup}>
                    {['康軒版', '翰林版', '南一版', '自編版'].map(ed => (
                      <TouchableOpacity 
                        key={ed} 
                        style={[
                          styles.filterItem, 
                          lectureEdition === ed && { backgroundColor: colors.primary }
                        ]}
                        onPress={() => setLectureEdition(ed)}
                      >
                        <ThemedText style={{ color: lectureEdition === ed ? '#FFFFFF' : colors.text, fontSize: 11 }}>
                          {ed}
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

              </View>

              {/* 講義文字輸入框 */}
              <View style={{ gap: Spacing.one }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <ThemedText style={{ color: colors.text }} type="smallBold">輸入課堂講義大綱或教材文字：</ThemedText>
                  <TouchableOpacity 
                    onPress={() => {
                      setLectureText(
                        '地球上的水會不斷循環。太陽的熱力使地表、海洋中的水蒸發，植物的蒸散作用也會釋放出水蒸氣。水蒸氣上升遇冷凝結成小水滴或冰晶，聚集在一起形成雲。當雲中的小水滴太大時，就會以降雨、降雪等形式落回地面。一部分雨水會滲入地下成為地下水，一部分則流入河流、海洋，這就是水循環。'
                      );
                    }}
                    style={{ backgroundColor: colors.backgroundSelected, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}
                  >
                    <ThemedText style={{ color: colors.primary, fontSize: 10 }} type="smallBold">📋 載入模擬講義 (水循環)</ThemedText>
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={[
                    styles.csvTextArea, 
                    { 
                      borderColor: colors.border, 
                      color: colors.text, 
                      backgroundColor: colors.backgroundElement
                    }
                  ]}
                  multiline={true}
                  numberOfLines={8}
                  placeholder={`在此填入您的講義段落、大綱或隨堂教案文字...`}
                  placeholderTextColor={colors.textSecondary}
                  value={lectureText}
                  onChangeText={setLectureText}
                />
              </View>

              {/* AI 講義出題編譯按鈕 */}
              <TouchableOpacity 
                style={[styles.importBtn, { backgroundColor: '#F59E0B' }]}
                onPress={handleAICompileLecture}
                disabled={compiling}
              >
                {compiling ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <ThemedText themeColor="background" type="smallBold">Gemini 2.0 Flash 正在深度出題編譯中...</ThemedText>
                  </View>
                ) : (
                  <ThemedText themeColor="background" type="smallBold">
                    ✨ AI 講義編譯出題 (全自動 5 題)
                  </ThemedText>
                )}
              </TouchableOpacity>

              {/* 編譯題目結果展示 */}
              {compiledQuestions.length > 0 && (
                <View style={{ gap: Spacing.two, marginTop: Spacing.two }}>
                  <ThemedText style={styles.sectionTitle} type="smallBold">
                    🎉 AI 編譯產出成果 (共 {compiledQuestions.length} 題已存入題庫)
                  </ThemedText>

                  {compiledQuestions.map((q, idx) => (
                    <ThemedView key={idx} type="backgroundElement" style={[styles.compiledCard, { borderColor: colors.border }]}>
                      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                        <View style={{ backgroundColor: '#F59E0B22', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                          <ThemedText style={{ color: '#F59E0B', fontSize: 10 }} type="smallBold">
                            第 {idx + 1} 題
                          </ThemedText>
                        </View>
                        <ThemedText style={{ color: colors.textSecondary, fontSize: 11 }}>
                          對應學科：{lectureSubject} | {lectureGrade}年級
                        </ThemedText>
                      </View>

                      {/* 題幹 */}
                      <ThemedText style={{ color: colors.text, marginVertical: 6, lineHeight: 18 }} type="smallBold">
                        {q.q}
                      </ThemedText>

                      {/* 四個選項 */}
                      <View style={{ gap: 4, marginVertical: 4 }}>
                        {q.opts.map((opt: string, oIdx: number) => {
                          const isCorrect = oIdx === q.a;
                          return (
                            <View 
                              key={oIdx} 
                              style={[
                                styles.optionRow, 
                                { 
                                  backgroundColor: isCorrect ? colors.success + '15' : colors.backgroundSelected + '22',
                                  borderColor: isCorrect ? colors.success : colors.border
                                }
                              ]}
                            >
                              <ThemedText style={{ fontSize: 11, color: isCorrect ? colors.success : colors.text, fontWeight: isCorrect ? '700' : '400' }}>
                                {String.fromCharCode(65 + oIdx)}. {opt} {isCorrect ? ' (✅ 正確解答)' : ''}
                              </ThemedText>
                            </View>
                          );
                        })}
                      </View>

                      {/* 解析 */}
                      <View style={{ backgroundColor: colors.backgroundSelected + '22', padding: 8, borderRadius: 8, marginTop: 4 }}>
                        <ThemedText style={{ fontSize: 11, color: colors.primary, fontWeight: '700' }}>
                          💡 溫馨解析：
                        </ThemedText>
                        <ThemedText style={{ fontSize: 11, color: colors.textSecondary, lineHeight: 15, fontStyle: 'italic', marginTop: 2 }}>
                          {q.exp}
                        </ThemedText>
                      </View>

                    </ThemedView>
                  ))}
                </View>
              )}

            </View>
          )}

        </ScrollView>
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
  gateInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    width: '100%',
    textAlign: 'center',
    fontSize: 15,
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
  adminHeader: {
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
    flexDirection: 'row',
    height: 44,
    borderBottomWidth: 1,
  },
  subMenuItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  sectionTitle: {
    fontSize: 14,
    marginBottom: 2,
  },
  classSummaryCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  cardTitle: {
    fontSize: 14,
  },
  summaryStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginVertical: 4,
  },
  statCircleBox: {
    alignItems: 'center',
    gap: 4,
  },
  microCircleProgress: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  barBg: {
    height: 8,
    borderRadius: 4,
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  familyCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.two,
    marginBottom: 4,
  },
  studentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  microBarBg: {
    width: 70,
    height: 4,
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden',
  },
  microBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  studentAccRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
    alignItems: 'center',
  },
  accMiniCard: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  alertHeaderCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: Spacing.three,
  },
  csvTextArea: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 12,
    fontSize: 13,
    textAlignVertical: 'top',
    height: 140,
  },
  importBtn: {
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
  },
  filterContainer: {
    borderWidth: 1,
    borderRadius: 14,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  btnGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  filterItem: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
  },
  compiledCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.three,
    gap: 4,
  },
  optionRow: {
    borderWidth: 0.5,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  }
});
