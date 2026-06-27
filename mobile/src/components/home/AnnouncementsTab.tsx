import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuthStore } from '@/core/stores/authStore';
import { useColors } from '@/hooks/use-colors';

import { AnnouncementDetailSheet } from './AnnouncementDetailSheet';
import { MakeAnnouncementModal } from './MakeAnnouncementModal';
import { MOCK_ANNOUNCEMENTS } from './mock-data';
import { SkeletonBox } from './SkeletonBox';
import {
  ALL_ANNOUNCEMENT_TAGS,
  TAG_COLORS,
  relativeTime,
  type Announcement,
  type AnnouncementTag,
} from './types';

interface Props {
  isLoading?: boolean;
  scrollToAnnouncementId?: string | null;
}

export function AnnouncementsTab({ isLoading, scrollToAnnouncementId }: Props) {
  const colors = useColors();
  const user = useAuthStore((s) => s.user);

  const isCorePlus = user && ['coordinator', 'founder', 'core'].includes(user.role);
  const canSeeTeams = isCorePlus;

  const [activeFilter, setActiveFilter] = useState<AnnouncementTag | 'All'>('All');
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [showMakeAnnouncement, setShowMakeAnnouncement] = useState(false);
  const [hasNewBanner, setHasNewBanner] = useState(false);
  const [hasError, setHasError] = useState(false);

  const visibleTags: Array<AnnouncementTag | 'All'> = [
    'All',
    ...ALL_ANNOUNCEMENT_TAGS.filter((t) => canSeeTeams || t !== 'Teams'),
  ];

  const filteredAnnouncements =
    activeFilter === 'All'
      ? MOCK_ANNOUNCEMENTS
      : MOCK_ANNOUNCEMENTS.filter((a) => a.tags.includes(activeFilter as AnnouncementTag));

  if (isLoading) {
    return <AnnouncementsSkeleton colors={colors} />;
  }

  if (hasError) {
    return (
      <View style={[styles.errorState, { backgroundColor: colors.background }]}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={[styles.errorTitle, { color: colors.text }]}>Failed to load announcements</Text>
        <Text style={[styles.errorBody, { color: colors.textMuted }]}>
          Check your connection and try again.
        </Text>
        <Pressable
          style={[styles.retryBtn, { backgroundColor: colors.primary }]}
          onPress={() => setHasError(false)}>
          <Text style={[styles.retryBtnText, { color: colors.primaryText }]}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* New announcement banner */}
      {hasNewBanner && (
        <Pressable
          style={[styles.newBanner, { backgroundColor: colors.accent }]}
          onPress={() => setHasNewBanner(false)}>
          <Text style={[styles.newBannerText, { color: colors.accentText }]}>
            1 new announcement — tap to refresh
          </Text>
        </Pressable>
      )}

      {/* Category filter chips */}
      <View style={[styles.filterBar, { borderBottomColor: colors.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}>
          {visibleTags.map((tag) => {
            const isActive = activeFilter === tag;
            const tagColor = tag === 'All' ? colors.accent : TAG_COLORS[tag as AnnouncementTag];
            return (
              <Pressable
                key={tag}
                onPress={() =>
                  setActiveFilter(isActive && tag !== 'All' ? 'All' : tag)
                }
                style={[
                  styles.filterChip,
                  isActive
                    ? { backgroundColor: tagColor, borderColor: tagColor }
                    : { borderColor: tagColor + '80', backgroundColor: tagColor + '12' },
                ]}>
                <Text style={[styles.filterChipText, { color: isActive ? '#fff' : tagColor }]}>
                  {tag}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* New Announcement button — Core+ only */}
        {isCorePlus && (
          <Pressable
            onPress={() => setShowMakeAnnouncement(true)}
            style={[styles.newAnnouncementBtn, { backgroundColor: colors.accent }]}
            accessibilityLabel="New announcement">
            <Text style={[styles.newAnnouncementText, { color: colors.accentText }]}>+</Text>
          </Pressable>
        )}
      </View>

      {/* Announcement feed */}
      {filteredAnnouncements.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Nothing posted yet</Text>
          <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
            Check back soon for announcements.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredAnnouncements}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.feedContent}
          showsVerticalScrollIndicator={false}
          onRefresh={() => { /* production: refetch */ }}
          refreshing={false}
          renderItem={({ item }) => (
            <AnnouncementCard
              announcement={item}
              colors={colors}
              isAuthenticated={!!user}
              highlighted={item.id === scrollToAnnouncementId}
              onPress={() => setSelectedAnnouncement(item)}
            />
          )}
          ListFooterComponent={
            <View style={[styles.retentionDivider, { borderColor: colors.border }]}>
              <Text style={[styles.retentionText, { color: colors.textMuted }]}>
                Older announcements are no longer shown
              </Text>
            </View>
          }
        />
      )}

      {/* Modals */}
      <AnnouncementDetailSheet
        announcement={selectedAnnouncement}
        onClose={() => setSelectedAnnouncement(null)}
      />
      <MakeAnnouncementModal
        visible={showMakeAnnouncement}
        onClose={() => setShowMakeAnnouncement(false)}
      />
    </View>
  );
}

interface CardProps {
  announcement: Announcement;
  colors: ReturnType<typeof import('@/hooks/use-colors').useColors>;
  isAuthenticated: boolean;
  highlighted: boolean;
  onPress: () => void;
}

function AnnouncementCard({ announcement, colors, isAuthenticated, highlighted, onPress }: CardProps) {
  const [showAbsoluteTime, setShowAbsoluteTime] = useState(false);
  const absoluteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTimestampLongPress = () => {
    setShowAbsoluteTime(true);
    if (absoluteTimerRef.current) clearTimeout(absoluteTimerRef.current);
    absoluteTimerRef.current = setTimeout(() => setShowAbsoluteTime(false), 3000);
  };

  const handleAvatarPress = () => {
    if (!isAuthenticated) {
      router.push('/login');
    } else {
      // In production: router.push(`/users/${announcement.author.id}`)
      router.push('/(drawer)/profile');
    }
  };

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: highlighted ? colors.accentMuted : colors.surface,
          borderColor: highlighted ? colors.accent : colors.border,
        },
      ]}
      accessibilityRole="button">
      {/* Header: tags + timestamp */}
      <View style={styles.cardHeader}>
        <View style={styles.cardTags}>
          {announcement.tags.map((tag) => (
            <View
              key={tag}
              style={[styles.tagPill, { backgroundColor: TAG_COLORS[tag] + '20', borderColor: TAG_COLORS[tag] }]}>
              <Text style={[styles.tagPillText, { color: TAG_COLORS[tag] }]}>{tag}</Text>
            </View>
          ))}
        </View>
        <Pressable onLongPress={handleTimestampLongPress} delayLongPress={350} hitSlop={8}>
          <Text style={[styles.cardTimestamp, { color: colors.textMuted }]}>
            {showAbsoluteTime
              ? new Date(announcement.createdAt).toLocaleString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : relativeTime(announcement.createdAt)}
          </Text>
        </Pressable>
      </View>

      {/* Title */}
      <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
        {announcement.title}
      </Text>

      {/* Body preview */}
      <Text style={[styles.cardBody, { color: colors.textMuted }]} numberOfLines={3}>
        {announcement.body}
      </Text>

      {/* Author */}
      <View style={styles.cardAuthor}>
        <Pressable onPress={handleAvatarPress} accessibilityLabel={`View ${announcement.author.name}'s profile`}>
          <View style={[styles.authorAvatar, { backgroundColor: announcement.author.avatarColor }]}>
            <Text style={styles.authorAvatarText}>{announcement.author.avatarInitial}</Text>
          </View>
        </Pressable>
        <Text style={[styles.authorMeta, { color: colors.textMuted }]}>
          {announcement.author.name} · {announcement.author.role}
        </Text>
      </View>
    </Pressable>
  );
}

