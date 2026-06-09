import React, { createContext, useContext, useState, useEffect } from 'react';
import { Colors, GradeTheme, ThemeMode } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface ThemeContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  gradeTheme: GradeTheme;
  setGradeTheme: (theme: GradeTheme) => void;
  colors: typeof Colors.light & typeof Colors.lowGrade.light;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>(
    systemScheme === 'dark' ? 'dark' : 'light'
  );
  // 預設為高年級樣式 (High Grade: Indigo/Cyan)
  const [gradeTheme, setGradeTheme] = useState<GradeTheme>('highGrade');

  // 當系統明暗模式變更時，自動更新主題
  useEffect(() => {
    if (systemScheme === 'dark') setThemeMode('dark');
    else setThemeMode('light');
  }, [systemScheme]);

  // 動態合併基礎主題與角色/年級專屬主題顏色
  const getThemeColors = () => {
    const baseColors = Colors[themeMode];
    
    let specificColors = Colors.highGrade[themeMode];
    if (gradeTheme === 'lowGrade') {
      specificColors = Colors.lowGrade[themeMode];
    } else if (gradeTheme === 'parent') {
      specificColors = Colors.parent[themeMode];
    }

    return {
      ...baseColors,
      ...specificColors,
    };
  };

  const colors = getThemeColors();

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        setThemeMode,
        gradeTheme,
        setGradeTheme,
        colors,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    // 降級處理：若無 Provider 容器，回傳預設系統配色的高年級樣式
    const systemScheme = useColorScheme();
    const mode = systemScheme === 'dark' ? 'dark' : 'light';
    return {
      themeMode: mode,
      setThemeMode: () => {},
      gradeTheme: 'highGrade' as GradeTheme,
      setGradeTheme: () => {},
      colors: { ...Colors[mode], ...Colors.highGrade[mode] },
    };
  }
  return context;
}
