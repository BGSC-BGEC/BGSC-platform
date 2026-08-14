import { StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { DifficultyPill, DomainPill } from '@/components/challenges/Pills';
import { PillButton } from '@/components/PillButton';
import { FONTS } from '@/core/theme/fonts';
import type { Challenge } from '@/core/types';
import { useColors } from '@/hooks/use-colors';

export interface AcceptChallengeSheetProps {
  visible: boolean;
  challenge: Challenge | null;
  confirming: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Accept challenge sheet (points spec §7): challenge summary, team/award,
 * time limit — the FIRST place a digital challenge's time limit is revealed
 * (spec §7.1). Physical challenges get a space/time warning; legend-tier gets
 * a Hall of Fame notice.
 *
 * TODO(Phase 2): time limit is fetched live when the sheet opens (spec §7.1)
 * — refetch ['challenges','detail',id] with staleTime: 0 before opening once
 * the challenge-service exists. The mock already carries fresh data.
 */
export function AcceptChallengeSheet({
  visible,
  challenge,
  confirming,
  onConfirm,
  onCancel,
}: AcceptChallengeSheetProps) {
  const colors = useColors();
  if (!challenge) return null;

  return (
    <BottomSheet visible={visible} onClose={onCancel} title="Accept Challenge">
      <View style={styles.body}>
        <View style={styles.pillRow}>
          <DomainPill domain={challenge.domain} />
          <DifficultyPill difficulty={challenge.difficulty} />
        </View>
        <Text style={[styles.name, { color: colors.text }]}>{challenge.title}</Text>

        <View style={styles.rows}>
          <Text style={[styles.row, { color: colors.textMuted }]}>
            👥 Team: {challenge.teamLimit === 1 ? 'Solo' : `up to ${challenge.teamLimit}`}
          </Text>
          <Text style={[styles.row, { color: colors.textMuted }]}>
            ⭐ Award: +{challenge.awardPoints} pts on completion
          </Text>
          <Text style={[styles.row, { color: colors.textMuted }]}>
            ⏱ Time limit: {challenge.timeLimitDays == null ? 'No limit' : `${challenge.timeLimitDays} day${challenge.timeLimitDays === 1 ? '' : 's'}`}
          </Text>
        </View>

        {challenge.mode === 'physical' && (
          <Text style={[styles.notice, { color: colors.textMuted }]}>
            ⚠️ Requires dedicated space / time
          </Text>
        )}
        {challenge.hallOfFameEligible && (
          <Text style={[styles.notice, { color: colors.textMuted }]}>
            🏆 Completing this earns a Hall of Fame entry
          </Text>
        )}

        <View style={styles.actions}>
          <PillButton
            variant="ghost"
            label="Cancel"
            onPress={onCancel}
            disabled={confirming}
            fullWidth={false}
            accessibilityLabel="Cancel accepting challenge"
            style={styles.button}
          />
          <PillButton
            variant="primary"
            label="Confirm — Start →"
            onPress={onConfirm}
            loading={confirming}
            disabled={confirming}
            fullWidth={false}
            accessibilityLabel="Confirm and start challenge"
            style={styles.button}
          />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: 12,
    paddingBottom: 8,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  name: {
    fontFamily: FONTS.bold,
    fontSize: 16,
  },
  rows: {
    gap: 6,
  },
  row: {
    fontFamily: FONTS.body,
    fontSize: 14,
  },
  notice: {
    fontFamily: FONTS.body,
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  button: {
    flex: 1,
    paddingHorizontal: 12,
  },
});
