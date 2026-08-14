import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ChipFilter } from '@/components/ChipFilter';
import { SkeletonBlock, SkeletonCard } from '@/components/SkeletonBlock';
import { useAuthStore } from '@/core/stores/authStore';
import type { AnnouncementTag } from '@/core/types';
import { FONTS } from '@/core/theme/fonts';
import { useAnnouncements } from '@/hooks/use-announcements';
import { useColors } from '@/hooks/use-colors';
import { AnnouncementCard } from './AnnouncementCard';
import { AnnouncementDetailSheet } from './AnnouncementDetailSheet';
import { MakeAnnouncementSheet } from './MakeAnnouncementSheet';
import { EmptyState, SectionError } from './StateViews';
import { canSeeTeams } from './utils';

const ALL_TAGS = [
  'BGEC',
  'FitSoc',
  'Airball',
  'Offside',
  'PowerPlay',
  'Around The Net',
  'Deuce',
  'Highlight Events',
  'Teams',
] as const;

/**
 * Announcements index (home-page.md H2): sticky category filter rail
 * (single-select, All default, Teams role-gated, trailing create control for
 * core+) + editorial card list. Every state covered: skeleton rail + cards,
 * empty (with category context), full-area retry, guest read.
 */
export function AnnouncementsTab() {
  const colors = useColors();
  const { data, isLoading, isError, isRefetching, refetch } = useAnnouncements();
  const role = useAuthStore((s) => s.user?.role);

  const [selected, setSelected] = useState<AnnouncementTag | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [composerVisible, setComposerVisible] = useState(false);

  const tags = useMemo(() => {
    const all = ALL_TAGS.filter((t): t is AnnouncementTag => canSeeTeams(role) || t !== 'Teams');
    return all;
  }, [role]);

  // Deep-link beacon residue: static signal-tint border for ~2.5 s (§15.5).
  useEffect(() => {
    if (!highlightId) return;
    const timer = setTimeout(() => setHighlightId(null), 2500);
    return () => clearTimeout(timer);
  }, [highlightId]);

  const filtered = useMemo(() => {
    if (!data) return undefined;
    return selected ? data.filter((a) => a.tags.includes(selected)) : data;
  }, [data, selected]);

  const detailAnnouncement = data?.find((a) => a.id === detail) ?? null;

  return (
    <View style={styles.root}>
      <ScrollView
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor={colors.textMuted}
          />
        }
        contentContainerStyle={styles.content}
      >
        {/* Sticky filter rail (home-page.md §7.1/§7.2). */}
        <View style={[styles.rail, { backgroundColor: colors.background }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.railChips}
          >
            <Pressable
              onPress={() => setSelected(null)}
              accessibilityRole="button"
              accessibilityLabel="All announcements filter"
              accessibilityState={{ selected: selected === null }}
              style={[
                styles.allChip,
                {
                  backgroundColor: selected === null ? colors.accent : 'transparent',
                  borderColor: colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.allChipLabel,
                  { color: selected === null ? colors.accentText : colors.textMuted },
                ]}
              >
                All
              </Text>
            </Pressable>
            <ChipFilter
              options={tags.map((t) => ({ label: t, value: t }))}
              value={selected}
              onChange={setSelected}
              variant="single"
              accessibilityLabel="Announcement category filters"
            />
          </ScrollView>
          {canSeeTeams(role) ? (
            <Pressable
              onPress={() => setComposerVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Make announcement"
              hitSlop={4}
              style={[styles.newBtn, { borderColor: colors.border }]}
            >
              <Ionicons name="add" size={22} color={colors.text} />
            </Pressable>
          ) : null}
        </View>

        {isLoading ? (
          <View style={styles.stateBlock}>
            <View style={styles.pillSkeletonRow}>
              <SkeletonBlock height={30} width={64} radius={20} />
              <SkeletonBlock height={30} width={72} radius={20} />
              <SkeletonBlock height={30} width={60} radius={20} />
            </View>
            <SkeletonCard lines={4} />
            <SkeletonCard lines={4} />
            <SkeletonCard lines={3} />
          </View>
        ) : isError ? (
          <SectionError message="Announcements couldn't be loaded." onRetry={() => void refetch()} />
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon="megaphone-outline"
            title="Nothing posted yet"
            message="Official announcements from BGEC, FitSoc and the other clubs will land here."
          />
        ) : filtered && filtered.length === 0 ? (
          <EmptyState
            icon="megaphone-outline"
            title={`Nothing in ${selected}`}
            message="No announcements in this category yet. Try another filter."
          />
        ) : (
          <View style={styles.list}>
            {filtered?.map((announcement) => (
              <AnnouncementCard
                key={announcement.id}
                announcement={announcement}
                highlighted={announcement.id === highlightId}
                onPress={() => setDetail(announcement.id)}
              />
            ))}
            {/* Retention boundary — §7.5 keeps older announcements out of the index. */}
            <Text style={[styles.retention, { color: colors.textMuted }]}>
              Older announcements are no longer shown
            </Text>
          </View>
        )}
      </ScrollView>

      <AnnouncementDetailSheet
        announcement={detailAnnouncement}
        onClose={() => setDetail(null)}
      />
      <MakeAnnouncementSheet
        visible={composerVisible}
        onClose={() => setComposerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 96,
    flexGrow: 1,
  },
  rail: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginHorizontal: -16,
    paddingHorizontal: 16,
    gap: 8,
  },
  railChips: {
    gap: 8,
    paddingRight: 8,
    alignItems: 'center',
  },
  allChip: {
    minHeight: 44,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allChipLabel: {
    fontFamily: FONTS.medium,
    fontSize: 13,
  },
  newBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateBlock: {
    gap: 12,
    marginTop: 12,
  },
  pillSkeletonRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  list: {
    gap: 12,
    marginTop: 12,
  },
  retention: {
    fontFamily: FONTS.body,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 16,
  },
});
