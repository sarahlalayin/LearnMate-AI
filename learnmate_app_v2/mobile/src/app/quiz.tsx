import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  TouchableOpacity, 
  View, 
  Modal, 
  Dimensions, 
  Animated,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 模擬符合 108 課綱的素養導向測驗題目 (Gemini 生成之 Mock 考題)
const MOCK_QUIZ_QUESTIONS = [
  {
    question: "在英語中，當你想表達小明「目前正在看書」時，下列哪一個句子最正確？",
    options: ["A. Xiao Ming reads a book now.", "B. Xiao Ming reading a book.", "C. Xiao Ming is reading a book.", "D. Xiao Ming was read a book."],
    answer: "C",
    explanation: "正確答案是 C！因為「正在進行」的動作必須使用現在進行式，公式為：主詞 (Xiao Ming) + Be動詞 (is) + 動詞ing (reading)。\n\n- 選項 A 是現在簡單式，不適合配 now。\n- 選項 B 漏掉了 Be動詞 is。\n- 選項 D 文法錯誤。",
    knowledge_tag: "英語-現在進行式",
    difficulty: "standard"
  },
  {
    question: "如果小明每天花 20 分鐘練琴，連續練了 5 天。請問他總共練琴了多少小時多少分鐘？",
    options: ["A. 1 小時 20 分鐘", "B. 1 小時 40 分鐘", "C. 2 小時", "D. 100 小時"],
    answer: "B",
    explanation: "正確答案是 B！\n我們來算算看：每天 20 分鐘 × 5 天 = 100 分鐘。\n因為 1 小時 = 60 分鐘，所以 100 分鐘可以拆成 60 分鐘 (1小時) + 40 分鐘。總共就是 1 小時 40 分鐘！",
    knowledge_tag: "數學-時間換算",
    difficulty: "standard"
  },
  {
    question: "下列關於台灣黑熊的敘述，哪一項最符合自然觀察事實？",
    options: ["A. 胸前有明顯的白色 V 字形斑紋", "B. 屬於草食性動物，只吃竹葉", "C. 冬天時會進入長達四個月的冬眠狀態", "D. 是台灣唯一的貓科保育動物"],
    answer: "A",
    explanation: "正確答案是 A！台灣黑熊最著名的特徵就是胸前有一圈白色的 V 字形（或稱新月形）斑紋喔！\n\n- 選項 B：黑熊是雜食性，也吃果實和肉。\n- 選項 C：台灣黑熊因為台灣冬天溫暖，並不會真正的冬眠。\n- 選項 D：黑熊是熊科，不是貓科。",
    knowledge_tag: "自然-台灣特有種",
    difficulty: "basic"
  }
];

