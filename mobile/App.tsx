import React from 'react';
import { Platform } from 'react-native';
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
  return (
    <AuthProvider>
      <ThemeProvider initialMode="dark">
        <PopupProvider>
          <DrawerLayout />
        </PopupProvider>
      </ThemeProvider>
    </AuthProvider>
  ) ;
}
