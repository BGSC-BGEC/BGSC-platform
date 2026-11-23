import React, { useEffect } from 'react';
import { Platform, StatusBar } from 'react-native';
import { useFonts } from 'expo-font';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_900Black } from '@expo-google-fonts/inter';
import { DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display';
import { Graduate_400Regular } from '@expo-google-fonts/graduate';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import DrawerLayout from './screens/drawer/layout';
import { AuthProvider, useAuth } from './store/auth';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { PopupProvider } from './src/popups/PopupProvider';
import { ErrorBoundary } from './src/feedback/ErrorBoundary';
import { usersRepository } from './src/repositories/UsersRepository';

// Web only: the inputs already show the orange focus border from the theme, so drop
// the browser's default focus rectangle that gets drawn on top of it.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = 'input:focus, textarea:focus, select:focus { outline: none !important; }';
  document.head.appendChild(style);
}

function AccountAppearance() {
  const { user } = useAuth();
  const { setMode, isDark } = useTheme();

  useEffect(() => {
    let active = true;
    if (user) usersRepository.me().then(profile => { if (active) setMode(profile.settings.theme); }).catch(() => undefined);
    else setMode('dark');
    return () => { active = false; };
  }, [user?.id, setMode]);

  useEffect(() => {
    if (Platform.OS === 'android') {
      (StatusBar as any).setTranslucent?.(true);
      (StatusBar as any).setBackgroundColor?.('transparent', true);
    }
  }, []);

  return <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />;
}

export default function App() {
  // Names match FONT_FAMILIES in src/theme/typography.ts
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_900Black,
    DMSerifDisplay_400Regular,
    JetBrainsMono_500Medium,
    Graduate_400Regular,
  });
  // On a load error render anyway with system fonts rather than hanging on a blank screen.
  if (!fontsLoaded && !fontError) return null;

  return (
    <ErrorBoundary fallbackTitle="Application encountered an error">
      {/* Tracks the soft keyboard so forms (KeyboardAwareScrollView) can scroll the focused
          field above it. Needed on Android, where edge-to-edge stops the window resizing. */}
      <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
        <AuthProvider>
          <ThemeProvider initialMode="dark">
            <AccountAppearance />
            <PopupProvider>
              <DrawerLayout />
            </PopupProvider>
          </ThemeProvider>
        </AuthProvider>
      </KeyboardProvider>
    </ErrorBoundary>
  );
}
