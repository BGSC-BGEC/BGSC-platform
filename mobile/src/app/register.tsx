import { router } from 'expo-router';
import { useEffect } from 'react';

export default function RegisterScreen() {
  useEffect(() => {
    router.replace({ pathname: '/login', params: { tab: 'register' } });
  }, []);
  return null;
}