function AnnouncementsSkeleton({ colors }: { colors: ReturnType<typeof import('@/hooks/use-colors').useColors> }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.filterBar, { borderBottomColor: colors.border }]}>
        <ScrollView horizontal contentContainerStyle={{ padding: 10, gap: 8 }} showsHorizontalScrollIndicator={false}>
          {[70, 60, 80, 65, 90].map((w, i) => (
            <SkeletonBox key={i} width={w} height={32} borderRadius={20} />
          ))}
        </ScrollView>
      </View>
      <View style={{ padding: 12, gap: 12 }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, gap: 10 }]}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <SkeletonBox width={50} height={22} borderRadius={20} />
              <SkeletonBox width={40} height={22} borderRadius={20} />
            </View>
            <SkeletonBox height={18} width="80%" />
            <SkeletonBox height={14} />
            <SkeletonBox height={14} width="90%" />
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <SkeletonBox width={28} height={28} borderRadius={14} />
              <SkeletonBox width={120} height={12} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  newBanner: { paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center' },
  newBannerText: { fontSize: 13, fontWeight: '600' },

  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterScroll: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  filterChipText: { fontSize: 13, fontWeight: '600' },

  newAnnouncementBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  newAnnouncementText: { fontSize: 22, fontWeight: '300', lineHeight: 26 },

  feedContent: { padding: 12, gap: 12, paddingBottom: 40 },

  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, flex: 1 },
  tagPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20, borderWidth: 1 },
  tagPillText: { fontSize: 11, fontWeight: '600' },
  cardTimestamp: { fontSize: 12, flexShrink: 0, marginLeft: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', lineHeight: 22 },
  cardBody: { fontSize: 14, lineHeight: 20 },

  cardAuthor: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  authorAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  authorAvatarText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  authorMeta: { fontSize: 12 },

  retentionDivider: { borderTopWidth: 1, marginTop: 8, paddingTop: 14, alignItems: 'center' },
  retentionText: { fontSize: 12 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyBody: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  errorState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  errorIcon: { fontSize: 48 },
  errorTitle: { fontSize: 18, fontWeight: '700' },
  errorBody: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  retryBtn: { marginTop: 8, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 10 },
  retryBtnText: { fontSize: 15, fontWeight: '600' },
});
