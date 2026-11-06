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

const SLIDES = [
  {
    title: 'Every game on campus, in one place.',
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

/** v2 Landing · tour (55:1999) — first screen for signed-out members. */
export default function LandingScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const slideWidth = width - PADDING * 2;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setPage(Math.round(e.nativeEvent.contentOffset.x / slideWidth));

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
      showsVerticalScrollIndicator={false}
    >
      <BrandMark size="sm" />
      <HeroCollage />

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
            <Typography variant="body" color="textMuted">
              {s.body}
            </Typography>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots} accessibilityLabel={`Slide ${page + 1} of ${SLIDES.length}`}>
        {SLIDES.map((s, i) => (
          <View
            key={s.title}
            style={[styles.dot, i === page ? { width: 24, backgroundColor: colors.primary } : { backgroundColor: colors.surfaceInner }]}
          />
        ))}
      </View>

      <View style={styles.actions}>
        <Button label="Get started" fullWidth onPress={() => navigation.navigate('Register')} />
        <Button label="I have an account" variant="outline" fullWidth onPress={() => navigation.navigate('Login')} />
      </View>
    </ScrollView>
  );
}

/** Three tilted preview cards: an event, season points and the leaderboard. */
function HeroCollage() {
  const { colors } = useTheme();
  const card = (style: ViewStyle) => [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style];
  return (
    <View style={styles.collage} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={card({ left: 29, top: 30, width: 190, height: 150, transform: [{ rotate: '-6deg' }] })}>
        <Badge label="Open" variant="success" />
        <Typography variant="body" color="text" style={styles.semibold}>
          Valorant Cup
        </Typography>
        <Typography variant="bodySmall" color="textMuted">
          Sat · LT-1
        </Typography>
        <View style={[styles.miniCta, { backgroundColor: colors.primarySolid }]}>
          <Typography color="primaryText" style={styles.miniCtaText}>
            Register
          </Typography>
        </View>
      </View>

      <View style={card({ left: 156, top: 7, width: 180, height: 120, transform: [{ rotate: '5deg' }] })}>
        <Typography color="textMuted" style={styles.kicker}>
          SEASON POINTS
        </Typography>
        <Typography variant="displayHero" color="text" style={styles.points}>
          1,250
        </Typography>
        <Typography variant="mono" color="success" style={styles.monoSmall}>
          +120 this week
        </Typography>
      </View>

      <View style={card({ left: 150, top: 153, width: 190, height: 130, transform: [{ rotate: '2deg' }] })}>
        <Typography color="textMuted" style={styles.kicker}>
          LEADERBOARD
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: PADDING, gap: 24 },
  collage: { height: 300 },
  card: {
    position: 'absolute',
    gap: 8,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 10,
  },
  semibold: { fontFamily: FONT_FAMILIES.bodySemiBold },
  miniCta: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  miniCtaText: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 11, lineHeight: 15 },
  kicker: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 9, lineHeight: 15, letterSpacing: 1 },
  points: { fontSize: 34, lineHeight: 52 },
  monoSmall: { fontSize: 11 },
  lbRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  slide: { gap: 12 },
  title: { fontSize: 40, lineHeight: 52 },
  dots: { flexDirection: 'row', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 999 },
  actions: { gap: 12 },
});
