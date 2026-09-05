import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { DifficultyPill } from '@/components/challenges/Pills';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import { FONTS } from '@/core/theme/fonts';
import type { Challenge } from '@/core/types';
import { useColors } from '@/hooks/use-colors';

interface ActiveChallengeStripProps {
  challenges: Challenge[] | undefined;
  loading: boolean;
}

/**
 * "Your Active Challenges" strip (points spec §9.3) — sits between How to
 * Spend and Transaction History. Hidden entirely when the user has no
 * in-progress challenges. Tap → submission screen directly.
 */
export function ActiveChallengeStrip({ challenges, loading }: ActiveChallengeStripProps) {
  const colors = useColors();

  if (loading) {
    return (
      <View style={styles.section}>
        <SkeletonBlock width={180} height={20} radius={6} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          <SkeletonBlock width={150} height={88} radius={16} />
          <SkeletonBlock width={150} height={88} radius={16} />
        </ScrollView>
      </View>
    );
  }

  const active = challenges?.filter(
    (c) => c.userState === 'accepted' || c.userState === 'submitted',
  ) ?? [];
  if (active.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: colors.text }]}>Your Active Challenges</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {active.map((c) => (
          <ActiveChallengeCard key={c.id} challenge={c} />
        ))}
      </ScrollView>
    </View>
  );
}

function ActiveChallengeCard({ challenge }: { challenge: Challenge }) {
  const colors = useColors();
  return (
    <GlassCard
      style={styles.card}
      onPress={() => router.push(`/challenge/${challenge.id}/submission`)}
      accessibilityLabel={`Open submission for ${challenge.title}`}
    >
      <DifficultyPill difficulty={challenge.difficulty} />
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
        {challenge.title}
      </Text>
      <Text style={[styles.footer, { color: colors.textMuted }]}>
        ⏱ {challenge.deadline ? fmtTimeLeft(challenge.deadline) : 'No deadline'}{'  '}
        <Text style={{ color: colors.accent }}>⭐ +{challenge.awardPoints} pts</Text>
      </Text>
    </GlassCard>
  );
}

function fmtTimeLeft(deadline: string): string {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return 'Ending soon';
  const hours = Math.ceil(ms / 3_600_000);
  if (hours < 24) return `${hours}h left`;
  return `${Math.ceil(ms / 86_400_000)}d left`;
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },
  heading: {
    fontFamily: FONTS.heading,
    fontSize: 20,
  },
  row: {
    gap: 12,
    paddingRight: 16,
  },
  card: {
    width: 150,
    gap: 8,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 13,
  },
  footer: {
    fontFamily: FONTS.body,
    fontSize: 12,
  },
});
