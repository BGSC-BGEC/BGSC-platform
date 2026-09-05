import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { PillButton } from '@/components/PillButton';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';

/**
 * Section-level states for leaderboard data sections (leaderboard.md §3.4 /
 * §4.7 / §5.6 state matrices): skeletons that mirror live content shape,
 * empty states with a message + optional CTA, and inline error + retry.
 * Vector icons only — no emoji (§16.2 home spec, applied here too).
 */

export function SectionEmpty({
  icon,
  message,
  actionLabel,
  onAction,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const colors = useColors();
  return (
    <GlassCard accessibilityLabel={message}>
      <View style={styles.emptyRoot}>
        <Ionicons name={icon} size={40} color={colors.textMuted} />
        <Text style={[styles.emptyMessage, { color: colors.textMuted }]}>{message}</Text>
        {actionLabel && onAction ? (
          <PillButton label={actionLabel} variant="ghost" onPress={onAction} fullWidth={false} />
        ) : null}
      </View>
    </GlassCard>
  );
}

export function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const colors = useColors();
  return (
    <GlassCard
      // L-20: accessibility label was generic — include the specific error message.
      accessibilityLabel={`Section error: ${message}`}
    >
      <View style={styles.errorRow}>
        <Ionicons name="cloud-offline-outline" size={22} color={colors.danger} />
        <Text style={[styles.errorText, { color: colors.textMuted }]}>{message}</Text>
      </View>
      <PillButton
        label="Retry"
        variant="ghost"
        onPress={onRetry}
        fullWidth={false}
        style={styles.retry}
      />
    </GlassCard>
  );
}

/** Browser skeleton — search bar + chip row + 3 card-shaped placeholders (spec §3.4). */
export function BrowserSkeleton() {
  return (
    <View style={styles.stack}>
      <SkeletonBlock height={48} radius={24} />
      <SkeletonBlock height={36} radius={20} />
      {[0, 1, 2].map((i) => (
        <GlassCard key={i} style={styles.cardSkeleton}>
          <View style={styles.skelRow}>
            <SkeletonBlock width="60%" height={16} radius={4} />
            <SkeletonBlock width={64} height={22} radius={20} />
          </View>
          <SkeletonBlock width="45%" height={12} radius={4} />
          <SkeletonBlock height={1} style={{ marginVertical: 10 }} />
          {[0, 1, 2].map((j) => (
            <SkeletonBlock key={j} height={18} style={{ marginBottom: 8 }} />
          ))}
        </GlassCard>
      ))}
    </View>
  );
}

/** Standings skeleton — 3 podium tiles + 6 rows (spec §4.7). */
export function StandingsSkeleton() {
  return (
    <View style={styles.stack}>
      <View style={styles.podiumSkeleton}>
        {[0, 1, 2].map((i) => (
          <SkeletonBlock key={i} height={132} radius={12} style={{ flex: 1 }} />
        ))}
      </View>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={styles.rowSkeleton}>
          <SkeletonBlock width={28} height={14} radius={4} />
          <SkeletonBlock width={36} height={36} radius={18} />
          <SkeletonBlock width="45%" height={14} radius={4} />
          <SkeletonBlock width={56} height={14} radius={4} />
        </View>
      ))}
    </View>
  );
}

/** Sponsor skeleton — chip rows + 4 bar tracks + 3 sponsor cards (spec §5.6). */
export function SponsorsSkeleton() {
  return (
    <View style={styles.stack}>
      <SkeletonBlock height={36} radius={20} />
      <GlassCard style={styles.cardSkeleton}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.barSkeleton}>
            <SkeletonBlock width="55%" height={12} radius={4} />
            <SkeletonBlock height={10} radius={5} />
          </View>
        ))}
      </GlassCard>
      {[0, 1, 2].map((i) => (
        <GlassCard key={i} style={styles.cardSkeleton}>
          <View style={styles.skelRow}>
            <SkeletonBlock width={48} height={48} radius={8} />
            <View style={styles.skelCol}>
              <SkeletonBlock width="70%" height={14} radius={4} />
              <SkeletonBlock width="50%" height={12} radius={4} />
            </View>
          </View>
        </GlassCard>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
  },
  cardSkeleton: {
    gap: 10,
  },
  skelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skelCol: {
    flex: 1,
    gap: 6,
    marginLeft: 12,
  },
  podiumSkeleton: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    height: 148,
  },
  rowSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 56,
    paddingHorizontal: 4,
  },
  barSkeleton: {
    gap: 6,
    marginBottom: 6,
  },
  emptyRoot: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  emptyMessage: {
    fontFamily: FONTS.body,
    fontSize: 14,
    textAlign: 'center',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  errorText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    flexShrink: 1,
  },
  retry: {
    marginTop: 12,
  },
});
