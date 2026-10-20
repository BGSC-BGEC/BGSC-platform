import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Badge, type BadgeVariant } from './Badge';
import { Button } from './Button';
import { Icon } from '../icons/Icon';
import { Typography } from '../typography/Typography';
import { useTheme } from '../theme/ThemeProvider';
import { resolveMediaUrl } from '../api/config';
import TrophyWatermark from '../../assets/illustrations/trophy-watermark.svg';
import type { ApiEvent, EventCategory } from '../api/types';
import { capacityLabel, EVENT_CATEGORY_LABELS, eventDateLabel, eventStatusPill } from '../utils/format';

/** Category → pill tone and cover gradient end colour (v2-events frame). */
export const EVENT_CATEGORY_STYLE: Record<EventCategory, { pill: BadgeVariant; cover: string }> = {
  bgec: { pill: 'info', cover: '#7354BF' },
  leagues: { pill: 'primary', cover: '#E07A40' },
  fitsoc: { pill: 'success', cover: '#339E6B' },
  general: { pill: 'muted', cover: '#5B8FA8' },
};

const COVER_BASE = '#2B3036';

/** Maps an API event onto EventCard's display props (footer/CTA are screen-specific). */
export function eventCardData(event: ApiEvent) {
  const pill = eventStatusPill(event);
  return {
    title: event.title,
    category: event.category,
    categoryLabel: EVENT_CATEGORY_LABELS[event.category],
    status: { label: pill.label, variant: pill.variant },
    registrationOpen: pill.registrationOpen,
    dateLabel: eventDateLabel(event.start_at),
    venue: event.venue,
    coverUrl: event.cover_media_url,
    footer: capacityLabel(event),
  };
}

export interface EventCardProps {
  title: string;
  category: EventCategory;
  categoryLabel: string;
  status: { label: string; variant: BadgeVariant };
  dateLabel: string;
  venue?: string | null;
  coverUrl?: string | null;
  /** Mono footer text: seats, waitlist, "You're in · Bib #048" */
  footer: string;
  cta?: { label: string; onPress: () => void; variant?: 'primary' | 'outline' };
  onPress: () => void;
  style?: ViewStyle;
}

/** v2/EventCard — cover (image or category gradient + trophy watermark), title, date, venue, footer + CTA. */
export function EventCard({
  title,
  category,
  categoryLabel,
  status,
  dateLabel,
  venue,
  coverUrl,
  footer,
  cta,
  onPress,
  style,
}: EventCardProps) {
  const { colors } = useTheme();
  const tone = EVENT_CATEGORY_STYLE[category] ?? EVENT_CATEGORY_STYLE.general;
  const cover = resolveMediaUrl(coverUrl);
  const gradientId = `cover-${category}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${status.label}`}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.pressed,
        style,
      ]}
    >
      <View style={styles.cover}>
        {cover ? (
          <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        ) : (
          <>
            {/* 159° CSS gradient: base colour for the first quarter, category colour by ~71% */}
            <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none">
              <Defs>
                <LinearGradient id={gradientId} x1="0.32" y1="0" x2="0.68" y2="1">
                  <Stop offset="0" stopColor={COVER_BASE} />
                  <Stop offset="0.25" stopColor={COVER_BASE} />
                  <Stop offset="0.714" stopColor={tone.cover} />
                  <Stop offset="1" stopColor={tone.cover} />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
            </Svg>
            <View style={styles.watermark} pointerEvents="none">
              <TrophyWatermark width={150} height={150} />
            </View>
          </>
        )}
        <Badge label={categoryLabel} variant={tone.pill} />
        <Badge label={status.label} variant={status.variant} />
      </View>

      <View style={styles.body}>
        <Typography variant="h3" color="text" numberOfLines={2}>
          {title}
        </Typography>
        <View style={styles.meta}>
          <View style={styles.metaRow}>
            <Icon name="calendar" size={16} color="textMuted" />
            <Typography variant="bodySmall" color="textMuted">
              {dateLabel}
            </Typography>
          </View>
          {venue ? (
            <View style={styles.metaRow}>
              <Icon name="map-pin" size={16} color="textMuted" />
              <Typography variant="bodySmall" color="textMuted" numberOfLines={1}>
                {venue}
              </Typography>
            </View>
          ) : null}
        </View>
        <View style={styles.footer}>
          <Typography variant="mono" color="text" style={styles.footerText} numberOfLines={1}>
            {footer}
          </Typography>
          {cta ? (
            <Button
              label={cta.label}
              variant={cta.variant ?? 'primary'}
              onPress={cta.onPress}
              style={styles.cta}
            />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 24, overflow: 'hidden' },
  pressed: { opacity: 0.9 },
  cover: { height: 132, flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 16, overflow: 'hidden' },
  watermark: { position: 'absolute', right: -3, top: 4, transform: [{ rotate: '12deg' }] },
  body: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, gap: 12 },
  meta: { gap: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  footerText: { flex: 1 },
  cta: { minWidth: 120 },
});
