import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

function NavThemed({ children }: { children: React.ReactNode }) {
  const { mode } = useTheme();
  return (
    <NavThemeProvider value={mode === 'dark' ? DarkTheme : DefaultTheme}>
      {children}
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider defaultMode="system" defaultAccent="indigo">
        <NavThemed>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
              animationDuration: 300,
            }}
          >
            <Stack.Screen name="index" options={{ animation: 'fade' }} />
            <Stack.Screen name="analyze" />
            {/* about reads as a detour off the intro, not a step forward */}
            <Stack.Screen name="about" options={{ animation: 'slide_from_bottom' }} />
          </Stack>
          <StatusBar style="auto" />
        </NavThemed>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
