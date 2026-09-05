import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { FONTS } from '@/core/theme/fonts';
import type { PointTransaction, PointsSource } from '@/core/types';
import { useColors } from '@/hooks/use-colors';

const SOURCE_ICONS: Record<PointsSource, keyof typeof Ionicons.glyphMap> = {
  event: 'calendar-outline',
  challenge: 'flash-outline',
  store: 'bag-outline',
  leaderboard: 'stats-chart-outline',
};

const SOURCE_LABELS: Record<PointsSource, string> = {
  event: 'Event Participation',
  challenge: 'Challenge Completed',
  store: 'Store Redemption',
  leaderboard: 'Leaderboard Investment',
};

export interface TransactionRowProps {
  tx: PointTransaction;
  onPress?: () => void;
}

/**
 * Transaction row (points spec §4.4): source icon, description, right-aligned
 * signed amount (green earn/refund, red spend), absolute timestamp.
 * Tap navigates to the related entity when it still exists.
 */
export function TransactionRow({ tx, onPress }: TransactionRowProps) {
  const colors = useColors();
  const isCredit = tx.type !== 'spend';
  const amountColor = isCredit ? colors.success : colors.danger;

  return (
    <GlassCard onPress={onPress} accessibilityLabel={`${SOURCE_LABELS[tx.source]} transaction`}>
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: colors.surfaceMuted }]}>
          <Ionicons name={SOURCE_ICONS[tx.source]} size={18} color={colors.textMuted} />
        </View>
        <View style={styles.textCol}>
          <Text style={[styles.description, { color: colors.text }]} numberOfLines={1}>
            {SOURCE_LABELS[tx.source]}
          </Text>
          {/*
            TODO(Phase 2): reference context line (event/challenge/store name).
            The points-service ledger only stores referenceId — resolving names
            needs a join, deferred until the challenge-service lands.
          */}
          <Text style={[styles.timestamp, { color: colors.textMuted }]}>
            {fmtDate(tx.createdAt)}
          </Text>
        </View>
        <Text style={[styles.amount, { color: amountColor }]}>
          {isCredit ? '+' : '−'}{tx.amount} pts
        </Text>
      </View>
    </GlassCard>
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  description: {
    fontFamily: FONTS.medium,
    fontSize: 14,
  },
  timestamp: {
    fontFamily: FONTS.body,
    fontSize: 12,
  },
  amount: {
    fontFamily: FONTS.semibold,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
});
