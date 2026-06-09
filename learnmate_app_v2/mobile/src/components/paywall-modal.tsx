import React, { useState } from 'react';
import { 
  Modal, 
  StyleSheet, 
  View, 
  TouchableOpacity, 
  Platform, 
  Alert,
  ScrollView
} from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  onUnlockSuccess: () => void;
}

export function PaywallModal({ visible, onClose, onUnlockSuccess }: PaywallModalProps) {
  const { colors } = useTheme();
  const [isUnlocking, setIsUnlocking] = useState(false);

  // 一鍵模擬解鎖 Pro (C3)
  const handleMockUnlock = async () => {
    setIsUnlocking(true);
    try {
      // 嘗試對接本地後端 Express API
      const response = await fetch('http://localhost:5000/api/billing/mock-unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyId: '507f1f77bcf86cd799439011' }) // 模擬固定 familyId
      });
      const data = await response.json();
      if (data.success) {
        setIsUnlocking(false);
        onUnlockSuccess();
        if (Platform.OS === 'web') {
          alert('💎 【沙盒解鎖】恭喜您！成功一鍵開啟 Pro 特權！AI無限生題、習慣模組已解鎖！');
        } else {
          Alert.alert('解鎖成功 💎', '【沙盒解鎖】恭喜您！成功一鍵開啟 Pro 特權！AI無限生題、習慣模組已解鎖！');
        }
        return;
      }
    } catch (e) {
      console.log('連線伺服器失敗，使用純前端本地沙盒解鎖 Pro 權限');
    }

    // 後端未連線時的純前端 Mock 解鎖
    setTimeout(() => {
      setIsUnlocking(false);
      onUnlockSuccess();
      if (Platform.OS === 'web') {
        alert('💎 【前端沙盒解鎖】恭喜！本地 Pro 特權已解鎖！');
      } else {
        Alert.alert('解鎖成功 💎', '【前端沙盒解鎖】恭喜！本地 Pro 特權已解鎖！');
      }
    }, 1000);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <ThemedView type="backgroundElement" style={[styles.modalContent, { borderColor: colors.primary }]}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* 👑 奢華標頭 */}
            <View style={styles.crownHeader}>
              <ThemedText style={styles.crownEmoji}>👑</ThemedText>
              <ThemedText style={[styles.title, { color: colors.primary }]} type="subtitle">
                LearnMate AI Pro 會員
              </ThemedText>
              <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]} type="small">
                解鎖最適合台灣學童的自律自適應學習神助攻！
              </ThemedText>
            </View>

            {/* 🌟 4大專屬 Pro 賣點 (PRD Freemium 套裝) */}
            <View style={styles.featureGrid}>
              <View style={[styles.featureCard, { backgroundColor: colors.backgroundSelected }]}>
                <ThemedText style={styles.featureIcon}>🤖</ThemedText>
                <View style={{ flex: 1 }}>
                  <ThemedText type="smallBold">Gemini AI 無限智慧出題</ThemedText>
                  <ThemedText type="small" style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>
                    完美契合 108 課綱南一/康軒/翰林版本隨堂考
                  </ThemedText>
                </View>
              </View>

              <View style={[styles.featureCard, { backgroundColor: colors.backgroundSelected }]}>
                <ThemedText style={styles.featureIcon}>🏃</ThemedText>
                <View style={{ flex: 1 }}>
                  <ThemedText type="smallBold">自律習慣打卡模組</ThemedText>
                  <ThemedText type="small" style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>
                    非學科學琴、慢跑、閱讀時長自評與雙向激勵
                  </ThemedText>
                </View>
              </View>

              <View style={[styles.featureCard, { backgroundColor: colors.backgroundSelected }]}>
                <ThemedText style={styles.featureIcon}>📊</ThemedText>
                <View style={{ flex: 1 }}>
                  <ThemedText type="smallBold">弱項錯題收集與雷達圖</ThemedText>
                  <ThemedText type="small" style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>
                    大數據分析弱點，AI 自動為孩子推動錯題加強題
                  </ThemedText>
                </View>
              </View>

              <View style={[styles.featureCard, { backgroundColor: colors.backgroundSelected }]}>
                <ThemedText style={styles.featureIcon}>✉️</ThemedText>
                <View style={{ flex: 1 }}>
                  <ThemedText type="smallBold">AI 家長預警與陪伴應對</ThemedText>
                  <ThemedText type="small" style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>
                    陪伴大於監控！學習卡關預警搭配暖心應對金句
                  </ThemedText>
                </View>
              </View>
            </View>

            {/* 🏷️ 定價說明 */}
            <View style={styles.pricingSection}>
              <View style={[styles.trialBadge, { backgroundColor: colors.primary + '22' }]}>
                <ThemedText style={{ color: colors.primary }} type="smallBold">14天免費試用</ThemedText>
              </View>
              <ThemedText type="subtitle" style={{ fontSize: 24, fontWeight: '800', marginTop: 4 }}>
                NT$150 / 月
              </ThemedText>
              <ThemedText type="small" style={{ color: colors.textSecondary, fontSize: 11 }}>
                試用到期前 3 天自動推播通知，隨時可一鍵退訂
              </ThemedText>
            </View>

            {/* 🚀 真實付費按鈕 (本地模擬展示) */}
            <TouchableOpacity 
              style={[styles.payButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                if (Platform.OS === 'web') alert('💳 真實 RevenueCat 金流在 Phase G 之前處於模擬測試中，請點擊下方「測試：模擬解鎖」解鎖 Pro！');
                else Alert.alert('金流測試 💳', '真實金流在 Phase G 之前處於預留聯調中，請使用下方「本地測試：一鍵模擬解鎖 Pro」進行開發調試！');
              }}
            >
              <ThemedText themeColor="background" type="smallBold">✨ 啟動 14 天免費試用</ThemedText>
            </TouchableOpacity>

            {/* 🛠️ 零成本測試：一鍵模擬解鎖 Pro 按鈕 */}
            <TouchableOpacity 
              style={[styles.mockButton, { borderColor: colors.success }]}
              onPress={handleMockUnlock}
              disabled={isUnlocking}
            >
              <ThemedText style={{ color: colors.success }} type="smallBold">
                {isUnlocking ? '🤖 正在向本地後端申請解鎖...' : '🛠️ 本地開發測試：一鍵模擬解鎖 Pro'}
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <ThemedText style={{ color: colors.textSecondary }} type="small">返回</ThemedText>
            </TouchableOpacity>
          </ScrollView>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: '#00000088',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  modalContent: {
    borderRadius: 24,
    borderWidth: 2,
    padding: Spacing.four,
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  scrollContent: {
    alignItems: 'center',
    gap: Spacing.three,
  },
  crownHeader: {
    alignItems: 'center',
    gap: 4,
    textAlign: 'center',
    marginBottom: 8,
  },
  crownEmoji: {
    fontSize: 48,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: Spacing.two,
  },
  featureGrid: {
    width: '100%',
    gap: 8,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: 10,
    borderRadius: 12,
  },
  featureIcon: {
    fontSize: 24,
  },
  pricingSection: {
    alignItems: 'center',
    marginTop: 8,
  },
  trialBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  payButton: {
    width: '100%',
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  mockButton: {
    width: '100%',
    height: 42,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    borderStyle: 'dashed',
  },
  closeButton: {
    paddingVertical: Spacing.one,
  }
});
