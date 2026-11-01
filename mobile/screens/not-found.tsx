import React from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  Pressable,
} from 'react-native';
import { useNavigation, useRoute, type NavigationProp, type ParamListBase, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../src/theme/ThemeProvider';
import { AppHeader } from '../src/components/AppHeader';
import { GamingBackdrop } from '../src/components/GamingBackdrop';
import { RetroTvError } from '../src/components/RetroTvError';
import { Button } from '../src/components/Button';
import { Typography } from '../src/typography/Typography';
import { Icon } from '../src/icons/Icon';
import { FONT_FAMILIES } from '../src/theme/typography';
import { withAlpha } from '../src/theme/colors';

interface NotFoundRouteParams {
  errorCode?: string;
  errorMessage?: string;
  title?: string;
  description?: string;
  returnTo?: string;
}

/**
 * 404 Not Found fallback screen with recovery navigation.
 */
export default function NotFoundScreen() {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const route = useRoute<RouteProp<{ params: NotFoundRouteParams }, 'params'>>();
  const insets = useSafeAreaInsets();

  const errorCode = route.params?.errorCode ?? '404';
  const errorMessage = route.params?.errorMessage ?? 'NOT FOUND';
  const displayTitle = route.params?.title ?? 'Lost in the Airwaves';
  const displayDescription =
    route.params?.description ??
    "The channel or coordinates you are tuning into don't exist, have expired, or lost transmission.";
  const returnTo = route.params?.returnTo ?? 'MainTabs';

  const handleGoHome = () => {
    try {
      navigation.navigate(returnTo);
    } catch {
      navigation.navigate('MainTabs');
    }
  };

  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      handleGoHome();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title="404 Broadcast"
        showBackButton={true}
        showMenuButton={false}
        showNotifications={false}
      />

      <GamingBackdrop style={styles.backdrop} height={320} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: Math.max(insets.bottom, 24) + 24,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.tvWrapper}>
          <RetroTvError
            errorCode={errorCode}
            errorMessage={errorMessage}
            scale={1.0}
            animated={true}
          />
        </View>

        <View style={styles.textBlock}>
          <View
            style={[
              styles.errorBadge,
              {
                backgroundColor: withAlpha(colors.primary, isDark ? 0.16 : 0.1),
                borderColor: withAlpha(colors.primary, 0.35),
              },
            ]}
          >
            <View style={[styles.badgeDot, { backgroundColor: colors.primary }]} />
            <Typography variant="mono" style={[styles.badgeText, { color: colors.primary }]}>
              BROADCAST ERROR {errorCode}
            </Typography>
          </View>

          <Typography
            variant="h1"
            color="text"
            style={styles.headline}
          >
            {displayTitle}
          </Typography>

          <Typography
            variant="body"
            color="textMuted"
            style={styles.description}
          >
            {displayDescription}
          </Typography>
        </View>

        <View style={styles.actionsContainer}>
          <Button
            label="Return to Home"
            onPress={handleGoHome}
            variant="primary"
            size="lg"
            leftIcon="home"
            fullWidth
          />

          <Button
            label="Go Back"
            onPress={handleGoBack}
            variant="outline"
            size="md"
            leftIcon="back"
            fullWidth
          />
        </View>

        <View style={[styles.quickLinksCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Typography variant="labelSmall" color="textMuted" style={styles.quickLinksTitle}>
            FREQUENT DESTINATIONS
          </Typography>

          <View style={styles.linksRow}>
            <Pressable
              onPress={() => navigation.navigate('Events')}
              style={[styles.linkPill, { backgroundColor: colors.surfaceInner, borderColor: colors.border }]}
              accessibilityRole="button"
            >
              <Icon name="calendar" size="xs" color="primary" />
              <Typography variant="bodySmall" color="text">
                Events
              </Typography>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate('Leaderboard')}
              style={[styles.linkPill, { backgroundColor: colors.surfaceInner, borderColor: colors.border }]}
              accessibilityRole="button"
            >
              <Icon name="trophy" size="xs" color="primary" />
              <Typography variant="bodySmall" color="text">
                Leaderboard
              </Typography>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate('ContactFaq')}
              style={[styles.linkPill, { backgroundColor: colors.surfaceInner, borderColor: colors.border }]}
              accessibilityRole="button"
            >
              <Icon name="help-circle-outline" size="xs" color="primary" />
              <Typography variant="bodySmall" color="text">
                Support
              </Typography>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    zIndex: 0,
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    zIndex: 1,
  },
  tvWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  textBlock: {
    alignItems: 'center',
    textAlign: 'center',
    maxWidth: 360,
    marginBottom: 24,
  },
  errorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 11,
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  headline: {
    textAlign: 'center',
    fontFamily: FONT_FAMILIES.hero,
    fontSize: 28,
    lineHeight: 34,
    marginBottom: 8,
  },
  description: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  actionsContainer: {
    width: '100%',
    maxWidth: 340,
    gap: 12,
    marginBottom: 28,
  },
  quickLinksCard: {
    width: '100%',
    maxWidth: 340,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    gap: 12,
  },
  quickLinksTitle: {
    letterSpacing: 0.8,
    fontWeight: '600',
    fontSize: 11,
  },
  linksRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  linkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
});
