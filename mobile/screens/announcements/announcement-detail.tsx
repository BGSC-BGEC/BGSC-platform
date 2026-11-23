import React, { useEffect } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type NavigationProp, type ParamListBase, type RouteProp } from '@react-navigation/native';
import { Image } from 'expo-image';

import { AppHeader } from '../../src/components/AppHeader';
import { Avatar } from '../../src/components/Avatar';
import { authorColor } from '../../src/components/AnnouncementCard';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { Skeleton } from '../../src/feedback/Skeleton';
import { ErrorState } from '../../src/feedback/ErrorState';
import { Icon } from '../../src/icons/Icon';
import { Typography } from '../../src/typography/Typography';
import { FONT_FAMILIES } from '../../src/theme/typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useAsyncResource } from '../../src/hooks/useAsyncResource';
import { resolveMediaUrl } from '../../src/api/config';
import { announcementsRepository } from '../../src/repositories/AnnouncementsRepository';
import { eventsRepository } from '../../src/repositories/EventsRepository';
import {
  ANNOUNCEMENT_CATEGORY_LABELS,
  ANNOUNCEMENT_PRIORITY,
  capacityLabel,
  eventStatusPill,
  formatDate,
} from '../../src/utils/format';

type Params = { AnnouncementDetail: { id: string } };

/**
 * Announcement detail, laid out like an article: photo (if any), kicker, title, byline, body, then the
 * linked event as a plain row. Opening it marks the post read.
 */
export default function AnnouncementDetailScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { id } = useRoute<RouteProp<Params, 'AnnouncementDetail'>>().params;

  const { data, loading, error, reload } = useAsyncResource(async () => {
    const post = await announcementsRepository.get(id);
    const event = post.audience.event_id ? await eventsRepository.get(post.audience.event_id).catch(() => null) : null;
    return { post, event };
  }, [id]);

  useEffect(() => {
    announcementsRepository.markRead(id).catch(() => undefined);
  }, [id]);

  const post = data?.post;
  const event = data?.event;
  const media = resolveMediaUrl(post?.media_url);
  const canRegister = event ? eventStatusPill(event).registrationOpen : false;
  const eventRef = event ? event.slug || event._id : '';

  const share = () => {
    if (!post) return;
    void Share.share({ title: post.title, message: `${post.title}\n\n${post.body}` });
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader title="Announcement" showBackButton showMenuButton={false} />
      {loading ? (
        <View style={[styles.pad, styles.loading]}>
          <Skeleton height={12} width="40%" />
          <Skeleton height={30} width="90%" />
          <Skeleton height={30} width="65%" />
          <Skeleton height={44} width={220} borderRadius={22} />
          <Skeleton height={14} width="100%" />
          <Skeleton height={14} width="95%" />
          <Skeleton height={14} width="80%" />
        </View>
      ) : !post ? (
        <View style={styles.pad}>
          <ErrorState variant="screen" title="Couldn’t open this announcement" message={error ?? undefined} onRetry={() => reload()} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {media ? <Image source={{ uri: media }} style={styles.cover} contentFit="cover" /> : null}

          <View style={styles.pad}>
            {/* Kicker: the clubs it's for, as text; urgent / important keep their status pill */}
            <View style={styles.kickerRow}>
              {post.categories.length ? (
                <Typography color="primary" style={styles.kicker} numberOfLines={1}>
                  {post.categories.map((c) => (ANNOUNCEMENT_CATEGORY_LABELS[c] ?? c).toUpperCase()).join(' · ')}
                </Typography>
              ) : null}
              {post.priority !== 'normal' ? (
                <Badge label={ANNOUNCEMENT_PRIORITY[post.priority].label} variant={ANNOUNCEMENT_PRIORITY[post.priority].variant} />
              ) : null}
            </View>
            <Typography variant="displayHero" color="text" style={styles.title}>
              {post.title}
            </Typography>

            <View style={[styles.author, { borderBottomColor: colors.border }]}>
              <Avatar
                name={post.author.display_name}
                uri={post.author.avatar_url}
                size={44}
                color={authorColor(post.author.display_name, colors)}
              />
              <View style={styles.flex}>
                <Typography variant="body" color="text" style={styles.semibold}>
                  {post.author.display_name}
                </Typography>
                <Typography variant="bodySmall" color="textMuted">
                  {post.author.role_label}
                  {post.published_at
                    ? ` · ${formatDate(post.published_at, { day: 'numeric', month: 'short', year: undefined })}, ${new Date(post.published_at)
                        .toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })
                        .toUpperCase()}`
                    : ''}
                </Typography>
              </View>
            </View>

            {/* Body is plain text; blank lines separate paragraphs */}
            <View style={styles.body}>
              {post.body.split(/\n{2,}/).map((para, i) => (
                <Typography key={i} variant="body" color="text" style={styles.bodyText} selectable>
                  {para}
                </Typography>
              ))}
            </View>

            {event ? (
              <Pressable
                onPress={() => navigation.navigate('EventDetails', { eventId: eventRef })}
                accessibilityRole="button"
                style={({ pressed }) => [styles.linked, { borderColor: colors.border }, pressed && styles.pressed]}
              >
                <View style={styles.flex}>
                  <Typography color="textMuted" style={styles.linkedKicker}>
                    EVENT
                  </Typography>
                  <Typography variant="body" color="text" style={styles.semibold} numberOfLines={1}>
                    {event.title}
                  </Typography>
                  <Typography variant="bodySmall" color="textMuted" numberOfLines={1}>
                    {formatDate(event.start_at, { weekday: 'short', day: 'numeric', month: 'short', year: undefined })} ·{' '}
                    {capacityLabel(event)}
                  </Typography>
                </View>
                <Icon name="chevron-right" size={20} color="textMuted" />
              </Pressable>
            ) : null}

            <View style={styles.actions}>
              {canRegister ? (
                <Button
                  label={event?.teaming.is_teamed ? 'Register team' : 'Register'}
                  onPress={() => navigation.navigate('EventRegistration', { eventId: eventRef })}
                  containerStyle={styles.flex}
                />
              ) : null}
              <Button label="Share" variant="outline" onPress={share} containerStyle={canRegister ? styles.share : styles.flex} />
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  pressed: { opacity: 0.6 },
  semibold: { fontFamily: FONT_FAMILIES.bodySemiBold },
  loading: { gap: 14, paddingTop: 20 },
  content: { paddingTop: 4, paddingBottom: 40, gap: 20 },
  pad: { paddingHorizontal: 20, gap: 20 },
  cover: { width: '100%', aspectRatio: 16 / 9 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: -8 },
  kicker: { flexShrink: 1, fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 11, lineHeight: 15, letterSpacing: 0.8 },
  title: { fontSize: 32, lineHeight: 40 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 18, borderBottomWidth: StyleSheet.hairlineWidth },
  body: { gap: 16 },
  bodyText: { fontSize: 16, lineHeight: 25 },
  linked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  linkedKicker: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 10.5, lineHeight: 14, letterSpacing: 0.8, marginBottom: 2 },
  actions: { flexDirection: 'row', gap: 12 },
  share: { width: 110 },
});
