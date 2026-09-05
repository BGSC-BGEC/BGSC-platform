import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import type { HallOfFameEventWinner } from '@/core/types';
import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';
import { formatMonthYear } from '@/lib/dates';

interface WinnerCardProps {
  winner: HallOfFameEventWinner;
  onPress: () => void;
  onShare: () => void;
}

/**
 * Standard winner card (hall-of-fame spec §6.1): fixed ~280 dp width for
 * horizontal carousels. Trophy icon, event name, winner score as a hero
 * number, "Month Year" date, share action.
 *
 * TODO(Phase 2): the event-winners DTO carries only `userId` — resolve the
 * display name via a public user-profile endpoint once user-service ships it;
 * until then the score is the card's headline.
 */
export function WinnerCard({ winner, onPress, onShare }: WinnerCardProps) {
  const colors = useColors();

  return (
    <GlassCard onPress={onPress} accessibilityLabel={`Open ${winner.eventTitle} winner details`} style={styles.card}>
      <View style={styles.topRow}>
        <View style={[styles.iconBadge, { backgroundColor: colors.surfaceMuted }]}>
          <Ionicons name="trophy-outline" size={18} color={colors.accent} />
        </View>
        <Pressable
          onPress={onShare}
          accessibilityRole="button"
          accessibilityLabel={`Share ${winner.eventTitle} winner card`}
          hitSlop={8}
          style={styles.share}
        >
          <Ionicons name="share-outline" size={18} color={colors.textMuted} />
        </Pressable>
      </View>
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
        {winner.eventTitle}
      </Text>
      <Text style={[styles.winnerLabel, { color: colors.textMuted }]}>Winner</Text>
      <Text style={[styles.score, { color: colors.accent }]}>
        {winner.score.toLocaleString('en-IN')}
      </Text>
      <Text style={[styles.date, { color: colors.textMuted }]}>
        {formatMonthYear(winner.eventDate)}
      </Text>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 280,
    gap: 6,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  share: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 20,
  },
  winnerLabel: {
    fontFamily: FONTS.body,
    fontSize: 13,
    marginTop: 4,
  },
  score: {
    fontFamily: FONTS.hero,
    fontSize: 34,
    lineHeight: 38,
    fontVariant: ['tabular-nums'],
  },
  date: {
    fontFamily: FONTS.body,
    fontSize: 12,
  },
});
