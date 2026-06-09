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

// 預設模擬的瑕疵報錯題目佇列 (報錯率 >= 5%) (E1.3)
const MOCK_REPORTED_QUESTIONS = [
  {
    _id: 'q_rep_1',
    subject: '數學',
    grade: '6',
    edition: '康軒版',
    q: '【有爭議】阿力和小美共有 20 顆糖果，阿力比小美多 4 顆，請問小美有幾顆？',
    opts: ["6 顆", "8 顆", "10 顆", "12 顆"],
    a: 1, // 正確答案是 8 顆。阿力12, 小美8。
    exp: '錯誤解析：設小美有 x 顆，阿力有 x+4 顆。x + x+4 = 20 => 2x = 16 => x = 8。但先前家長回報：AI 解析算式顯示成了 12 顆，導致孩子錯亂。',
    attemptsCount: 80,
    reportCount: 12,
    errorRate: 15, // 15% 報錯率
    isBlacklisted: false
  },
  {
    _id: 'q_rep_2',
    subject: '英語',
    grade: '6',
    edition: '通用版',
    q: '【有爭議】We ___ going to the zoo next Sunday.',
    opts: ["am", "is", "are", "be"],
    a: 2,
    exp: 'We 為複數主詞，Be 動詞應搭配 are。先前報錯：系統原答案設定成了 is，導致答 are 的人全部判錯！',
    attemptsCount: 150,
    reportCount: 9,
    errorRate: 6, // 6% 報錯率
    isBlacklisted: false
  }
];

// 預設模擬全體家庭列表 (E1.2)
const MOCK_FAMILIES = [
  {
    _id: 'f_1',
    childName: '小明',
    familyCode: 'fc_xiaoming',
    points: 320,
    streak: 5,
    subscription: {
      plan: 'pro',
      status: 'active',
      current_period_end: '2026-07-02T00:00:00.000Z'
    }
  },
  {
    _id: 'f_2',
    childName: '小華',
    familyCode: 'fc_xiaohua',
    points: 120,
    streak: 1,
    subscription: {
      plan: 'free',
      status: 'expired',
      current_period_end: null
    }
  },
  {
    _id: 'f_3',
    childName: '阿寶',
    familyCode: 'fc_abao',
    points: 540,
    streak: 8,
    subscription: {
      plan: 'free',
      status: 'trial',
      current_period_end: '2026-06-10T00:00:00.000Z'
    }
  }
];

