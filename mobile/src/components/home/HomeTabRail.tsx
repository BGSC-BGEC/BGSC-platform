import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';

const TABS: { label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'Introduction', icon: 'home-outline' },
  { label: 'Announcements', icon: 'megaphone-outline' },
  { label: 'Feed', icon: 'newspaper-outline' },
];

export interface HomeTabRailProps {
  active: number;
  onChange: (index: number) => void;
}

/**
 * Sticky glass tab rail (home-page.md §5.2 / H0): 52 dp, inset 12, radius 24,
 * active item Barlow bold + 2 dp signal underline with Home Tab Continuity
 * spring (§15.2), 44 dp touch targets, tab semantics per §19.2. The underline
 * follows both taps and pager swipes — it springs to `active` whenever the
 * index changes, so this component never needs to know how it changed.
 */
export function HomeTabRail({ active, onChange }: HomeTabRailProps) {
  const colors = useColors();
  const [trackWidth, setTrackWidth] = useState(0);
  const [underline] = useState(() => new Animated.Value(0));

  const segment = trackWidth / TABS.length;

  useEffect(() => {
    Animated.spring(underline, {
      toValue: active * segment,
      damping: 18,
      stiffness: 150,
      useNativeDriver: true,
    }).start();
  }, [active, segment, underline]);

  return (
    <View style={styles.railInset}>
      <View
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        style={[styles.track, { borderColor: colors.border }]}
      >
        <BlurView intensity={55} tint="dark" style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface }]} />
        {trackWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.underline,
              {
                backgroundColor: colors.accent,
                left: 16,
                width: Math.max(0, segment - 32),
                transform: [{ translateX: underline }],
              },
            ]}
          />
        ) : null}
        {TABS.map((tab, index) => {
          const isActive = index === active;
          return (
            <Pressable
              key={tab.label}
              onPress={() => onChange(index)}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: isActive }}
              style={styles.tab}
            >
              <Ionicons
                name={tab.icon}
                size={18}
                color={isActive ? colors.text : colors.textMuted}
              />
              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  {
                    fontFamily: isActive ? FONTS.heading : FONTS.medium,
                    fontSize: 14,
                    color: isActive ? colors.text : colors.textMuted,
                  },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  railInset: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },
  track: {
    height: 52,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  label: {
    letterSpacing: 0.2,
  },
  underline: {
    position: 'absolute',
    bottom: 5,
    height: 2,
    borderRadius: 1,
  },
});
