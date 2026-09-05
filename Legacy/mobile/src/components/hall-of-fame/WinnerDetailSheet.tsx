import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { PillButton } from '@/components/PillButton';
import { useToast } from '@/components/Toast';
import type { HallOfFameEventWinner } from '@/core/types';
import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';
import { formatFullDate } from '@/lib/dates';

interface WinnerDetailSheetProps {
  winner: HallOfFameEventWinner | null;
  onClose: () => void;
}

/**
 * Winner detail bottom sheet (hall-of-fame spec §9): full event info, the
 * winner's score, View Event Details (event route exists), and Share.
 *
 * TODO(Phase 2): team roster + winner quote + sponsor affiliation arrive with
 * the richer event-winners DTO; the sheet renders them once present.
 * TODO(Phase 2): shareable branded card image via expo-sharing.
 */
export function WinnerDetailSheet({ winner, onClose }: WinnerDetailSheetProps) {
  const toast = useToast();

  const onShare = () => {
    toast.show('Shareable winner cards arrive with Phase 2 media support.');
  };

  return (
    <BottomSheet visible={winner !== null} onClose={onClose} title={winner?.eventTitle}>
      {winner ? (
        <View style={styles.content}>
          <DetailRow label="Category" value="League" />
          <DetailRow label="Date" value={formatFullDate(winner.eventDate)} />
          <DetailRow label="Winner" value={`Top scorer · ${winner.score.toLocaleString('en-IN')} pts`} />
          <PillButton
            label="View Event Details"
            variant="ghost"
            onPress={() => {
              onClose();
              router.push(`/event/${winner.eventId}`);
            }}
            style={styles.button}
          />
          <PillButton
            label="Share"
            variant="ghost"
            onPress={onShare}
            style={styles.button}
          />
        </View>
      ) : null}
    </BottomSheet>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
  },
  row: {
    gap: 2,
  },
  rowLabel: {
    fontFamily: FONTS.semibold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  rowValue: {
    fontFamily: FONTS.medium,
    fontSize: 15,
  },
  button: {
    marginTop: 4,
  },
});
