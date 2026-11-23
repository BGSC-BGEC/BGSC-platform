import React, { useCallback, useMemo, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  DrawerActions,
  useFocusEffect,
  useIsFocused,
  useNavigation,
  type NavigationProp,
  type ParamListBase,
} from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';

import { Avatar } from '../../src/components/Avatar';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { authorColor } from '../../src/components/AnnouncementCard';
import { EventCard, eventCardData } from '../../src/components/EventCard';
import { SectionHeader } from '../../src/components/SectionHeader';
import { BgscLogo } from '../../src/components/BgscLogo';
import { GamingBackdrop } from '../../src/components/GamingBackdrop';
import { AnimatedScrollView } from '../../src/components/reacticx/templates/parallax-header';
import { DrawerSafeScrollView } from '../../src/navigation/drawerGesture';
import { HeroIllustration, HERO_ILLUSTRATION_ASPECT } from '../../src/components/HeroIllustration';
import { FrostedRim, FrostedSheen } from '../../src/components/FrostedSheen';
import { SkeletonEventCard, Skeleton } from '../../src/feedback/Skeleton';
import { ErrorState } from '../../src/feedback/ErrorState';
import { Icon, type IconName } from '../../src/icons/Icon';
import { Typography } from '../../src/typography/Typography';
import { FONT_FAMILIES } from '../../src/theme/typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { withAlpha } from '../../src/theme/colors';
import { useAuth } from '../../store/auth';
import { useAsyncResource } from '../../src/hooks/useAsyncResource';
import { api } from '../../src/api/client';
import { announcementsRepository } from '../../src/repositories/AnnouncementsRepository';
import { eventsRepository } from '../../src/repositories/EventsRepository';
import { leaderboardRepository } from '../../src/repositories/LeaderboardRepository';
import { pointsRepository } from '../../src/repositories/PointsRepository';
import { notificationsRepository } from '../../src/repositories/NotificationsRepository';
import type { Announcement, AnnouncementHead, ApiEvent, EventCategory, PointTransaction } from '../../src/api/types';
import {
  ANNOUNCEMENT_CATEGORY_LABELS,
  eventStatusPill,
  formatNumber,
  humanizeReason,
  isPinned,
  timeAgo,
} from '../../src/utils/format';

const WHATSAPP_URL = 'https://www.whatsapp.com/';

const WEEK_MS = 7 * 24 * 3600 * 1000;

/** Collapsed (frosted) top bar height below the status bar. (Hero height: see heroArtLayout.) */
const TOP_BAR_BODY_HEIGHT = 52;
/** Height of the menu button and action capsule in the top bar. */
const TOP_BAR_CONTROL_SIZE = 40;
/** How far the rounded content sheet rides up over the hero. */
const SHEET_OVERLAP = 24;

/** Hero text sits on the orange doodle backdrop in both themes, so it is always white. */
const HERO_INK = '#FFFFFF';
const HERO_INK_SOFT = 'rgba(255, 255, 255, 0.88)';
const HERO_AVATAR_SIZE = 64;
const HERO_AVATAR_GAP = 8;
/** Avatar fallback fill: deep burnt orange, so initials don't vanish into the hero. */
const HERO_AVATAR_BG = '#7A2E06';
const HERO_TEXT_SHADOW = {
  textShadowColor: 'rgba(80, 30, 0, 0.28)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 6,
} as const;

export type FinderCategory = 'general' | 'gaming' | 'sports';

export const FINDER_CONFIG: Record<
  FinderCategory,
  {
    disciplineCode: string;
    disciplineLabel: string;
    disciplineSub: string;
    arenaCode: string;
    arenaLabel: string;
    arenaSub: string;
    schedule: string;
    time: string;
    squad: string;
    format: string;
    ctaLabel: string;
    targetCategory?: EventCategory;
  }
