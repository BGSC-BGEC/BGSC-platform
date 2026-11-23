import React, { useCallback, useMemo, useRef, useState } from 'react';
import Reanimated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
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
import { LinearGradient } from 'expo-linear-gradient';
import { usersRepository } from '../../src/repositories/UsersRepository';
import { cardTierStyle } from '../../src/components/playercard/cardTiers';

import { Avatar } from '../../src/components/Avatar';
import { Button } from '../../src/components/Button';
import { authorColor } from '../../src/components/AnnouncementCard';
import { EventCard, eventCardData } from '../../src/components/EventCard';
import { SectionHeader } from '../../src/components/SectionHeader';
import { FilterChips } from '../../src/components/FilterChips';
import { BgscLogo } from '../../src/components/BgscLogo';
import { GamingBackdrop } from '../../src/components/GamingBackdrop';
import { AnimatedScrollView } from '../../src/components/reacticx/templates/parallax-header';
import { DrawerSafeScrollView } from '../../src/navigation/drawerGesture';
import { HeroIllustration, HERO_ILLUSTRATION_ASPECT } from '../../src/components/HeroIllustration';
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
const HERO_AVATAR_SIZE = 80;
/** Space between the avatar and the greeting; generous so the avatar sits a bit higher. */
const HERO_AVATAR_GAP = 18;
/** Thickness of the tier foil ring around the hero avatar. */
const HERO_AVATAR_RING = 3;
/** Avatar fallback fill: deep burnt orange, so initials don't vanish into the hero. */
const HERO_AVATAR_BG = '#7A2E06';
const HERO_TEXT_SHADOW = {
  textShadowColor: 'rgba(80, 30, 0, 0.28)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 6,
} as const;

export type FinderCategory = 'general' | 'gaming' | 'sports';

const FINDER_TABS: ReadonlyArray<{ label: string; value: FinderCategory }> = [
  { label: 'General', value: 'general' },
  { label: 'Gaming', value: 'gaming' },
  { label: 'Sports', value: 'sports' },
];

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
  /** Player-card tier (e.g. 'Gold'); colours the hero avatar ring. */
  cardTier: string | null;
}

const ACTIVE_PARTICIPATION = ['accepted', 'submitted', 'under_review'];

