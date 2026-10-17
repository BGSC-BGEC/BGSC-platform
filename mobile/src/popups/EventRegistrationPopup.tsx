import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { Button } from '../components/Button';
import { Typography } from '../typography/Typography';
import { PopupShell } from './PopupShell';

export interface EventRegistrationPopupProps {
  visible: boolean;
  eventTitle: string;
  /** Label / value rows summarising what will be submitted */
  summary: Array<{ label: string; value: string }>;
  note?: string;
  submitting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** "Confirm your registration" popup shown before the form is submitted. */
export function EventRegistrationPopup({
  visible,
  eventTitle,
  summary,
  note,
  submitting = false,
  onConfirm,
  onCancel,
}: EventRegistrationPopupProps) {
  const { colors } = useTheme();

  return (
    <PopupShell
      visible={visible}
      onRequestClose={submitting ? () => undefined : onCancel}
      dismissOnBackdrop={!submitting}
      title="Confirm registration"
      message={`You are registering for ${eventTitle}.`}
      tone="primary"
      icon="calendar"
    >
      <View style={[styles.summary, { backgroundColor: colors.surfaceInner }]}>
        {summary.map((row) => (
          <View key={row.label} style={styles.row}>
            <Typography variant="label" color="textMuted">{row.label}</Typography>
            <Typography variant="body" style={styles.value} numberOfLines={2}>
              {row.value}
            </Typography>
          </View>
        ))}
      </View>
      {note ? <Typography variant="caption" color="textMuted">{note}</Typography> : null}
      <View style={styles.actions}>
        <Button label="Submit registration" fullWidth loading={submitting} onPress={onConfirm} />
        <Button label="Go back" variant="ghost" fullWidth disabled={submitting} onPress={onCancel} />
      </View>
    </PopupShell>
  );
}

const styles = StyleSheet.create({
  summary: { borderRadius: 16, padding: 14, gap: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  value: { flexShrink: 1, textAlign: 'right' },
  actions: { gap: 8 },
});
