import { useColorScheme as useRnColorScheme } from 'react-native';

/** Current OS color scheme (light | dark | null). */
export function useColorScheme(): 'light' | 'dark' {
  return useRnColorScheme() === 'light' ? 'light' : 'dark';
}
