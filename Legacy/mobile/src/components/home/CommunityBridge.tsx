import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';

export interface CommunityBridgeProps {
  /** Real counts only — no fabricated counters (home-page.md §6.4). */
  announcementCount?: number;
  postCount?: number;
  onOpenAnnouncements: () => void;
  onOpenFeed: () => void;
}

/**
 * Community pulse bridge (home-page.md §6.4): routes Introduction into the
 * two content tabs. Counts render only when real data exists; both undefined
 * while loading → skeleton tiles.
 */
export function CommunityBridge({
  announcementCount,
  postCount,
  onOpenAnnouncements,
  onOpenFeed,
}: CommunityBridgeProps) {
  const colors = useColors();

  if (announcementCount === undefined || postCount === undefined) {
    return (
      <View style={styles.row}>
        <SkeletonBlock height={104} radius={16} style={styles.tile} />
        <SkeletonBlock height={104} radius={16} style={styles.tile} />
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <GlassCard onPress={onOpenAnnouncements} style={styles.tile} accessibilityLabel="Open announcements">
        <Ionicons name="megaphone-outline" size={22} color={colors.accent} />
        <Text style={[styles.title, { color: colors.text }]}>Official updates</Text>
        <Text style={[styles.desc, { color: colors.textMuted }]}>
          {announcementCount > 0 ? `${announcementCount} announcement${announcementCount === 1 ? '' : 's'}` : 'Stay in the loop'}
        </Text>
      </GlassCard>
      <GlassCard onPress={onOpenFeed} style={styles.tile} accessibilityLabel="Open community feed">
        <Ionicons name="people-outline" size={22} color={colors.accent} />
        <Text style={[styles.title, { color: colors.text }]}>Community posts</Text>
        <Text style={[styles.desc, { color: colors.textMuted }]}>
          {postCount > 0 ? `${postCount} post${postCount === 1 ? '' : 's'}` : 'Join the conversation'}
        </Text>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  tile: {
    flex: 1,
    gap: 6,
    minHeight: 104,
  },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 17,
    marginTop: 2,
  },
  desc: {
    fontFamily: FONTS.body,
    fontSize: 12,
  },
});
