import React from 'react';
import DrawerLayout from './screens/drawer/layout';
import { AuthProvider } from './store/auth';
import { ThemeProvider } from './src/theme/ThemeProvider';


export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider initialMode="dark">
        <DrawerLayout />
      </ThemeProvider>
    </AuthProvider>
  );
}