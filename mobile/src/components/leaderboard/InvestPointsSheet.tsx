import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { PillButton } from '@/components/PillButton';
import { FONTS } from '@/core/theme/fonts';
import type { LeaderboardEntry } from '@/core/types';
import { useColors } from '@/hooks/use-colors';

const MIN_INVEST = 10;
const QUICK_AMOUNTS = [50, 100, 250];

export interface InvestPointsSheetProps {
  visible: boolean;
  onClose: () => void;
  eventId: string;
  /** Live balance — fetched by the parent (PointsRepository). */
  balance?: number;
  /** Current standings — used for the advisory projection (spec §4.4). */
  entries: LeaderboardEntry[];
  /** Investor's current score in this event (0 when not yet scored). */
  ownScore: number;
  onSubmit: (amount: number) => void;
  submitting: boolean;
  onEarnPoints: () => void;
}

/**
 * Points investment sheet (leaderboard.md §4.4): balance, numeric amount
 * input, quick-amount pills, live rank projection, non-refundable warning,
 * full-width primary CTA. Insufficient balance → Earn Points (routes to the
 * challenge browser).
 *
 * TODO(Phase 2): `event_investment_cap` and the 5/hour rate guard (429) come
 * from the backend points_pool config — today the cap is the user's balance.
 */
export function InvestPointsSheet({
  visible,
  onClose,
  eventId,
  balance,
  entries,
  ownScore,
  onSubmit,
  submitting,
  onEarnPoints,
}: InvestPointsSheetProps) {
  const colors = useColors();
  const [amountText, setAmountText] = useState('');
  const [focused, setFocused] = useState(false);

  const balanceValue = balance ?? 0;
  const maxAmount = Math.max(0, balanceValue);
  const insufficient = balanceValue < MIN_INVEST;

  const amount = Number.parseInt(amountText, 10);
  const valid = Number.isInteger(amount) && amount >= MIN_INVEST && amount <= maxAmount;

  const projection = useMemo(() => {
    if (!valid) return null;
    const newScore = ownScore + amount;
    const newRank = 1 + entries.filter((e) => e.score > newScore).length;
    const currentRank = 1 + entries.filter((e) => e.score > ownScore).length;
    return { newRank, newScore, currentRank };
  }, [valid, amount, ownScore, entries]);

  const confirm = () => {
    if (!valid) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Invest points?',
      `Invest ${amount.toLocaleString()} points in this leaderboard? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Invest', onPress: () => onSubmit(amount) },
      ],
    );
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Invest Points">
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Boost your standing in this event.
        </Text>

        <View style={[styles.balanceRow, { backgroundColor: colors.surfaceMuted }]}>
          <Text style={[styles.balanceLabel, { color: colors.textMuted }]}>Your Balance</Text>
          <Text style={[styles.balanceValue, { color: colors.text }]}>
            {balanceValue.toLocaleString()} pts
          </Text>
        </View>

        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Amount to Invest *</Text>
        <View
          style={[
            styles.inputWrap,
            {
              borderColor: focused ? colors.borderActive : insufficient ? colors.danger : colors.border,
              backgroundColor: colors.surfaceMuted,
            },
          ]}
        >
          <TextInput
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="number-pad"
            placeholder={insufficient ? 'Insufficient balance' : '0'}
            placeholderTextColor={colors.textMuted}
            editable={!insufficient && !submitting}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            accessibilityLabel="Amount to invest"
            style={[styles.input, { color: colors.text }]}
          />
        </View>

        <View style={styles.pills}>
          {QUICK_AMOUNTS.map((q) => {
            const disabled = q > maxAmount;
            return (
              <Pressable
                key={q}
                onPress={() => setAmountText(String(q))}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={`Invest ${q} points`}
                accessibilityState={{ disabled }}
                style={[
                  styles.pill,
                  {
                    borderColor: amount === q ? colors.accent : colors.border,
                    backgroundColor: amount === q ? colors.accentMuted : 'transparent',
                    opacity: disabled ? 0.4 : 1,
                  },
                ]}
              >
                <Text style={[styles.pillText, { color: amount === q ? colors.accent : colors.textMuted }]}>
                  {q}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => setAmountText(String(maxAmount))}
            disabled={maxAmount < MIN_INVEST}
            accessibilityRole="button"
            accessibilityLabel="Invest maximum amount"
            accessibilityState={{ disabled: maxAmount < MIN_INVEST }}
            style={[
              styles.pill,
              {
                borderColor: amountText === String(maxAmount) ? colors.accent : colors.border,
                backgroundColor: amountText === String(maxAmount) ? colors.accentMuted : 'transparent',
                opacity: maxAmount < MIN_INVEST ? 0.4 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.pillText,
                { color: amountText === String(maxAmount) ? colors.accent : colors.textMuted },
              ]}
            >
              Max
            </Text>
          </Pressable>
        </View>

        {projection ? (
          <View style={[styles.projection, { backgroundColor: colors.surfaceMuted }]}>
            <Text style={[styles.projectionRow, { color: colors.text }]}>
              Projected Rank:{'  '}
              <Text style={{ color: colors.textMuted }}>
                #{projection.currentRank} →{' '}
              </Text>
              <Text style={{ color: colors.accent }}>#{projection.newRank}</Text>
            </Text>
            <Text style={[styles.projectionRow, { color: colors.text }]}>
              Projected Score:{'  '}
              <Text style={{ color: colors.textMuted }}>
                {ownScore.toLocaleString()} →{' '}
              </Text>
              <Text style={{ color: colors.accent }}>{projection.newScore.toLocaleString()}</Text>
            </Text>
          </View>
        ) : null}

        {/* TODO(design): spec wants #FCD34D warning text — no token exists;
            tokens.ts has no warning colour, so the warning renders in muted. */}
        <Text style={[styles.warning, { color: colors.textMuted }]}>
          ⚠ Investments are final and cannot be refunded.
        </Text>

        {/* ponytail: Phase-2 mock — the invest endpoint doesn't exist yet; the
            optimistic re-rank is local only. Drop this note when it lands. */}
        <Text style={[styles.demoNote, { color: colors.textMuted }]}>
          Demo mode: settlement is local until the points service ships investment (Phase 2).
        </Text>

        {insufficient ? (
          <PillButton label="Earn Points" variant="primary" onPress={onEarnPoints} style={styles.cta} />
        ) : (
          <PillButton
            label="Confirm Investment"
            variant="primary"
            onPress={confirm}
            loading={submitting}
            disabled={!valid}
            accessibilityLabel="Confirm investment"
            style={styles.cta}
          />
        )}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 13,
    marginBottom: 12,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  balanceLabel: {
    fontFamily: FONTS.semibold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  balanceValue: {
    fontFamily: FONTS.mono,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
  },
  fieldLabel: {
    fontFamily: FONTS.semibold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  inputWrap: {
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 48,
    justifyContent: 'center',
  },
  input: {
    fontFamily: FONTS.mono,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontVariant: ['tabular-nums'],
  },
  pills: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  pill: {
    borderRadius: 16,
    height: 32,
    borderWidth: 1,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: {
    fontFamily: FONTS.semibold,
    fontSize: 12,
  },
  projection: {
    borderRadius: 8,
    padding: 12,
    marginTop: 14,
    gap: 4,
  },
  projectionRow: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  warning: {
    fontFamily: FONTS.body,
    fontSize: 12,
    marginTop: 14,
  },
  demoNote: {
    fontFamily: FONTS.body,
    fontSize: 11,
    marginTop: 6,
  },
  cta: {
    marginTop: 16,
  },
});