async function loadHome(userId: string | undefined): Promise<HomeData> {
  let firstError: unknown = null;
  const settle = <T,>(p: Promise<T>): Promise<T | null> =>
    p.catch((err) => {
      firstError ??= err;
      return null;
    });
  const [points, txPage, rank, total, regs, parts, pinnedList, heads, events, card] = await Promise.all([
    settle(pointsRepository.me()),
    settle(pointsRepository.transactions({ limit: 50 })),
    userId ? settle(leaderboardRepository.findMyGlobalRank(userId)) : Promise.resolve(null),
    settle(leaderboardRepository.global({ limit: 1 })),
    settle(api.get<Array<{ owner?: { type: string } }>>('/registrations', { params: { status: 'confirmed', limit: 500 } })),
    settle(api.get<{ participations: Array<{ status: string }> }>('/challenges/me/participations', { params: { limit: 50 } })),
    settle(announcementsRepository.list({ pinned: true, limit: 5 })),
    settle(announcementsRepository.heads()),
    settle(eventsRepository.list({ status: ['upcoming', 'ongoing'], sort: 'date_asc', limit: 20 })),
    // Not settle(): a missing card only loses the ring colour, it shouldn't surface as an error.
    userId ? usersRepository.card(userId).catch(() => null) : Promise.resolve(null),
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
    cardTier: card?.card_tier ?? null,
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
  // Greeting column: ringed avatar + gap + greeting + name (max line height).
  const identityHeight =
    HERO_AVATAR_SIZE + HERO_AVATAR_RING * 2 + HERO_AVATAR_GAP + 18 + Math.round(HERO_NAME_MAX * 1.15);
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
  // Heads who have posted, newest post first. With none, the section shows one shared message.
  const headPosts = useMemo(
    () =>
      (data?.heads ?? [])
        .filter((h) => h.announcement != null)
        .sort((a, b) => postTime(b.announcement!) - postTime(a.announcement!)),
    [data?.heads],
  );

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

  // The top bar's avatar and BGSC logo only show once the hero avatar has scrolled up under
  // the bar; at the top the hero carries the identity, so the bar stays clear (two avatars on
  // screen at once read as a duplicate). The crossing point is measured
  // from the hero avatar; until then, a fallback a little way into the hero is used.
  const [showBarIdentity, setShowBarIdentity] = useState(false);
  const scrollOffset = useRef(0);
  const heroAvatarRef = useRef<React.ComponentRef<typeof View>>(null);
  const barAvatarThreshold = useRef(heroHeight * 0.3);
  // Once the solid (frosted) bar has faded in, the menu/bell/avatar drop their glass pills
  // and grow: the bar itself is now the backdrop. The bar fades in over the last quarter of
  // (hero - top bar), so switch near its end.
  const [barSolid, setBarSolid] = useState(false);
  const barSolidThreshold = useRef(0);
  barSolidThreshold.current = (heroHeight - topBarHeight) * 0.9;
  const updateBarAvatar = useCallback((y: number) => {
    scrollOffset.current = y;
    const next = y >= barAvatarThreshold.current;
    setShowBarIdentity((prev) => (prev === next ? prev : next));
    const solid = y >= barSolidThreshold.current;
    setBarSolid((prev) => (prev === solid ? prev : solid));
  }, []);
  const measureHeroAvatar = useCallback(() => {
    heroAvatarRef.current?.measureInWindow((_x, y, _w, h) => {
      // The hero is pinned (pinHeader), so the avatar stays at y on screen while the content
      // sheet slides up over it; the sheet's top is at heroHeight - SHEET_OVERLAP - offset.
      // Switch once the sheet has covered the avatar's middle.
      const covered = heroHeight - SHEET_OVERLAP - (y + h / 2);
      barAvatarThreshold.current = Math.max(0, covered);
      updateBarAvatar(scrollOffset.current);
    });
  }, [heroHeight, topBarHeight, updateBarAvatar]);

  // Home always opens at the top: when you leave it (another tab, a pushed screen), jump back to
  // the top while it's hidden, so returning never lands mid-page and never shows the jump.
  const scrollRef = useRef<React.ComponentRef<typeof AnimatedScrollView>>(null);
  useFocusEffect(
    useCallback(
      () => () => {
        scrollRef.current?.scrollTo({ y: 0, animated: false });
        updateBarAvatar(0);
      },
      [updateBarAvatar],
    ),
  );

  const openProfile = () =>
    navigation.navigate('App', { screen: 'MainTabs', params: { screen: 'ProfileTab' } }, { pop: true });

  // Hero avatar ring: the tier's foil (dark edge, highlight, dark edge), as on the player card.
  const heroRingColors: [string, string, ...string[]] = data?.cardTier
    ? cardTierStyle(data.cardTier, isDark ? 'dark' : 'light').foil
    : ['rgba(255, 255, 255, 0.9)', 'rgba(255, 255, 255, 0.9)'];

  // Shared frosted-glass tone for the top bar's menu button and action capsule.
  const glassTone = {
    backgroundColor: withAlpha(colors.surface, isDark ? 0.62 : 0.8),
    borderColor: isDark ? withAlpha('#FFFFFF', 0.12) : withAlpha(colors.border, 0.7),
    borderTopColor: withAlpha('#FFFFFF', isDark ? 0.22 : 0.9),
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AnimatedScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        headerMaxHeight={heroHeight}
        topBarHeight={topBarHeight}
        onScrollOffset={updateBarAvatar}
        // The orange hero stays still; the content sheet slides up over it.
        pinHeader
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
        // Hero backdrop: held still (pinHeader) while the sheet slides over it; stretches on pull-down.
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
        // Greeting on the orange hero; held still while the sheet slides over it.
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
                {/* Ringed in the player-card tier's foil (white until the tier loads); opens the profile. */}
                <Pressable
                  ref={heroAvatarRef}
                  onLayout={measureHeroAvatar}
                  onPress={openProfile}
                  accessibilityRole="button"
                  accessibilityLabel="Your profile"
                  hitSlop={6}
                  style={({ pressed }) => [styles.avatarRing, pressed && styles.pressed]}
                >
                  <LinearGradient
                    colors={heroRingColors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.avatarRingFill}
                  >
                    <Avatar
                      name={user?.fullName || user?.username}
                      uri={user?.avatar_url}
                      size={HERO_AVATAR_SIZE}
                      color={HERO_AVATAR_BG}
                    />
                  </LinearGradient>
                </Pressable>
                <Typography style={styles.greetingText} numberOfLines={1}>
                  Good {greeting().toLowerCase()}
                </Typography>
                <Typography
                  style={[styles.heroName, heroNameSize(firstName || 'Player', heroArt.identityWidth)]}
                  numberOfLines={1}
                >
                  {firstName || 'Player'}
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

          {/* Points: the one number this screen is about, straight on the sheet. */}
          {loading ? (
            <Skeleton height={170} borderRadius={12} />
          ) : data?.points ? (
            <View style={styles.pointsBlock}>
              <View>
                <View style={styles.balanceHead}>
                  <Typography variant="caption" color="textMuted" style={styles.kicker}>
                    TOTAL POINTS
                  </Typography>
                  {data.rank ? (
                    <Typography variant="bodySmall" color="textMuted" style={styles.rankText}>
                      Top {data.rank.topPercent}%
                    </Typography>
                  ) : null}
                </View>
                <Typography color="text" style={styles.balance} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                  {formatNumber(data.points.balance)}
                </Typography>
              </View>

              <View style={styles.statsRow}>
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

              <View style={styles.passActions}>
                <Button label="History" variant="outline" onPress={() => navigation.navigate('Points')} containerStyle={styles.flex} />
                <Button label="Leaderboard" onPress={() => navigation.navigate('Leaderboard')} containerStyle={styles.flex} />
              </View>
            </View>
          ) : null}

          {/* Events: heading, filter chips, then the cards running edge to edge */}
          <View style={styles.section}>
            <SectionHeader titleStyle={styles.sectionTitle}
              title="Upcoming events"
              actionLabel="Show all"
              onAction={() =>
                navigation.navigate('Events', currentConfig.targetCategory ? { category: currentConfig.targetCategory } : undefined)
              }
            />
            <FilterChips options={FINDER_TABS} value={searchTab} onChange={setSearchTab} />
            {loading ? (
              <DrawerSafeScrollView style={styles.bleed} contentContainerStyle={styles.eventsCarousel}>
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
                style={styles.bleed}
                contentContainerStyle={styles.eventsCarousel}
                snapToInterval={278}
                decelerationRate="fast"
              >
                {carouselEvents.map((event) => renderFinderEventCard(event, false))}
              </DrawerSafeScrollView>
            ) : (
              <Typography variant="bodySmall" color="textMuted" style={styles.emptyText}>
                No upcoming {searchTab} events right now. Check back soon or browse all events.
              </Typography>
            )}
          </View>

          {/* Explore: a typographic list, no icons; name left, count right */}
          <View style={styles.section}>
            <SectionHeader titleStyle={styles.sectionTitle} title="Explore" />
            <View>
              <QuickAction
                title="Events"
                caption="Tournaments, matches and meetups"
                count={openEvents.length}
                countLabel="open"
                onPress={() => navigation.navigate('Events')}
              />
              <QuickAction
                title="Challenges"
                caption="Complete them to earn points"
                count={data?.activeChallenges ?? undefined}
                countLabel="active"
                onPress={() => navigation.navigate('Challenges')}
              />
              <QuickAction
                title="Hall of Fame"
                caption="Past champions and winning teams"
                onPress={() => navigation.navigate('HallOfFame')}
                last
              />
            </View>
          </View>

          {/* Pinned Announcement: a plain row */}
          {data?.pinned ? (
            <Pressable
              onPress={() => navigation.navigate('AnnouncementDetail', { id: data.pinned!._id })}
              accessibilityRole="button"
              style={({ pressed }) => [styles.plainRow, pressed && styles.rowPressed]}
            >
              <View style={[styles.rowIcon, { backgroundColor: withAlpha(colors.primary, 0.14) }]}>
                <Icon name="megaphone" size={18} color="primary" />
              </View>
              <View style={styles.flex}>
                <Typography color="primary" style={styles.pinnedKicker}>
                  PINNED · {ANNOUNCEMENT_CATEGORY_LABELS[data.pinned.categories[0]]?.toUpperCase()}
                </Typography>
                <Typography variant="body" color="text" style={styles.semibold} numberOfLines={2}>
                  {data.pinned.title}
                </Typography>
              </View>
              <Icon name="chevron-right" size={18} color="textMuted" />
            </Pressable>
          ) : null}

          {/* From the heads: each head's latest post as a feed row, newest first */}
          {data ? (
            <View style={styles.section}>
              <SectionHeader titleStyle={styles.sectionTitle} title="From the heads" actionLabel="All posts" onAction={() => navigation.navigate('AnnouncementsTab')} />
              {headPosts.length ? (
                <View>
                  {headPosts.map((h, i) => (
                    <HeadPost
                      key={h.coordinator.user_id}
                      head={h}
                      last={i === headPosts.length - 1}
                      onPress={() => navigation.navigate('AnnouncementDetail', { id: h.announcement!._id })}
                    />
                  ))}
                </View>
              ) : (
                <Typography variant="bodySmall" color="textMuted" style={styles.emptyText}>
                  No posts from the heads yet.
                </Typography>
              )}
            </View>
          ) : null}

          {/* Recent Activity: a plain list, hairlines between rows */}
          {data?.activity.length ? (
            <View style={styles.section}>
              <SectionHeader titleStyle={styles.sectionTitle} title="Recent activity" actionLabel="History" onAction={() => navigation.navigate('Points')} />
              <View>
                {data.activity.map((t, i) => (
                  <View
                    key={t.id}
                    style={[
                      styles.activityRow,
                      i < data.activity.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                    ]}
                  >
                    <View style={[styles.rowIcon, { backgroundColor: colors.surfaceInner }]}>
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
              </View>
            </View>
          ) : null}

          {/* WhatsApp community: a plain row */}
          <Pressable
            onPress={() => void Linking.openURL(WHATSAPP_URL)}
            accessibilityRole="link"
            style={({ pressed }) => [styles.plainRow, pressed && styles.rowPressed]}
          >
            <View style={[styles.rowIcon, { backgroundColor: colors.success }]}>
              <Icon name="message" size={18} color="white" />
            </View>
            <View style={styles.flex}>
              <Typography variant="body" color="text" style={styles.semibold}>
                Join the BGSC WhatsApp
              </Typography>
              <Typography color="textMuted" style={styles.tiny}>
                Announcements land there first
              </Typography>
            </View>
            <Icon name="chevron-right" size={18} color="textMuted" />
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
          style={({ pressed }) => [styles.control, styles.menuButton, pressed && styles.pressed]}
        >
          {/* Glass pill over the orange hero; gone on the solid bar. */}
          {!barSolid ? (
            <Reanimated.View
              entering={FadeIn.duration(180)}
              exiting={FadeOut.duration(180)}
              style={[styles.glassBg, glassTone]}
            />
          ) : null}
          <Icon name="menu" size={barSolid ? 26 : 20} color="text" />
        </Pressable>

        <View
          style={[styles.brandCenterWrap, { top: insets.top }]}
          pointerEvents="none"
          accessible
          accessibilityRole="header"
          accessibilityLabel="BGSC"
        >
          {/* The wordmark always shows; the logo mark joins it (like the avatar) only once
              the hero has scrolled away, and the wordmark slides over to make room. */}
          <View style={styles.brandRow}>
            {showBarIdentity ? (
              <Reanimated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)}>
                <BgscLogo size={30} />
              </Reanimated.View>
            ) : null}
            <Reanimated.View layout={LinearTransition.duration(180)}>
              <Typography color="text" style={styles.brandWordmark}>
                BGSC
              </Typography>
            </Reanimated.View>
          </View>
        </View>

        <Reanimated.View
          layout={LinearTransition.duration(180)}
          style={[styles.control, styles.actionsCapsule]}
        >
          {!barSolid ? (
            <Reanimated.View
              entering={FadeIn.duration(180)}
              exiting={FadeOut.duration(180)}
              style={[styles.glassBg, glassTone]}
            />
          ) : null}
          <Pressable
            onPress={() => navigation.navigate('Notifications', undefined, { pop: true })}
            accessibilityRole="button"
            accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
            hitSlop={4}
            style={({ pressed }) => [styles.capsuleBtn, pressed && styles.pressed]}
          >
            <Icon name="bell" size={barSolid ? 23 : 19} color="text" />
            {unread > 0 ? (
              <View style={[styles.unreadBadge, { backgroundColor: colors.primarySolid, borderColor: colors.surface }]}>
                <Typography style={styles.unreadText} numberOfLines={1}>
                  {unread > 9 ? '9+' : unread}
                </Typography>
              </View>
            ) : null}
          </Pressable>

          {/* Avatar joins the capsule only after the hero avatar has scrolled away. */}
          {showBarIdentity ? (
            <Reanimated.View
              entering={FadeIn.duration(180)}
              exiting={FadeOut.duration(120)}
              style={styles.capsuleAvatarGroup}
            >
              {/* Divider only separates the two inside a pill. */}
              {!barSolid ? (
                <View style={[styles.capsuleDivider, { backgroundColor: withAlpha(colors.border, 0.7) }]} />
              ) : null}
              <Pressable
                onPress={openProfile}
                accessibilityRole="button"
                accessibilityLabel="Your profile"
                hitSlop={4}
                style={({ pressed }) => [styles.capsuleBtn, pressed && styles.pressed]}
              >
                <Avatar
                  name={user?.fullName || user?.username}
                  uri={user?.avatar_url}
                  size={barSolid ? 32 : 30}
                  ring={false}
                />
              </Pressable>
            </Reanimated.View>
          ) : null}
        </Reanimated.View>
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

/** One Explore row: name and what's inside on the left, the live count (if any) on the right. */
function QuickAction({
  title,
  caption,
  count,
  countLabel,
  onPress,
  last = false,
}: {
  title: string;
  caption: string;
  count?: number;
  countLabel?: string;
  onPress: () => void;
  last?: boolean;
}) {
  const { colors } = useTheme();
  const hasCount = count != null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={hasCount ? `${title}, ${count} ${countLabel ?? ''}` : title}
      style={({ pressed }) => [
        styles.quick,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        pressed && styles.rowPressed,
      ]}
    >
      <View style={styles.flex}>
        <Typography color="text" style={styles.quickTitle} numberOfLines={1}>
          {title}
        </Typography>
        <Typography color="textMuted" style={styles.quickCaption} numberOfLines={1}>
          {caption}
        </Typography>
      </View>
      {hasCount ? (
        <View style={styles.quickCount}>
          <Typography color="text" style={styles.quickCountValue}>
            {count}
          </Typography>
          {countLabel ? (
            <Typography color="textMuted" style={styles.quickCountLabel}>
              {countLabel.toUpperCase()}
            </Typography>
          ) : null}
        </View>
      ) : null}
      <Icon name="chevron-right" size={18} color="textMuted" />
    </Pressable>
  );
}

function postTime(post: Announcement): number {
  const t = Date.parse(post.published_at ?? '');
  return Number.isNaN(t) ? 0 : t;
}

/** First line of a post body as plain text (markdown marks dropped), for a one-line preview. */
function previewLine(body: string): string {
  return body
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~]+/g, '')
    .split('\n')
    .map((l) => l.trim())
    .find(Boolean) ?? '';
}

/** A head's latest post: avatar, who and when, then the title and a one-line preview. */
function HeadPost({
  head,
  last,
  onPress,
}: {
  head: AnnouncementHead;
  last: boolean;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const name = head.coordinator.display_name;
  const post = head.announcement;
  const preview = post ? previewLine(post.body) : '';
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${name}, ${head.coordinator.role_label}: ${post ? post.title : 'no posts yet'}`}
      style={({ pressed }) => [
        styles.headPost,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        pressed && styles.rowPressed,
      ]}
    >
      <Avatar name={name} uri={head.coordinator.avatar_url} size={40} color={authorColor(name, colors)} />
      <View style={styles.flex}>
        <View style={styles.headPostMeta}>
          <Typography color="text" style={[styles.semibold, styles.small, styles.headName]} numberOfLines={1}>
            {name}
          </Typography>
          <Typography color="textMuted" style={[styles.small, styles.headRole]} numberOfLines={1}>
            {head.coordinator.role_label}
          </Typography>
          {post?.published_at ? (
            <Typography color="textMuted" style={styles.small}>
              · {timeAgo(post.published_at)}
            </Typography>
          ) : null}
        </View>
        {post ? (
          <Typography color="text" style={styles.headTitle} numberOfLines={2}>
            {post.title}
          </Typography>
        ) : (
          <Typography color="textMuted" style={styles.headPreview}>
            No posts yet
          </Typography>
        )}
        {preview ? (
          <Typography color="textMuted" style={styles.headPreview} numberOfLines={1}>
            {preview}
          </Typography>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Content sheet's top corners, and its side and top padding. */
const SHEET_RADIUS = 32;
const SHEET_INSET = 20;

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
    borderRadius: 999,
  },
  avatarRingFill: {
    padding: HERO_AVATAR_RING,
    borderRadius: 999,
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
    fontFamily: FONT_FAMILIES.bodyBold,
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
  // Menu button / action group: layout only. The glass look is a separate layer
  // (glassBg) so it can fade away on the solid bar.
  control: {
    height: TOP_BAR_CONTROL_SIZE,
    borderRadius: TOP_BAR_CONTROL_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  glassBg: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: TOP_BAR_CONTROL_SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth * 2,
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
    // Elegant serif at its heaviest (Black). Line height leaves room for Playfair's tall caps while the
    // row's centre alignment keeps it level with the 30px logo mark.
    fontFamily: FONT_FAMILIES.wordmark,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: 1,
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
  // Divider + avatar, kept together so they appear and leave as one; same spacing as
  // the capsule's own row.
  capsuleAvatarGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
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
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    borderTopWidth: 1,
    paddingHorizontal: SHEET_INSET,
    paddingTop: SHEET_INSET + 4,
    paddingBottom: 28,
    gap: 30,
  },

  pinnedKicker: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 9.5, lineHeight: 14, letterSpacing: 0.6 },
  pointsBlock: { gap: 18 },
  kicker: { letterSpacing: 1.2 },
  balanceHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rankText: { fontWeight: '700' },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center', gap: 1 },
  statDivider: { width: StyleSheet.hairlineWidth * 2, height: 28 },
  statValue: { fontFamily: FONT_FAMILIES.hero, fontSize: 20, lineHeight: 24 },
  balance: { fontFamily: FONT_FAMILIES.hero, fontSize: 56, lineHeight: 64, marginTop: 4 },
  passActions: {
    flexDirection: 'row',
    gap: 10,
  },
  quick: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  quickTitle: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 17, lineHeight: 22 },
  quickCaption: { fontSize: 13, lineHeight: 18, marginTop: 1 },
  quickCount: { alignItems: 'flex-end', minWidth: 36 },
  quickCountValue: { fontFamily: FONT_FAMILIES.hero, fontSize: 22, lineHeight: 26 },
  quickCountLabel: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 9.5, lineHeight: 12, letterSpacing: 0.8 },
  plainRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowPressed: { opacity: 0.6 },
  rowIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  section: { gap: 12 },
  sectionTitle: { fontSize: 27, lineHeight: 33 },
  // Horizontal rows run to the screen edges; their content starts in line with the rest.
  bleed: { marginHorizontal: -SHEET_INSET },
  eventsCarousel: { gap: 8, paddingHorizontal: SHEET_INSET, paddingVertical: 1 },
  emptyText: { paddingVertical: 8 },
  carouselCardWrap: { width: 270 },
  carouselSingleCardWrap: { width: '100%' },
  headPost: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14 },
  headPostMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  // Name keeps its width; the role gives way first on a narrow screen.
  headName: { flexShrink: 0, maxWidth: '55%' },
  headRole: { flexShrink: 1 },
  headTitle: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 15.5, lineHeight: 21, marginTop: 3 },
  headPreview: { fontSize: 13.5, lineHeight: 19, marginTop: 2 },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
});
