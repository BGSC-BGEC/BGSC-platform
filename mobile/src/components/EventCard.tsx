import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Defs, LinearGradient, Rect, Stop, Path } from 'react-native-svg';

import type { BadgeVariant } from './Badge';
import { Icon } from '../icons/Icon';
import { Typography } from '../typography/Typography';
import { FONT_FAMILIES } from '../theme/typography';
import { useTheme } from '../theme/ThemeProvider';
import { withAlpha } from '../theme/colors';
import { resolveMediaUrl } from '../api/config';
import type { ApiEvent, EventCategory } from '../api/types';
import { EVENT_CATEGORY_LABELS, eventDateLabel, eventStatusPill } from '../utils/format';

/** Category style accents */
export const EVENT_CATEGORY_STYLE: Record<
  EventCategory,
  { pill: BadgeVariant; cover: string; tagColor: string; gradEnd: string }
> = {
  bgec: { pill: 'info', cover: '#7354BF', tagColor: '#68B5D9', gradEnd: '#D96A27' },
  leagues: { pill: 'primary', cover: '#E07A40', tagColor: '#F3A775', gradEnd: '#E07A40' },
  fitsoc: { pill: 'success', cover: '#339E6B', tagColor: '#34D399', gradEnd: '#2D8A58' },
  general: { pill: 'muted', cover: '#5B8FA8', tagColor: '#93C5FD', gradEnd: '#4A6F82' },
};

/** Formats event data for the premium card presentation */
export function eventCardData(event: ApiEvent) {
  const pill = eventStatusPill(event);

  let footer = '';
  if (event.teaming?.is_teamed && event.teaming?.max_teams) {
    const confirmed = event.counts?.registrations_confirmed ?? 0;
    const teamSize = event.teaming.team_size_min || 1;
    const teams = Math.max(1, Math.floor(confirmed / teamSize));
    footer = `${teams} / ${event.teaming.max_teams} teams`;
  } else if (event.registration?.max_participants) {
    footer = `${event.counts?.registrations_confirmed ?? 0} / ${event.registration.max_participants} seats`;
  } else {
    footer = pill.label;
  }

  const d = new Date(event.start_at);
  const isValidDate = !isNaN(d.getTime());
  const dayName = isValidDate
    ? d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' }).toUpperCase()
    : 'UPCOMING';
  const dateDisplay = isValidDate
    ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' })
    : '';
  const timeDisplay = isValidDate
    ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }).toUpperCase()
    : '';

  return {
    title: event.title,
    category: event.category,
    categoryLabel: EVENT_CATEGORY_LABELS[event.category] || event.category.toUpperCase(),
    status: {
      label: pill.registrationOpen ? 'OPEN' : pill.label.toUpperCase(),
      isOpen: pill.registrationOpen,
    },
    registrationOpen: pill.registrationOpen,
    dateLabel: eventDateLabel(event.start_at),
    dayName,
    dateDisplay,
    timeDisplay,
    venue: event.venue,
    coverUrl: event.cover_media_url,
    footer,
  };
}

export interface EventCardProps {
  title: string;
  category: EventCategory;
  categoryLabel: string;
  status: { label: string; isOpen?: boolean };
  dateLabel: string;
  dayName?: string;
  dateDisplay?: string;
  timeDisplay?: string;
  venue?: string | null;
  coverUrl?: string | null;
  footer: string;
  cta?: { label: string; onPress: () => void; variant?: 'primary' | 'outline' };
  onPress: () => void;
  style?: ViewStyle;
}

/**
 * Event card with category badges, date overlay, metadata, and action CTA.
 */
