import { useLocalSearchParams, router } from 'expo-router';
import { Share ,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthLocked } from '@/components/AuthLocked';
import { AcceptChallengeSheet } from '@/components/challenges/AcceptChallengeSheet';
import { ChallengeStatRow } from '@/components/challenges/ChallengeStatRow';
import { CountdownTimer } from '@/components/challenges/CountdownTimer';
import { DifficultyPill, DomainPill, StatusPill } from '@/components/challenges/Pills';
import { ResourceLinkRow } from '@/components/challenges/ResourceLinkRow';
import { StackNavBar } from '@/components/challenges/StackNavBar';
import { GlassCard } from '@/components/GlassCard';
import { PillButton } from '@/components/PillButton';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import { useToast } from '@/components/Toast';
import { useAuthStore } from '@/core/stores/authStore';
import { FONTS } from '@/core/theme/fonts';
import type { Challenge } from '@/core/types';
import { useColors } from '@/hooks/use-colors';
import { useAcceptChallenge, useChallengeDetail } from '@/hooks/use-challenges';

/**
 * Challenge detail (points spec §6): full spec, stat row, Hall of Fame banner
 * (legend), resource links, status pill, bottom-fixed ActionArea with all six
 * user states (§6.5), and the accept sheet (§7).
 */
export default function ChallengeDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const status = useAuthStore((s) => s.status);
  const authed = status === 'authenticated';

  const query = useChallengeDetail(id, { enabled: authed });
  const accept = useAcceptChallenge();
  const [sheetOpen, setSheetOpen] = useState(false);

  const challenge = query.data;

  if (status === 'unknown' || status === 'loading') {
    return (
      <View style={[styles.canvas, { backgroundColor: colors.background }]}>
        <StackNavBar title="Challenge" onBack={() => router.back()} />
        <View style={styles.detailSkeleton}>
          <SkeletonBlock width="70%" height={24} radius={6} />
          <SkeletonBlock height={14} radius={4} />
          <SkeletonBlock height={14} radius={4} />
          <SkeletonBlock width="60%" height={14} radius={4} />
          <SkeletonBlock height={64} radius={16} />
          <SkeletonBlock height={48} radius={16} />
          <SkeletonBlock height={48} radius={16} />
        </View>
      </View>
    );
  }

  if (!authed) {
    return (
      <View style={[styles.canvas, { backgroundColor: colors.background }]}>
        <StackNavBar title="Challenge" onBack={() => router.back()} />
        <AuthLocked subject="challenge details" />
      </View>
    );
  }

  const share = () => {
    if (!challenge) return;
    // TODO(Phase 2): real deep link once a web route exists — use expo-linking
    // createURL('/challenge/' + id) for a platform-correct URL.
    void Share.share({
      message: `Check out this challenge on BGSC: ${challenge.title}`,
      url: `https://bgsc.app/challenge/${challenge.id}`,
    });
  };

  const confirmAccept = () => {
    accept.mutate(id, {
      onSuccess: () => {
        setSheetOpen(false);
        toast.show('Challenge accepted! Good luck.');
      },
      onError: (err) => toast.show(err instanceof Error ? err.message : 'Could not accept challenge'),
    });
  };

  return (
    <View style={[styles.canvas, { backgroundColor: colors.background }]}>
      <StackNavBar
        title={challenge?.title ?? 'Challenge'}
        onBack={() => router.back()}
        onShare={share}
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {query.isPending ? (
          <DetailSkeleton />
        ) : query.isError ? (
          <ErrorState onRetry={() => query.refetch()} />
        ) : challenge ? (
          <View style={styles.body}>
            <View style={styles.pillRow}>
              <DomainPill domain={challenge.domain} />
              <DifficultyPill difficulty={challenge.difficulty} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>{challenge.title}</Text>
            <Text style={[styles.description, { color: colors.textMuted }]}>
              {challenge.description}
            </Text>

            <GlassCard accessibilityLabel="Challenge stats">
              <ChallengeStatRow challenge={challenge} />
            </GlassCard>

            {challenge.hallOfFameEligible && (
              <GlassCard
                selected
                accessibilityLabel="Hall of Fame eligibility"
                style={styles.hofBanner}
              >
                <Text style={[styles.hofText, { color: colors.text }]}>
                  🏆 Completing this earns a{' '}
                  <Text style={{ color: colors.accent }}>Hall of Fame</Text> entry
                </Text>
              </GlassCard>
            )}

            <ResourceLinkRow resources={challenge.resources} />

            <View style={styles.statusRow}>
              <StatusPill status={challenge.status} />
            </View>
          </View>
        ) : (
          <ErrorState onRetry={() => query.refetch()} message="Challenge not found" />
        )}
      </ScrollView>

      <View style={[styles.actionArea, { borderTopColor: colors.border, paddingBottom: insets.bottom + 12 }]}>
        <ActionArea
          challenge={challenge}
          onAccept={() => setSheetOpen(true)}
          onViewSubmission={() => router.push(`/challenge/${id}/submission`)}
        />
      </View>

      <AcceptChallengeSheet
        visible={sheetOpen && !!challenge && challenge.userState === 'not_accepted'}
        challenge={challenge ?? null}
        confirming={accept.isPending}
        onConfirm={confirmAccept}
        onCancel={() => setSheetOpen(false)}
      />
    </View>
  );
}

