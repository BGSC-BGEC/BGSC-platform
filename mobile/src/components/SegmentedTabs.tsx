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
        Platform.OS === 'web' && ({
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          boxShadow: 'inset 0 1px 1.5px rgba(255, 255, 255, 0.12)',
        } as any),
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
                Platform.OS === 'web' && ({
                  boxShadow: '0 3px 12px rgba(0, 0, 0, 0.14), inset 0 1px 1px rgba(255, 255, 255, 0.3)',
                } as any),
                shadow('flat'),
              ],
            ]}
          >
            <Typography
              variant="button"
              color={active ? 'accent' : 'textMuted'}
              align="center"
              numberOfLines={1}
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
  container: { flexDirection: 'row', borderRadius: 24, borderWidth: 1, padding: 4 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: 4, paddingVertical: 10, borderRadius: 20 },
});