export function EventCard({
  title,
  category,
  categoryLabel,
  status,
  dateLabel,
  dayName,
  dateDisplay,
  timeDisplay,
  venue,
  coverUrl,
  footer,
  cta,
  onPress,
  style,
}: EventCardProps) {
  const { colors, shadow } = useTheme();
  const themeAccent = EVENT_CATEGORY_STYLE[category] ?? EVENT_CATEGORY_STYLE.general;
  const cover = resolveMediaUrl(coverUrl);

  const gradId = React.useMemo(
    () => `grad-${category}-${Math.random().toString(36).slice(2, 7)}`,
    [category]
  );

  let displayDayName = dayName;
  let displayDateNum = dateDisplay;
  if (!displayDayName || !displayDateNum) {
    const parts = (dateLabel || '').split('·').map((s) => s.trim());
    const datePart = parts[0] || '';
    const dayMatch = datePart.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,?\s+(.*)/i);
    if (dayMatch) {
      const fullDays: Record<string, string> = {
        Mon: 'MONDAY',
        Tue: 'TUESDAY',
        Wed: 'WEDNESDAY',
        Thu: 'THURSDAY',
        Fri: 'FRIDAY',
        Sat: 'SATURDAY',
        Sun: 'SUNDAY',
      };
      displayDayName = fullDays[dayMatch[1].slice(0, 3)] || dayMatch[1].toUpperCase();
      displayDateNum = dayMatch[2];
    } else {
      displayDayName = 'EVENT';
      displayDateNum = datePart || 'TBA';
    }
  }

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        shadow('raised'),
        style,
      ]}
    >
      <Pressable
        onPress={onPress}
        accessibilityLabel={`${title}, ${status.label}`}
        style={({ pressed }) => [pressed && styles.pressed]}
      >
        <View style={styles.coverBanner}>
          <Svg width="100%" height={126} style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="85%">
                <Stop offset="0%" stopColor="#1C2125" />
                <Stop offset="40%" stopColor="#2A3035" />
                <Stop offset="100%" stopColor={themeAccent.gradEnd} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill={`url(#${gradId})`} />
          </Svg>

          {cover ? (
            <View style={StyleSheet.absoluteFill}>
              <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
              <View style={[styles.coverOverlay, { backgroundColor: withAlpha(colors.surface, 0.45) }]} />
            </View>
          ) : null}

          <View style={styles.trophyWrap} pointerEvents="none">
            <Svg width={115} height={115} viewBox="0 0 120 120">
              <Path
                d="M 34 26 L 86 26 C 86 54, 76 68, 60 72 C 44 68, 34 54, 34 26 Z"
                stroke="#F3A775"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                opacity={0.18}
              />
              <Path
                d="M 34 35 C 16 35, 14 56, 34 56"
                stroke="#F3A775"
                strokeWidth="6"
                strokeLinecap="round"
                fill="none"
                opacity={0.18}
              />
              <Path
                d="M 86 35 C 104 35, 106 56, 86 56"
                stroke="#F3A775"
                strokeWidth="6"
                strokeLinecap="round"
                fill="none"
                opacity={0.18}
              />
              <Path
                d="M 54 72 L 54 86 M 66 72 L 66 86"
                stroke="#F3A775"
                strokeWidth="5"
                strokeLinecap="round"
                fill="none"
                opacity={0.18}
              />
              <Path
                d="M 42 86 L 78 86 L 84 98 L 36 98 Z"
                stroke="#F3A775"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                opacity={0.18}
              />
            </Svg>
          </View>

          <View style={styles.coverHeaderRow}>
            <View style={styles.badgeRow}>
              <View style={[styles.badgePill, { backgroundColor: 'rgba(24, 32, 40, 0.75)' }]}>
                <Typography style={[styles.badgeText, { color: themeAccent.tagColor }]} numberOfLines={1}>
                  {categoryLabel.toUpperCase()}
                </Typography>
              </View>

              <View
                style={[
                  styles.badgePill,
                  {
                    backgroundColor: status.isOpen ? 'rgba(18, 42, 32, 0.8)' : 'rgba(38, 42, 48, 0.8)',
                  },
                ]}
              >
                <Typography
                  style={[
                    styles.badgeText,
                    {
                      color: status.isOpen ? '#34D399' : colors.textMuted,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {status.label}
                </Typography>
              </View>
            </View>

            <View style={styles.dateStampWrap}>
              <Typography style={styles.dateStampDay} numberOfLines={1}>
                {displayDayName}
              </Typography>
              <Typography style={styles.dateStampDate} numberOfLines={1}>
                {displayDateNum}
              </Typography>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <Typography variant="h3" color="text" numberOfLines={1} style={styles.title}>
            {title}
          </Typography>

          <View style={styles.metaRow}>
            <Icon name="clock" size={15} color="textMuted" />
            <Typography variant="bodySmall" color="textMuted" style={styles.metaText} numberOfLines={1}>
              {timeDisplay ? `${timeDisplay} IST` : dateLabel}
            </Typography>
          </View>

          <View style={styles.metaRow}>
            <Icon name="map-pin" size={15} color="textMuted" />
            <Typography variant="bodySmall" color="textMuted" style={styles.metaText} numberOfLines={1}>
              {venue || 'BGSC Arena'}
            </Typography>
          </View>

          <View style={styles.footerRow}>
            <Typography variant="mono" color="text" style={styles.footerCapacity} numberOfLines={1}>
              {footer}
            </Typography>

            {cta ? (
              <Pressable
                onPress={cta.onPress}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.ctaPill,
                  {
                    backgroundColor: cta.variant === 'outline' ? 'transparent' : colors.primary,
                    borderColor: colors.primary,
                    borderWidth: cta.variant === 'outline' ? 1.5 : 0,
                  },
                  shadow('flat'),
                  pressed && styles.pressed,
                ]}
              >
                <Typography
                  style={[
                    styles.ctaText,
                    { color: cta.variant === 'outline' ? colors.primary : '#FFFFFF' },
                  ]}
                >
                  {cta.label}
                </Typography>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
  },
  coverBanner: {
    height: 114,
    position: 'relative',
    overflow: 'hidden',
  },
  coverOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  trophyWrap: {
    position: 'absolute',
    right: 30,
    top: 6,
  },
  coverHeaderRow: {
    position: 'absolute',
    top: 7,
    left: 8,
    right: 9,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    zIndex: 2,
    gap: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    flexShrink: 1,
  },
  badgePill: {
    paddingHorizontal: 6.5,
    paddingVertical: 2.5,
    borderRadius: 5.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: FONT_FAMILIES.bodyBold,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  dateStampWrap: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  dateStampDay: {
    fontFamily: FONT_FAMILIES.bodyBold,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 1.0,
    color: '#6BA4E8',
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  dateStampDate: {
    fontFamily: FONT_FAMILIES.bodyBold,
    fontSize: 21,
    lineHeight: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    marginTop: -2,
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 4,
  },
  body: {
    paddingHorizontal: 12,
    paddingTop: 9,
    paddingBottom: 11,
    gap: 4,
  },
  title: {
    fontFamily: FONT_FAMILIES.bodyBold,
    fontSize: 15.5,
    lineHeight: 20,
    fontWeight: '700',
    marginBottom: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    lineHeight: 16,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  footerCapacity: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  ctaPill: {
    paddingVertical: 5.5,
    paddingHorizontal: 15,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontFamily: FONT_FAMILIES.bodyBold,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});