/** Bottom-fixed action area (points spec §6.5) — six user states. */
function ActionArea({
  challenge,
  onAccept,
  onViewSubmission,
}: {
  challenge: Challenge | null | undefined;
  onAccept: () => void;
  onViewSubmission: () => void;
}) {
  const colors = useColors();
  if (!challenge) return null;

  const closed = challenge.status !== 'active';

  switch (challenge.userState) {
    case 'not_accepted':
      return closed ? (
        <Notice text="Challenge closed" muted />
      ) : (
        <PillButton variant="primary" label="Accept Challenge" onPress={onAccept} />
      );
    case 'accepted':
      return (
        <View style={styles.stateBlock}>
          <View style={styles.stateRow}>
            <StatePill label="In Progress" color={colors.accent} />
            <CountdownTimer deadline={challenge.deadline} />
          </View>
          <PillButton variant="ghost" label="View Submission" onPress={onViewSubmission} />
        </View>
      );
    case 'submitted':
      return (
        <View style={styles.stateBlock}>
          <View style={styles.stateRow}>
            <StatePill label="Under Review" color={colors.info} />
          </View>
          <PillButton variant="ghost" label="View Submission" onPress={onViewSubmission} />
        </View>
      );
    case 'rejected':
      return (
        <View style={styles.stateBlock}>
          <View style={styles.stateRow}>
            <StatePill label="Rejected" color={colors.danger} />
          </View>
          <PillButton variant="ghost" label="View Submission" onPress={onViewSubmission} />
        </View>
      );
    case 'approved':
      return (
        <Pressable
          disabled
          accessibilityRole="button"
          accessibilityLabel="Challenge completed"
          accessibilityState={{ disabled: true }}
          style={[styles.completed, { borderColor: colors.success }]}
        >
          <Text style={[styles.completedText, { color: colors.success }]}>
            Completed ✓  +{challenge.awardPoints} pts earned
          </Text>
        </Pressable>
      );
    default:
      return null;
  }
}

function StatePill({ label, color }: { label: string; color: string }) {
  const colors = useColors();
  return (
    <View style={[styles.statePill, { backgroundColor: colors.surfaceMuted, borderColor: color }]}>
      <Text style={[styles.statePillText, { color }]}>{label}</Text>
    </View>
  );
}

function Notice({ text, muted }: { text: string; muted?: boolean }) {
  const colors = useColors();
  return (
    <Text style={[styles.notice, { color: muted ? colors.textMuted : colors.text }]}>
      {text}
    </Text>
  );
}

function ErrorState({ onRetry, message = 'Could not load challenge' }: { onRetry: () => void; message?: string }) {
  const colors = useColors();
  return (
    <View style={styles.error}>
      <Text style={[styles.errorText, { color: colors.textMuted }]}>{message}</Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Retry"
        hitSlop={8}
        style={styles.retry}
      >
        <Text style={[styles.retryText, { color: colors.accent }]}>Retry</Text>
      </Pressable>
    </View>
  );
}

function DetailSkeleton() {
  return (
    <View style={styles.detailSkeleton}>
      <View style={styles.pillRow}>
        <SkeletonBlock width={64} height={22} radius={20} />
        <SkeletonBlock width={56} height={22} radius={20} />
      </View>
      <SkeletonBlock width="80%" height={26} radius={6} />
      <SkeletonBlock height={14} radius={4} />
      <SkeletonBlock height={14} radius={4} />
      <SkeletonBlock width="60%" height={14} radius={4} />
      <SkeletonBlock height={64} radius={16} />
      <SkeletonBlock height={48} radius={16} />
      <SkeletonBlock height={48} radius={16} />
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
  scroll: {
    padding: 16,
    paddingBottom: 24,
  },
  body: {
    gap: 16,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 24,
  },
  description: {
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 21,
  },
  hofBanner: {
    borderWidth: 1,
  },
  hofText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
  },
  statusRow: {
    flexDirection: 'row',
  },
  actionArea: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  stateBlock: {
    gap: 10,
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  statePill: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statePillText: {
    fontFamily: FONTS.semibold,
    fontSize: 12,
  },
  notice: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 8,
  },
  completed: {
    borderRadius: 999,
    borderWidth: 1,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.9,
  },
  completedText: {
    fontFamily: FONTS.semibold,
    fontSize: 15,
  },
  error: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  errorText: {
    fontFamily: FONTS.body,
    fontSize: 14,
  },
  retry: {
    minHeight: 44,
    justifyContent: 'center',
  },
  retryText: {
    fontFamily: FONTS.semibold,
    fontSize: 14,
  },
  detailSkeleton: {
    padding: 16,
    gap: 10,
  },
});
