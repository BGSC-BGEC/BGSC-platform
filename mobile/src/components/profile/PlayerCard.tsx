import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { PillButton } from '@/components/PillButton';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import { useToast } from '@/components/Toast';
import { FONTS } from '@/core/theme/fonts';
import { DOMAIN_COLORS } from '@/core/theme/tokens';
import type { UserProfile, UserRole } from '@/core/types';
import { useColors } from '@/hooks/use-colors';
import type { PlayerCardData } from '@/hooks/use-profile';

export interface PlayerCardProps {
  card: PlayerCardData | undefined;
  profile: UserProfile | undefined;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}

/** "1.2k" / "45k" / "1.4M" — compact stat numerals (player card fans, sponsor counts). */
export function formatCompact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}

/** Role tag colours (spec §3.2): founder green · coordinator blue · core purple · member grey. */
function roleColor(role: UserRole, colors: ReturnType<typeof useColors>): string {
  switch (role) {
    case 'founder':
      return colors.success;
    case 'coordinator':
      return colors.info;
    case 'core':
      // tokens have no dedicated role palette — reuse the game_dev purple. TODO(design): add ROLE_COLORS to tokens.
      return DOMAIN_COLORS.game_dev;
    default:
      return colors.textMuted;
  }
}

/**
 * Hero card (profile spec §3): cover, 96 dp avatar with accent ring, display
 * name + @username, sponsor badge, expandable bio, interest / custom / role
 * pills, four-stat row and the two hero actions. Skeleton on first load;
 * inline retry on error.
 *
 * TODO(Phase 2): Edit Profile → Account Actions popup (spec §8.1); Share Card →
 * card-image export flow (spec §3.2, §5.3); avatar tap → picture popup (§8.2).
 */
