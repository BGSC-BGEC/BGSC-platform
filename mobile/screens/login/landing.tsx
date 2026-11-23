import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark } from '../../src/auth/BrandMark';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { CountdownRing } from '../../src/components/CountdownRing';
import { Doodle, type DoodleName } from '../../src/components/doodles/Doodles';
import { BDOME_ASPECT, BDomeArt } from '../../src/components/playercard/BDomeArt';
import {
  PLAYER_CARD_HEIGHT,
  PLAYER_CARD_WIDTH,
  PlayerCardView,
} from '../../src/components/playercard/PlayerCardView';
import { Typography } from '../../src/typography/Typography';
import { FONT_FAMILIES } from '../../src/theme/typography';
import { PALETTE, withAlpha } from '../../src/theme/colors';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useAuth } from '../../store/auth';
import { CosmicSpaceBackground, GlassCard } from '../../src/auth/CosmicSpaceView';

type ArtName = 'campus' | 'auction' | 'card';

const SLIDES: { art: ArtName; title: string; body: string }[] = [
  {
    art: 'card',
    title: 'Every game on campus, in one universe.',
    body: 'Register for events, bid in live auctions, climb the leaderboard and get your name in the Hall of Fame.',
  },
  {
    art: 'auction',
    title: 'Bid live. Build your squad.',
    body: 'Captains run the auction in real time — every lot, every purse, every last-second bid.',
  },
  {
    art: 'card',
    title: 'Win, climb, get remembered.',
    body: 'Points from every event and challenge add up. The best seasons end up in the Hall of Fame.',
  },
];
const PADDING = 24;
/** The cosmic backdrop's base colour (CosmicSpaceBackground), for fades into it. */
const SPACE = '#03060f';
/** Every slide's artwork gets the same stage, so swiping never shifts the text below. */
const ART_HEIGHT = 290;

/** v2 Cosmic Landing · tour — first screen for signed-out members. */
export default function LandingScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { devLogin } = useAuth();
  const [page, setPage] = useState(0);
  const slideWidth = width - PADDING * 2;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setPage(Math.round(e.nativeEvent.contentOffset.x / slideWidth));

  return (
    <View style={styles.screen}>
      <CosmicSpaceBackground showAstronaut astronautTop={insets.top + 8} astronautRight={14} astronautScale={0.8} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandRow}>
          <BrandMark size="sm" />
        </View>

        {/* Tour: each slide's artwork swipes with the line it illustrates */}
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScroll}
          style={{ width: slideWidth }}
        >
          {SLIDES.map((s) => (
            <View key={s.title} style={[styles.slide, { width: slideWidth }]}>
              <View
                style={styles.art}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                {s.art === 'campus' && <CampusPlanet width={slideWidth} />}
                {s.art === 'auction' && <LiveLot width={slideWidth} />}
                {s.art === 'card' && <CardShowcase />}
              </View>
              <Typography variant="displayHero" color="text" style={styles.title}>
                {s.title}
              </Typography>
              <Typography variant="body" color="textMuted" style={styles.subtitle}>
                {s.body}
              </Typography>
            </View>
          ))}
        </ScrollView>

        <View style={styles.dots} accessibilityLabel={`Slide ${page + 1} of ${SLIDES.length}`}>
          {SLIDES.map((s, i) => (
            <View
              key={s.title}
              style={[
                styles.dot,
                i === page
                  ? { width: 26, backgroundColor: colors.primary }
                  : { backgroundColor: withAlpha(colors.white, 0.2) },
              ]}
            />
          ))}
        </View>

        <View style={styles.actions}>
          <Button label="Get started" fullWidth onPress={() => navigation.navigate('Register')} />
          <Button
            label="I have an account"
            variant="outline"
            fullWidth
            onPress={() => navigation.navigate('Login')}
          />
          <Button
            label="⚡ Dev: Skip to Main App"
            variant="ghost"
            fullWidth
            onPress={devLogin}
          />
        </View>
      </ScrollView>
    </View>
  );
}

/* ---------- Slide 1: the campus as a planet, sports in orbit ---------- */

const ORBIT: { name: DoodleName; angle: number }[] = [
  { name: 'football', angle: 186 },
  { name: 'controller', angle: 238 },
  { name: 'trophy', angle: 302 },
  { name: 'headphones', angle: 354 },
];
const MOON = 44;

