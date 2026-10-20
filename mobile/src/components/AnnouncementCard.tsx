import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Avatar } from './Avatar';
import { Badge, type BadgeVariant } from './Badge';
import { Typography } from '../typography/Typography';
import { FONT_FAMILIES } from '../theme/typography';
import { useTheme } from '../theme/ThemeProvider';
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

/** v2/AnnouncementCard — author row (+ unread dot, priority), title, one-line body, category pills. */
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
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'Unread. ' : ''}${title}, from ${author}`}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
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
          <Typography variant="bodySmall" color="textMuted" numberOfLines={1}>
            {meta}
          </Typography>
        </View>
        {unread ? <View style={[styles.dot, { backgroundColor: colors.primary }]} /> : null}
        {priority ? <Badge label={priority.label} variant={priority.variant} /> : null}
      </View>

      <Typography variant="bodyLarge" color="text" style={styles.title}>
        {title}
      </Typography>
      <Typography variant="body" color="textMuted" numberOfLines={1}>
        {body}
      </Typography>

      {tags?.length ? (
        <View style={styles.tags}>
          {tags.map((t) => (
            <Badge key={t.label} label={t.label} variant={t.variant} />
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 12 },
  pressed: { opacity: 0.9 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  who: { flex: 1, gap: 2 },
  author: { fontFamily: FONT_FAMILIES.bodySemiBold },
  dot: { width: 8, height: 8, borderRadius: 4 },
  title: { fontFamily: FONT_FAMILIES.bodyBold, fontSize: 16, lineHeight: 24 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
