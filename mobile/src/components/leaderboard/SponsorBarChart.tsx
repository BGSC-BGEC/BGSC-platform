import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';

export interface SponsorBarRow {
  id: string;
  name: string;
  value: number;
  rank: number;
  isMine: boolean;
}

export interface SponsorBarChartProps {
  rows: SponsorBarRow[];
}

/**
 * Fan distribution bar chart (leaderboard.md §5.3): one horizontal bar per
 * sponsor, value/max width — never below 4 dp. Bars grow from width 0 via
 * scaleX (native driver) staggered 50 ms. The user's sponsor gets a ★ prefix
 * and a text outline. Rank is always shown as text — never color-only.
 */
export function SponsorBarChart({ rows }: SponsorBarChartProps) {
  const maxValue = Math.max(1, ...rows.map((r) => r.value));

  return (
    <GlassCard accessibilityLabel="Fan distribution across sponsors">
      <View style={styles.stack}>
        {rows.map((row, i) => (
          <BarRow key={row.id} row={row} ratio={row.value / maxValue} total={rows.length} index={i} />
        ))}
      </View>
    </GlassCard>
  );
}

function BarRow({
  row,
  ratio,
  total,
  index,
}: {
  row: SponsorBarRow;
  ratio: number;
  total: number;
  index: number;
}) {
  const colors = useColors();
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.spring(progress, {
        toValue: 1,
        stiffness: 320,
        damping: 30,
        mass: 0.9,
        useNativeDriver: true,
      }).start();
    }, index * 50);
    return () => clearTimeout(timer);
  }, [progress, index]);

  const fillWidth = Math.max(0.04, ratio); // never below 4% so non-zero sponsors stay visible

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`${row.name}, ${row.value.toLocaleString()} fans, rank ${row.rank} of ${total}`}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}
      style={styles.row}
    >
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: row.isMine ? colors.text : colors.textMuted }]} numberOfLines={1}>
          {row.isMine ? '★ ' : ''}
          {row.name}
        </Text>
        <Text style={[styles.value, { color: colors.accent }]}>{row.value.toLocaleString()}</Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
        <Animated.View
          style={[
            styles.fill,
            {
              backgroundColor: colors.accent,
              borderColor: row.isMine ? colors.text : 'transparent',
              transform: [{ scaleX: progress }],
              width: `${fillWidth * 100}%`,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
  },
  row: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  label: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
    flex: 1,
  },
  value: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 8,
    borderRadius: 6,
    overflow: 'hidden',
  },
  fill: {
    height: 8,
    borderRadius: 6,
    borderWidth: 2,
    transformOrigin: 'left',
  },
});