export default function AdminScreen() {
  const router = useRouter();
  const { colors, setGradeTheme } = useTheme();

  // 1. 特權密碼認證 (E1.1)
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [unlockedAttempts, setUnlockedAttempts] = useState(0);

  // 2. 業務資料狀態
  const [families, setFamilies] = useState<any[]>(MOCK_FAMILIES);
  const [reportedQuestions, setReportedQuestions] = useState<any[]>(MOCK_REPORTED_QUESTIONS);
  const [loading, setLoading] = useState(false);

  // 3. Tab 切換 (families: 家庭管理, questionQuality: AI品管佇列)
  const [adminTab, setAdminTab] = useState<'families' | 'questionQuality'>('families');

  // 後端聯調：獲取家庭列表與報錯題目
  const fetchAdminData = async () => {
    setLoading(true);
    try {
      // 1. 嘗試獲取家庭列表
      const famRes = await fetch('http://localhost:5000/api/admin/families');
      const famData = await famRes.json();
      if (famData.success) {
        setFamilies(famData.families);
      }

      // 2. 嘗試獲取報錯佇列
      const qRes = await fetch('http://localhost:5000/api/admin/questions/reported');
      const qData = await qRes.json();
      if (qData.success) {
        setReportedQuestions(qData.questions);
      }
    } catch (e) {
      console.log('獲取管理端數據失敗，啟動離線沙盒模式');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminUnlocked) {
      fetchAdminData();
    }
  }, [adminUnlocked]);

  // 驗證特權解鎖 (E1.1)
  const handleVerifyAdmin = () => {
    if (adminPassword === 'admin888') {
      setAdminUnlocked(true);
      setGradeTheme('parent'); // 進入管理專屬綠色溫馨皮膚
    } else {
      setUnlockedAttempts(a => a + 1);
      if (Platform.OS === 'web') alert('❌ 特權密碼錯誤！非營運人員請勿嘗試進入。');
      else Alert.alert('特權驗證失敗 ⚠️', '特權密碼錯誤！非營運人員請勿嘗試進入。');
      setAdminPassword('');
    }
  };

  // 手動加贈 Pro 會員 (E1.2)
  const handleGiftPro = async (familyId: string, childName: string) => {
    try {
      const response = await fetch('http://localhost:5000/api/admin/families/update-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyId, plan: 'pro', days: 30 })
      });
      const data = await response.json();
      if (data.success) {
        // 更新本地狀態
        setFamilies(prev => prev.map(f => f._id === familyId ? { ...f, subscription: data.subscription } : f));
        if (Platform.OS === 'web') alert(`🎁 Pro 贈送成功！已為【${childName}】的家庭帳號開通 30 天尊榮 Pro 會員權益！`);
        else Alert.alert('贈送成功 👑', `已為【${childName}】的家庭帳號開通 30 天尊榮 Pro 會員權益！`);
        return;
      }
    } catch (e) {
      console.log('API連線失敗，啟動本地 Mock 贈送');
    }

    // 本地模擬
    setFamilies(prev => prev.map(f => {
      if (f._id === familyId) {
        return {
          ...f,
          subscription: {
            plan: 'pro',
            status: 'active',
            current_period_end: new Date(Date.now() + 30 * 86400000).toISOString()
          }
        };
      }
      return f;
    }));

    if (Platform.OS === 'web') {
      alert(`🎁 【沙盒模擬】已為【${childName}】的家庭帳號手動贈送 30 天 Pro 尊榮會員！✓`);
    } else {
      Alert.alert('贈送成功 👑', `【沙盒模擬】已為【${childName}】的家庭帳號手動贈送 30 天 Pro 尊榮會員！✓`);
    }
  };

  // 手動調整金幣點數 (E1.2)
  const handleModifyPoints = async (familyId: string, childName: string, amount: number) => {
    try {
      const response = await fetch('http://localhost:5000/api/admin/families/update-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyId, pointsToAdd: amount })
      });
      const data = await response.json();
      if (data.success) {
        setFamilies(prev => prev.map(f => f._id === familyId ? { ...f, points: data.points } : f));
        if (Platform.OS === 'web') alert(`💎 金幣變更成功！目前【${childName}】共累積了 ${data.points} 點。`);
        else Alert.alert('修改點數 💎', `變更成功！目前【${childName}】共累積了 ${data.points} 點。`);
        return;
      }
    } catch (e) {
      console.log('API連線失敗，啟動本地 Mock 修改金幣');
    }

    // 本地模擬
    setFamilies(prev => prev.map(f => {
      if (f._id === familyId) {
        return {
          ...f,
          points: Math.max(0, f.points + amount)
        };
      }
      return f;
    }));

    if (Platform.OS === 'web') {
      alert(`💎 【沙盒模擬】手動調整【${childName}】金幣點數成功！修正幅度：${amount > 0 ? '+' : ''}${amount}點。`);
    } else {
      Alert.alert('點數變更成功 💎', `【沙盒模擬】手動調整【${childName}】金幣點數成功！修正幅度：${amount > 0 ? '+' : ''}${amount}點。`);
    }
  };

  // 一鍵屏蔽報錯 AI 題目 (移入黑名單) (E1.3)
  const handleBlacklistQuestion = async (questionId: string) => {
    try {
      const response = await fetch('http://localhost:5000/api/admin/questions/blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId })
      });
      const data = await response.json();
      if (data.success) {
        setReportedQuestions(prev => prev.filter(q => q._id !== questionId));
        if (Platform.OS === 'web') alert('⛔ 題目已被成功遮蔽，並移入出題黑名單佇列！');
        else Alert.alert('黑名單移入成功 ⛔', '該爭議題目已被黑名單標記，以後 AI 出題將不會再派發該題。');
        return;
      }
    } catch (e) {
      console.log('API連線失敗，啟動本地 Mock 黑名單');
    }

    // 本地模擬
    setReportedQuestions(prev => prev.filter(q => q._id !== questionId));
    if (Platform.OS === 'web') {
      alert('⛔ 【沙盒模擬】該 AI 有爭議題目已一鍵黑名單移入！此題已從題庫排除。✓');
    } else {
      Alert.alert('品管處理成功 ⛔', '【沙盒模擬】該 AI 有爭議題目已一鍵黑名單移入！此題已從題庫排除。✓');
    }
  };

  // ── 階段零：特權安全密碼鎖屏 (E1.1) ─────────────────────────────────
  if (!adminUnlocked) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.gateWrapper}>
            <ThemedText style={styles.gateTrophy} type="subtitle">🛡️</ThemedText>
            <ThemedText style={styles.gateTitle} type="subtitle">LearnMate 內部營運後台</ThemedText>
            <ThemedText style={[styles.gateDesc, { color: colors.textSecondary }]} type="small">
              本區域為 LearnMate 平台工程運作與運營總部，非特權營運人員請勿嘗試解鎖！
            </ThemedText>

            <TextInput
              style={[styles.gateInput, { borderColor: colors.border, color: colors.text }]}
              secureTextEntry={true}
              placeholder="請填入營運特權密碼"
              placeholderTextColor={colors.textSecondary}
              value={adminPassword}
              onChangeText={setAdminPassword}
            />

            <TouchableOpacity 
              style={[styles.gateVerifyBtn, { backgroundColor: colors.primary }]}
              onPress={handleVerifyAdmin}
            >
              <ThemedText themeColor="background" type="smallBold">🔒 特權密碼驗證解鎖</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.gateBackBtn}
              onPress={() => router.replace('/')}
            >
              <ThemedText style={{ color: colors.textSecondary }} type="smallBold">返回學生首頁</ThemedText>
            </TouchableOpacity>

            <ThemedText style={{ fontSize: 10, color: colors.textSecondary, marginTop: 10 }}>
              💡 小提示：特權密碼請輸入「admin888」進行 Demo 演示。
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  // ── 階段一：已解鎖營運控制面板 ──────────────────────────────────────
  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        
        {/* 頂部導航 */}
        <View style={[styles.adminHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => {
            setAdminUnlocked(false);
            setGradeTheme('highGrade'); // 切回學生高年級主題
            router.replace('/');
          }} style={styles.logoutBtn}>
            <ThemedText style={{ color: colors.textSecondary }} type="smallBold">🔒 鎖定退出</ThemedText>
          </TouchableOpacity>

          <ThemedText type="smallBold" style={{ color: colors.primary }}>
            LearnMate AI 全球營運總部
          </ThemedText>

          <View style={{ backgroundColor: colors.success + '22', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 8 }}>
            <ThemedText style={{ color: colors.success, fontSize: 10 }} type="smallBold">🟢 運行中</ThemedText>
          </View>
        </View>

        {/* Tab 欄 (families: 家庭管理, questionQuality: AI品管佇列) */}
        <View style={[styles.subMenu, { borderBottomColor: colors.border }]}>
          {[
            { key: 'families', name: '👥 平台家庭與訂閱管理' },
            { key: 'questionQuality', name: `⚑ AI 出題品質監控 (${reportedQuestions.length})` }
          ].map(tab => (
            <TouchableOpacity 
              key={tab.key}
              style={[
                styles.subMenuItem, 
                adminTab === tab.key && { borderBottomColor: colors.primary, borderBottomWidth: 3 }
              ]}
              onPress={() => setAdminTab(tab.key as any)}
            >
              <ThemedText 
                style={{ color: adminTab === tab.key ? colors.primary : colors.textSecondary }}
                type="smallBold"
              >
                {tab.name}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* ==================== SUB-TAB 1: 家庭與訂閱管理 ==================== */}
          {adminTab === 'families' && (
            <View style={styles.tabContent}>
              <ThemedText style={styles.sectionTitle} type="smallBold">
                已註冊家庭清單與特權特批
              </ThemedText>

              {loading ? (
                <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
              ) : (
                families.map((fam) => {
                  const isProFamily = fam.subscription && fam.subscription.plan === 'pro' && fam.subscription.status === 'active';
                  
                  return (
                    <ThemedView key={fam._id} type="backgroundElement" style={[styles.familyCard, { borderColor: colors.border }]}>
                      <View style={styles.familyHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={[styles.avatarCircle, { backgroundColor: colors.primary }]}>
                            <ThemedText style={{ color: '#FFFFFF' }} type="smallBold">{fam.childName[0]}</ThemedText>
                          </View>
                          <View>
                            <ThemedText type="smallBold" style={{ color: colors.text }}>
                              孩子姓名：{fam.childName}
                            </ThemedText>
                            <ThemedText type="small" style={{ color: colors.textSecondary, fontSize: 11 }}>
                              家庭代碼：{fam.familyCode}
                            </ThemedText>
                          </View>
                        </View>

                        <View style={[
                          styles.subBadge, 
                          { backgroundColor: isProFamily ? '#F59E0B22' : colors.backgroundSelected }
                        ]}>
                          <ThemedText style={{ color: isProFamily ? '#F59E0B' : colors.textSecondary, fontSize: 10 }} type="smallBold">
                            {isProFamily ? '👑 尊榮 Pro' : '⚪ 普通 Free'}
                          </ThemedText>
                        </View>
                      </View>

                      {/* 金幣與 Streak */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 8, backgroundColor: colors.backgroundSelected + '22', padding: 8, borderRadius: 8 }}>
                        <ThemedText type="small" style={{ color: colors.text }}>
                          💎 累積金幣：<ThemedText type="smallBold" style={{ color: colors.primary }}>{fam.points} 點</ThemedText>
                        </ThemedText>
                        <ThemedText type="small" style={{ color: colors.text }}>
                          🔥 自律 Streak：<ThemedText type="smallBold" style={{ color: colors.warning }}>{fam.streak} 天</ThemedText>
                        </ThemedText>
                      </View>

                      {/* 贈送與修改操作區 */}
                      <View style={styles.actionRow}>
                        {/* 手動加減點數 */}
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          <TouchableOpacity 
                            style={[styles.pointsBtn, { borderColor: colors.border }]}
                            onPress={() => handleModifyPoints(fam._id, fam.childName, -50)}
                          >
                            <ThemedText style={{ color: colors.critical, fontSize: 11 }} type="smallBold">-50</ThemedText>
                          </TouchableOpacity>

                          <TouchableOpacity 
                            style={[styles.pointsBtn, { borderColor: colors.border }]}
                            onPress={() => handleModifyPoints(fam._id, fam.childName, 100)}
                          >
                            <ThemedText style={{ color: colors.success, fontSize: 11 }} type="smallBold">+100</ThemedText>
                          </TouchableOpacity>
                        </View>

                        {/* 開通會員 */}
                        {!isProFamily ? (
                          <TouchableOpacity 
                            style={[styles.proGiftBtn, { backgroundColor: '#F59E0B' }]}
                            onPress={() => handleGiftPro(fam._id, fam.childName)}
                          >
                            <ThemedText themeColor="background" style={{ fontSize: 11 }} type="smallBold">
                              👑 贈送30天 Pro
                            </ThemedText>
                          </TouchableOpacity>
                        ) : (
                          <View style={{ paddingHorizontal: 10, paddingVertical: 4 }}>
                            <ThemedText style={{ color: colors.success, fontSize: 11 }} type="smallBold">✓ 已開通 (剩餘29天)</ThemedText>
                          </View>
                        )}
                      </View>
                    </ThemedView>
                  );
                })
              )}
            </View>
          )}

          {/* ==================== SUB-TAB 2: AI 品管佇列 ==================== */}
          {adminTab === 'questionQuality' && (
            <View style={styles.tabContent}>
              <View style={[styles.alertHeaderCard, { backgroundColor: colors.critical + '15', borderColor: colors.critical }]}>
                <ThemedText style={{ color: colors.critical }} type="smallBold">
                  🚨 AI 素養題目品質警告佇列
                </ThemedText>
                <ThemedText type="small" style={{ color: colors.textSecondary, marginTop: 4, fontSize: 11, lineHeight: 15 }}>
                  當學生在答題時覺得題目有瑕疵、點擊「舉報」後，系統會將題目送入此處。
                  當題目的 **報錯率大於等於 5%** 時，營運後台將爆出紅字警示！營運人員可「一鍵移入黑名單」，防止瑕疵題目被派發給其他孩子。
                </ThemedText>
              </View>

              {reportedQuestions.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <ThemedText style={{ color: colors.success, textAlign: 'center' }}>
                    🎉 題目品質極佳！目前沒有任何題目報錯率超標！
                  </ThemedText>
                </View>
              ) : (
                reportedQuestions.map((q) => (
                  <ThemedView key={q._id} type="backgroundElement" style={[styles.familyCard, { borderColor: colors.critical, borderWidth: 1.5 }]}>
                    <View style={styles.familyHeader}>
                      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                        <View style={[styles.subBadge, { backgroundColor: colors.primary + '15' }]}>
                          <ThemedText style={{ color: colors.primary, fontSize: 10 }} type="smallBold">{q.subject}</ThemedText>
                        </View>
                        <ThemedText style={{ color: colors.textSecondary, fontSize: 11 }} type="small">
                          {q.grade}年級 - {q.edition}
                        </ThemedText>
                      </View>

                      <View style={{ backgroundColor: colors.critical + '22', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                        <ThemedText style={{ color: colors.critical, fontSize: 10 }} type="smallBold">
                          🚨 報錯率：{q.errorRate}%
                        </ThemedText>
                      </View>
                    </View>

                    {/* 答題與報錯數據 */}
                    <ThemedText type="small" style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4 }}>
                      數據指標：答題總次數 {q.attemptsCount} 次 | 被報錯 {q.reportCount} 次
                    </ThemedText>

                    {/* 題幹 */}
                    <ThemedText style={{ color: colors.text, marginVertical: 6 }} type="smallBold">
                      {q.q}
                    </ThemedText>

                    {/* 有爭議的解析 */}
                    <View style={{ backgroundColor: colors.backgroundSelected + '22', padding: 8, borderRadius: 8, gap: 4 }}>
                      <ThemedText style={{ color: colors.text, fontSize: 11 }} type="small">
                        💡 <ThemedText type="smallBold" style={{ color: colors.primary }}>報錯原因與爭議點</ThemedText>：
                      </ThemedText>
                      <ThemedText style={{ color: colors.textSecondary, fontSize: 11, fontStyle: 'italic' }} type="small">
                        {q.exp}
                      </ThemedText>
                    </View>

                    {/* 一鍵品管黑名單 */}
                    <TouchableOpacity 
                      style={[styles.blacklistBtn, { backgroundColor: colors.critical }]}
                      onPress={() => handleBlacklistQuestion(q._id)}
                    >
                      <ThemedText themeColor="background" type="smallBold" style={{ fontSize: 12 }}>
                        ⛔ 一鍵移入出題黑名單 (全站遮蔽)
                      </ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                ))
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
  emptyContainer: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
  familyCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.two,
    marginBottom: 4,
  },
  familyHeader: {
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
  subBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  pointsBtn: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  proGiftBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  alertHeaderCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: Spacing.three,
  },
  blacklistBtn: {
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
  }
});
