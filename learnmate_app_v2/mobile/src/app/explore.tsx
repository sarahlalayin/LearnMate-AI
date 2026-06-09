import React, { useState } from 'react';
import { 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  View, 
  TextInput, 
  Linking, 
  Dimensions, 
  Platform,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { PaywallModal } from '@/components/paywall-modal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 預設模擬獎勵清單
const INITIAL_REWARDS = [
  { id: 'r1', name: '玩 Switch 30分鐘', icon: '🎮', cost: 100, status: 'ready', type: 'parent' },
  { id: 'r2', name: '看卡通一集', icon: '📺', cost: 50, status: 'ready', type: 'parent' },
  { id: 'r3', name: '週末去公園踢球', icon: '⚽', cost: 300, status: 'ready', type: 'parent' },
  { id: 'r4', name: '買樂高小積木一組', icon: '🧩', cost: 500, status: 'ready', type: 'parent' }
];

// 預設模擬 AI 影片推薦清單
const MOCK_VIDEOS = [
  {
    id: 'v1',
    title: '小學五年級 英語 康軒版 L3 現在進行式精華教學',
    channel: '國小英語特攻隊 🚀',
    duration: '8 分 15 秒',
    url: 'https://www.youtube.com/results?search_query=小學+五年級+英語+現在進行式',
    reason: '因為你最近在【現在進行式】的隨堂測驗中卡住了，這部 8 分鐘的短片有非常易懂的文法說明喔！',
    subject: '英語'
  },
  {
    id: 'v2',
    title: '小學五年級 數學 康軒版 時間與分數乘法換算',
    channel: '均一教育中心 🎓',
    duration: '12 分 30 秒',
    url: 'https://www.youtube.com/results?search_query=小學+五年級+數學+時間換算',
    reason: '這是你上週有錯題的知識點，花 10 分鐘看一下，段考就能輕鬆過關！',
    subject: '數學'
  }
];

// 預設模擬錯題本數據 (D1.2)
const MOCK_ERROR_LOGS = [
  {
    id: 'e1',
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
    id: 'e2',
    subject: '英語',
    grade: '6',
    topic: '現在進行式',
    q: 'What are you doing? I ___ reading a book.',
    opts: ["am", "is", "are", "be"],
    a: 0,
    userAnswer: 1, // 錯答成 is
    exp: '主詞為 I，Be動詞應配 am。',
    incorrectCount: 1
  }
];

export default function TabTwoScreen() {
  const { colors, gradeTheme } = useTheme();
  
  // 分段選擇狀態 (rewards: 收藏與許願, videos: 影片推薦, errorLog: 智能錯題本)
  const [activeTab, setActiveTab] = useState<'rewards' | 'videos' | 'errorLog'>('rewards');
  
  // Pro 訂閱狀態 (Phase C)
  const [isPro, setIsPro] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [errorLogs, setErrorLogs] = useState(MOCK_ERROR_LOGS);
  
  // 點數與獎勵狀態
  const [points, setPoints] = useState(320);
  const [rewards, setRewards] = useState(INITIAL_REWARDS);
  const [claimRequests, setClaimRequests] = useState<{ [key: string]: boolean }>({});
  
  // 許願池輸入狀態
  const [wishName, setWishName] = useState('');
  const [wishEmoji, setWishEmoji] = useState('🎁');

  // 申請兌換獎勵
  const handleClaimReward = (id: string, name: string, cost: number) => {
    if (points < cost) {
      if (Platform.OS === 'web') {
        alert(`❌ 點數不足！兌換【${name}】需要 ${cost} 點，你目前只有 ${points} 點。繼續做題賺點數吧！`);
      } else {
        Alert.alert('點數不足 ⚠️', `兌換【${name}】需要 ${cost} 點，你目前只有 ${points} 點。繼續做題賺點數吧！`);
      }
      return;
    }

    // 扣除點數，並標記申請狀態為「審核中」
    setPoints(p => p - cost);
    setClaimRequests(prev => ({ ...prev, [id]: true }));
    
    if (Platform.OS === 'web') {
      alert(`🎉 申請兌換成功！已扣除 ${cost} 點。請提醒爸爸媽媽幫你核准【${name}】喔！`);
    } else {
      Alert.alert('申請成功 ✉️', `已扣除 ${cost} 點。請提醒爸爸媽媽幫你核准【${name}】喔！`);
    }
  };

  // 學生發送許願 (PRD 6.6: Wishlist/Propose)
  const handleProposeWish = () => {
    if (!wishName.trim()) {
      if (Platform.OS === 'web') alert('❌ 請輸入你想許願的獎勵名稱喔！');
      else Alert.alert('提示 💡', '請輸入你想許願的獎勵名稱喔！');
      return;
    }

    const newWish = {
      id: `w_${Date.now()}`,
      name: wishName,
      icon: wishEmoji,
      cost: 0, // 價格由家長後續核准時設定 (BUG-08修復邏輯)
      status: 'proposed',
      type: 'student'
    };

    setRewards(prev => [newWish, ...prev]);
    setWishName('');
    
    if (Platform.OS === 'web') {
      alert(`✨ 許願送出成功！【${wishEmoji} ${wishName}】已送至家長審核面板。等爸媽設定點數後就會上架囉！`);
    } else {
      Alert.alert('許願成功 🌟', `【${wishEmoji} ${wishName}】已送至家長審核面板。等爸媽設定點數後就會上架囉！`);
    }
  };

  // 打開教學影片 (YouTube 搜尋連結)
  const handleOpenVideo = (url: string) => {
    Linking.openURL(url).catch(() => {
      if (Platform.OS === 'web') alert('無法開啟影片連結');
    });
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        
        {/* ── 頂部區段切換器 Tab Bar (PRD 6.6 Segment) ───────────────── */}
        <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
          <TouchableOpacity 
            style={[
              styles.tabItem, 
              activeTab === 'rewards' && { borderBottomColor: colors.primary }
            ]}
            onPress={() => setActiveTab('rewards')}
          >
            <ThemedText 
              style={{ color: activeTab === 'rewards' ? colors.primary : colors.textSecondary }}
              type="smallBold"
            >
              💎 我的收藏與許願
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.tabItem, 
              activeTab === 'videos' && { borderBottomColor: colors.primary }
            ]}
            onPress={() => setActiveTab('videos')}
          >
            <ThemedText 
              style={{ color: activeTab === 'videos' ? colors.primary : colors.textSecondary }}
              type="smallBold"
            >
              📺 影音推薦基地
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.tabItem, 
              activeTab === 'errorLog' && { borderBottomColor: colors.primary }
            ]}
            onPress={() => setActiveTab('errorLog')}
          >
            <ThemedText 
              style={{ color: activeTab === 'errorLog' ? colors.primary : colors.textSecondary }}
              type="smallBold"
            >
              ❌ 智能錯題本
            </ThemedText>
          </TouchableOpacity>
        </View>

        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          
          {/* ─── TAB ONE: 我的收藏與許願 ─────────────────────────────── */}
          {activeTab === 'rewards' && (
            <View style={styles.tabContent}>
              {/* 點數錢包顯示板 */}
              <ThemedView type="backgroundElement" style={[styles.walletCard, { borderColor: colors.border }]}>
                <ThemedText type="small" style={{ color: colors.textSecondary }}>當前自律總金幣</ThemedText>
                <ThemedText type="title" style={[styles.walletPoints, { color: colors.warning }]}>
                  💎 {points} <ThemedText type="smallBold" style={{ color: colors.textSecondary }}>點</ThemedText>
                </ThemedText>
                <View style={styles.walletDetails}>
                  <ThemedText type="small" style={{ color: colors.textSecondary }}>
                    完成今日任務或加強題，累積更多金幣兌換爸媽準備的驚喜吧！ 🎁
                  </CalculatedText>
                </View>
              </ThemedView>

              {/* 兌換獎勵列表 */}
              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle} type="smallBold">
                  點數兌換商店
                </ThemedText>

                {rewards.map((r) => {
                  const isProposed = r.status === 'proposed';
                  const isClaimed = claimRequests[r.id];
                  
                  return (
                    <ThemedView 
                      key={r.id} 
                      type="backgroundElement" 
                      style={[
                        styles.rewardCard, 
                        { 
                          borderColor: isProposed ? colors.primary + '33' : colors.border,
                          borderStyle: isProposed ? 'dashed' : 'solid'
                        }
                      ]}
                    >
                      <View style={styles.rewardCardLeft}>
                        <View style={[styles.iconBox, { backgroundColor: colors.backgroundSelected }]}>
                          <ThemedText style={{ fontSize: 24 }}>{r.icon}</ThemedText>
                        </View>
                        <View style={styles.rewardDetails}>
                          <ThemedText style={{ color: colors.text }} type="smallBold">
                            {r.name}
                          </ThemedText>
                          <ThemedText style={{ color: colors.textSecondary }} type="small">
                            {isProposed ? '🎁 許願中（等待爸媽訂定價格）' : `價格：${r.cost} 點`}
                          </ThemedText>
                        </View>
                      </View>

                      <View style={styles.rewardCardRight}>
                        {isProposed ? (
                          <View style={[styles.statusBadge, { backgroundColor: colors.primary + '15' }]}>
                            <ThemedText style={{ color: colors.primary }} type="smallBold">許願中</ThemedText>
                          </View>
                        ) : isClaimed ? (
                          <View style={[styles.statusBadge, { backgroundColor: colors.warning + '15' }]}>
                            <ThemedText style={{ color: colors.warning }} type="smallBold">審核中 ⏳</ThemedText>
                          </View>
                        ) : (
                          <TouchableOpacity 
                            style={[styles.claimBtn, { backgroundColor: colors.primary }]}
                            onPress={() => handleClaimReward(r.id, r.name, r.cost)}
                          >
                            <ThemedText themeColor="background" type="smallBold">兌換</ThemedText>
                          </TouchableOpacity>
                        )}
                      </View>
                    </ThemedView>
                  );
                })}
              </View>

              {/* 獎勵許願池 Form (PRD 6.6: Wishlist Input) */}
              <ThemedView type="backgroundElement" style={[styles.wishFormCard, { borderColor: colors.border }]}>
                <ThemedText style={styles.wishFormTitle} type="smallBold">
                  🌟 獎勵許願池（向爸媽許願吧！）
                </ThemedText>
                <ThemedText style={styles.wishFormSubtitle} type="small">
                  想要其他的獎勵嗎？寫下你想得到的東西並加上一個 Emoji 貼圖送出許願吧！
                </ThemedText>

                <View style={styles.formRow}>
                  {/* Emoji 簡易選擇器 */}
                  <View style={styles.emojiPickerContainer}>
                    {['🎁', '🍔', '🧸', '🎬', '🍦'].map(em => (
                      <TouchableOpacity 
                        key={em}
                        style={[
                          styles.emojiBtn,
                          wishEmoji === em && { backgroundColor: colors.primary + '22', borderColor: colors.primary }
                        ]}
                        onPress={() => setWishEmoji(em)}
                      >
                        <ThemedText style={{ fontSize: 18 }}>{em}</ThemedText>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* 許願名稱輸入框 */}
                <TextInput
                  style={[
                    styles.inputField, 
                    { 
                      borderColor: colors.border, 
                      color: colors.text,
                      backgroundColor: colors.backgroundSelected + '44'
                    }
                  ]}
                  placeholder="輸入你想要的獎勵名稱，例如：去吃麥當勞"
                  placeholderTextColor={colors.textSecondary}
                  value={wishName}
                  onChangeText={setWishName}
                />

                <TouchableOpacity 
                  style={[styles.submitWishBtn, { backgroundColor: colors.primary }]}
                  onPress={handleProposeWish}
                >
                  <ThemedText themeColor="background" type="smallBold">🚀 送出許願申請</ThemedText>
                </TouchableOpacity>
              </ThemedView>
            </View>
          )}

          {/* ─── TAB TWO: AI 影音推薦基地 ─────────────────────────────── */}
          {activeTab === 'videos' && (
            <View style={styles.tabContent}>
              
              {/* AI 影片推薦說明 */}
              <View style={[styles.recommendBubble, { backgroundColor: colors.backgroundSelected }]}>
                <ThemedText type="small" style={{ color: colors.text }}>
                  📺 <ThemedText type="smallBold" style={{ color: colors.primary }}>AI 影片精選推薦</ThemedText>
                  {'\n'}這是系統針對你最近答題「較不熟悉」的科目所精選的 108 課綱影片。看完後重新挑戰，你的正確率與點數將會飛快增加喔！
                </ThemedText>
              </View>

              {/* 影片列表 */}
              <View style={styles.section}>
                {MOCK_VIDEOS.map((v) => (
                  <ThemedView 
                    key={v.id} 
                    type="backgroundElement" 
                    style={[styles.videoCard, { borderColor: colors.border }]}
                  >
                    {/* 影片 Mock 縮圖卡 (素雅漸變發光質感) */}
                    <TouchableOpacity 
                      activeOpacity={0.8}
                      style={[styles.videoThumbnail, { backgroundColor: colors.primary + '22' }]}
                      onPress={() => handleOpenVideo(v.url)}
                    >
                      <View style={styles.playIconCircle}>
                        <ThemedText style={{ fontSize: 24, marginLeft: 4 }}>▶</ThemedText>
                      </View>
                      <View style={styles.durationBadge}>
                        <ThemedText style={styles.durationText} type="smallBold">{v.duration}</ThemedText>
                      </View>
                    </TouchableOpacity>

                    {/* 影片描述詳情 */}
                    <View style={styles.videoDetails}>
                      <View style={styles.videoHeaderRow}>
                        <View style={[styles.subjectPill, { backgroundColor: colors.primary + '15' }]}>
                          <ThemedText style={{ color: colors.primary, fontSize: 10 }} type="smallBold">{v.subject}</ThemedText>
                        </View>
                        <ThemedText style={[styles.channelText, { color: colors.textSecondary }]} type="small">
                          {v.channel}
                        </ThemedText>
                      </View>
                      
                      <ThemedText style={[styles.videoTitle, { color: colors.text }]} type="smallBold">
                        {v.title}
                      </ThemedText>

                      {/* AI 推薦理由 (PRD 6.5: Precise push reasons) */}
                      <View style={[styles.reasonBox, { backgroundColor: colors.backgroundSelected }]}>
                        <ThemedText style={[styles.reasonText, { color: colors.textSecondary }]} type="small">
                          💡 {v.reason}
                        </ThemedText>
                      </View>

                      <TouchableOpacity 
                        style={[styles.watchBtn, { borderColor: colors.primary }]}
                        onPress={() => handleOpenVideo(v.url)}
                      >
                        <ThemedText style={{ color: colors.primary }} type="smallBold">
                          📺 前往 YouTube 收看影片
                        </ThemedText>
                      </TouchableOpacity>
                    </View>
                  </ThemedView>
                ))}
              </View>
            </View>
          )}

          {/* ─── TAB THREE: 智能錯題本 (Pro 專屬) ─────────────────────────────── */}
          {activeTab === 'errorLog' && (
            <View style={styles.tabContent}>
              {!isPro ? (
                /* 👑 奢華付費鎖屏 (Pro Freemium Gate) */
                <ThemedView type="backgroundElement" style={[styles.paywallGateCard, { borderColor: '#8B5CF6' }]}>
                  <ThemedText style={{ fontSize: 64, textAlign: 'center' }}>🔒</ThemedText>
                  <ThemedText style={[styles.paywallGateTitle, { color: '#8B5CF6' }]} type="subtitle">
                    智能錯題本 & AI 加強
                  </ThemedText>
                  <ThemedText style={styles.paywallGateSubtitle} type="small">
                    此功能為 Pro 會員專屬。解鎖後，系統將自動收集孩子在隨堂測驗中答錯的死穴題目，並支持家長端『一鍵智能派發 Gemini 3 題相似考點題』進行針對性複習加強！
                  </ThemedText>
                  <TouchableOpacity 
                    style={[styles.paywallGateBtn, { backgroundColor: '#8B5CF6' }]}
                    onPress={() => setShowPaywall(true)}
                  >
                    <ThemedText themeColor="background" type="smallBold">
                      👑 升級 Pro 解鎖大數據錯題本
                    </ThemedText>
                  </TouchableOpacity>
                </ThemedView>
              ) : (
                /* 📚 錯題本真實內容列表 */
                <View style={styles.section}>
                  <View style={[styles.recommendBubble, { backgroundColor: colors.backgroundSelected }]}>
                    <ThemedText type="small" style={{ color: colors.text }}>
                      ❌ <ThemedText type="smallBold" style={{ color: colors.primary }}>我的智能錯題本</ThemedText>
                      {'\n'}這裡自動收集了你答錯的題目。答錯越多次的『死穴題』會被排在越前面，請仔細看正確答案與溫馨解析，把不熟的觀念學會吧！
                    </ThemedText>
                  </View>

                  {errorLogs.map((error) => (
                    <ThemedView 
                      key={error.id} 
                      type="backgroundElement" 
                      style={[
                        styles.errorCard, 
                        { borderColor: error.incorrectCount >= 2 ? colors.critical : colors.border }
                      ]}
                    >
                      {/* 卡片頂部 */}
                      <View style={styles.errorCardHeader}>
                        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                          <View style={[styles.subjectPill, { backgroundColor: colors.primary + '15' }]}>
                            <ThemedText style={{ color: colors.primary, fontSize: 10 }} type="smallBold">
                              {error.subject}
                            </ThemedText>
                          </View>
                          <ThemedText style={{ color: colors.textSecondary, fontSize: 11 }} type="small">
                            單元：{error.topic}
                          </ThemedText>
                        </View>
                        
                        {/* 大數據死穴氣泡 */}
                        {error.incorrectCount >= 2 ? (
                          <View style={{ backgroundColor: colors.critical + '22', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                            <ThemedText style={{ color: colors.critical, fontSize: 10 }} type="smallBold">
                              🔥 重複卡關 {error.incorrectCount} 次 (死穴)
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

                      {/* 題幹 */}
                      <ThemedText style={[styles.errorQuestionText, { color: colors.text }]} type="smallBold">
                        {error.q}
                      </ThemedText>

                      {/* 選項列表 (特別高亮正確與孩子答錯) */}
                      <View style={{ gap: 6, marginVertical: 6 }}>
                        {error.opts.map((opt, optIndex) => {
                          const isCorrectOpt = optIndex === error.a;
                          const isUserWrongOpt = optIndex === error.userAnswer;
                          
                          return (
                            <View 
                              key={optIndex}
                              style={[
                                styles.optionRow,
                                {
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
                                  borderWidth: (isCorrectOpt || isUserWrongOpt) ? 1.5 : 1
                                }
                              ]}
                            >
                              <ThemedText style={{ 
                                color: isCorrectOpt 
                                  ? colors.success 
                                  : isUserWrongOpt 
                                    ? colors.critical 
                                    : colors.text,
                                flex: 1
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
                                  <ThemedText style={{ color: colors.critical, fontSize: 9 }} type="smallBold">🚨 你的錯答</ThemedText>
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>

                      {/* 解析 */}
                      <View style={[styles.reasonBox, { backgroundColor: colors.backgroundSelected }]}>
                        <ThemedText style={{ color: colors.text, fontSize: 12 }} type="small">
                          💡 <ThemedText type="smallBold" style={{ color: colors.primary }}>溫馨解析</ThemedText>：{error.exp}
                        </ThemedText>
                      </View>
                    </ThemedView>
                  ))}
                </View>
              )}
            </View>
          )}

          <PaywallModal 
            visible={showPaywall}
            onClose={() => setShowPaywall(false)}
            onUnlockSuccess={() => {
              setIsPro(true);
              setShowPaywall(false);
            }}
          />

        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    height: 48,
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  scrollContent: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  tabContent: {
    gap: Spacing.four,
  },
  walletCard: {
    borderRadius: 20,
    padding: Spacing.four,
    borderWidth: 1,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  walletPoints: {
    fontSize: 38,
    fontWeight: '800',
    marginVertical: 4,
  },
  walletDetails: {
    marginTop: 4,
    alignItems: 'center',
  },
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    fontSize: 14,
    marginBottom: 4,
  },
  rewardCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  rewardCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    flex: 1,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rewardDetails: {
    flex: 1,
    gap: 2,
  },
  rewardCardRight: {
    marginLeft: Spacing.two,
  },
  claimBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  wishFormCard: {
    borderRadius: 20,
    padding: Spacing.four,
    borderWidth: 1,
    gap: Spacing.three,
  },
  wishFormTitle: {
    fontSize: 14,
  },
  wishFormSubtitle: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: -8,
  },
  formRow: {
    gap: Spacing.two,
  },
  emojiPickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  emojiBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB33',
  },
  inputField: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.three,
    fontSize: 13,
  },
  submitWishBtn: {
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  recommendBubble: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    borderRadius: 12,
  },
  videoCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: Spacing.two,
  },
  videoThumbnail: {
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  playIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFFFFFCC',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 10,
  },
  videoDetails: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  videoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subjectPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  channelText: {
    fontSize: 11,
  },
  videoTitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  reasonBox: {
    padding: 8,
    borderRadius: 8,
  },
  reasonText: {
    fontSize: 11,
    lineHeight: 15,
  },
  watchBtn: {
    height: 38,
    borderRadius: 10,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  }
});
