import React from 'react';
import { Pressable, StyleSheet, View, Platform, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../theme/ThemeProvider';
import { withAlpha } from '../theme/colors';
import { Typography } from '../typography/Typography';

export interface SegmentedTabsProps<T extends string> {
  tabs: ReadonlyArray<{ label: string; value: T }>;
  value: T;
  onChange: (value: T) => void;
  style?: ViewStyle;
}

/**
 * Full-width segmented tab control for switching between categories or views.
 */
export function SegmentedTabs<T extends string>({ tabs, value, onChange, style }: SegmentedTabsProps<T>) {
  const { colors, shadow } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: withAlpha(colors.surfaceMuted, 0.72),
          borderColor: withAlpha('#FFFFFF', 0.16),
        },
        style,
      ]}
    >
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
            style={[
              styles.tab,
              active && [
                {
                  backgroundColor: colors.surface,
                  borderColor: withAlpha('#FFFFFF', 0.25),
                  borderWidth: 1,
                },
                shadow('flat'),
              ],
            ]}
          >
            <Typography
              variant="caption"
              color={active ? 'accent' : 'textMuted'}
              align="center"
              numberOfLines={1}
              style={{ fontWeight: '700', fontSize: 12.5 }}
            >
              {tab.label}
            </Typography>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Alias per mobile-v2-build-split.md Phase 0 contract (`src/components/SegmentedControl.tsx`). */
export const SegmentedControl = SegmentedTabs;
export type SegmentedControlProps<T extends string> = SegmentedTabsProps<T>;

const styles = StyleSheet.create({
  container: { flexDirection: 'row', borderRadius: 13, borderWidth: 1, padding: 3 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 33, paddingHorizontal: 4, paddingVertical: 5, borderRadius: 9 },
});
