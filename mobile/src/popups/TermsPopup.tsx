import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { Button } from '../components/Button';
import { Checkbox } from '../forms/Checkbox';
import { Typography } from '../typography/Typography';
import { PopupShell } from './PopupShell';

export const DEFAULT_EVENT_TERMS = [
  'Participants must be registered BGSC members and carry a valid college ID on the day.',
  'Arrive at least 15 minutes before your scheduled slot. Late arrivals may be marked as a no-show.',
  'Organisers may reschedule or cancel fixtures; changes will be posted in announcements.',
  'Unsportsmanlike conduct can lead to disqualification and loss of event points.',
  'Photos and videos taken at BGSC events may be shared on the media page.',
  'Points, auction credits and rewards have no cash value and cannot be transferred.',
];

export interface TermsPopupProps {
  visible: boolean;
  title?: string;
  /** Rule lines to show; defaults to the standard BGSC event rules */
  terms?: string[];
  onAccept: () => void;
  onClose: () => void;
}

/**
 * Scrollable terms & conditions popup. The accept button stays disabled
 * until the member ticks the acknowledgement box.
 */
export function TermsPopup({
  visible,
  title = 'Event rules',
  terms = DEFAULT_EVENT_TERMS,
  onAccept,
  onClose,
}: TermsPopupProps) {
  const { colors } = useTheme();
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    if (visible) setAcknowledged(false);
  }, [visible]);

  return (
    <PopupShell visible={visible} onRequestClose={onClose} title={title} tone="info" icon="document-text-outline">
      <ScrollView
        style={[styles.scroll, { backgroundColor: colors.surfaceInner }]}
        contentContainerStyle={styles.scrollContent}
      >
        {terms.map((line, index) => (
          <View key={line} style={styles.row}>
            <Typography variant="mono" color="accent">{`${index + 1}.`}</Typography>
            <Typography variant="body" color="textMuted" style={styles.line}>
              {line}
            </Typography>
          </View>
        ))}
      </ScrollView>
      <Checkbox checked={acknowledged} onChange={setAcknowledged} label="I have read and agree to these rules" />
      <View style={styles.actions}>
        <Button label="Accept" fullWidth disabled={!acknowledged} onPress={onAccept} />
        <Button label="Close" variant="ghost" fullWidth onPress={onClose} />
      </View>
    </PopupShell>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 260, borderRadius: 16 },
  scrollContent: { padding: 14, gap: 10 },
  row: { flexDirection: 'row', gap: 8 },
  line: { flex: 1 },
  actions: { gap: 8 },
});
