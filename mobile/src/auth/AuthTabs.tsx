import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { Typography } from '../typography/Typography';
import { FONT_FAMILIES } from '../theme/typography';
import { useTheme } from '../theme/ThemeProvider';

interface AuthTabsProps {
  mode: 'login' | 'register';
  onChange: (mode: 'login' | 'register') => void;
}

const TABS = [
  { mode: 'login', label: 'Log in' },
  { mode: 'register', label: 'Sign up' },
] as const;

/** v2 Log in / Sign up segmented switch on the auth screens. */
export function AuthTabs({ mode, onChange }: AuthTabsProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.track, { backgroundColor: colors.surfaceInner }]} accessibilityRole="tablist">
      {TABS.map((tab) => {
        const active = tab.mode === mode;
        return (
          <Pressable
            hitSlop={8}
            key={tab.mode}
            onPress={() => {
              if (active) return;
              void Haptics.selectionAsync();
              onChange(tab.mode);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={styles.tab}
          >
            <Typography color={active ? 'text' : 'textMuted'} style={styles.label}>
              {tab.label}
            </Typography>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 999 },
  tab: { flex: 1, alignItems: 'center', padding: 8, borderRadius: 12 },
  label: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 12, lineHeight: 15 },
});
