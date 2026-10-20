import React, { useCallback } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';

import { AppHeader } from '../../src/components/AppHeader';
import { Avatar } from '../../src/components/Avatar';
import { authorColor } from '../../src/components/AnnouncementCard';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { EventCard, eventCardData } from '../../src/components/EventCard';
import { SectionHeader } from '../../src/components/SectionHeader';
import { SkeletonEventCard, Skeleton } from '../../src/feedback/Skeleton';
import { ErrorState } from '../../src/feedback/ErrorState';
import { Icon, type IconName } from '../../src/icons/Icon';
import { Typography } from '../../src/typography/Typography';
import { FONT_FAMILIES } from '../../src/theme/typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useAuth } from '../../store/auth';
import { useAsyncResource } from '../../src/hooks/useAsyncResource';
import { api } from '../../src/api/client';
import { announcementsRepository } from '../../src/repositories/AnnouncementsRepository';
import { eventsRepository } from '../../src/repositories/EventsRepository';
import { leaderboardRepository } from '../../src/repositories/LeaderboardRepository';
import { pointsRepository } from '../../src/repositories/PointsRepository';
import type { Announcement, AnnouncementHead, ApiEvent, PointTransaction } from '../../src/api/types';
import {
  ANNOUNCEMENT_CATEGORY_LABELS,
  eventStatusPill,
  formatNumber,
  humanizeReason,
  isPinned,
  timeAgo,
} from '../../src/utils/format';

// ponytail: placeholder community link — swap for the real BGSC WhatsApp invite.
const WHATSAPP_URL = 'https://www.whatsapp.com/';
const WEEK_MS = 7 * 24 * 3600 * 1000;

const SOURCE_ICON: Record<PointTransaction['source'], IconName> = {
  event: 'trophy',
  challenge: 'target',
  leaderboard: 'zap',
  engagement: 'sparkles',
  store: 'coins',
  sponsor: 'coins',
  admin: 'settings',
};

interface HomeData {
  points: { balance: number; week: number } | null;
  rank: { rank: number; topPercent: number } | null;
  eventsJoined: number | null;
  activeChallenges: number | null;
  pinned: Announcement | null;
  heads: AnnouncementHead[];
  events: ApiEvent[];
  activity: Array<PointTransaction & { title: string }>;
}

const ACTIVE_PARTICIPATION = ['accepted', 'submitted', 'under_review'];

async function loadHome(userId: string | undefined): Promise<HomeData> {
  // Each tile degrades on its own; if the core feed all fails we're offline and the screen says so.
  let firstError: unknown = null;
  const settle = <T,>(p: Promise<T>): Promise<T | null> =>
    p.catch((err) => {
      firstError ??= err;
      return null;
    });
  const [points, txPage, rank, total, regs, parts, pinnedList, heads, events] = await Promise.all([
    settle(pointsRepository.me()),
    settle(pointsRepository.transactions({ limit: 50 })),
    userId ? settle(leaderboardRepository.findMyGlobalRank(userId)) : Promise.resolve(null),
    settle(leaderboardRepository.global({ limit: 1 })),
    settle(api.get<Array<{ owner?: { type: string } }>>('/registrations', { params: { status: 'confirmed', limit: 500 } })),
    settle(api.get<{ participations: Array<{ status: string }> }>('/challenges/me/participations', { params: { limit: 50 } })),
    settle(announcementsRepository.list({ pinned: true, limit: 5 })),
    settle(announcementsRepository.heads()),
    settle(eventsRepository.list({ status: ['upcoming', 'ongoing'], sort: 'date_asc', limit: 20 })),
  ]);
  if (!points && !txPage && !total && !events && !heads && !pinnedList) throw firstError;

  const tx = txPage?.transactions ?? [];
  const weekAgo = Date.now() - WEEK_MS;
  const week = tx.filter((t) => Date.parse(t.created_at) >= weekAgo && t.amount > 0).reduce((n, t) => n + t.amount, 0);

  // Transactions only carry a reference id — look up event titles for the three rows shown.
  const recent = tx.slice(0, 3);
  const titles = await Promise.all(
    recent.map((t) =>
      t.reference.type === 'event' && t.reference.id
        ? eventsRepository.get(t.reference.id).then((e) => e.title).catch(() => null)
        : Promise.resolve(null),
    ),
  );

  return {
    points: points ? { balance: points.balance, week } : null,
    rank:
      rank?.rank && total?.total
        ? { rank: rank.rank, topPercent: Math.max(1, Math.ceil((rank.rank / total.total) * 100)) }
        : null,
    eventsJoined: regs ? regs.filter((r) => r.owner?.type === 'event').length : null,
    activeChallenges: parts ? parts.participations.filter((p) => ACTIVE_PARTICIPATION.includes(p.status)).length : null,
    pinned: pinnedList?.announcements.find((a) => isPinned(a)) ?? null,
    heads: heads ?? [],
    events: events?.events ?? [],
    activity: recent.map((t, i) => ({ ...t, title: titles[i] ? `${humanizeReason(t.reason)} · ${titles[i]}` : humanizeReason(t.reason) })),
  };
}

