import { BlurView } from 'expo-blur';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { PillButton } from '@/components/PillButton';
import { SectionLabel } from '@/components/events/SectionStates';
import { LiveDot } from '@/components/events/EventCard';
import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';
import { useToast } from '@/components/Toast';

const MOCK_STREAK = 12;
const MOCK_ROWS = [
  { rank: 1, name: 'Aditi Rao', pct: '92%' },
  { rank: 2, name: 'Karan Shah', pct: '87%' },
  { rank: 3, name: 'Meher Singh', pct: '81%' },
];

/**
 * Strava sub-section inside the FitSoc tab (spec §5.3): streak hero +
 * consistency leaderboard behind the "Not Connected" locked overlay.
 *
 * TODO(events, Phase 2): no Strava backend exists — connection state, streak
 * and consistency data all come from a future Strava integration. Until then
 * the spec's disconnected state is the only state, so no fake data is shown.
 */
export function StravaSection({ onLayout }: { onLayout?: (y: number) => void }) {
  const colors = useColors();
  const toast = useToast();
  const [connected] = useState(false);

  return (
    <View
      onLayout={(e) => onLayout?.(e.nativeEvent.layout.y)}
      style={styles.wrap}
    >
      <SectionLabel label="STRAVA · DAILY RUNS" />
      <GlassCard style={styles.card}>
        {/* Locked preview content behind the overlay (streak hero + rows). */}
        <View style={styles.content}>
          <View style={styles.streakRow}>
            <Text style={[styles.streak, { color: colors.text }]}>{MOCK_STREAK}</Text>
            <Text style={[styles.streakLabel, { color: colors.textMuted }]}>DAY STREAK</Text>
          </View>
          <Text style={[styles.caption, { color: colors.textMuted }]}>
            Run at least 1km today to keep it alive.
          </Text>
          {MOCK_ROWS.map((row) => (
            <View key={row.rank} style={styles.row}>
              <Text style={[styles.rank, { color: colors.text }]}>{row.rank}</Text>
              {row.rank <= 3 ? <LiveDot size={8} /> : <View style={styles.rowSpacer} />}
              <Text style={[styles.rowName, { color: colors.text }]}>{row.name}</Text>
              <Text style={[styles.rowPct, { color: colors.textMuted }]}>{row.pct}</Text>
            </View>
          ))}
        </View>

        {/* Locked overlay (spec §5.3) — only interactive element until connected. */}
        {!connected ? (
          <View style={styles.overlay}>
            <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.backgroundMid }]} />
            <PillButton
              label="Connect Strava"
              variant="light"
              fullWidth={false}
              accessibilityLabel="Connect Strava"
              onPress={() => {
                // TODO(events, Phase 2): Strava OAuth via in-app browser.
                toast.show('Strava linking is coming in a later phase.');
              }}
            />
          </View>
        ) : null}
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 24,
    gap: 8,
  },
  card: {
    position: 'relative',
    overflow: 'hidden',
    minHeight: 260,
  },
  content: {
    gap: 10,
    paddingVertical: 4,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  streak: {
    fontFamily: FONTS.hero,
    fontSize: 48,
  },
  streakLabel: {
    fontFamily: FONTS.body,
    fontSize: 12,
    letterSpacing: 1,
  },
  caption: {
    fontFamily: FONTS.body,
    fontSize: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 32,
  },
  rank: {
    fontFamily: FONTS.heading,
    fontSize: 18,
    width: 18,
  },
  rowSpacer: {
    width: 8,
    height: 8,
  },
  rowName: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    flex: 1,
  },
  rowPct: {
    fontFamily: FONTS.body,
    fontSize: 12,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
