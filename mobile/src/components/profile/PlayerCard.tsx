import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SkeletonBox } from '@/components/home/SkeletonBox';
import { apiClient } from '@/core/api/ApiClient';
import { UserRepository } from '@/core/repositories/UserRepository';
import { useAuthStore } from '@/core/stores/authStore';
import type { UserProfile, UserRole } from '@/core/types';
import { useColors } from '@/hooks/use-colors';

const ROLE_COLORS: Partial<Record<UserRole, string>> = {
  founder: '#22c55e',
  coordinator: '#3b82f6',
  core: '#8b5cf6',
  member: '#8c857a',
};

const DOMAIN_COLORS: Record<string, string> = {
  sports: '#f59e0b',
  esports: '#8b5cf6',
  gaming_industry: '#3b82f6',
  game_dev: '#e8662a',
};

function fmt(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

interface Props {
  onEditProfile: () => void;
}

export function PlayerCard({ onEditProfile }: Props) {
  const colors = useColors();
  const status = useAuthStore((s) => s.status);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: UserRepository.getProfile,
    enabled: status === 'authenticated',
  });

  // Shared query — no extra network call (UserInfoPanel fetches it too with same key)
  const { data: sponsorStats } = useQuery({
    queryKey: ['sponsorStats'],
    queryFn: UserRepository.getSponsorStats,
    enabled: status === 'authenticated' && !!profile?.activeSponsorId,
  });

  const entranceAnim = useRef(new Animated.Value(0)).current;
  const scaleAnims = useRef([0, 1, 2, 3].map(() => new Animated.Value(1))).current;

  useEffect(() => {
    if (profile) {
      Animated.timing(entranceAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }).start();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!profile]);

  if (isLoading || !profile) {
    return <PlayerCardSkeleton colors={colors} />;
  }

  const displayName = profile.displayName || profile.username;
  const roleColor = ROLE_COLORS[profile.role];
  const showRole = profile.role !== 'user' && profile.role !== 'guest';

  // Pull live event stats from event-service directly (JWT protected route)
  const { data: eventStats } = useQuery({
    queryKey: ['eventStats'],
    queryFn: () => apiClient.get<{ totalRegistrations: number; totalWins: number }>('/events/me/stats'),
    enabled: status === 'authenticated',
  });

  return (
    <Animated.View
      style={[
        s.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        {
          opacity: entranceAnim,
          transform: [{ translateY: entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
        },
      ]}
    >
      {/* Cover */}
      <View style={[s.cover, { backgroundColor: colors.surfaceMuted }]} />

      {/* Avatar + identity row */}
      <View style={s.identityRow}>
        <View style={[s.avatarRing, { borderColor: colors.accent }]}>
          <View style={[s.avatar, { backgroundColor: colors.accent }]}>
            <Text style={[s.avatarInitial, { color: colors.accentText }]}>
              {displayName.slice(0, 1).toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={s.nameBlock}>
          <Text style={[s.displayName, { color: colors.text }]} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={[s.username, { color: colors.textMuted }]}>@{profile.username}</Text>
          {sponsorStats && (
            <Pressable
              style={[s.sponsorBadge, { backgroundColor: colors.accentMuted, borderColor: colors.accent }]}
              onPress={() => {}}
            >
              <Text style={[s.sponsorBadgeText, { color: colors.accent }]}>
                {sponsorStats.sponsorName}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      <View style={s.body}>
        {/* Bio */}
        <BioText bio={profile.bio} colors={colors} onEdit={onEditProfile} />

        {/* Interest chips */}
        {profile.interests.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
            {profile.interests.map((i) => (
              <View
                key={i.id}
                style={[
                  s.chip,
                  { backgroundColor: DOMAIN_COLORS[i.domain] + '22', borderColor: DOMAIN_COLORS[i.domain] + '88' },
                ]}
              >
                <Text style={[s.chipText, { color: DOMAIN_COLORS[i.domain] }]}>{i.label}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Role + custom tags */}
        <View style={s.tagRow}>
          {showRole && roleColor && (
            <View style={[s.roleTag, { backgroundColor: roleColor + '22', borderColor: roleColor + '88' }]}>
              <Text style={[s.roleTagText, { color: roleColor }]}>
                {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
              </Text>
            </View>
          )}
          {profile.customTags.map((tag) => (
            <View key={tag} style={[s.customTag, { borderColor: colors.border }]}>
              <Text style={[s.customTagText, { color: colors.textMuted }]}>{tag}</Text>
            </View>
          ))}
        </View>

        {/* Stats row */}
        <View style={[s.statsRow, { borderColor: colors.border }]}>
          {[
            { label: 'Events', value: fmt(eventStats?.totalRegistrations ?? 0) },
            { label: 'Wins', value: fmt(eventStats?.totalWins ?? 0) },
            { label: 'Fans', value: fmt(sponsorStats?.fansContributed ?? 0) },
            { label: 'Rating', value: profile.rating ? `${profile.rating}⭐` : '—' },
          ].map((stat, i) => (
            <Pressable
              key={stat.label}
              style={[
                s.statBlock,
                i < 3 && { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.border },
              ]}
              onPress={() => {
                Animated.sequence([
                  Animated.spring(scaleAnims[i], { toValue: 1.2, useNativeDriver: true, speed: 20, bounciness: 15 }),
                  Animated.spring(scaleAnims[i], { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }),
                ]).start();
              }}
              accessibilityLabel={`${stat.label}: ${stat.value}`}
            >
              <Animated.View style={{ transform: [{ scale: scaleAnims[i] }] }}>
                <Text style={[s.statValue, { color: colors.text }]}>{stat.value}</Text>
                <Text style={[s.statLabel, { color: colors.textMuted }]}>{stat.label}</Text>
              </Animated.View>
            </Pressable>
          ))}
        </View>

        {/* Action buttons */}
        <View style={s.actionsRow}>
          <Pressable
            onPress={onEditProfile}
            style={[s.primaryActionBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={[s.primaryActionText, { color: colors.primaryText }]}>Edit Profile</Text>
          </Pressable>
          <Pressable
            onPress={() => Alert.alert('Share Card', 'Shareable card generation coming soon.')}
            style={[s.outlineActionBtn, { borderColor: colors.border }]}
          >
            <Ionicons name="share-outline" size={16} color={colors.text} />
            <Text style={[s.outlineActionText, { color: colors.text }]}>Share Card</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

function BioText({
  bio,
  colors,
  onEdit,
}: {
  bio?: string;
  colors: ReturnType<typeof useColors>;
  onEdit: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!bio) {
    return (
      <Pressable onPress={onEdit}>
        <Text style={[s.bioEmpty, { color: colors.textMuted }]}>
          Tap <Text style={{ color: colors.accent }}>Edit Profile</Text> to add a bio
        </Text>
      </Pressable>
    );
  }
  return (
    <View>
      <Text style={[s.bio, { color: colors.textMuted }]} numberOfLines={expanded ? 8 : 3}>
        {bio}
      </Text>
      {bio.length > 120 && (
        <Pressable onPress={() => setExpanded((v) => !v)} hitSlop={8}>
          <Text style={[s.bioToggle, { color: colors.accent }]}>
            {expanded ? 'less' : 'more'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function PlayerCardSkeleton({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[s.cover, { backgroundColor: colors.surfaceMuted }]} />
      <View style={s.body}>
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
          <SkeletonBox width={96} height={96} borderRadius={48} />
          <View style={{ flex: 1, gap: 8, justifyContent: 'center' }}>
            <SkeletonBox width="70%" height={18} />
            <SkeletonBox width="45%" height={14} />
          </View>
        </View>
        <SkeletonBox width="100%" height={14} style={{ marginBottom: 6 }} />
        <SkeletonBox width="80%" height={14} style={{ marginBottom: 16 }} />
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          {[80, 90, 70].map((w) => <SkeletonBox key={w} width={w} height={28} borderRadius={14} />)}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[1, 2, 3, 4].map((i) => <SkeletonBox key={i} style={{ flex: 1 }} height={56} borderRadius={8} />)}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, overflow: 'hidden', margin: 16 },
  cover: { height: 110, width: '100%' },

  identityRow: { flexDirection: 'row', paddingHorizontal: 16, marginTop: -32, gap: 12, alignItems: 'flex-end' },
  avatarRing: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, padding: 2 },
  avatar: { flex: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 36, fontWeight: '700' },

  nameBlock: { flex: 1, paddingBottom: 6, gap: 2 },
  displayName: { fontSize: 20, fontWeight: '700' },
  username: { fontSize: 14 },
  sponsorBadge: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, marginTop: 4 },
  sponsorBadgeText: { fontSize: 11, fontWeight: '600' },

  body: { padding: 16, gap: 12 },

  bio: { fontSize: 14, lineHeight: 20 },
  bioEmpty: { fontSize: 14, lineHeight: 20, fontStyle: 'italic' },
  bioToggle: { fontSize: 13, fontWeight: '600', marginTop: 4 },

  chipScroll: { marginHorizontal: -4 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginHorizontal: 4 },
  chipText: { fontSize: 12, fontWeight: '500' },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  roleTag: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  roleTagText: { fontSize: 11, fontWeight: '600' },
  customTag: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  customTagText: { fontSize: 11 },

  statsRow: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, overflow: 'hidden' },
  statBlock: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  statValue: { fontSize: 17, fontWeight: '700' },
  statLabel: { fontSize: 11, fontWeight: '500', marginTop: 2 },

  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  primaryActionBtn: { flex: 1, borderRadius: 999, height: 44, alignItems: 'center', justifyContent: 'center' },
  primaryActionText: { fontSize: 14, fontWeight: '600' },
  outlineActionBtn: { flex: 1, borderWidth: 1, borderRadius: 999, height: 44, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  outlineActionText: { fontSize: 14, fontWeight: '500' },
});
