import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark } from '../../src/auth/BrandMark';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { CountdownRing } from '../../src/components/CountdownRing';
import { Doodle, type DoodleName } from '../../src/components/doodles/Doodles';
import { cardTierStyle } from '../../src/components/playercard/cardTiers';
import {
  PLAYER_CARD_HEIGHT,
  PLAYER_CARD_WIDTH,
  PlayerCardView,
} from '../../src/components/playercard/PlayerCardView';
import { Typography } from '../../src/typography/Typography';
import { FONT_FAMILIES } from '../../src/theme/typography';
import { withAlpha } from '../../src/theme/colors';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useAuth } from '../../store/auth';
import { CosmicSpaceBackground, GlassCard } from '../../src/auth/CosmicSpaceView';

/** The campus illustration with its cream background cut away, so it stands in space. */
const CAMPUS = require('../../assets/images/landing-campus.png');
const CAMPUS_ASPECT = 792 / 572;

const PADDING = 24;
/** The cosmic backdrop's base colour (CosmicSpaceBackground), for the tickets' punched notches. */
const SPACE = '#03060f';
/** Artwork is drawn on a 280-tall stage, then scaled to whatever height the screen can spare. */
const DESIGN_H = 280;
/** How long each slide stays before the tour moves on. */
const INTERVAL = 4500;
/** Art height bounds; between them the art takes whatever the screen leaves. */
const ART_MIN = 130;
const ART_MAX = 340;
const CONTROLS_H = 36;
const SLIDE_TEXT_H = 164;
/**
 * Everything on screen except the art: vertical padding 12 + 24, brand 34, three 18px gaps,
 * slide text (16 margin + SLIDE_TEXT_H), the controls row, and three 48px buttons with 10px gaps.
 */
/** The slide text block under the art: its 16px margin plus SLIDE_TEXT_H. */
const TEXT_BLOCK = 16 + SLIDE_TEXT_H;
const CHROME = 36 + 34 + 3 * 18 + (16 + SLIDE_TEXT_H) + CONTROLS_H + (3 * 48 + 2 * 10);

type ArtName = 'campus' | 'ticket' | 'auction' | 'podium' | 'card' | 'more';

/** The whole app in six slides — every feature is on the first screen, nothing to scroll for. */
const SLIDES: { art: ArtName; kicker: string; title: string; body: string }[] = [
  {
    art: 'campus',
    kicker: 'WELCOME TO BGSC',
    title: 'Every game on campus, in one universe.',
    body: 'Sign up for events, bid in live auctions, earn points and build a player card worth showing off.',
  },
  {
    art: 'ticket',
    kicker: 'EVENTS',
    title: 'Every event on campus, one tap away.',
    body: 'Tournaments, matches and meets across every sport and esport. Register solo or with your team.',
  },
  {
    art: 'auction',
    kicker: 'LIVE AUCTIONS',
    title: 'Captains build squads, live.',
    body: 'Every lot, every purse, every last-second bid, in real time.',
  },
  {
    art: 'podium',
    kicker: 'LEADERBOARD',
    title: 'Points from every game add up.',
    body: 'Climb the season leaderboard. The best seasons are written into the Hall of Fame.',
  },
  {
    art: 'card',
    kicker: 'PLAYER CARD',
    title: 'A card that levels up with you.',
    body: 'Your rating grows with every event, podium and challenge, from Rookie to Legend. Share it anywhere.',
  },
  {
    art: 'more',
    kicker: 'ALSO INSIDE',
    title: 'Challenges, Strava and more.',
    body: 'Team challenges, Strava-linked fitness goals, event photos and announcements the moment they drop.',
  },
];