> = {
  general: {
    disciplineCode: 'ALL',
    disciplineLabel: 'COMMUNITY',
    disciplineSub: 'General Events & Socials',
    arenaCode: 'AUD',
    arenaLabel: 'VENUE',
    arenaSub: 'Main Auditorium · Hall A',
    schedule: 'Sun, 6 Sep',
    time: '5:00 PM IST',
    squad: 'Solo / Teams',
    format: 'Open Stage',
    ctaLabel: 'Explore General Events',
    targetCategory: 'general',
  },
  gaming: {
    disciplineCode: 'VAL',
    disciplineLabel: 'DISCIPLINE',
    disciplineSub: 'Valorant 5v5 · PC Esports',
    arenaCode: 'FNL',
    arenaLabel: 'ARENA',
    arenaSub: 'Grand Finals · Discord',
    schedule: 'Fri, 4 Sep',
    time: '6:00 PM IST',
    squad: '5 Players (Team)',
    format: 'Double Elim',
    ctaLabel: 'Search Gaming Tournaments',
    targetCategory: 'bgec',
  },
  sports: {
    disciplineCode: 'BPL',
    disciplineLabel: 'LEAGUE',
    disciplineSub: 'Badminton & Football',
    arenaCode: 'SAC',
    arenaLabel: 'ARENA',
    arenaSub: 'Indoor Courts · Turf',
    schedule: 'Sat, 5 Sep',
    time: '4:30 PM IST',
    squad: 'Franchise Teams',
    format: 'Round Robin',
    ctaLabel: 'Search Sports Leagues',
    targetCategory: 'leagues',
  },
};

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

  const recent = tx.slice(0, 3);
  const titles = await Promise.all(
    recent.map((t) =>
      t.reference?.type === 'event' && t.reference?.id
        ? eventsRepository.get(t.reference.id).then((e) => e?.title).catch(() => null)
        : Promise.resolve(null),
    ),
  );

  const regList = Array.isArray(regs)
    ? regs
    : Array.isArray((regs as any)?.registrations)
      ? (regs as any).registrations
      : [];

  return {
    points: points ? { balance: points.balance, week } : null,
    rank:
      rank?.rank && total?.total
        ? { rank: rank.rank, topPercent: Math.max(1, Math.ceil((rank.rank / total.total) * 100)) }
        : null,
    eventsJoined: regList.filter((r: any) => r?.owner?.type === 'event').length,
    activeChallenges:
      parts && Array.isArray(parts.participations)
        ? parts.participations.filter((p) => p && ACTIVE_PARTICIPATION.includes(p.status)).length
        : 0,
    pinned: Array.isArray(pinnedList?.announcements)
      ? pinnedList.announcements.find((a) => a && isPinned(a)) ?? null
      : null,
    heads: Array.isArray(heads) ? heads : [],
    events: Array.isArray(events?.events) ? events.events : [],
    activity: recent.map((t, i) => ({ ...t, title: titles[i] ? `${humanizeReason(t.reason)} · ${titles[i]}` : humanizeReason(t.reason) })),
  };
}

/**
 * Player-card name size from the width available beside the illustration:
 * Inter Black averages ~0.62em per character, so pick the largest size that fits,
 * between a floor and a cap. Longer names still get an ellipsis at the floor.
 */
const HERO_NAME_MAX = 40;
const HERO_NAME_MIN = 24;
function heroNameSize(name: string, maxWidth: number) {
  const fit = Math.floor(maxWidth / (Math.max(1, name.length) * 0.62));
  const fontSize = Math.max(HERO_NAME_MIN, Math.min(HERO_NAME_MAX, fit));
  return { fontSize, lineHeight: Math.round(fontSize * 1.15) };
}

/**
 * Hero geometry. One row: greeting column on the left, illustration on the right.
 * The illustration is large (72% of the width, original aspect ratio), runs ~18% of its
 * width off the right edge, and sits behind the greeting. Its base rests on the content
 * sheet's top edge (not tucked under). To use the empty space at the top instead of
 * adding height, the row starts HERO_ROW_RAISE px up into the (transparent) top bar.
 *
 * Row height = the taller of the illustration and the greeting column (+ its clearance
 * above the sheet and below the top bar), so a big avatar never meets the top bar buttons.
 * Hero body height = top bar - raise + row + bottom padding.
 */
