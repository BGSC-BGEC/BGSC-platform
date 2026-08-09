import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';

export interface SpendTileProps {
  icon: keyof typeof Ionicons.glyphMap;
  name: string;
  subtitle: string;
  onPress: () => void;
}

/**
 * Spending-source tile (points spec §4.3) — taps navigate (Store /
 * Leaderboard). Same layout as EarnTile but pressable.
 */
export function SpendTile({ icon, name, subtitle, onPress }: SpendTileProps) {
  const colors = useColors();
  return (
    <GlassCard
      style={styles.tile}
      onPress={onPress}
      accessibilityLabel={`${name} spending source`}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.surfaceMuted }]}>
        <Ionicons name={icon} size={22} color={colors.accent} />
      </View>
      <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
        {name}
      </Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={2}>
        {subtitle}
      </Text>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 112,
    alignItems: 'center',
    gap: 6,
    padding: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 11,
    textAlign: 'center',
  },
});
