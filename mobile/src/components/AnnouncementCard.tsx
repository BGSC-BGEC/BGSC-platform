import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Avatar } from './Avatar';
import { Badge, type BadgeVariant } from './Badge';
import { Typography } from '../typography/Typography';
import { FONT_FAMILIES } from '../theme/typography';
import { useTheme } from '../theme/ThemeProvider';
import { withAlpha } from '../theme/colors';
import type { UIThemeColors } from '../theme/colors';
import type { Announcement } from '../api/types';
import { ANNOUNCEMENT_CATEGORY_LABELS } from '../utils/format';

/** Category pills: the first carries the info tone, the rest are muted (v2 card). */
export function announcementTags(a: Announcement): Array<{ label: string; variant: BadgeVariant }> {
  return a.categories.map((c, i) => ({ label: ANNOUNCEMENT_CATEGORY_LABELS[c] ?? c, variant: i === 0 ? 'info' : 'muted' }));
}

/** Stable per-author avatar colour (v2 uses blue / green / orange initials circles). */
export function authorColor(name: string, colors: UIThemeColors): string {
  const palette = [colors.info, colors.success, colors.primarySolid];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

export interface AnnouncementCardProps {
  author: string;
  authorAvatar?: string | null;
  /** "BGEC Coordinator · 2h ago" */
  meta: string;
  title: string;
  body: string;
  priority?: { label: string; variant: BadgeVariant };
  unread?: boolean;
  tags?: Array<{ label: string; variant: BadgeVariant }>;
  onPress: () => void;
  style?: ViewStyle;
}

/**
 * Announcement card with author meta, title, divider, and category tags.
 */
export function AnnouncementCard({
  author,
  authorAvatar,
  meta,
  title,
  body,
  priority,
  unread,
  tags,
  onPress,
  style,
}: AnnouncementCardProps) {
  const { colors, shadow } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'Unread. ' : ''}${title}, from ${author}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: unread ? withAlpha(colors.primary, 0.4) : colors.border,
        },
        shadow('flat'),
        pressed && styles.pressed,
        style,
      ]}
    >
      <View style={styles.authorRow}>
        <Avatar name={author} uri={authorAvatar} size={36} color={authorColor(author, colors)} />
        <View style={styles.who}>
          <Typography variant="body" color="text" style={styles.author} numberOfLines={1}>
            {author}
          </Typography>
          <Typography variant="caption" color="textMuted" numberOfLines={1}>
            {meta}
          </Typography>
        </View>
        {unread ? (
          <View style={[styles.unreadPill, { backgroundColor: withAlpha(colors.primary, 0.15) }]}>
            <View style={[styles.dot, { backgroundColor: colors.primary }]} />
            <Typography variant="caption" color="primary" style={styles.unreadText}>
              NEW
            </Typography>
          </View>
        ) : null}
        {priority ? <Badge label={priority.label} variant={priority.variant} /> : null}
      </View>

      <Typography variant="bodyLarge" color="text" style={styles.title} numberOfLines={2}>
        {title}
      </Typography>
      <Typography variant="body" color="textMuted" numberOfLines={2} style={styles.bodyText}>
        {body}
      </Typography>

      {tags?.length ? (
        <View style={styles.footerWrap}>
          <View style={[styles.dashedLine, { borderColor: colors.border }]} />
          <View style={styles.tags}>
            {tags.map((t) => (
              <Badge key={t.label} label={t.label} variant={t.variant} />
            ))}
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 22, padding: 16, gap: 10 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  who: { flex: 1, gap: 2 },
  author: { fontFamily: FONT_FAMILIES.bodySemiBold },
  unreadPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  unreadText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  title: { fontFamily: FONT_FAMILIES.bodyBold, fontSize: 16, lineHeight: 22 },
  bodyText: { fontSize: 13, lineHeight: 19 },
  footerWrap: { gap: 10, marginTop: 4 },
  dashedLine: { borderTopWidth: 1, borderStyle: 'dashed' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
