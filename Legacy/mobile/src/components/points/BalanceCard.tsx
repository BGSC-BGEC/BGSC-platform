import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { PillButton } from '@/components/PillButton';
import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';

export interface BalanceCardProps {
  balance: number;
  error?: string | null;
  onRetry: () => void;
  onEarnMore: () => void;
  onGoToStore: () => void;
}

/**
 * Balance card (points spec §4.1): label, Bebas hero number in accent,
 * "Earn more ↓" (scrolls to How to Earn) + "Go to Store →" (primary).
 * Number pops (scale 1 → 1.15 → 1) on change (spec §10 / impl guide §8).
 * Inline error with retry (spec §12).
 */
export function BalanceCard({ balance, error, onRetry, onEarnMore, onGoToStore }: BalanceCardProps) {
  const colors = useColors();
  const [scale] = useState(() => new Animated.Value(1));

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.15, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
    ]).start();
  }, [balance, scale]);

  if (error) {
    return (
      <GlassCard accessibilityLabel="Balance error">
        <Text style={[styles.label, { color: colors.textMuted }]}>Your Points</Text>
        <Text style={[styles.errorText, { color: colors.textMuted }]}>
          Could not load balance
        </Text>
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry loading balance"
          hitSlop={8}
          style={styles.retry}
        >
          <Text style={[styles.retryText, { color: colors.accent }]}>Retry</Text>
        </Pressable>
      </GlassCard>
    );
  }

  return (
    <GlassCard accessibilityLabel="Points balance">
      <Text style={[styles.label, { color: colors.textMuted }]}>Your Points</Text>
      <Animated.Text
        style={[
          styles.balance,
          { color: colors.accent, transform: [{ scale }] },
        ]}
      >
        {balance.toLocaleString()} pts
      </Animated.Text>
      <View style={styles.actions}>
        <PillButton
          variant="ghost"
          label="Earn more ↓"
          onPress={onEarnMore}
          fullWidth={false}
          accessibilityLabel="Scroll to how to earn"
          style={styles.actionButton}
        />
        <PillButton
          variant="primary"
          label="Go to Store →"
          onPress={onGoToStore}
          fullWidth={false}
          accessibilityLabel="Go to store"
          style={styles.actionButton}
        />
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: FONTS.semibold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  balance: {
    fontFamily: FONTS.hero,
    fontSize: 48,
    marginVertical: 8,
    fontVariant: ['tabular-nums'],
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    paddingHorizontal: 12,
  },
  errorText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    marginTop: 8,
  },
  retry: {
    marginTop: 8,
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  retryText: {
    fontFamily: FONTS.semibold,
    fontSize: 14,
  },
});