export default function QuizScreen() {
  const router = useRouter();
  const { colors, gradeTheme } = useTheme();
  
  // 答題核心狀態
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOpt, setSelectedOpt] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  
  // 點數飛入動畫狀態 (Reanimated/Animated)
  const [flyAnim] = useState(new Animated.Value(0));
  const [showFlyText, setShowFlyText] = useState(false);
  
  // 求救 / Skip 彈窗狀態
  const [showSkipModal, setShowSkipModal] = useState(false);
  
  // 測驗結束彈窗狀態
  const [showCompleteModal, setShowCompleteModal] = useState(false);

  const currentQuestion = MOCK_QUIZ_QUESTIONS[currentIdx];

  // 答題選擇觸發
  const handleSelectOption = (optKey: string) => {
    if (isAnswered) return;
    setSelectedOpt(optKey);
    setIsAnswered(true);

    const correctLetter = currentQuestion.answer; // "A" | "B" | "C" | "D"
    const isCorrect = optKey === correctLetter;

    if (isCorrect) {
      setCorrectCount(c => c + 1);
      // 觸發 +2 點飛入動畫
      triggerPointAnimation();
    }
  };

  // +2 點數飛出微動畫 (Fly-up gaming effect)
  const triggerPointAnimation = () => {
    setShowFlyText(true);
    flyAnim.setValue(0);
    Animated.timing(flyAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true
    }).start(() => {
      setShowFlyText(false);
    });
  };

  // 前往下一題
  const handleNext = () => {
    if (currentIdx < MOCK_QUIZ_QUESTIONS.length - 1) {
      setCurrentIdx(i => i + 1);
      setSelectedOpt(null);
      setIsAnswered(false);
    } else {
      // 測驗全部完成
      setShowCompleteModal(true);
    }
  };

  // 確定暫停求助 (PRD 6.4: Skip reasons logic)
  const handleConfirmSkip = (reasonCode: string) => {
    setShowSkipModal(false);
    // 回到主畫面，在真實 API 中會觸發 /api/tasks/skip 發送 critical/warning 預警
    router.replace('/');
  };

  // 動態計算點數上升的平移動畫值
  const translateUp = flyAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -120]
  });

  const opacityOut = flyAnim.interpolate({
    inputRange: [0, 0.2, 0.8, 1],
    outputRange: [0, 1, 1, 0]
  });

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea}>
        
        {/* ── 頂部測驗 Header ─────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ThemedText style={{ color: colors.textSecondary }} type="smallBold">✕ 離開</ThemedText>
          </TouchableOpacity>

          <View style={styles.progressInfo}>
            <ThemedText type="smallBold" style={{ color: colors.text }}>
              AI 練習基地
            </ThemedText>
            <ThemedText type="small" style={{ color: colors.textSecondary }}>
              第 {currentIdx + 1} / {MOCK_QUIZ_QUESTIONS.length} 題
            </ThemedText>
          </View>

          {/* 難度適應標章 (PRD 6.3: difficulty adaptive badge) */}
          <View style={[styles.difficultyBadge, { backgroundColor: colors.primary + '15' }]}>
            <ThemedText style={[styles.difficultyText, { color: colors.primary }]} type="small">
              {currentQuestion.difficulty === 'basic' ? '🌟 基礎程度' : '✨ 標準程度'}
            </ThemedText>
          </View>
        </View>

        {/* ── 題目與選項 Scroll 視圖 ─────────────────────────────── */}
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* 知識點標籤 */}
          <View style={[styles.tagBadge, { backgroundColor: colors.backgroundSelected }]}>
            <ThemedText style={[styles.tagText, { color: colors.textSecondary }]} type="small">
              🔖 知識點：{currentQuestion.knowledge_tag}
            </ThemedText>
          </View>

          {/* 題目描述卡片 */}
          <ThemedView type="backgroundElement" style={[styles.questionCard, { borderColor: colors.border }]}>
            <ThemedText style={[styles.questionText, { color: colors.text }]} type="default">
              {currentQuestion.question}
            </ThemedText>
          </ThemedView>

          {/* 四選一選項列表 */}
          <View style={styles.optionsContainer}>
            {currentQuestion.options.map((optText, i) => {
              const optLetter = ["A", "B", "C", "D"][i];
              const isSelected = selectedOpt === optLetter;
              const isCorrectOpt = optLetter === currentQuestion.answer;
              
              // 動態邊框與背景色決定答題結果 (高保真視覺回饋)
              let borderStyle = colors.border;
              let bgStyle = 'transparent';
              
              if (isAnswered) {
                if (isCorrectOpt) {
                  // 答對的選項亮綠色
                  borderStyle = colors.success;
                  bgStyle = colors.success + '15';
                } else if (isSelected) {
                  // 選錯的選項亮紅色
                  borderStyle = colors.critical;
                  bgStyle = colors.critical + '15';
                }
              } else if (isSelected) {
                borderStyle = colors.primary;
              }

              return (
                <TouchableOpacity 
                  key={optLetter}
                  activeOpacity={0.8}
                  style={[
                    styles.optionCard, 
                    { 
                      borderColor: borderStyle,
                      backgroundColor: bgStyle
                    }
                  ]}
                  onPress={() => handleSelectOption(optLetter)}
                >
                  <View style={[
                    styles.optionCircle, 
                    { 
                      borderColor: isSelected ? colors.primary : colors.border,
                      backgroundColor: isSelected ? colors.primary : 'transparent'
                    }
                  ]}>
                    <ThemedText style={{ color: isSelected ? '#FFFFFF' : colors.textSecondary }} type="smallBold">
                      {optLetter}
                    </ThemedText>
                  </View>
                  <ThemedText style={[styles.optionText, { color: colors.text }]} type="small">
                    {optText.substring(3)}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── 答題解析與回饋板 (PRD 6.3: AI Explanation Card) ───────────────── */}
          {isAnswered && (
            <ThemedView type="backgroundElement" style={[styles.explanationCard, { borderColor: colors.border }]}>
              <View style={[
                styles.feedbackBanner, 
                { backgroundColor: selectedOpt === currentQuestion.answer ? colors.success + '22' : colors.critical + '22' }
              ]}>
                <ThemedText style={{ color: selectedOpt === currentQuestion.answer ? colors.success : colors.critical }} type="smallBold">
                  {selectedOpt === currentQuestion.answer 
                    ? '🎉 答對了！你太厲害了！ +2 💎' 
                    : '沒關係，我們一起來看看解析！ 💪'
                  }
                </ThemedText>
              </View>

              <ThemedText style={[styles.explanationTitle, { color: colors.text }]} type="smallBold">
                💡 題目詳解：
              </ThemedText>
              <ThemedText style={[styles.explanationText, { color: colors.textSecondary }]} type="small">
                {currentQuestion.explanation}
              </ThemedText>
            </ThemedView>
          )}
        </ScrollView>

        {/* ── 點數飛入浮動動畫元素 (Fly-up +2 Point popup) ───────────────── */}
        {showFlyText && (
          <Animated.View style={[
            styles.flyTextContainer,
            {
              transform: [{ translateY: translateUp }],
              opacity: opacityOut
            }
          ]}>
            <ThemedText style={styles.flyText} type="subtitle">💎 +2 點</ThemedText>
          </Animated.View>
        )}

        {/* ── 底部導航按鈕列 (暫停與下一題) ─────────────────────────────── */}
        <ThemedView type="backgroundElement" style={[styles.footer, { borderTopColor: colors.border }]}>
          {/* 當未完成答題時，可選擇求救暫停 (PRD 6.4 Skip mechanism) */}
          {!isAnswered ? (
            <TouchableOpacity 
              style={[styles.skipButton, { borderColor: colors.border }]} 
              onPress={() => setShowSkipModal(true)}
            >
              <ThemedText style={{ color: colors.textSecondary }} type="small">暫停求助 💬</ThemedText>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 80 }} /> // 排版佔位
          )}

          {isAnswered && (
            <TouchableOpacity 
              style={[styles.nextButton, { backgroundColor: colors.primary }]}
              onPress={handleNext}
            >
              <ThemedText themeColor="background" type="smallBold">
                {currentIdx < MOCK_QUIZ_QUESTIONS.length - 1 ? '下一題 ➡️' : '完成測驗 🎉'}
              </ThemedText>
            </TouchableOpacity>
          )}
        </ThemedView>

        {/* ── 彈窗一：暫停求救原因選擇 (PRD 6.4 Skip Modal) ──────────────── */}
        <Modal
          visible={showSkipModal}
          transparent={true}
          animationType="fade"
        >
          <View style={styles.modalOverlay}>
            <ThemedView type="backgroundElement" style={styles.skipModalContent}>
              <ThemedText style={styles.skipTitle} type="smallBold">
                想先休息一下嗎？請選擇暫停原因：
              </ThemedText>
              <ThemedText style={styles.skipSubtitle} type="small">
                * 暫停這科將扣除 <ThemedText type="smallBold" style={{ color: colors.critical }}>5 點</ThemedText> 點數作為代價喔
              </ThemedText>

              <View style={styles.skipButtonsContainer}>
                <TouchableOpacity 
                  style={[styles.skipReasonBtn, { backgroundColor: colors.backgroundSelected }]}
                  onPress={() => handleConfirmSkip('too_busy')}
                >
                  <ThemedText type="small" style={{ color: colors.text }}>📚 今天學校其他功課太多了</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.skipReasonBtn, { backgroundColor: colors.backgroundSelected }]}
                  onPress={() => handleConfirmSkip('not_feeling_well')}
                >
                  <ThemedText type="small" style={{ color: colors.text }}>🤒 身體不舒服，想先休息</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.skipReasonBtn, { backgroundColor: colors.critical + '15', borderColor: colors.critical, borderWidth: 1 }]}
                  onPress={() => handleConfirmSkip('cannot_understand')}
                >
                  <ThemedText type="small" style={{ color: colors.critical }}>🚨 這個科目我看不懂，需要爸媽幫忙解釋</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.skipReasonBtn, { backgroundColor: colors.backgroundSelected }]}
                  onPress={() => handleConfirmSkip('too_tired')}
                >
                  <ThemedText type="small" style={{ color: colors.text }}>💤 今天太累了，明天再補上</ThemedText>
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={styles.cancelSkipBtn}
                onPress={() => setShowSkipModal(false)}
              >
                <ThemedText style={{ color: colors.textSecondary }} type="smallBold">返回繼續挑戰 💪</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </View>
        </Modal>

        {/* ── 彈窗二：測驗完全完成賀卡 (Completion Modal) ──────────────── */}
        <Modal
          visible={showCompleteModal}
          transparent={true}
          animationType="slide"
        >
          <View style={styles.modalOverlay}>
            <ThemedView type="backgroundElement" style={styles.completeModalContent}>
              <ThemedText style={styles.trophyIcon} type="subtitle">🏆</ThemedText>
              
              <ThemedText style={styles.completeTitle} type="subtitle">
                太棒了！測驗全數完成！
              </ThemedText>
              
              <View style={styles.scoreRow}>
                <ThemedText type="smallBold" style={{ color: colors.text }}>本節答對題數：</ThemedText>
                <ThemedText type="smallBold" style={{ color: colors.primary }}>
                  {correctCount} / {MOCK_QUIZ_QUESTIONS.length} 題
                </ThemedText>
              </View>

              <View style={[styles.rewardBox, { backgroundColor: colors.success + '15' }]}>
                <ThemedText style={{ color: colors.success }} type="smallBold">
                  💰 完成加成獎勵： +10 點！
                </ThemedText>
              </View>

              <TouchableOpacity 
                style={[styles.finishBtn, { backgroundColor: colors.primary }]}
                onPress={() => {
                  setShowCompleteModal(false);
                  router.replace('/');
                }}
              >
                <ThemedText themeColor="background" type="smallBold">收下獎勵並返回基地 🏠</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </View>
        </Modal>

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
  backButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  progressInfo: {
    alignItems: 'center',
    gap: 1,
  },
  difficultyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  difficultyText: {
    fontSize: 10,
    fontWeight: '700',
  },
  scrollContent: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  tagBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  questionCard: {
    padding: Spacing.four,
    borderRadius: 16,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  questionText: {
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '700',
  },
  optionsContainer: {
    gap: Spacing.two,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: Spacing.two,
  },
  optionCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  explanationCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.three,
    gap: 6,
    overflow: 'hidden',
    marginTop: 6,
  },
  feedbackBanner: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 4,
  },
  explanationTitle: {
    fontSize: 13,
  },
  explanationText: {
    fontSize: 13,
    lineHeight: 18,
  },
  flyTextContainer: {
    position: 'absolute',
    left: SCREEN_WIDTH / 2 - 60,
    bottom: 220,
    width: 120,
    alignItems: 'center',
    pointerEvents: 'none',
  },
  flyText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F59E0B',
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 1, height: 1.5 },
    textShadowRadius: 2,
  },
  footer: {
    borderTopWidth: 1,
    padding: Spacing.three,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skipButton: {
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  nextButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  skipModalContent: {
    width: '100%',
    borderRadius: 20,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  skipTitle: {
    fontSize: 15,
    textAlign: 'center',
  },
  skipSubtitle: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: -8,
  },
  skipButtonsContainer: {
    gap: Spacing.two,
  },
  skipReasonBtn: {
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  cancelSkipBtn: {
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
  },
  completeModalContent: {
    width: '100%',
    borderRadius: 24,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
  },
  trophyIcon: {
    fontSize: 48,
    lineHeight: 52,
  },
  completeTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  scoreRow: {
    flexDirection: 'row',
    gap: 4,
  },
  rewardBox: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 10,
  },
  finishBtn: {
    height: 48,
    borderRadius: 12,
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  }
});
