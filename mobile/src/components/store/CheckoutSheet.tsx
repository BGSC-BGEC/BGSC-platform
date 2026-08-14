import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { GlassCard } from '@/components/GlassCard';
import { PillButton } from '@/components/PillButton';
import { FONTS } from '@/core/theme/fonts';
import type { RedemptionInput, StoreItem } from '@/core/types';
import { useColors } from '@/hooks/use-colors';

export interface CartLine {
  item: StoreItem;
  quantity: number;
}

export interface CheckoutSheetProps {
  visible: boolean;
  onClose: () => void;
  lines: CartLine[];
  balance: number;
  pending: boolean;
  onConfirm: (items: RedemptionInput['items']) => void;
}

/**
 * Cart & checkout bottom sheet (store spec §2.2 / §6.1) with a confirm step:
 * review the lines + total, then "Confirm Checkout" flips to a final
 * "Yes, Redeem" confirmation before the mutation fires. The sheet stays open
 * on failure so the user can retry; the screen closes it on success.
 */
export function CheckoutSheet({ visible, onClose, lines, balance, pending, onConfirm }: CheckoutSheetProps) {
  const colors = useColors();
  const [step, setStep] = useState<'review' | 'confirm'>('review');

  const close = () => {
    setStep('review');
    onClose();
  };

  const total = lines.reduce((sum, l) => sum + l.item.costPoints * l.quantity, 0);
  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);
  const insufficient = total > balance;

  if (lines.length === 0) {
    return (
      <BottomSheet visible={visible} onClose={close} title="Your Cart">
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>Your cart is empty.</Text>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet visible={visible} onClose={close} title={step === 'review' ? 'Your Cart' : 'Confirm Redemption'}>
      {step === 'review' ? (
        <>
          <View style={styles.lines}>
            {lines.map(({ item, quantity }) => (
              <View key={item.id} style={styles.line}>
                <Text style={[styles.lineTitle, { color: colors.text }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={[styles.lineMeta, { color: colors.textMuted }]}>
                  ×{quantity}
                </Text>
                <Text style={[styles.lineCost, { color: colors.text }]}>
                  {(item.costPoints * quantity).toLocaleString()} pts
                </Text>
              </View>
            ))}
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: colors.textMuted }]}>Total</Text>
            <Text style={[styles.total, { color: colors.accent }]}>{total.toLocaleString()} pts</Text>
          </View>
          <Text style={[styles.balanceNote, { color: colors.textMuted }]}>
            Balance: {balance.toLocaleString()} pts
          </Text>

          {insufficient ? (
            <Text style={[styles.insufficient, { color: colors.danger }]}>
              Not enough points — you need {(total - balance).toLocaleString()} more.
            </Text>
          ) : null}

          <PillButton
            label="Confirm Checkout"
            variant="primary"
            disabled={insufficient}
            onPress={() => setStep('confirm')}
            accessibilityLabel="Go to confirmation"
            style={styles.cta}
          />
        </>
      ) : (
        <>
          <GlassCard style={styles.summaryCard}>
            <Text style={[styles.summaryTitle, { color: colors.text }]}>
              Redeem {total.toLocaleString()} pts?
            </Text>
            <Text style={[styles.summaryBody, { color: colors.textMuted }]}>
              {itemCount} {itemCount === 1 ? 'item' : 'items'} — {lines.map((l) => `${l.quantity}× ${l.item.title}`).join(', ')}.
              Points are deducted from your balance.
            </Text>
          </GlassCard>
          <View style={styles.confirmRow}>
            <PillButton
              label="Back"
              variant="ghost"
              onPress={() => setStep('review')}
              accessibilityLabel="Back to cart review"
              style={styles.confirmBack}
            />
            <PillButton
              label="Yes, Redeem"
              variant="primary"
              loading={pending}
              disabled={pending}
              onPress={() =>
                onConfirm(
                  lines.map(({ item, quantity }) => ({ itemId: item.id, quantity })),
                )
              }
              accessibilityLabel="Confirm redemption"
              style={styles.confirmGo}
            />
          </View>
        </>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  emptyText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 24,
  },
  lines: {
    gap: 10,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  lineTitle: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    flex: 1,
  },
  lineMeta: {
    fontFamily: FONTS.body,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  lineCost: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  divider: {
    height: 1,
    marginVertical: 14,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  total: {
    fontFamily: FONTS.hero,
    fontSize: 40,
    fontVariant: ['tabular-nums'],
  },
  balanceNote: {
    fontFamily: FONTS.body,
    fontSize: 13,
    marginTop: 2,
  },
  insufficient: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
    marginTop: 10,
  },
  cta: {
    marginTop: 20,
  },
  summaryCard: {
    gap: 6,
  },
  summaryTitle: {
    fontFamily: FONTS.heading,
    fontSize: 22,
  },
  summaryBody: {
    fontFamily: FONTS.body,
    fontSize: 13,
    lineHeight: 18,
  },
  confirmRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  confirmBack: {
    flex: 1,
  },
  confirmGo: {
    flex: 1.4,
  },
});
