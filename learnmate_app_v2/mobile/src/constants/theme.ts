/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#111827',
    background: '#F9FAFB',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E5E7EB',
    textSecondary: '#4B5563',
    primary: '#4F46E5', // default
    border: '#E5E7EB',
    
    // Status colors (台灣時區與系統預警用)
    success: '#10B981', // green (一切順利)
    warning: '#F59E0B', // orange (留意中)
    critical: '#EF4444', // red (救援 alert)
    positive: '#3B82F6', // blue (進步中)
  },
  dark: {
    text: '#F3F4F6',
    background: '#111827',
    backgroundElement: '#1F2937',
    backgroundSelected: '#374151',
    textSecondary: '#9CA3AF',
    primary: '#6366F1', // default
    border: '#374151',
    
    // Status colors
    success: '#34D399',
    warning: '#FBBF24',
    critical: '#F87171',
    positive: '#60A5FA',
  },
  // 低年級（1-3年級）護眼明亮、童趣活力色彩 (Playful Mint & Yellow)
  lowGrade: {
    light: {
      primary: '#34D399', // 薄荷綠
      secondary: '#FBBF24', // 暖太陽黃
      accent: '#FF8A65', // 珊瑚粉橘
      background: '#F0FDF4', // 嫩綠背景色
      backgroundElement: '#FFFFFF',
      text: '#064E3B', // 深綠色文字（高對比護眼）
      textSecondary: '#047857',
      border: '#D1FAE5'
    },
    dark: {
      primary: '#10B981',
      secondary: '#F59E0B',
      accent: '#FF7043',
      background: '#022C22',
      backgroundElement: '#064E3B',
      text: '#ECFDF5',
      textSecondary: '#A7F3D0',
      border: '#047857'
    }
  },
  // 高年級（4-9年級）精緻專注、潮流星空質感 (Sleek Indigo & Cyan)
  highGrade: {
    light: {
      primary: '#4F46E5', // 靛藍極光
      secondary: '#06B6D4', // 晨曦青
      accent: '#EC4899', // 霓虹粉
      background: '#F5F3FF', // 柔靛紫背景
      backgroundElement: '#FFFFFF',
      text: '#1E1B4B', // 深靛藍文字
      textSecondary: '#4338CA',
      border: '#E0E7FF'
    },
    dark: {
      primary: '#6366F1',
      secondary: '#22D3EE',
      accent: '#F472B6',
      background: '#09080F', // 太空黑背景
      backgroundElement: '#181528', // 暗紫色元件
      text: '#EEF2F6',
      textSecondary: '#C7D2FE',
      border: '#2E2A47'
    }
  },
  // 家長陪伴端（溫暖守護、數據洞察）(Warm Teal & Rose)
  parent: {
    light: {
      primary: '#0D9488', // 陪伴松石綠
      secondary: '#E11D48', // 溫馨玫瑰粉
      background: '#FFF1F2', // 暖玫瑰背景
      backgroundElement: '#FFFFFF',
      text: '#4C0519', // 深玫瑰木文字
      textSecondary: '#9F1239',
      border: '#FFE4E6'
    },
    dark: {
      primary: '#14B8A6',
      secondary: '#F43F5E',
      background: '#18080C', // 暗暖紅背景
      backgroundElement: '#3E0C1B', // 勃根地紅元件
      text: '#FFE4E6',
      textSecondary: '#FDA4AF',
      border: '#641126'
    }
  }
} as const;

export type ThemeMode = 'light' | 'dark';
export type GradeTheme = 'lowGrade' | 'highGrade' | 'parent';
export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
