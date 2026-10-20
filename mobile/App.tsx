import React from 'react';
import { Platform, StatusBar } from 'react-native';
import { useFonts } from 'expo-font';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_900Black } from '@expo-google-fonts/inter';
import { DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import DrawerLayout from './screens/drawer/layout';
import { AuthProvider } from './store/auth';
import { ThemeProvider } from './src/theme/ThemeProvider';
import { PopupProvider } from './src/popups/PopupProvider';

// Web only: the inputs already show the orange focus border from the theme, so drop
// the browser's default focus rectangle that gets drawn on top of it.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = 'input:focus, textarea:focus, select:focus { outline: none !important; }';
  document.head.appendChild(style);
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
  });
  // On a load error render anyway with system fonts rather than hanging on a blank screen.
  if (!fontsLoaded && !fontError) return null;

  return (
    <AuthProvider>
      <ThemeProvider initialMode="dark">
        <StatusBar barStyle="light-content" />
        <PopupProvider>
          <DrawerLayout />
        </PopupProvider>
      </ThemeProvider>
    </AuthProvider>
  ) ;
}
