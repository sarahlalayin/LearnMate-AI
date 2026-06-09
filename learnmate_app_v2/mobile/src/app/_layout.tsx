import { DarkTheme, DefaultTheme, ThemeProvider as ExpoNavigationProvider } from 'expo-router';
import { useColorScheme } from 'react-native';
import { ThemeProvider as CustomThemeProvider } from '@/hooks/use-theme';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <CustomThemeProvider>
      <ExpoNavigationProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <AppTabs />
      </ExpoNavigationProvider>
    </CustomThemeProvider>
  );
}
