import { useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { PillButton } from '@/components/PillButton';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import { FONTS } from '@/core/theme/fonts';
import { useAnnouncements } from '@/hooks/use-announcements';
import { useFeed } from '@/hooks/use-feed';
import { useColors } from '@/hooks/use-colors';
import { AnnouncementDetailSheet } from './AnnouncementDetailSheet';
import { CommunityBridge } from './CommunityBridge';
import { CoordinatorVoiceCard } from './CoordinatorVoiceCard';
import { HomeHero } from './HomeHero';
import { SectionError } from './StateViews';

export interface IntroTabProps {
  onSwitchTab: (index: number) => void;
}

function QuoteSkeleton() {
  return (
    <GlassCard>
      <View style={styles.skelHeader}>
        <SkeletonBlock width={48} height={48} radius={24} />
        <View style={styles.skelIdentity}>
          <SkeletonBlock width={120} height={14} />
          <SkeletonBlock width={80} height={12} style={{ marginTop: 6 }} />
        </View>
      </View>
      <SkeletonBlock height={14} style={{ marginTop: 12 }} />
      <SkeletonBlock height={14} style={{ marginTop: 8 }} />
      <SkeletonBlock height={14} width="65%" style={{ marginTop: 8 }} />
    </GlassCard>
  );
}

/**
 * Introduction / landing surface (home-page.md H1): hero, coordinator
 * voices (derived from latest announcements), community pulse bridge.
 * Hero geometry stays stable while quote skeletons shimmer (§6.5); an
 * announcements error degrades only this section, never the hero.
 */
export function IntroTab({ onSwitchTab }: IntroTabProps) {
  const colors = useColors();
  const { data, isLoading, isError, isRefetching, refetch } = useAnnouncements();
  const feed = useFeed();
  const [scrollY, setScrollY] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);

  const voices = data?.slice(0, 3) ?? [];
  const detailAnnouncement = data?.find((a) => a.id === detailId) ?? null;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
      scrollEventThrottle={64}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching || feed.isRefetching}
          onRefresh={() => {
            void refetch();
            void feed.refetch();
          }}
          tintColor={colors.textMuted}
        />
      }
      contentContainerStyle={styles.content}
    >
      <HomeHero cueVisible={scrollY < 32} />

      <View style={styles.section}>
        <Text accessibilityRole="header" style={[styles.eyebrow, { color: colors.textMuted }]}>
          What our heads have to say
        </Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Official voices, latest updates
        </Text>

        {isLoading ? (
          <View style={styles.stack}>
            <QuoteSkeleton />
            <QuoteSkeleton />
            <QuoteSkeleton />
          </View>
        ) : isError ? (
          <SectionError message="Coordinator updates couldn't be loaded." onRetry={() => void refetch()} />
        ) : voices.length === 0 ? (
          <GlassCard>
            <Text style={[styles.preparing, { color: colors.textMuted }]}>
              Updates are being prepared. Check back soon.
            </Text>
          </GlassCard>
        ) : (
          <View style={styles.stack}>
            {voices.map((announcement) => (
              <CoordinatorVoiceCard
                key={announcement.id}
                announcement={announcement}
                onPress={() => setDetailId(announcement.id)}
              />
            ))}
          </View>
        )}

        <PillButton
          label="View all announcements"
          variant="ghost"
          onPress={() => onSwitchTab(1)}
          accessibilityLabel="View all announcements"
          style={styles.viewAll}
        />
      </View>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={[styles.eyebrow, { color: colors.textMuted }]}>
          Community pulse
        </Text>
        <CommunityBridge
          announcementCount={data?.length}
          postCount={feed.data?.length}
          onOpenAnnouncements={() => onSwitchTab(1)}
          onOpenFeed={() => onSwitchTab(2)}
        />
      </View>

      <AnnouncementDetailSheet
        announcement={detailAnnouncement}
        onClose={() => setDetailId(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 96,
  },
  section: {
    marginTop: 28,
    gap: 10,
  },
  eyebrow: {
    fontFamily: FONTS.semibold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 13,
    marginBottom: 4,
  },
  stack: {
    gap: 12,
  },
  preparing: {
    fontFamily: FONTS.body,
    fontSize: 14,
  },
  viewAll: {
    marginTop: 4,
  },
  skelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  skelIdentity: {
    flex: 1,
  },
});
