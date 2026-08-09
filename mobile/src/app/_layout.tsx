import {
  BarlowCondensed_700Bold,
  BarlowCondensed_800ExtraBold,
} from '@expo-google-fonts/barlow-condensed';
import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ToastProvider } from '@/components/Toast';
import { useAuthStore } from '@/core/stores/authStore';
import { useThemeStore } from '@/core/stores/themeStore';
import { darkColors, lightColors } from '@/core/theme/tokens';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { queryClient } from '@/lib/query-client';

/**
 * Root layout (master §2.3): QueryClientProvider + theme resolution +
 * ToastProvider + font loading (§5.3). Splash stays up until fonts load.
 */
export default function RootLayout() {
  const scheme = useColorScheme();
  const preference = useThemeStore((s) => s.theme);
  const loadTheme = useThemeStore((s) => s.loadTheme);

  const [fontsLoaded] = useFonts({
    BebasNeue_400Regular,
    BarlowCondensed_700Bold,
    BarlowCondensed_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    JetBrainsMono_500Medium,
  });

  // Rehydrate persisted session + theme once on app start.
  useEffect(() => {
    void useAuthStore.getState().loadSession();
    void loadTheme();
  }, [loadTheme]);

  if (!fontsLoaded) return null; // native splash stays visible

  const resolved = preference === 'system' ? scheme : preference;
  const colors = resolved === 'dark' ? darkColors : lightColors;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="(drawer)" />
            <Stack.Screen name="event/[id]" />
            <Stack.Screen name="event/bracket/[id]" />
            <Stack.Screen name="event/auction/[id]" />
            <Stack.Screen name="challenge/[id]" />
            <Stack.Screen name="challenge/[id]/submission" />
            <Stack.Screen name="login" />
            <Stack.Screen name="register" />
            <Stack.Screen name="auth/callback" />
            <Stack.Screen name="auth/otp" />
            <Stack.Screen name="auth/complete-profile" />
          </Stack>
          <StatusBar style={resolved === 'dark' ? 'light' : 'dark'} />
        </ToastProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
