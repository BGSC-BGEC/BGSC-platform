import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

// Sign Up is now the second tab of the Login screen.
export default function RegisterRedirect() {
  useEffect(() => {
    router.replace({ pathname: '/login', params: { tab: 'signup' } });
  }, []);
  return <View />;
}