export function PlayerCard({ card, profile, loading, error, onRetry }: PlayerCardProps) {
  const colors = useColors();
  const toast = useToast();
  const [bioExpanded, setBioExpanded] = useState(false);

  if (loading && !card) return <PlayerCardSkeleton />;
  if (error && !card) {
    return (
      <GlassCard accessibilityLabel="Player card failed to load">
        <Text style={[styles.errorText, { color: colors.textMuted }]}>
          Could not load your player card
        </Text>
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry loading player card"
          hitSlop={8}
          style={styles.retry}
        >
          <Text style={[styles.retryText, { color: colors.accent }]}>Retry</Text>
        </Pressable>
      </GlassCard>
    );
  }
  if (!card) return null;

  const displayName = card.displayName || card.username;
  const bio = profile?.bio ?? '';
  const showRolePill = card.role !== 'guest' && card.role !== 'user';
  const stats: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { label: 'Events', value: formatCompact(card.totalEvents), icon: 'calendar-outline' },
    { label: 'Wins', value: formatCompact(card.totalWins), icon: 'trophy-outline' },
    { label: 'Fans', value: formatCompact(card.totalFans), icon: 'people-outline' },
    { label: 'Rating', value: card.rating != null ? card.rating.toFixed(1) : '—', icon: 'star-outline' },
  ];

  return (
    <GlassCard accessibilityLabel={`Player card for ${displayName}`} style={styles.card}>
      {profile?.coverImageUrl ? (
        <Image
          source={{ uri: profile.coverImageUrl }}
          style={styles.cover}
          contentFit="cover"
          accessibilityLabel="Profile cover image"
        />
      ) : (
        <View style={[styles.cover, { backgroundColor: colors.backgroundMid }]} />
      )}

      <View style={styles.identityRow}>
        <View style={[styles.avatarRing, { borderColor: colors.accent }]}>
          {card.avatarUrl ? (
            <Image
              source={{ uri: card.avatarUrl }}
              style={styles.avatar}
              contentFit="cover"
              accessibilityLabel={`${displayName} avatar`}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.surfaceSolid }]}>
              <Text style={[styles.avatarInitial, { color: colors.text }]}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.nameCol}>
          <Text style={[styles.displayName, { color: colors.text }]} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={[styles.username, { color: colors.textMuted }]} numberOfLines={1}>
            @{card.username}
          </Text>
          {card.sponsorName ? (
            <Pressable
              onPress={() => {
                // TODO(Phase 2): sponsor detail route — toast until /sponsor/[id] exists.
                toast.show(`${card.sponsorName} — sponsor page coming soon`);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${card.sponsorName} sponsor badge`}
              hitSlop={8}
              style={[styles.sponsorBadge, { backgroundColor: colors.accentMuted, borderColor: colors.borderActive }]}
            >
              {card.sponsorLogoUrl ? (
                <Image source={{ uri: card.sponsorLogoUrl }} style={styles.sponsorLogo} contentFit="contain" />
              ) : (
                <Ionicons name="trophy-outline" size={12} color={colors.accent} />
              )}
              <Text style={[styles.sponsorName, { color: colors.accent }]} numberOfLines={1}>
                {card.sponsorName}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {bio ? (
        <View style={styles.bioBlock}>
          <Text style={[styles.bio, { color: colors.textMuted }]} numberOfLines={bioExpanded ? undefined : 3}>
            {bio}
          </Text>
          {bio.length > 120 ? (
            <Pressable
              onPress={() => setBioExpanded((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={bioExpanded ? 'Collapse bio' : 'Expand bio'}
              hitSlop={8}
            >
              <Text style={[styles.bioMore, { color: colors.accent }]}>
                {bioExpanded ? 'less' : 'more'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <Text style={[styles.bio, { color: colors.textMuted }]}>
          No bio yet — tap Edit Profile to add one.
        </Text>
      )}

      {(card.interests.length > 0 || card.customTags.length > 0 || showRolePill) && (
        <View style={styles.chipRow}>
          {showRolePill ? (
            <View style={[styles.rolePill, { backgroundColor: roleColor(card.role as UserRole, colors) }]}>
              <Text style={[styles.rolePillText, { color: colors.accentText }]}>{card.role}</Text>
            </View>
          ) : null}
          {card.interests.map((i) => (
            <View key={i} style={[styles.infoChip, { borderColor: colors.border }]}>
              <Text style={[styles.infoChipText, { color: colors.textMuted }]}>{i}</Text>
            </View>
          ))}
          {card.customTags.map((t) => (
            <View key={t} style={[styles.infoChip, { borderColor: colors.border }]}>
              <Text style={[styles.infoChipText, { color: colors.textMuted }]}>{t}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.statsRow}>
        {stats.map((s) => (
          <StatBlock key={s.label} {...s} />
        ))}
      </View>

      <View style={styles.actionsRow}>
        <PillButton
          variant="primary"
          label="Edit Profile"
          onPress={() => {
            // TODO(Phase 2): open Account Actions popup (spec §8.1) — edit flow not in this milestone.
            toast.show('Profile editing is coming soon');
          }}
          accessibilityLabel="Edit profile"
          style={styles.actionButton}
        />
        <PillButton
          variant="ghost"
          label="Share Card"
          onPress={() => {
            // TODO(Phase 2): player-card image export → preview sheet → native share (spec §3.2 / §5.3).
            toast.show('Card sharing is coming soon');
          }}
          accessibilityLabel="Share player card"
          style={styles.actionButton}
        />
      </View>
    </GlassCard>
  );
}

/** One stat block (spec §3.2) — hero numerals, subtle scale bounce on press. */
function StatBlock({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  const colors = useColors();
  const [scale] = useState(() => new Animated.Value(1));

  return (
    <Pressable
      onPressIn={() =>
        Animated.spring(scale, { toValue: 0.94, speed: 40, bounciness: 0, useNativeDriver: true }).start()
      }
      onPressOut={() =>
        Animated.spring(scale, { toValue: 1, speed: 40, bounciness: 0, useNativeDriver: true }).start()
      }
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      style={styles.stat}
    >
      <Animated.View style={[styles.statInner, { transform: [{ scale }] }]}>
        <Ionicons name={icon} size={14} color={colors.textMuted} />
        <Text
          style={[styles.statValue, { color: colors.text }]}
          adjustsFontSizeToFit
          numberOfLines={1}
        >
          {value}
        </Text>
        <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

/** Skeleton matching the live hero shape (spec §11): avatar circle, lines, 4 stat blocks. */
export function PlayerCardSkeleton() {
  return (
    <GlassCard accessibilityLabel="Loading player card">
      <SkeletonBlock height={96} radius={16} />
      <View style={styles.skeletonIdentity}>
        <SkeletonBlock width={96} height={96} radius={48} />
        <View style={styles.skeletonCol}>
          <SkeletonBlock width={140} height={20} radius={4} />
          <SkeletonBlock width={90} height={14} radius={4} />
          <SkeletonBlock width={120} height={22} radius={20} />
        </View>
      </View>
      <SkeletonBlock width="100%" height={14} radius={4} />
      <SkeletonBlock width="70%" height={14} radius={4} />
      <View style={styles.statsRow}>
        {[1, 2, 3, 4].map((i) => (
          <SkeletonBlock key={i} height={64} radius={12} style={{ flex: 1 }} />
        ))}
      </View>
      <SkeletonBlock height={52} radius={999} />
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 0,
  },
  cover: {
    width: '100%',
    height: 108,
  },
  identityRow: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 14,
    paddingTop: 14,
    alignItems: 'center',
  },
  avatarRing: {
    width: 102,
    height: 102,
    borderRadius: 51,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: FONTS.heading,
    fontSize: 40,
  },
  nameCol: {
    flex: 1,
    gap: 2,
  },
  displayName: {
    fontFamily: FONTS.heading,
    fontSize: 24,
  },
  username: {
    fontFamily: FONTS.body,
    fontSize: 14,
  },
  sponsorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 6,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  sponsorLogo: {
    width: 14,
    height: 14,
  },
  sponsorName: {
    fontFamily: FONTS.semibold,
    fontSize: 12,
  },
  bioBlock: {
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  bio: {
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 20,
  },
  bioMore: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
    marginTop: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  rolePill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  rolePillText: {
    fontFamily: FONTS.semibold,
    fontSize: 12,
    textTransform: 'capitalize',
  },
  infoChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  infoChipText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 16,
  },
  stat: {
    flex: 1,
    minHeight: 64,
  },
  statInner: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: 8,
    borderRadius: 12,
  },
  statValue: {
    fontFamily: FONTS.hero,
    fontSize: 32,
    fontVariant: ['tabular-nums'],
    lineHeight: 34,
  },
  statLabel: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
  },
  actionButton: {
    flex: 1,
  },
  errorText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    textAlign: 'center',
    paddingTop: 8,
  },
  retry: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    fontFamily: FONTS.semibold,
    fontSize: 14,
  },
  skeletonIdentity: {
    flexDirection: 'row',
    gap: 14,
    paddingTop: 14,
  },
  skeletonCol: {
    flex: 1,
    gap: 10,
    justifyContent: 'center',
  },
});