const HERO_SIDE_PADDING = 16;
const HERO_ROW_RAISE = 12;
const HERO_BLOCK_PADDING_BOTTOM = SHEET_OVERLAP;
/** Space between the greeting column and the content sheet's top edge. */
const HERO_TEXT_ABOVE_SHEET = 12;
const HERO_IDENTITY_PADDING_BOTTOM = SHEET_OVERLAP + HERO_TEXT_ABOVE_SHEET - HERO_BLOCK_PADDING_BOTTOM;
const HERO_ART_WIDTH_RATIO = 0.72;
const HERO_ART_OVERFLOW_RATIO = 0.18;
/** Toned down so the illustration supports the greeting instead of grabbing attention. */
const HERO_ART_OPACITY = 0.78;
/** How far the greeting column may reach over the art's (mostly empty) left edge. */
const HERO_TEXT_OVER_ART = 14;
function heroArtLayout(screenWidth: number) {
  const width = Math.round(Math.min(screenWidth, 600) * HERO_ART_WIDTH_RATIO);
  const height = Math.round(width / HERO_ILLUSTRATION_ASPECT);
  const overflow = Math.round(width * HERO_ART_OVERFLOW_RATIO);
  const left = screenWidth + overflow - width; // art's left edge on screen
  // Greeting column: ringed avatar + gap + greeting + name (max line height) + subline.
  const identityHeight =
    HERO_AVATAR_SIZE + 9 + HERO_AVATAR_GAP + 18 + Math.round(HERO_NAME_MAX * 1.15) + 22;
  const rowHeight = Math.max(height, identityHeight + HERO_IDENTITY_PADDING_BOTTOM + HERO_ROW_RAISE);
  return {
    width,
    height,
    rowHeight,
    /** Offset from the row's right edge (the row sits inside the side padding). */
    right: -(HERO_SIDE_PADDING + overflow),
    identityWidth: Math.round(left - HERO_SIDE_PADDING + HERO_TEXT_OVER_ART),
    bodyHeight: TOP_BAR_BODY_HEIGHT - HERO_ROW_RAISE + rowHeight + HERO_BLOCK_PADDING_BOTTOM,
    /** The art's box in hero (backdrop) coordinates, for keeping doodles out of it. */
    rect: (heroHeight: number) => ({
      x: left,
      y: heroHeight - HERO_BLOCK_PADDING_BOTTOM - height,
      width,
      height,
    }),
  };
}

function greeting(now = new Date()): string {
  const h = Number(now.toLocaleString('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Kolkata' }));
  return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
}

/**
 * Home screen displaying featured events, announcements, and quick actions.
 */
