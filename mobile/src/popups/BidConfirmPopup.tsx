import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { Button } from '../components/Button';
import { Typography } from '../typography/Typography';
import { formatNumber } from '../utils/format';
import { PopupShell } from './PopupShell';

export interface BidConfirmPopupProps {
  visible: boolean;
  playerName: string;
  amount: number;
  purseRemaining: number;
  secondsRemaining: number | null;
  submitting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Final check before a captain places a bid. */
export function BidConfirmPopup({
  visible,
  playerName,
  amount,
  purseRemaining,
  secondsRemaining,
  submitting = false,
  onConfirm,
  onCancel,
}: BidConfirmPopupProps) {
  const { colors } = useTheme();
  const after = purseRemaining - amount;

  return (
    <PopupShell
      visible={visible}
      onRequestClose={submitting ? () => undefined : onCancel}
      dismissOnBackdrop={!submitting}
      title="Confirm your bid"
      message={`Place a bid for ${playerName}?`}
      tone="primary"
      icon="hammer-outline"
    >
      <View style={[styles.amountBox, { backgroundColor: colors.accentMuted, borderColor: colors.accent }]}>
        <Typography variant="label" color="textMuted">YOUR BID</Typography>
        <Typography variant="h1" color="accent">{formatNumber(amount)} credits</Typography>
      </View>
      <View style={styles.rows}>
        <View style={styles.row}>
          <Typography variant="body" color="textMuted">Purse now</Typography>
          <Typography variant="mono">{formatNumber(purseRemaining)}</Typography>
        </View>
        <View style={styles.row}>
          <Typography variant="body" color="textMuted">If you win</Typography>
          <Typography variant="mono" color={after < 0 ? 'danger' : 'text'}>{formatNumber(after)}</Typography>
        </View>
        {secondsRemaining != null ? (
          <View style={styles.row}>
            <Typography variant="body" color="textMuted">Time left</Typography>
            <Typography variant="mono" color={secondsRemaining <= 5 ? 'danger' : 'text'}>{secondsRemaining}s</Typography>
          </View>
        ) : null}
      </View>
      <View style={styles.actions}>
        <Button label="Place bid" fullWidth loading={submitting} disabled={after < 0} onPress={onConfirm} />
        <Button label="Cancel" variant="ghost" fullWidth disabled={submitting} onPress={onCancel} />
      </View>
    </PopupShell>
  );
}

const styles = StyleSheet.create({
  amountBox: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 4, alignItems: 'center' },
  rows: { gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actions: { gap: 8 },
});