function greeting(now = new Date()): string {
  // IST, like every other date on screen.
  const h = Number(now.toLocaleString('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Kolkata' }));
  return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
}

/** v2 Home (34:563). */
export default function Home() {
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { user } = useAuth();
  const { data, loading, refreshing, error, reload } = useAsyncResource(() => loadHome(user?.id), [user?.id]);

  const openEvents = (data?.events ?? []).filter((e) => eventStatusPill(e).registrationOpen);
  const [featured, ...more] = data?.events ?? [];
  const firstName = (user?.fullName || user?.username || '').split(' ')[0];
  const today = new Date()
    .toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })
    .toUpperCase();

  const goEvent = useCallback(
    (e: ApiEvent) => navigation.navigate('EventDetails', { eventId: e.slug || e._id }),
    [navigation],
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader title="BGSC" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => reload()} tintColor={colors.primary} />}
      >
        {/* Greeting */}
        <View style={styles.greeting}>
          <Typography color="textMuted" style={styles.kicker}>
            {today}
          </Typography>
          <Typography variant="displayHero" color="text" style={styles.hello}>
            {greeting()}
            {firstName ? `, ${firstName}` : ''}.
          </Typography>
          {data ? (
            <Typography variant="body" color="textMuted">
              {openEvents.length === 0
                ? 'Nothing open for registration right now.'
                : `${openEvents.length} ${openEvents.length === 1 ? 'event is' : 'events are'} open for registration.`}
            </Typography>
          ) : null}
        </View>

        {error && !data ? <ErrorState title="Couldn’t load your home feed" message={error} onRetry={() => reload()} /> : null}

        {/* Pinned broadcast */}
        {data?.pinned ? (
          <Pressable
            onPress={() => navigation.navigate('AnnouncementDetail', { id: data.pinned!._id })}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.pinned,
              { backgroundColor: colors.accentMuted, borderColor: colors.primary },
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.iconTile, { backgroundColor: colors.primarySolid }]}>
              <Icon name="megaphone" size={20} color="white" />
            </View>
            <View style={styles.flex}>
              <Typography color="primary" style={styles.pinnedKicker}>
                PINNED · {ANNOUNCEMENT_CATEGORY_LABELS[data.pinned.categories[0]]?.toUpperCase()}
              </Typography>
              <Typography variant="body" color="text" style={styles.semibold} numberOfLines={2}>
                {data.pinned.title}
              </Typography>
            </View>
            <Icon name="chevron-right" size={20} color="primary" />
          </Pressable>
        ) : null}

        {/* Points card */}
        {loading ? (
          <Skeleton height={230} borderRadius={24} />
        ) : data?.points ? (
          <View style={[styles.card, styles.pointsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.row}>
              <Typography color="textMuted" style={[styles.kicker, styles.flex]}>
                SEASON POINTS
              </Typography>
              {data.rank ? <Badge label={`Top ${data.rank.topPercent}%`} variant="success" /> : null}
            </View>
            <View style={styles.balanceRow}>
              <Typography color="text" style={styles.balance}>
                {formatNumber(data.points.balance)}
              </Typography>
              {data.points.week > 0 ? (
                <Typography variant="mono" color="success" style={styles.week}>
                  +{formatNumber(data.points.week)} this week
                </Typography>
              ) : null}
            </View>
            <View style={styles.stats}>
              <Stat value={data.rank ? `#${data.rank.rank}` : '—'} label="Global rank" />
              <Stat value={data.eventsJoined != null ? String(data.eventsJoined) : '—'} label="Events" />
              <Stat
                value={data.activeChallenges != null ? String(data.activeChallenges) : '—'}
                label="Challenges"
                onPress={() => navigation.navigate('Challenges')}
              />
            </View>
            <View style={styles.row}>
              <Button label="Points history" variant="outline" onPress={() => navigation.navigate('Points')} containerStyle={styles.flex} />
              <Button label="Leaderboard" onPress={() => navigation.navigate('Leaderboard')} containerStyle={styles.flex} />
            </View>
          </View>
        ) : null}

        {/* Quick actions */}
        <View style={styles.row}>
          <QuickAction icon="calendar" title="Register" meta={`${openEvents.length} open`} onPress={() => navigation.navigate('Events')} />
          <QuickAction
            icon="target"
            title="Challenges"
            meta={data?.activeChallenges != null ? `${data.activeChallenges} active` : 'Browse'}
            onPress={() => navigation.navigate('Challenges')}
          />
          <QuickAction icon="image" title="Media" meta="Share" onPress={() => navigation.navigate('Media')} />
        </View>

        {/* From the heads */}
        {data?.heads.length ? (
          <View style={styles.section}>
            <SectionHeader title="From the heads" actionLabel="All posts" onAction={() => navigation.navigate('AnnouncementsTab')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
              {data.heads.map((h) => (
                <HeadBubble
                  key={h.coordinator.user_id}
                  head={h}
                  onPress={h.announcement ? () => navigation.navigate('AnnouncementDetail', { id: h.announcement!._id }) : undefined}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Upcoming events */}
        <View style={styles.section}>
          <SectionHeader title="Upcoming events" actionLabel="See all" onAction={() => navigation.navigate('Events')} />
          {loading ? (
            <SkeletonEventCard />
          ) : featured ? (
            (() => {
              const card = eventCardData(featured);
              return (
                <EventCard
                  {...card}
                  onPress={() => goEvent(featured)}
                  cta={
                    card.registrationOpen
                      ? { label: 'Register', onPress: () => navigation.navigate('EventRegistration', { eventId: featured.slug || featured._id }) }
                      : { label: 'View', variant: 'outline', onPress: () => goEvent(featured) }
                  }
                />
              );
            })()
          ) : (
            <Typography variant="body" color="textMuted">
              No upcoming events yet — check back soon.
            </Typography>
          )}
          {more.length ? (
            <View style={styles.row}>
              {more.slice(0, 2).map((e) => {
                const pill = eventStatusPill(e);
                return (
                  <Pressable
                    key={e._id}
                    onPress={() => goEvent(e)}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.card,
                      styles.compact,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Badge label={pill.label} variant={pill.variant} />
                    <Typography variant="body" color="text" style={styles.semibold} numberOfLines={1}>
                      {e.title}
                    </Typography>
                    <Typography color="textMuted" style={styles.tiny} numberOfLines={1}>
                      {new Date(e.start_at).toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' })}
                      {e.venue ? ` · ${e.venue}` : ''}
                    </Typography>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>

        {/* Recent activity */}
        {data?.activity.length ? (
          <View style={styles.section}>
            <SectionHeader title="Recent activity" actionLabel="History" onAction={() => navigation.navigate('Points')} />
            <View style={[styles.card, styles.list, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {data.activity.map((t, i) => (
                <View
                  key={t.id}
                  style={[styles.activityRow, i < data.activity.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                >
                  <View style={[styles.iconTile, { backgroundColor: colors.surfaceInner }]}>
                    <Icon name={SOURCE_ICON[t.source] ?? 'zap'} size={18} color="textMuted" />
                  </View>
                  <View style={styles.flex}>
                    <Typography color="text" style={[styles.semibold, styles.small]} numberOfLines={1}>
                      {t.title}
                    </Typography>
                    <Typography color="textMuted" style={styles.tiny}>
                      {timeAgo(t.created_at)}
                    </Typography>
                  </View>
                  <Typography variant="mono" style={{ color: t.amount >= 0 ? colors.success : colors.dangerText }}>
                    {t.amount >= 0 ? '+' : '−'}
                    {formatNumber(Math.abs(t.amount))}
                  </Typography>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* WhatsApp community */}
        <Pressable
          onPress={() => void Linking.openURL(WHATSAPP_URL)}
          accessibilityRole="link"
          style={({ pressed }) => [
            styles.card,
            styles.whatsapp,
            { backgroundColor: colors.successMuted, borderColor: colors.success },
            pressed && styles.pressed,
          ]}
        >
          <View style={[styles.iconTile, { backgroundColor: colors.success }]}>
            <Icon name="message" size={20} color="white" />
          </View>
          <View style={styles.flex}>
            <Typography variant="body" color="text" style={styles.semibold}>
              Join the BGSC WhatsApp
            </Typography>
            <Typography color="textMuted" style={styles.tiny}>
              Announcements land there first
            </Typography>
          </View>
          <Icon name="external-link" size={18} color="success" />
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Stat({ value, label, onPress }: { value: string; label: string; onPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={[styles.stat, { backgroundColor: colors.surfaceInner }]}
    >
      <Typography variant="mono" color="text" style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Typography>
      <Typography color="textMuted" style={styles.tiny} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {label}
      </Typography>
    </Pressable>
  );
}

function QuickAction({ icon, title, meta, onPress }: { icon: IconName; title: string; meta: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${meta}`}
      style={({ pressed }) => [
        styles.card,
        styles.quick,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.iconTile, { backgroundColor: colors.accentMuted }]}>
        <Icon name={icon} size={20} color="primary" />
      </View>
      <View>
        <Typography variant="body" color="text" style={styles.semibold} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {title}
        </Typography>
        <Typography color="textMuted" style={styles.tiny} numberOfLines={1}>
          {meta}
        </Typography>
      </View>
    </Pressable>
  );
}

/** A head's latest post as a speech bubble, with who said it underneath. */
function HeadBubble({ head, onPress }: { head: AnnouncementHead; onPress?: () => void }) {
  const { colors } = useTheme();
  const name = head.coordinator.display_name;
  return (
    <View style={styles.head}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        style={({ pressed }) => [styles.bubble, { backgroundColor: colors.text }, pressed && styles.pressed]}
      >
        <Typography variant="body" style={{ color: colors.background }} numberOfLines={3}>
          {head.announcement ? head.announcement.title : 'Nothing posted yet — check back soon.'}
        </Typography>
      </Pressable>
      <View style={styles.headWho}>
        <Avatar name={name} uri={head.coordinator.avatar_url} size={36} color={authorColor(name, colors)} />
        <View>
          <Typography variant="body" color="text" style={styles.semibold} numberOfLines={1}>
            {name}
          </Typography>
          <Typography color="textMuted" style={styles.tiny} numberOfLines={1}>
            {head.coordinator.role_label}
          </Typography>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, gap: 24 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pressed: { opacity: 0.85 },
  semibold: { fontFamily: FONT_FAMILIES.bodySemiBold },
  small: { fontSize: 13 },
  tiny: { fontSize: 11, lineHeight: 18 },
  kicker: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 11, lineHeight: 15, letterSpacing: 1 },
  greeting: { gap: 4 },
  hello: { fontSize: 34, lineHeight: 52 },
  card: { borderWidth: 1 },
  pinned: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 20, borderWidth: 1 },
  pinnedKicker: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 10, lineHeight: 15, letterSpacing: 0.8 },
  iconTile: { padding: 8, borderRadius: 12 },
  pointsCard: { borderRadius: 24, padding: 20, gap: 16 },
  balanceRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', columnGap: 16 },
  balance: { fontFamily: FONT_FAMILIES.hero, fontSize: 48, lineHeight: 52 },
  week: { fontSize: 12, paddingBottom: 12 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, gap: 2, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 16 },
  statValue: { fontSize: 18 },
  quick: { flex: 1, gap: 12, padding: 12, borderRadius: 20 },
  section: { gap: 12 },
  carousel: { gap: 12 },
  head: { width: 250, gap: 12 },
  bubble: {
    padding: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    borderBottomLeftRadius: 4,
  },
  headWho: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  compact: { flex: 1, gap: 8, padding: 16, borderRadius: 20 },
  list: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 4 },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  whatsapp: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 20 },
});
