import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../theme/ThemeProvider';
import { Typography } from '../typography/Typography';

export interface SegmentedTabsProps<T extends string> {
  tabs: ReadonlyArray<{ label: string; value: T }>;
  value: T;
  onChange: (value: T) => void;
  style?: ViewStyle;
}

/**
 * Full-width segmented control (e.g. Global / Events / Challenges).
 * Active segment is a raised surface pill with orange label.
 */
export function SegmentedTabs<T extends string>({ tabs, value, onChange, style }: SegmentedTabsProps<T>) {
  const { colors, shadow } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }, style]}>
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <Pressable
            key={tab.value}
            onPress={() => {
              if (active) return;
              void Haptics.selectionAsync();
              onChange(tab.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.tab, active && [{ backgroundColor: colors.surface }, shadow('flat')]]}
          >
            <Typography variant="button" color={active ? 'accent' : 'textMuted'} numberOfLines={1}>
              {tab.label}
            </Typography>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', borderRadius: 24, borderWidth: 1, padding: 4 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 20 },
});
