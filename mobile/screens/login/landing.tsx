import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewStyle,
} from 'react-native';
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark } from '../../src/auth/BrandMark';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { Typography } from '../../src/typography/Typography';
import { FONT_FAMILIES } from '../../src/theme/typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useAuth } from '../../store/auth';
import { CosmicSpaceBackground, GlassCard } from '../../src/auth/CosmicSpaceView';

const SLIDES = [
  {
    title: 'Every game on campus, in one universe.',
    body: 'Register for events, bid in live auctions, climb the leaderboard and get your name in the Hall of Fame.',
  },
  {
    title: 'Bid live. Build your squad.',
    body: 'Captains run the auction in real time — every lot, every purse, every last-second bid.',
  },
  {
    title: 'Win, climb, get remembered.',
    body: 'Points from every event and challenge add up. The best seasons end up in the Hall of Fame.',
  },
];
const PADDING = 24;

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
      {/* Cosmic Canvas / SVG Starfield & Horizon Glow */}
      <CosmicSpaceBackground showAstronaut astronautTop={insets.top + 16} astronautRight={12} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Header */}
        <View style={styles.brandRow}>
          <BrandMark size="sm" />
        </View>

        {/* Floating Tilted Glass Cards Preview */}
        <HeroCollage />

        {/* Slide Carousel */}
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScroll}
          style={{ width: slideWidth }}
        >
          {SLIDES.map((s) => (
            <View key={s.title} style={[styles.slide, { width: slideWidth }]}>
              <Typography variant="displayHero" color="text" style={styles.title}>
                {s.title}
              </Typography>
              <Typography variant="body" color="textMuted" style={styles.subtitle}>
                {s.body}
              </Typography>
            </View>
          ))}
        </ScrollView>

        {/* Carousel Dots */}
        <View style={styles.dots} accessibilityLabel={`Slide ${page + 1} of ${SLIDES.length}`}>
          {SLIDES.map((s, i) => (
            <View
              key={s.title}
              style={[
                styles.dot,
                i === page
                  ? { width: 26, backgroundColor: colors.primary }
                  : { backgroundColor: 'rgba(255, 255, 255, 0.2)' },
              ]}
            />
          ))}
        </View>

        {/* Action Buttons */}
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

/** Three tilted preview glass cards: an event, season points and the leaderboard. */
function HeroCollage() {
  const { colors } = useTheme();

  return (
    <View style={styles.collage} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {/* Card 1: Valorant Tournament */}
      <GlassCard style={cardStyle({ left: 16, top: 24, width: 200, height: 154, transform: [{ rotate: '-6deg' }] })}>
        <View style={styles.cardHeader}>
          <Badge label="Open" variant="success" />
          <Typography variant="bodySmall" color="textMuted" style={styles.monoSmall}>
            ESPORTS
          </Typography>
        </View>
        <Typography variant="body" color="text" style={styles.semibold}>
          Valorant Cup
        </Typography>
        <Typography variant="bodySmall" color="textMuted">
          Sat · LT-1 Campus Arena
        </Typography>
        <View style={[styles.miniCta, { backgroundColor: colors.primarySolid }]}>
          <Typography color="primaryText" style={styles.miniCtaText}>
            Register Lot
          </Typography>
        </View>
      </GlassCard>

      {/* Card 2: Season Points */}
      <GlassCard style={cardStyle({ left: 154, top: 8, width: 180, height: 124, transform: [{ rotate: '5deg' }] })}>
        <Typography color="textMuted" style={styles.kicker}>
          SEASON POINTS
        </Typography>
        <Typography variant="displayHero" color="text" style={styles.points}>
          1,250
        </Typography>
        <Typography variant="mono" color="success" style={styles.monoSmall}>
          +120 this week
        </Typography>
      </GlassCard>

      {/* Card 3: Live Standings */}
      <GlassCard style={cardStyle({ left: 140, top: 152, width: 200, height: 136, transform: [{ rotate: '2deg' }] })}>
        <Typography color="textMuted" style={styles.kicker}>
          LEADERBOARD · TOP 3
        </Typography>
        {[
          ['1', 'Aarav S.', '2,480'],
          ['2', 'Meera D.', '2,120'],
          ['8', 'You', '1,250'],
        ].map(([rank, name, pts]) => {
          const me = name === 'You';
          return (
            <View key={rank} style={styles.lbRow}>
              <Typography variant="mono" color={me ? 'primary' : 'textMuted'} style={styles.monoSmall}>
                {rank}
              </Typography>
              <Typography variant="bodySmall" color={me ? 'primary' : 'text'} style={styles.flex}>
                {name}
              </Typography>
              <Typography variant="mono" color="textMuted" style={styles.monoSmall}>
                {pts}
              </Typography>
            </View>
          );
        })}
      </GlassCard>
    </View>
  );
}

const cardStyle = (custom: ViewStyle): ViewStyle => ({
  position: 'absolute',
  ...custom,
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#03060f',
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
  collage: {
    height: 300,
    position: 'relative',
    marginTop: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  semibold: {
    fontFamily: FONT_FAMILIES.bodySemiBold,
    fontSize: 15,
  },
  miniCta: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    marginTop: 2,
  },
  miniCtaText: {
    fontFamily: FONT_FAMILIES.bodySemiBold,
    fontSize: 11,
    lineHeight: 14,
  },
  kicker: {
    fontFamily: FONT_FAMILIES.bodySemiBold,
    fontSize: 9,
    lineHeight: 14,
    letterSpacing: 1,
  },
  points: {
    fontSize: 32,
    lineHeight: 44,
  },
  monoSmall: {
    fontSize: 11,
  },
  lbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 1,
  },
  flex: {
    flex: 1,
  },
  slide: {
    gap: 10,
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
});
