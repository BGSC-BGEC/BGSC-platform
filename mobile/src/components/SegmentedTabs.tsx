import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '../theme/ThemeProvider';
import { Typography } from '../typography/Typography';
import { GlassSurface } from '../navigation/GlassSurface';
import { GLASS_ACTIVE_FILL, GLASS_ACTIVE_GLOW, GLASS_ACTIVE_INK, IS_IOS, glassTokens } from '../navigation/glass';

export interface SegmentedTabsProps<T extends string> {
  tabs: ReadonlyArray<{ label: string; value: T }>;
  value: T;
  onChange: (value: T) => void;
  style?: ViewStyle;
}

const RADIUS = 13;
const PILL_RADIUS = 10;

/**
 * Full-width segmented tab control for switching between categories or views. Drawn like the
 * bottom tab bar: a liquid-glass track with the coral pill on the active tab.
 */
export function SegmentedTabs<T extends string>({ tabs, value, onChange, style }: SegmentedTabsProps<T>) {
  const { isDark } = useTheme();
  const g = glassTokens(isDark);

  return (
    <View style={[styles.container, style]}>
      <GlassSurface fill radius={RADIUS} />
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
            style={styles.tab}
          >
            {active ? (
              <View pointerEvents="none" style={[styles.pill, styles.pillGlow]}>
                <LinearGradient
                  colors={GLASS_ACTIVE_FILL}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.pillFill}
                />
              </View>
            ) : null}
            <Typography
              variant="caption"
              color={active ? GLASS_ACTIVE_INK : g.inactiveInk}
              align="center"
              numberOfLines={1}
              style={styles.label}
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
  container: { flexDirection: 'row', borderRadius: RADIUS, padding: 3 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 33, paddingHorizontal: 4, paddingVertical: 5, borderRadius: PILL_RADIUS },
  pill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: PILL_RADIUS },
  pillFill: { flex: 1, borderRadius: PILL_RADIUS, overflow: 'hidden' },
  // Coral glow under the active pill, iOS only (as on the tab bar).
  pillGlow: IS_IOS
    ? { shadowColor: GLASS_ACTIVE_GLOW, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, shadowRadius: 8 }
    : {},
  label: { fontWeight: '700', fontSize: 12.5 },
});