/** v2 Cosmic Landing — a self-playing tour of the app for signed-out members. */
export default function LandingScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { devLogin } = useAuth();

  const slideWidth = width - PADDING * 2;
  // The tour takes whatever height the brand, controls and buttons leave (measured, so it
  // stays right at any font size); the art gets that minus the slide text. CHROME is only the
  // first-frame estimate before the measurement arrives.
  const [tourHeight, setTourHeight] = useState<number | null>(null);
  const artHeight = Math.max(
    ART_MIN,
    Math.min(
      ART_MAX,
      tourHeight !== null ? tourHeight - TEXT_BLOCK : height - insets.top - insets.bottom - CHROME,
    ),
  );

  const pager = useRef<React.ComponentRef<typeof ScrollView>>(null);
  /** Slide an auto-advance or dot tap is scrolling to; scroll events are ignored until it lands. */
  const target = useRef<number | null>(null);
  const [page, setPage] = useState(0);
  const [touching, setTouching] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [screenReader, setScreenReader] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  // Never moves under a finger, a screen reader, reduced motion, or once the member pauses it.
  const autoplay = !touching && !paused && !reduceMotion && !screenReader;

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    void AccessibilityInfo.isScreenReaderEnabled().then(setScreenReader);
    const subs = [
      AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion),
      AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);

  // Keep the current slide aligned if the width changes (web resize, split screen).
  useEffect(() => {
    pager.current?.scrollTo({ x: page * slideWidth, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideWidth]);

  // Each page change restarts the clock; anything that stops autoplay stops it.
  useEffect(() => {
    progress.stopAnimation();
    progress.setValue(autoplay ? 0 : 1);
    if (!autoplay) return;
    const fill = Animated.timing(progress, {
      toValue: 1,
      duration: INTERVAL,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    fill.start();
    const timer = setTimeout(() => goTo((page + 1) % SLIDES.length), INTERVAL);
    return () => {
      clearTimeout(timer);
      fill.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, autoplay, slideWidth]);

  const goTo = (i: number) => {
    target.current = i;
    pager.current?.scrollTo({ x: i * slideWidth, animated: !reduceMotion });
    setPage(i);
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    // Only once the pager has settled on a slide, so a scroll in flight never flips the page back.
    const x = e.nativeEvent.contentOffset.x;
    const i = Math.round(x / slideWidth);
    if (Math.abs(x - i * slideWidth) > 2) return;
    if (target.current !== null) {
      if (i !== target.current) return;
      target.current = null;
    }
    if (i !== page && i >= 0 && i < SLIDES.length) setPage(i);
  };

  // Touch events fire on native and web alike (web never calls onScrollBeginDrag).
  const hold = () => {
    target.current = null;
    setTouching(true);
  };
  const release = () => setTouching(false);

  return (
    <View style={styles.screen}>
      <CosmicSpaceBackground showAstronaut astronautTop={insets.top + 4} astronautRight={14} astronautScale={0.7} />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandRow}>
          <BrandMark size="sm" />
        </View>

        {/* Tour */}
        <View style={styles.tour} onLayout={(e) => setTourHeight(e.nativeEvent.layout.height)}>
          <ScrollView
            ref={pager}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={32}
            onTouchStart={hold}
            onTouchEnd={release}
            onTouchCancel={release}
            style={{ width: slideWidth }}
          >
            {SLIDES.map((s) => (
              <View key={s.kicker} style={{ width: slideWidth }}>
                <ArtStage width={slideWidth} height={artHeight}>
                  {(w) => (
                    <>
                      {s.art === 'campus' && <Campus width={w} />}
                      {s.art === 'ticket' && <EventTickets width={w} />}
                      {s.art === 'auction' && <LiveLot width={w} />}
                      {s.art === 'podium' && <Podium width={w} />}
                      {s.art === 'card' && <CardShowcase />}
                      {s.art === 'more' && <AlsoInside width={w} />}
                    </>
                  )}
                </ArtStage>
                <View style={styles.slideText}>
                  <Typography variant="labelSmall" color="primary">
                    {s.kicker}
                  </Typography>
                  <Typography variant="h1" color="text" style={styles.title} numberOfLines={2}>
                    {s.title}
                  </Typography>
                  <Typography variant="body" color="textMuted" numberOfLines={3}>
                    {s.body}
                  </Typography>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Progress dots: the active one fills while its slide plays; tap any to jump (which
            hands control to the member and stops autoplay). Pause/play on the right. */}
        <View style={styles.controls}>
          <View style={styles.dots}>
            {SLIDES.map((s, i) => {
              const active = i === page;
              return (
                <Pressable
                  key={s.kicker}
                  onPress={() => {
                    setPaused(true);
                    goTo(i);
                  }}
                  hitSlop={{ top: 18, bottom: 18, left: 4, right: 4 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Show ${s.kicker.toLowerCase()}, slide ${i + 1} of ${SLIDES.length}`}
                  accessibilityState={{ selected: active }}
                >
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: withAlpha(colors.white, 0.2) },
                      active && styles.dotActive,
                    ]}
                  >
                    {active && (
                      <Animated.View
                        style={[
                          styles.dotFill,
                          {
                            backgroundColor: colors.primary,
                            width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                          },
                        ]}
                      />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
          {!reduceMotion && !screenReader && (
            <Pressable
              onPress={() => setPaused((p) => !p)}
              style={[styles.playPause, { borderColor: withAlpha(colors.white, 0.18) }]}
              accessibilityRole="button"
              accessibilityLabel={paused ? 'Play the tour' : 'Pause the tour'}
            >
              <Typography color="textMuted" style={styles.playPauseGlyph}>
                {paused ? '▶' : '❚❚'}
              </Typography>
            </Pressable>
          )}
        </View>

        <View style={styles.actions}>
          <Button label="Get started" fullWidth onPress={() => navigation.navigate('Register')} />
          <Button label="I have an account" variant="outline" fullWidth onPress={() => navigation.navigate('Login')} />
          <Button label="⚡ Dev: Skip to Main App" variant="ghost" fullWidth onPress={devLogin} />
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * Decorative stage: lays the art out on a DESIGN_H-tall canvas and scales it to fit `height`,
 * so every slide's art keeps its proportions on short phones. Hidden from screen readers.
 */
function ArtStage({
  width,
  height,
  children,
}: {
  width: number;
  height: number;
  children: (designWidth: number) => React.ReactNode;
}) {
  const s = height / DESIGN_H;
  const designWidth = width / s;
  return (
    <View
      style={{ width, height, overflow: 'visible' }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={[
          styles.artCanvas,
          {
            width: designWidth,
            left: (width - designWidth) / 2,
            top: (height - DESIGN_H) / 2,
            transform: [{ scale: s }],
          },
        ]}
      >
        {children(designWidth)}
      </View>
    </View>
  );
}

/* ---------- Welcome: the campus illustration ---------- */

function Campus({ width }: { width: number }) {
  const { colors } = useTheme();
  const imgW = Math.min(width, DESIGN_H * CAMPUS_ASPECT);
  const imgH = imgW / CAMPUS_ASPECT;
  return (
    <View style={styles.centerStage}>
      {/* Warm glow so the illustration's dark outlines read against space */}
      <Svg width={width} height={DESIGN_H} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="landing-campus-glow" cx="50%" cy="55%" r="50%">
            <Stop offset="0" stopColor={colors.primary} stopOpacity={0.32} />
            <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={width / 2} cy={DESIGN_H * 0.55} rx={width / 2} ry={DESIGN_H / 2} fill="url(#landing-campus-glow)" />
      </Svg>
      <Image source={CAMPUS} style={{ width: imgW, height: imgH }} resizeMode="contain" />
    </View>
  );
}

/* ---------- Events: tickets ---------- */

function EventTickets({ width }: { width: number }) {
  const ticketW = Math.min(width - 48, 320);
  return (
    <View style={styles.centerStage}>
      <View style={[styles.ticketBehind, { width: ticketW }]}>
        <Ticket day="21" month="DEC" weekday="SAT" sport="FOOTBALL" name="Inter-hostel Cup" place="Main Ground · 4 PM" filled={14} total={16} muted />
      </View>
      <View style={[styles.ticketFront, { width: ticketW }]}>
        <Ticket day="14" month="DEC" weekday="SAT" sport="ESPORTS" name="Valorant Cup" place="LT-1 Campus Arena · 6 PM" filled={32} total={48} />
      </View>
    </View>
  );
}

function Ticket(p: {
  day: string;
  month: string;
  weekday: string;
  sport: string;
  name: string;
  place: string;
  filled: number;
  total: number;
  muted?: boolean;
}) {
  const { colors } = useTheme();
  const stubBg = p.muted ? colors.surfaceInner : colors.primarySolid;
  return (
    <View style={[styles.ticket, { backgroundColor: colors.surface, borderColor: withAlpha(colors.white, 0.12) }]}>
      <View style={[styles.stub, { backgroundColor: stubBg }]}>
        <Typography variant="labelSmall" color="primaryText">
          {p.weekday}
        </Typography>
        <Typography color="primaryText" style={styles.stubDay}>
          {p.day}
        </Typography>
        <Typography variant="labelSmall" color="primaryText">
          {p.month}
        </Typography>
      </View>

      {/* Perforation, with notches punched out of top and bottom */}
      <View style={[styles.perforation, { borderColor: withAlpha(colors.white, 0.2) }]} />
      <View style={[styles.notch, styles.notchTop, { backgroundColor: SPACE }]} />
      <View style={[styles.notch, styles.notchBottom, { backgroundColor: SPACE }]} />

      <View style={styles.ticketBody}>
        <View style={styles.rowBetween}>
          <Badge label="Open" variant="success" />
          <Typography variant="labelSmall" color="textMuted">
            {p.sport}
          </Typography>
        </View>
        <Typography variant="h3" color="text" numberOfLines={1}>
          {p.name}
        </Typography>
        <Typography variant="bodySmall" color="textMuted" numberOfLines={1}>
          {p.place}
        </Typography>
        <View style={[styles.spotsTrack, { backgroundColor: withAlpha(colors.white, 0.1) }]}>
          <View style={[styles.spotsFill, { width: `${(p.filled / p.total) * 100}%`, backgroundColor: colors.primary }]} />
        </View>
        <Typography variant="caption" color="textMuted">
          {p.filled} / {p.total} spots taken
        </Typography>
      </View>
    </View>
  );
}

/* ---------- Live auctions: one lot ---------- */

function LiveLot({ width }: { width: number }) {
  const { colors } = useTheme();
  const cardW = Math.min(width - 16, 320);

  return (
    <View style={styles.centerStage}>
      <View
        style={[
          styles.lotGhost,
          { width: cardW - 36, borderColor: withAlpha(colors.white, 0.14), backgroundColor: withAlpha(colors.surface, 0.5) },
        ]}
      />
      <GlassCard style={{ width: cardW }}>
        <View style={styles.rowBetween}>
          <Badge label="● Live" variant="danger" />
          <Typography variant="mono" color="textMuted" style={styles.monoSmall}>
            LOT 07 / 24
          </Typography>
        </View>

        <View style={styles.lotPlayer}>
          <View style={[styles.initialsDisc, { backgroundColor: colors.primarySolid }]}>
            <Typography color="primaryText" style={styles.initials}>
              RK
            </Typography>
          </View>
          <View style={styles.flex}>
            <Typography variant="h4" color="text">
              Rhea Kapoor
            </Typography>
            <Typography variant="bodySmall" color="textMuted">
              Striker · Football
            </Typography>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: withAlpha(colors.white, 0.1) }]} />

        <View style={styles.lotBidRow}>
          <View style={styles.flex}>
            <Typography variant="labelSmall" color="textMuted">
              Current bid
            </Typography>
            <Typography variant="displayHero" color="text" style={styles.bid}>
              1,450
            </Typography>
            <Typography variant="bodySmall" color="primary">
              Team Comets leads
            </Typography>
          </View>
          <CountdownRing seconds={8} total={15} size={64} stroke={5} />
        </View>

        <View style={styles.lotSteps}>
          {['+50', '+100', '+250'].map((step, i) => (
            <View
              key={step}
              style={[
                styles.lotStep,
                i === 1 ? { backgroundColor: colors.primary } : { borderColor: withAlpha(colors.white, 0.18), borderWidth: 1 },
              ]}
            >
              <Typography color={i === 1 ? 'onPrimary' : 'text'} style={styles.lotStepText}>
                {step}
              </Typography>
            </View>
          ))}
        </View>
      </GlassCard>
    </View>
  );
}

/* ---------- Leaderboard: the podium, in the card tiers' metals ---------- */

const PODIUM = [
  { rank: 2, initials: 'MD', name: 'Meera D.', pts: '2,120', height: 92, tier: 'Silver' },
  { rank: 1, initials: 'AS', name: 'Aarav S.', pts: '2,480', height: 128, tier: 'Gold' },
  { rank: 3, initials: 'KN', name: 'Kabir N.', pts: '1,980', height: 68, tier: 'Bronze' },
];

function Podium({ width }: { width: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.centerStage}>
      <View style={[styles.podium, { width: Math.min(width, 340) }]}>
        {PODIUM.map((p) => {
          const t = cardTierStyle(p.tier, 'dark');
          return (
            <View key={p.rank} style={styles.podiumCol}>
              {p.rank === 1 && <Doodle name="star" size={20} color={t.foil[1]} strokeWidth={2} />}
              <View style={[styles.initialsDisc, styles.podiumAvatar, { borderColor: t.foil[1], backgroundColor: t.avatarBg }]}>
                <Typography style={[styles.initials, { color: t.ink }]}>{p.initials}</Typography>
              </View>
              <Typography variant="bodySmall" color="text" numberOfLines={1}>
                {p.name}
              </Typography>
              <Typography variant="mono" color="textMuted" style={styles.monoSmall}>
                {p.pts} pts
              </Typography>
              <View
                style={[
                  styles.podiumBlock,
                  { height: p.height, backgroundColor: withAlpha(t.foil[0], 0.3), borderTopColor: t.foil[1] },
                ]}
              >
                <Typography style={[styles.podiumRank, { color: t.foil[1] }]}>{p.rank}</Typography>
              </View>
            </View>
          );
        })}
        <View style={[styles.podiumFloor, { backgroundColor: withAlpha(colors.white, 0.14) }]} />
      </View>
    </View>
  );
}

/* ---------- Player card ---------- */

const SHOWCASE_SCALE = 0.56;

function CardShowcase() {
  const { colors } = useTheme();
  const w = PLAYER_CARD_WIDTH * SHOWCASE_SCALE;
  const h = PLAYER_CARD_HEIGHT * SHOWCASE_SCALE;

  return (
    <View style={styles.centerStage}>
      <Svg width={w * 2} height={DESIGN_H} style={styles.cardGlow}>
        <Defs>
          <RadialGradient id="landing-card-glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.warning} stopOpacity={0.35} />
            <Stop offset="1" stopColor={colors.warning} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={w} cy={DESIGN_H / 2} rx={w} ry={DESIGN_H / 2} fill="url(#landing-card-glow)" />
      </Svg>

      <View style={[styles.cardTilt, { width: w, height: h }]}>
        <View
          style={{
            width: PLAYER_CARD_WIDTH,
            height: PLAYER_CARD_HEIGHT,
            transform: [{ scale: SHOWCASE_SCALE }],
            marginLeft: -(PLAYER_CARD_WIDTH * (1 - SHOWCASE_SCALE)) / 2,
            marginTop: -(PLAYER_CARD_HEIGHT * (1 - SHOWCASE_SCALE)) / 2,
          }}
        >
          <PlayerCardView
            fullName="Aarav Shah"
            username="aarav.s"
            tier="Gold"
            rating={1240}
            events={18}
            podiums={6}
            challenges={11}
            interests={['Football', 'Valorant', 'Chess']}
            mode="dark"
          />
        </View>
      </View>
    </View>
  );
}

/* ---------- Also inside: four features as tiles ---------- */

const ALSO_INSIDE: { icon: DoodleName; title: string }[] = [
  { icon: 'bolt', title: 'Challenges' },
  { icon: 'sneaker', title: 'Strava' },
  { icon: 'monitor', title: 'Media' },
  { icon: 'megaphone', title: 'Announcements' },
];

function AlsoInside({ width }: { width: number }) {
  const { colors } = useTheme();
  const gridW = Math.min(width, 340);
  return (
    <View style={styles.centerStage}>
      <View style={[styles.grid, { width: gridW }]}>
        {ALSO_INSIDE.map((f, i) => (
          <GlassCard key={f.title} style={[styles.tile, { transform: [{ rotate: i % 2 ? '2deg' : '-2deg' }] }]}>
            <View style={[styles.tileIcon, { backgroundColor: withAlpha(colors.primary, 0.14) }]}>
              <Doodle name={f.icon} size={26} color={colors.primary} strokeWidth={2} />
            </View>
            <Typography variant="h4" color="text" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
              {f.title}
            </Typography>
          </GlassCard>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: SPACE,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: PADDING,
    gap: 18,
  },
  tour: {
    flex: 1,
    minHeight: ART_MIN + TEXT_BLOCK,
    justifyContent: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  artCanvas: {
    position: 'absolute',
    height: DESIGN_H,
  },
  centerStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideText: {
    gap: 8,
    marginTop: 16,
    // Room for a two-line title and three-line body, so the dots and buttons never jump.
    minHeight: SLIDE_TEXT_H,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
  },
  controls: {
    height: CONTROLS_H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playPause: {
    width: CONTROLS_H,
    height: CONTROLS_H,
    borderRadius: CONTROLS_H / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playPauseGlyph: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: -1,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  dotActive: {
    width: 28,
  },
  dotFill: {
    height: '100%',
    borderRadius: 4,
  },
  actions: {
    gap: 10,
    marginTop: 'auto',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monoSmall: {
    fontSize: 11,
  },
  divider: {
    height: 1,
    marginVertical: 14,
  },
  initialsDisc: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: FONT_FAMILIES.hero,
    fontSize: 18,
    lineHeight: 22,
  },

  // Tickets
  ticketBehind: {
    position: 'absolute',
    top: 28,
    opacity: 0.55,
    transform: [{ rotate: '5deg' }, { translateX: 14 }],
  },
  ticketFront: {
    marginTop: 64,
    transform: [{ rotate: '-3deg' }],
  },
  ticket: {
    flexDirection: 'row',
    height: 150,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  stub: {
    width: 78,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  stubDay: {
    fontFamily: FONT_FAMILIES.brand,
    fontSize: 34,
    lineHeight: 40,
  },
  perforation: {
    width: 0,
    borderLeftWidth: 2,
    borderStyle: 'dashed',
    marginVertical: 14,
  },
  notch: {
    position: 'absolute',
    left: 79 - 9,
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  notchTop: {
    top: -9,
  },
  notchBottom: {
    bottom: -9,
  },
  ticketBody: {
    flex: 1,
    padding: 14,
    gap: 4,
  },
  spotsTrack: {
    height: 6,
    borderRadius: 3,
    marginTop: 8,
    overflow: 'hidden',
  },
  spotsFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Auction
  lotGhost: {
    position: 'absolute',
    top: 2,
    height: 60,
    borderRadius: 20,
    borderWidth: 1,
  },
  lotPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
  },
  lotBidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bid: {
    fontSize: 32,
    lineHeight: 40,
  },
  lotSteps: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  lotStep: {
    flex: 1,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lotStepText: {
    fontFamily: FONT_FAMILIES.bodySemiBold,
    fontSize: 13,
    lineHeight: 18,
  },

  // Podium
  podium: {
    height: DESIGN_H,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingBottom: 1,
  },
  podiumCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  podiumAvatar: {
    borderWidth: 2,
    marginBottom: 2,
  },
  podiumBlock: {
    alignSelf: 'stretch',
    marginTop: 6,
    borderTopWidth: 3,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    alignItems: 'center',
    paddingTop: 8,
  },
  podiumRank: {
    fontFamily: FONT_FAMILIES.brand,
    fontSize: 30,
    lineHeight: 36,
  },
  podiumFloor: {
    position: 'absolute',
    left: -12,
    right: -12,
    bottom: 0,
    height: 1,
  },

  // Card
  cardGlow: {
    position: 'absolute',
  },
  cardTilt: {
    transform: [{ rotate: '-4deg' }],
  },

  // Also inside
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
  },
  tile: {
    width: '47%',
  },
  tileIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
});
