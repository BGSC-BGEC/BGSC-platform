import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useAuthStore } from '@/core/stores/authStore';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { queryClient } from '@/lib/query-client';

export default function RootLayout() {
  const scheme = useColorScheme();

  // Rehydrate the persisted session once on app start.
  useEffect(() => {
    void useAuthStore.getState().loadSession();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(drawer)" />
            <Stack.Screen name="event/[id]" />
            <Stack.Screen name="event/bracket/[id]" />
            <Stack.Screen name="event/auction/[id]" />
            <Stack.Screen name="login" />
            <Stack.Screen name="register" />
            <Stack.Screen name="auth/callback" />
            <Stack.Screen name="auth/otp" />
            <Stack.Screen name="auth/complete-profile" />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
