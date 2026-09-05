import { useQueryClient } from '@tanstack/react-query';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { AuthLocked } from '@/components/AuthLocked';
import { HistorySection } from '@/components/profile/HistorySection';
import { PlayerCard, PlayerCardSkeleton } from '@/components/profile/PlayerCard';
import { SettingsSection } from '@/components/profile/SettingsSection';
import { UserInfoCard } from '@/components/profile/UserInfoCard';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import { useAuthStore } from '@/core/stores/authStore';
import { useColors } from '@/hooks/use-colors';
import { usePlayerCard, useProfile, useSponsorStats } from '@/hooks/use-profile';

/**
 * My Profile (master §9 table, profile spec). Auth required (master §2.4) —
 * guests see AuthLocked with a Login CTA; session restore shows skeletons.
 *
 * Sections: PlayerCard (cover/avatar/stats/chips/actions) → UserInfoCard
 * (friend tags, contact, social links, sponsor stats) → History (4 tabs) →
 * Settings (rows + logout). Pull-to-refresh invalidates all ['profile'] keys.
 */
export default function ProfileScreen() {
  const colors = useColors();
  const status = useAuthStore((s) => s.status);

  if (status === 'unknown' || status === 'loading') return <ProfileSkeleton />;
  if (status !== 'authenticated') {
    return (
      <View style={[styles.canvas, { backgroundColor: colors.background }]}>
        <AuthLocked subject="your profile" />
      </View>
    );
  }

  return <ProfileBody />;
}

function ProfileBody() {
  const colors = useColors();
  const qc = useQueryClient();
  const logout = useAuthStore((s) => s.logout);

  const profile = useProfile();
  const card = usePlayerCard();
  const sponsor = useSponsorStats();

  const onRefresh = () => {
    qc.invalidateQueries({ queryKey: ['profile'] });
  };

  const loading = profile.isPending || card.isPending;
  const error = (profile.isError || card.isError) && !loading;

  return (
    <View style={[styles.canvas, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={profile.isRefetching || card.isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.textMuted}
          />
        }
      >
        <PlayerCard
          card={card.data}
          profile={profile.data}
          loading={loading}
          error={error}
          onRetry={() => {
            void profile.refetch();
            void card.refetch();
          }}
        />
        <UserInfoCard profile={profile.data} sponsor={sponsor.data} loading={loading} />
        <HistorySection />
        <SettingsSection onLogout={logout} />
      </ScrollView>
    </View>
  );
}

/** Session-restore placeholder (spec §11): hero skeleton + line cards, never a spinner. */
function ProfileSkeleton() {
  const colors = useColors();
  return (
    <View style={[styles.canvas, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <PlayerCardSkeleton />
        <SkeletonBlock height={120} radius={16} />
        <SkeletonBlock height={180} radius={16} />
        <SkeletonBlock height={100} radius={16} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 20,
    paddingBottom: 32,
  },
});