export default function Home() {
  const { colors, shadow, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const isFocused = useIsFocused();
  const { user } = useAuth();
  const { data, loading, refreshing, error, reload } = useAsyncResource(() => loadHome(user?.id), [user?.id]);
  const [searchTab, setSearchTab] = useState<FinderCategory>('gaming');
  const [unread, setUnread] = useState(0);

  const currentConfig = FINDER_CONFIG[searchTab];

  const carouselEvents = useMemo(() => {
    const all = data?.events ?? [];
    if (!all.length) return [];
    if (searchTab === 'gaming') {
      const matches = all.filter((e) => e.domain === 'esports' || e.category === 'bgec');
      return matches.length > 0 ? matches : all;
    }
    if (searchTab === 'sports') {
      const matches = all.filter(
        (e) => e.domain === 'sports' || e.domain === 'fitness' || e.category === 'leagues' || e.category === 'fitsoc',
      );
      return matches.length > 0 ? matches : all;
    }
    if (searchTab === 'general') {
      const matches = all.filter((e) => e.domain === 'general' || e.category === 'general');
      return matches.length > 0 ? matches : all;
    }
    return all;
  }, [data?.events, searchTab]);

  // Poll notifications for top bar
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      const load = () =>
        notificationsRepository
          .getUnreadCount()
          .then((n) => alive && setUnread(n))
          .catch(() => undefined);
      load();
      const timer = setInterval(load, 30000);
      return () => {
        alive = false;
        clearInterval(timer);
      };
    }, []),
  );

  const openEvents = (data?.events ?? []).filter((e) => eventStatusPill(e).registrationOpen);
  const firstName = (user?.fullName || user?.username || '').split(' ')[0];

  const goEvent = useCallback(
    (e: ApiEvent) => navigation.navigate('EventDetails', { eventId: e.slug || e._id }),
    [navigation],
  );

  const renderFinderEventCard = (event: ApiEvent, isSingle: boolean) => {
    const card = eventCardData(event);
    return (
      <View key={event._id} style={isSingle ? styles.carouselSingleCardWrap : styles.carouselCardWrap}>
        <EventCard
          {...card}
          onPress={() => goEvent(event)}
          cta={
            card.registrationOpen
              ? {
                  label: 'Register',
                  onPress: () =>
                    navigation.navigate('EventRegistration', {
                      eventId: event.slug || event._id,
                    }),
                }
              : {
                  label: 'View Details',
                  variant: 'outline',
                  onPress: () => goEvent(event),
                }
          }
        />
      </View>
    );
  };

  const { width: screenWidth } = useWindowDimensions();
  const heroArt = useMemo(() => heroArtLayout(screenWidth), [screenWidth]);
  const heroHeight = insets.top + heroArt.bodyHeight;
  const topBarHeight = insets.top + TOP_BAR_BODY_HEIGHT;

  // Shared frosted-glass tone for the top bar's menu button and action capsule.
  const glassTone = {
    backgroundColor: withAlpha(colors.surface, isDark ? 0.62 : 0.8),
    borderColor: isDark ? withAlpha('#FFFFFF', 0.12) : withAlpha(colors.border, 0.7),
    borderTopColor: withAlpha('#FFFFFF', isDark ? 0.22 : 0.9),
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AnimatedScrollView
        showsVerticalScrollIndicator={false}
        headerMaxHeight={heroHeight}
        topBarHeight={topBarHeight}
        // Frosted bar that fades in behind the fixed top buttons once the hero scrolls away.
        renderTopNavBarComponent={() => (
          <View
            pointerEvents="none"
            style={[styles.collapsedBar, { borderBottomColor: withAlpha(colors.border, 0.7) }]}
          >
            <BlurView intensity={isDark ? 45 : 70} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: withAlpha(colors.background, Platform.OS === 'ios' ? 0.55 : 0.92) },
              ]}
            />
          </View>
        )}
        // Parallax layer: drifts down at half scroll speed, fades, and stretches on pull-down.
        renderHeaderComponent={() => (
          <View pointerEvents="none" style={[styles.heroLayer, { backgroundColor: colors.background }]}>
            <GamingBackdrop
              height={heroHeight}
              topInset={topBarHeight}
              // Doodles behind the greeting and stat strip are drawn fainter.
              bottomInset={heroHeight - topBarHeight}
              // No fade: the content sheet's rounded corners sit straight on the orange
              // (a fade into the dark background read as a muddy band).
              fadeHeight={0}
              // No doodles behind the illustration (it has its own).
              clearRects={[heroArt.rect(heroHeight)]}
              paused={!isFocused}
            />
          </View>
        )}
        // Player card on the orange hero; fades out as you scroll.
        renderOveralComponent={() => (
          <View
            pointerEvents="box-none"
            // Fills the orange area below the top bar, starting HERO_ROW_RAISE px up into it.
            style={[styles.heroTextBlock, { height: heroHeight - topBarHeight + HERO_ROW_RAISE }]}
          >
            {/* Greeting on the left, large illustration behind it on the right (running
                slightly off-screen), both above the strip. */}
            <View style={[styles.heroRow, { height: heroArt.rowHeight }]}>
              <HeroIllustration
                width={heroArt.width}
                opacity={HERO_ART_OPACITY}
                style={[styles.heroArt, { right: heroArt.right }]}
              />
              <View style={[styles.identity, { width: heroArt.identityWidth }]}>
                <View style={styles.avatarRing}>
                  <Avatar
                    name={user?.fullName || user?.username}
                    uri={user?.avatar_url}
                    size={HERO_AVATAR_SIZE}
                    color={HERO_AVATAR_BG}
                  />
                </View>
                <Typography style={styles.greetingText} numberOfLines={1}>
                  Good {greeting().toLowerCase()}
                </Typography>
                <Typography
                  style={[styles.heroName, heroNameSize(firstName || 'Player', heroArt.identityWidth)]}
                  numberOfLines={1}
                >
                  {firstName || 'Player'}
                </Typography>
                <Typography style={styles.heroSubline} numberOfLines={1}>
                  Ready to play?
                </Typography>
              </View>
            </View>
          </View>
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => reload()}
            tintColor={colors.primary}
            progressViewOffset={insets.top + 60}
          />
        }
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(110, insets.bottom + 90) },
        ]}
      >
        <View
          style={[
            styles.contentSheet,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderTopColor: withAlpha('#FFFFFF', 0.18),
            },
            shadow('elevated'),
          ]}
        >
          {/* Feed Error Alert */}
          {error && !data ? <ErrorState title="Couldn’t load your home feed" message={error} onRetry={() => reload()} /> : null}

          {/* Member Pass: points balance, weekly gain, rank and activity stats. */}
          {loading ? (
            <Skeleton height={210} borderRadius={24} />
          ) : data?.points ? (
            <View style={[styles.card, styles.pointsPass, { backgroundColor: colors.surface, borderColor: colors.border }, shadow('raised')]}>
              <FrostedSheen radius={18} />
              <View style={[styles.passRibbon, { borderBottomColor: colors.border }]}>
                <View style={styles.passType}>
                  <Icon name="zap" size={14} color="primary" />
                  <Typography variant="mono" color="textMuted" style={styles.passLabel}>
                    BGSC MEMBER PASS
                  </Typography>
                </View>
                {data.rank ? <Badge label={`Top ${data.rank.topPercent}%`} variant="success" /> : null}
              </View>

              {/* Points */}
              <View style={styles.balanceRow}>
                <View>
                  <Typography variant="caption" color="textMuted">
                    TOTAL POINTS
                  </Typography>
                  <Typography color="text" style={styles.balance}>
                    {formatNumber(data.points.balance)}
                  </Typography>
                </View>
                {data.points.week > 0 ? (
                  <View style={[styles.weekPill, { backgroundColor: withAlpha(colors.success, 0.15) }]}>
                    <Icon name="arrow-up" size={12} color="success" />
                    <Typography variant="mono" color="success" style={styles.week}>
                      +{formatNumber(data.points.week)} this week
                    </Typography>
                  </View>
                ) : null}
              </View>

              <View style={[styles.statsStrip, { backgroundColor: colors.surfaceInner, borderColor: colors.border }]}>
                <Stat value={data.rank ? `#${data.rank.rank}` : '—'} label="Global Rank" />
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <Stat value={data.eventsJoined != null ? String(data.eventsJoined) : '—'} label="Events Joined" />
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <Stat
                  value={data.activeChallenges != null ? String(data.activeChallenges) : '—'}
                  label="Challenges"
                  onPress={() => navigation.navigate('Challenges')}
                />
              </View>

              {/* Actions */}
              <View style={styles.passActions}>
                <Button label="History" variant="outline" onPress={() => navigation.navigate('Points')} containerStyle={styles.flex} />
                <Button label="Leaderboard" onPress={() => navigation.navigate('Leaderboard')} containerStyle={styles.flex} />
              </View>
              <FrostedRim radius={18} />
            </View>
          ) : null}

          {/* Pinned Announcement */}
          {data?.pinned ? (
            <Pressable
              onPress={() => navigation.navigate('AnnouncementDetail', { id: data.pinned!._id })}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.pinned,
                { backgroundColor: colors.accentMuted, borderColor: colors.primary },
                shadow('flat'),
                pressed && styles.pressed,
              ]}
            >
              <FrostedSheen radius={14} />
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

          {/* Tournament & Event Finder */}
          <View
            style={[
              styles.finderBoxWrap,
              {
                backgroundColor: withAlpha(colors.surfaceInner, 0.88),
                borderColor: withAlpha(colors.border, 0.8),
                borderTopColor: withAlpha('#FFFFFF', 0.2),
              },
            ]}
          >
            <FrostedSheen radius={16} />
            <View
              style={[
                styles.finderTabs,
                {
                  backgroundColor: withAlpha(colors.surface, 0.65),
                  borderColor: withAlpha(colors.border, 0.7),
                  borderTopColor: withAlpha('#FFFFFF', 0.14),
                },
              ]}
            >
              {(['general', 'gaming', 'sports'] as const).map((tabKey) => {
                const active = searchTab === tabKey;
                return (
                  <Pressable
                    key={tabKey}
                    onPress={() => setSearchTab(tabKey)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    style={[
                      styles.finderTab,
                      active && [
                        {
                          backgroundColor: colors.surfaceElevated,
                          borderColor: withAlpha(colors.primary, 0.35),
                          shadowColor: colors.primary,
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.22,
                          shadowRadius: 6,
                          elevation: 3,
                        },
                      ],
                    ]}
                  >
                    <Typography
                      variant="caption"
                      style={{
                        fontFamily: active ? FONT_FAMILIES.bodyBold : FONT_FAMILIES.bodyMedium,
                        color: active ? colors.text : colors.textMuted,
                        textTransform: 'capitalize',
                        fontSize: 12,
                      }}
                    >
                      {tabKey}
                    </Typography>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.finderCarouselContainer}>
              {loading ? (
                <DrawerSafeScrollView contentContainerStyle={styles.eventsCarousel}>
                  <View style={styles.carouselCardWrap}>
                    <SkeletonEventCard />
                  </View>
                  <View style={styles.carouselCardWrap}>
                    <SkeletonEventCard />
                  </View>
                </DrawerSafeScrollView>
              ) : carouselEvents.length === 1 ? (
                renderFinderEventCard(carouselEvents[0], true)
              ) : carouselEvents.length > 1 ? (
                <DrawerSafeScrollView
                  contentContainerStyle={styles.eventsCarousel}
                  snapToInterval={278}
                  decelerationRate="fast"
                >
                  {carouselEvents.map((event) => renderFinderEventCard(event, false))}
                </DrawerSafeScrollView>
              ) : (
                <View style={[styles.emptyEventsBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Icon name="calendar-outline" size={24} color="textMuted" />
                  <Typography variant="bodySmall" color="textMuted" style={{ textAlign: 'center' }}>
                    No upcoming {searchTab} events right now.{'\n'}Check back soon or browse all events.
                  </Typography>
                </View>
              )}
            </View>

            <Pressable
              onPress={() =>
                navigation.navigate(
                  'Events',
                  currentConfig.targetCategory ? { category: currentConfig.targetCategory } : undefined,
                )
              }
              accessibilityRole="button"
              accessibilityLabel={`Show all ${searchTab} events`}
              style={({ pressed }) => [
                styles.finderFooterRow,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && styles.pressed,
              ]}
            >
              <Typography variant="caption" color="textMuted" style={{ fontSize: 12, fontWeight: '500' }}>
                {carouselEvents.length} event{carouselEvents.length === 1 ? '' : 's'}
              </Typography>
              <View style={styles.finderFooterAction}>
                <Typography variant="caption" color="primary" style={[styles.semibold, { fontSize: 12 }]}>
                  Show all
                </Typography>
                <Icon name="chevron-right" size={14} color="primary" />
              </View>
            </Pressable>
          </View>

          {/* Quick Actions */}
          <View style={styles.quickGrid}>
            <QuickAction icon="calendar" title="Events" meta={`${openEvents.length} open`} onPress={() => navigation.navigate('Events')} />
            <QuickAction
              icon="target"
              title="Challenges"
              meta={data?.activeChallenges != null ? `${data.activeChallenges} active` : 'Browse'}
              onPress={() => navigation.navigate('Challenges')}
            />
            <QuickAction icon="trophy" title="Hall of Fame" meta="Champions" onPress={() => navigation.navigate('HallOfFame')} />
          </View>

          {/* From the heads */}
          {data?.heads.length ? (
            <View style={styles.section}>
              <SectionHeader title="From the heads" actionLabel="All posts" onAction={() => navigation.navigate('AnnouncementsTab')} />
              <DrawerSafeScrollView contentContainerStyle={styles.carousel}>
                {data.heads.map((h) => (
                  <HeadBubble
                    key={h.coordinator.user_id}
                    head={h}
                    onPress={h.announcement ? () => navigation.navigate('AnnouncementDetail', { id: h.announcement!._id }) : undefined}
                  />
                ))}
              </DrawerSafeScrollView>
            </View>
          ) : null}

          {/* Recent Activity */}
          {data?.activity.length ? (
            <View style={styles.section}>
              <SectionHeader title="Recent Activity" actionLabel="History" onAction={() => navigation.navigate('Points')} />
              <View style={[styles.card, styles.list, { backgroundColor: colors.surface, borderColor: colors.border }, shadow('flat')]}>
                <FrostedSheen radius={16} />
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
                    <Typography variant="mono" style={{ color: t.amount >= 0 ? colors.success : colors.dangerText, fontWeight: '700' }}>
                      {t.amount >= 0 ? '+' : '−'}
                      {formatNumber(Math.abs(t.amount))}
                    </Typography>
                  </View>
                ))}
                <FrostedRim radius={16} />
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
            <FrostedSheen radius={16} />
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
            <Icon name="chevron-right" size={18} color="success" />
          </Pressable>
        </View>
      </AnimatedScrollView>

      {/* Fixed top bar. Same height as the frosted collapsed bar so they line up. */}
      <View
        pointerEvents="box-none"
        style={[styles.topBar, { paddingTop: insets.top, height: topBarHeight }]}
      >
        <Pressable
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          accessibilityRole="button"
          accessibilityLabel="Open menu"
          hitSlop={8}
          style={({ pressed }) => [styles.glass, styles.menuButton, glassTone, pressed && styles.pressed]}
        >
          <Icon name="menu" size={20} color="text" />
        </Pressable>

        <View
          style={[styles.brandCenterWrap, { top: insets.top }]}
          pointerEvents="none"
          accessible
          accessibilityRole="header"
          accessibilityLabel="BGSC"
        >
          <View style={styles.brandRow}>
            <BgscLogo size={30} />
            <Typography color="text" style={styles.brandWordmark}>
              BGSC
            </Typography>
          </View>
        </View>

        <View style={[styles.glass, styles.actionsCapsule, glassTone]}>
          <Pressable
            onPress={() => navigation.navigate('Notifications', undefined, { pop: true })}
            accessibilityRole="button"
            accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
            hitSlop={4}
            style={({ pressed }) => [styles.capsuleBtn, pressed && styles.pressed]}
          >
            <Icon name="bell" size={19} color="text" />
            {unread > 0 ? (
              <View style={[styles.unreadBadge, { backgroundColor: colors.primarySolid, borderColor: colors.surface }]}>
                <Typography style={styles.unreadText} numberOfLines={1}>
                  {unread > 9 ? '9+' : unread}
                </Typography>
              </View>
            ) : null}
          </Pressable>

          <View style={[styles.capsuleDivider, { backgroundColor: withAlpha(colors.border, 0.7) }]} />

          <Pressable
            onPress={() => navigation.navigate('App', { screen: 'MainTabs', params: { screen: 'ProfileTab' } }, { pop: true })}
            accessibilityRole="button"
            accessibilityLabel="Your profile"
            hitSlop={4}
            style={({ pressed }) => [styles.capsuleBtn, pressed && styles.pressed]}
          >
            <Avatar name={user?.fullName || user?.username} uri={user?.avatar_url} size={30} ring={false} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}


function Stat({ value, label, onPress }: { value: string; label: string; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={styles.stat}
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
  const { colors, shadow } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${meta}`}
      style={({ pressed }) => [
        styles.quick,
        { backgroundColor: colors.surface, borderColor: colors.border },
        shadow('flat'),
        pressed && styles.pressed,
      ]}
    >
      <FrostedSheen radius={14} />
      <View style={[styles.iconTile, { backgroundColor: withAlpha(colors.primary, 0.15) }]}>
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
  scrollContent: { paddingBottom: 32 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  semibold: { fontFamily: FONT_FAMILIES.bodySemiBold },
  small: { fontSize: 13 },
  tiny: { fontSize: 11, lineHeight: 16 },

  heroLayer: {
    flex: 1,
    overflow: 'hidden',
  },
  collapsedBar: {
    flex: 1,
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  heroTextBlock: {
    paddingHorizontal: HERO_SIDE_PADDING,
    // Small on purpose: the illustration's base tucks under the content sheet; the
    // greeting column keeps its own clearance (HERO_IDENTITY_PADDING_BOTTOM).
    paddingBottom: HERO_BLOCK_PADDING_BOTTOM,
    justifyContent: 'flex-end',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Absolutely placed so it can run off the right edge; drawn before the greeting
  // so the text sits on top.
  heroArt: {
    position: 'absolute',
    bottom: 0,
  },
  // Vertically centred beside the illustration.
  // Fills the row's height and sits toward the bottom, so the avatar has room above
  // and the text lines up with the lower half of the illustration.
  identity: {
    alignSelf: 'stretch',
    paddingHorizontal: 2,
    paddingBottom: HERO_IDENTITY_PADDING_BOTTOM,
    justifyContent: 'flex-end',
  },
  avatarRing: {
    alignSelf: 'flex-start',
    marginBottom: HERO_AVATAR_GAP,
    padding: 2.5,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
  heroSubline: {
    fontFamily: FONT_FAMILIES.bodySemiBold,
    fontSize: 14,
    lineHeight: 18,
    marginTop: 4,
    color: HERO_INK_SOFT,
    ...HERO_TEXT_SHADOW,
  },
  greetingText: {
    fontFamily: FONT_FAMILIES.bodySemiBold,
    fontSize: 14,
    lineHeight: 18,
    color: HERO_INK_SOFT,
    ...HERO_TEXT_SHADOW,
  },
  // Plain bold white; size comes from heroNameSize() so long names fit on one line.
  heroName: {
    fontFamily: FONT_FAMILIES.bodyBlack,
    letterSpacing: -1,
    color: HERO_INK,
    ...HERO_TEXT_SHADOW,
  },

  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    zIndex: 10,
  },
  // Frosted glass pill shared by the menu button and the action capsule.
  // Soft iOS shadow only: Android elevation draws grey artifacts on translucent views.
  glass: {
    height: TOP_BAR_CONTROL_SIZE,
    borderRadius: TOP_BAR_CONTROL_SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.14,
        shadowRadius: 8,
      },
      default: {},
    }),
  },
  menuButton: {
    width: TOP_BAR_CONTROL_SIZE,
  },
  // Spans the row below the status bar, so the wordmark is centred on the buttons.
  brandCenterWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Plain bold wordmark: theme text colour reads on both the orange hero and the
  // frosted collapsed bar.
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandWordmark: {
    fontFamily: FONT_FAMILIES.brand,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: 2,
  },
  actionsCapsule: {
    flexDirection: 'row',
    paddingHorizontal: 3,
    gap: 2,
  },
  capsuleBtn: {
    width: TOP_BAR_CONTROL_SIZE - 6,
    height: TOP_BAR_CONTROL_SIZE - 6,
    borderRadius: (TOP_BAR_CONTROL_SIZE - 6) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capsuleDivider: {
    width: StyleSheet.hairlineWidth * 2,
    height: 16,
  },
  unreadBadge: {
    position: 'absolute',
    top: 1,
    right: -1,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: {
    color: '#FFFFFF',
    fontFamily: FONT_FAMILIES.bodyBold,
    fontSize: 9,
    lineHeight: 11,
  },

  contentSheet: {
    marginTop: -SHEET_OVERLAP,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 28,
    gap: 10,
  },

  finderBoxWrap: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 9,
    gap: 6,
  },
  finderTabs: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 2.5,
    marginBottom: 0,
  },
  finderTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
    paddingVertical: 5,
    borderRadius: 8,
  },
  finderCarouselContainer: {
    marginVertical: 1,
  },
  emptyEventsBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
  },
  finderFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 34,
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 0,
  },
  finderFooterAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },

  card: { borderWidth: 1 },
  pinned: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, borderWidth: 1 },
  pinnedKicker: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 9.5, lineHeight: 14, letterSpacing: 0.6 },
  iconTile: { padding: 8, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  pointsPass: { borderRadius: 18, padding: 12, gap: 9 },
  passRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 7,
    borderBottomWidth: 1,
  },
  passType: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  passLabel: { fontSize: 9.5, letterSpacing: 0.8 },
  balanceRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  balance: { fontFamily: FONT_FAMILIES.hero, fontSize: 32, lineHeight: 36 },
  weekPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 7,
  },
  week: { fontSize: 10.5, fontWeight: '700' },
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: 3,
  },
  stat: { flex: 1, alignItems: 'center', gap: 1, paddingVertical: 2 },
  statDivider: { width: 1, height: 20 },
  statValue: { fontSize: 15, fontWeight: '700' },
  passActions: {
    flexDirection: 'row',
    gap: 6,
  },
  quickGrid: { flexDirection: 'row', gap: 8 },
  quick: { flex: 1, gap: 6, padding: 9, borderRadius: 14, borderWidth: 1 },
  section: { gap: 8 },
  carousel: { gap: 8 },
  eventsCarousel: { gap: 8, paddingRight: 6, paddingVertical: 1 },
  carouselCardWrap: { width: 270 },
  carouselSingleCardWrap: { width: '100%' },
  head: { width: 230, gap: 8 },
  bubble: {
    padding: 12,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomLeftRadius: 4,
  },
  headWho: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  compactPass: { flex: 1, gap: 5, padding: 10, borderRadius: 14 },
  compactTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tinyCode: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.5 },
  list: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 2 },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  whatsapp: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16 },
});