function CampusPlanet({ width }: { width: number }) {
  const { colors } = useTheme();
  const cx = width / 2;
  // Planet: its top cap is the ground the BDome stands on; narrower than the slide so its curve
  // shows on both sides, and it fades into space at the bottom of the stage.
  const planetR = width * 0.6;
  const planetTop = ART_HEIGHT - 80;
  const planetCy = planetTop + planetR;
  // Orbit behind the dome.
  const orbit = { cy: 118, rx: width / 2 - MOON / 2 - 2, ry: 50 };
  const domeW = Math.min(220, width * 0.62);
  const domeH = domeW / BDOME_ASPECT;

  return (
    <View style={{ width, height: ART_HEIGHT }}>
      <Svg width={width} height={ART_HEIGHT} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="landing-planet" cx="50%" cy="0%" r="70%" fx="50%" fy="0%">
            <Stop offset="0" stopColor={PALETTE.orangeLight} />
            <Stop offset="0.35" stopColor={colors.primary} />
            <Stop offset="1" stopColor={colors.primarySolid} />
          </RadialGradient>
          <LinearGradient id="landing-planet-fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={SPACE} stopOpacity={0} />
            <Stop offset="1" stopColor={SPACE} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        {/* Atmosphere, then the planet */}
        <Circle cx={cx} cy={planetCy} r={planetR + 16} fill={withAlpha(colors.primary, 0.16)} />
        <Circle cx={cx} cy={planetCy} r={planetR + 6} fill={withAlpha(colors.primary, 0.22)} />
        <Circle cx={cx} cy={planetCy} r={planetR} fill="url(#landing-planet)" />
        <Rect x={0} y={ART_HEIGHT - 56} width={width} height={56} fill="url(#landing-planet-fade)" />
        {/* Orbit path */}
        <Ellipse
          cx={cx}
          cy={orbit.cy}
          rx={orbit.rx}
          ry={orbit.ry}
          fill="none"
          stroke={withAlpha(colors.white, 0.22)}
          strokeWidth={1.2}
          strokeDasharray="4 6"
        />
      </Svg>

      {/* Moons: one sport each, riding the orbit */}
      {ORBIT.map(({ name, angle }) => {
        const a = (angle * Math.PI) / 180;
        const x = cx + orbit.rx * Math.cos(a);
        const y = orbit.cy + orbit.ry * Math.sin(a);
        return (
          <View
            key={name}
            style={[
              styles.moon,
              {
                left: x - MOON / 2,
                top: y - MOON / 2,
                borderColor: withAlpha(colors.white, 0.22),
                backgroundColor: withAlpha(colors.surface, 0.85),
              },
            ]}
          >
            <Doodle name={name} size={24} color={colors.primary} strokeWidth={2} />
          </View>
        );
      })}

      {/* The BDome, standing on the planet's horizon */}
      <View style={{ position: 'absolute', left: cx - domeW / 2, top: planetTop - domeH + 10 }}>
        <BDomeArt width={domeW} />
      </View>
    </View>
  );
}

/* ---------- Slide 2: one live auction lot ---------- */

function LiveLot({ width }: { width: number }) {
  const { colors } = useTheme();
  const cardW = Math.min(width - 16, 320);

  return (
    <View style={[styles.lotStage, { width }]}>
      {/* The next lot, waiting behind */}
      <View
        style={[
          styles.lotGhost,
          {
            width: cardW - 36,
            borderColor: withAlpha(colors.white, 0.14),
            backgroundColor: withAlpha(colors.surface, 0.5),
          },
        ]}
      />

      <GlassCard style={{ width: cardW }}>
        <View style={styles.lotHeader}>
          <Badge label="● Live" variant="danger" />
          <Typography variant="mono" color="textMuted" style={styles.monoSmall}>
            LOT 07 / 24
          </Typography>
        </View>

        <View style={styles.lotPlayer}>
          <View style={[styles.lotAvatar, { backgroundColor: colors.primarySolid }]}>
            <Typography color="primaryText" style={styles.lotInitials}>
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

        <View style={[styles.lotDivider, { backgroundColor: withAlpha(colors.white, 0.1) }]} />

        <View style={styles.lotBidRow}>
          <View style={styles.flex}>
            <Typography color="textMuted" style={styles.kicker}>
              CURRENT BID
            </Typography>
            <Typography variant="displayHero" color="text" style={styles.bid}>
              1,450
            </Typography>
            <Typography variant="bodySmall" color="primary">
              Team Comets leads
            </Typography>
          </View>
          <CountdownRing seconds={8} total={15} size={68} stroke={5} />
        </View>

        <View style={styles.lotSteps}>
          {['+50', '+100', '+250'].map((step, i) => (
            <View
              key={step}
              style={[
                styles.lotStep,
                i === 1
                  ? { backgroundColor: colors.primary }
                  : { borderColor: withAlpha(colors.white, 0.18), borderWidth: 1 },
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

/* ---------- Slide 3: the player card ---------- */

const SHOWCASE_SCALE = 0.58;

function CardShowcase() {
  const { colors } = useTheme();
  const w = PLAYER_CARD_WIDTH * SHOWCASE_SCALE;
  const h = PLAYER_CARD_HEIGHT * SHOWCASE_SCALE;

  return (
    <View style={styles.cardStage}>
      {/* Glow behind the card */}
      <Svg width={w * 2} height={ART_HEIGHT} style={styles.cardGlow}>
        <Defs>
          <RadialGradient id="landing-card-glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.warning} stopOpacity={0.35} />
            <Stop offset="1" stopColor={colors.warning} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={w} cy={ART_HEIGHT / 2} rx={w} ry={ART_HEIGHT / 2} fill="url(#landing-card-glow)" />
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: SPACE,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: PADDING,
    gap: 22,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slide: {
    gap: 10,
  },
  art: {
    height: ART_HEIGHT,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 36,
    lineHeight: 46,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  actions: {
    gap: 12,
    marginTop: 6,
  },
  flex: {
    flex: 1,
  },
  kicker: {
    fontFamily: FONT_FAMILIES.bodySemiBold,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1,
  },
  monoSmall: {
    fontSize: 11,
  },

  // Slide 1
  moon: {
    position: 'absolute',
    width: MOON,
    height: MOON,
    borderRadius: MOON / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Slide 2
  lotStage: {
    height: ART_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lotGhost: {
    position: 'absolute',
    top: 4,
    height: 60,
    borderRadius: 20,
    borderWidth: 1,
  },
  lotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lotPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
  },
  lotAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lotInitials: {
    fontFamily: FONT_FAMILIES.hero,
    fontSize: 18,
    lineHeight: 22,
  },
  lotDivider: {
    height: 1,
    marginVertical: 14,
  },
  lotBidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bid: {
    fontSize: 34,
    lineHeight: 42,
  },
  lotSteps: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
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

  // Slide 3
  cardStage: {
    height: ART_HEIGHT,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardGlow: {
    position: 'absolute',
  },
  cardTilt: {
    transform: [{ rotate: '-4deg' }],
  },
});
