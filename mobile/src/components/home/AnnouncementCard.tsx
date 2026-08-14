import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { CATEGORY_COLORS } from '@/core/theme/tokens';
import type { Announcement } from '@/core/types';
import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';
import { relativeTime } from './utils';

export interface AnnouncementCardProps {
  announcement: Announcement;
  /** Deep-link beacon residue — static signal-tint border (home-page.md §7.4/§15.5). */
  highlighted?: boolean;
  onPress: () => void;
}

function TagPill({ tag }: { tag: string }) {
  const colors = useColors();
  const dotColor = CATEGORY_COLORS[tag] ?? colors.accent;
  return (
    <View style={[styles.tagPill, { borderColor: colors.border }]}>
      <View style={[styles.tagDot, { backgroundColor: dotColor }]} />
      <Text style={[styles.tagLabel, { color: colors.textMuted }]}>{tag}</Text>
    </View>
  );
}

/**
 * Announcement card (home-page.md §7.3): editorial hierarchy — up to two
 * category pills (+N overflow), official marker (icon+text, never colour
 * alone), relative time, Barlow title, 3-line preview, author row. Whole card
 * opens the detail sheet (H3).
 */
export function AnnouncementCard({ announcement, highlighted = false, onPress }: AnnouncementCardProps) {
  const colors = useColors();
  const visibleTags = announcement.tags.slice(0, 2);
  const overflow = announcement.tags.length - visibleTags.length;

  return (
    <GlassCard
      onPress={onPress}
      selected={highlighted}
      style={styles.card}
      accessibilityLabel={`Open announcement: ${announcement.title}`}
    >
      <View style={styles.metaRow}>
        {visibleTags.map((tag) => (
          <TagPill key={tag} tag={tag} />
        ))}
        {overflow > 0 ? (
          <Text style={[styles.overflow, { color: colors.textMuted }]}>+{overflow}</Text>
        ) : null}
        <View style={styles.spacer} />
        <View style={styles.official}>
          <Ionicons name="megaphone-outline" size={12} color={colors.textMuted} />
          <Text style={[styles.officialLabel, { color: colors.textMuted }]}>Official</Text>
        </View>
        <Text style={[styles.time, { color: colors.textMuted }]}>
          {relativeTime(announcement.createdAt)}
        </Text>
      </View>

      <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
        {announcement.title}
      </Text>
      <Text style={[styles.preview, { color: colors.text }]} numberOfLines={3}>
        {announcement.body}
      </Text>

      <View style={styles.authorRow}>
        <View
          style={[
            styles.avatar,
            { backgroundColor: announcement.author.avatarColor ?? colors.accent },
          ]}
        >
          <Text style={[styles.avatarText, { color: colors.accentText }]}>
            {announcement.author.avatarInitial}
          </Text>
        </View>
        <Text style={[styles.authorName, { color: colors.text }]} numberOfLines={1}>
          {announcement.author.name}
        </Text>
        <Text style={[styles.authorRole, { color: colors.textMuted }]} numberOfLines={1}>
          {announcement.author.role}
        </Text>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  spacer: {
    flex: 1,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  tagLabel: {
    fontFamily: FONTS.medium,
    fontSize: 10,
  },
  overflow: {
    fontFamily: FONTS.medium,
    fontSize: 10,
  },
  official: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  officialLabel: {
    fontFamily: FONTS.semibold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  time: {
    fontFamily: FONTS.body,
    fontSize: 11,
  },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 18,
    lineHeight: 21,
    marginTop: 2,
  },
  preview: {
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 20,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
  },
  authorName: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
    flexShrink: 1,
  },
  authorRole: {
    fontFamily: FONTS.body,
    fontSize: 12,
    flexShrink: 1,
  },
});
