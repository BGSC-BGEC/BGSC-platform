import React, { useEffect } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type NavigationProp, type ParamListBase, type RouteProp } from '@react-navigation/native';
import { Image } from 'expo-image';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { AppHeader } from '../../src/components/AppHeader';
import { Avatar } from '../../src/components/Avatar';
import { announcementTags, authorColor } from '../../src/components/AnnouncementCard';
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
import { ANNOUNCEMENT_PRIORITY, capacityLabel, eventStatusPill, formatDate } from '../../src/utils/format';
import MegaphoneWatermark from '../../assets/illustrations/megaphone-watermark.svg';

type Params = { AnnouncementDetail: { id: string } };

/** v2 Announcement detail (35:775). Opening it marks the post read. */
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
        <View style={styles.loading}>
          <Skeleton height={220} borderRadius={0} />
          <View style={styles.pad}>
            <Skeleton height={96} borderRadius={12} />
            <Skeleton height={44} width={220} borderRadius={22} />
            <Skeleton height={140} borderRadius={12} />
          </View>
        </View>
      ) : !post ? (
        <View style={styles.pad}>
          <ErrorState title="Couldn’t open this announcement" message={error ?? undefined} onRetry={() => reload()} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.cover}>
            {media ? (
              <Image source={{ uri: media }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <>
                <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none">
                  <Defs>
                    <LinearGradient id="announcement-cover" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0" stopColor="#E07A40" />
                      <Stop offset="1" stopColor="#2B3036" />
                    </LinearGradient>
                  </Defs>
                  <Rect width="100%" height="100%" fill="url(#announcement-cover)" />
                </Svg>
                <View style={styles.watermark} pointerEvents="none">
                  <MegaphoneWatermark width={200} height={200} />
                </View>
              </>
            )}
            <View style={styles.badges}>
              <Badge label={ANNOUNCEMENT_PRIORITY[post.priority].label} variant={ANNOUNCEMENT_PRIORITY[post.priority].variant} />
              {announcementTags(post).map((t) => (
                <Badge key={t.label} label={t.label} variant={t.variant} />
              ))}
            </View>
          </View>

          <View style={styles.pad}>
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
                style={({ pressed }) => [
                  styles.linked,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.linkedIcon, { backgroundColor: colors.accentMuted }]}>
                  <Icon name="calendar" size={20} color="primary" />
                </View>
                <View style={styles.flex}>
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
  pressed: { opacity: 0.85 },
  semibold: { fontFamily: FONT_FAMILIES.bodySemiBold },
  loading: { gap: 20 },
  content: { paddingBottom: 32, gap: 20 },
  pad: { paddingHorizontal: 20, gap: 20 },
  cover: { height: 220, justifyContent: 'flex-end', padding: 20, overflow: 'hidden' },
  watermark: { position: 'absolute', right: -6, top: 0, transform: [{ rotate: '12deg' }] },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  title: { fontSize: 32, lineHeight: 48 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 16, borderBottomWidth: 1 },
  body: { gap: 16 },
  bodyText: { fontSize: 15, lineHeight: 22 },
  linked: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 20, borderWidth: 1 },
  linkedIcon: { padding: 12, borderRadius: 12 },
  actions: { flexDirection: 'row', gap: 12 },
  share: { width: 110 },
});
