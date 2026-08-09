import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';

const ECOSYSTEM_CHIPS = ['BGEC', 'FitSoc'];

/**
 * Introduction hero (home-page.md §6.2): authored deep-teal field — brand
 * lockup, tagline, quiet ecosystem chips, abstract court arcs at low opacity
 * (no stock illustration). Explore cue fades once the first scroll passes.
 */
export function HomeHero({ cueVisible = true }: { cueVisible?: boolean }) {
  const colors = useColors();
  const [cueOpacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    Animated.timing(cueOpacity, {
      toValue: cueVisible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [cueVisible, cueOpacity]);

  return (
    <View style={[styles.hero, { backgroundColor: colors.backgroundMid, borderColor: colors.border }]}>
      {/* Restrained radial-light composition — soft circles, ≤12% opacity. */}
      <View
        pointerEvents="none"
        style={[styles.orb, styles.orbTop, { backgroundColor: colors.surfaceSolid }]}
      />
      <View
        pointerEvents="none"
        style={[styles.orb, styles.orbBottom, { backgroundColor: colors.primary, opacity: 0.06 }]}
      />
      <View
        pointerEvents="none"
        style={[styles.arc, { borderColor: colors.border }]}
      />

      <Text
        accessibilityRole="header"
        style={[styles.brand, { color: colors.text }]}
      >
        BGSC
      </Text>
      <Text style={[styles.tagline, { color: colors.text }]}>
        Where campus sport meets esports.
      </Text>

      <View style={styles.chipRow}>
        {ECOSYSTEM_CHIPS.map((chip) => (
          <View key={chip} style={[styles.chip, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            <Text style={[styles.chipLabel, { color: colors.textMuted }]}>{chip}</Text>
          </View>
        ))}
      </View>

      <Animated.View style={[styles.cue, { opacity: cueOpacity }]}>
        <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 36,
    minHeight: 380,
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orbTop: {
    width: 220,
    height: 220,
    top: -90,
    right: -60,
    opacity: 0.08,
  },
  orbBottom: {
    width: 180,
    height: 180,
    bottom: -80,
    left: -50,
  },
  arc: {
    position: 'absolute',
    width: 420,
    height: 200,
    bottom: -110,
    right: -120,
    borderWidth: 1,
    borderRadius: 999,
    transform: [{ rotate: '-8deg' }],
  },
  brand: {
    fontFamily: FONTS.hero,
    fontSize: 64,
    letterSpacing: 1.5,
    lineHeight: 68,
  },
  tagline: {
    fontFamily: FONTS.body,
    fontSize: 19,
    lineHeight: 27,
    maxWidth: 280,
    marginTop: 4,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 24,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  chipLabel: {
    fontFamily: FONTS.medium,
    fontSize: 13,
  },
  cue: {
    position: 'absolute',
    bottom: 14,
    alignSelf: 'center',
  },
});
