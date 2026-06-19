/**
 * Mobile App Entry Point
 * Sets up navigation, providers, and global state
 */

import { useEffect } from 'react';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Stack } from 'expo-router';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAuthStore } from './stores/auth.store';
import { useThemeStore } from './stores/theme.store';

// Prevent splash screen from auto hiding
SplashScreen.preventAutoHideAsync();

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
    },
  },
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  const { isAuthenticated, initialize } = useAuthStore();
  const { isDarkMode } = useThemeStore();

  useEffect(() => {
    const bootstrap = async () => {
      // Initialize auth state from AsyncStorage
      await initialize();
      // Hide splash screen once we've checked auth state
      await SplashScreen.hideAsync();
    };

    if (fontsLoaded) {
      bootstrap();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <Stack
            screenOptions={{
              headerShown: false,
              cardStyle: { backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff' },
            }}
          >
            {isAuthenticated ? (
              // Authenticated stack
              <Stack.Screen
                name="(app)"
                options={{
                  animationEnabled: false,
                }}
              />
            ) : (
              // Auth stack
              <Stack.Screen
                name="(auth)"
                options={{
                  animationEnabled: false,
                }}
              />
            )}
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
