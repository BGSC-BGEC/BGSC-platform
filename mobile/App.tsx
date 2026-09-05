import React from 'react';
import DrawerLayout from './screens/drawer/layout';
import { AuthProvider } from './store/auth';


export default function App() {
  return (
    <AuthProvider>
      <DrawerLayout />
    </AuthProvider>
  );
}