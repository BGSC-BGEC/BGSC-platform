import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { Typography } from '../typography/Typography';
import { FONT_FAMILIES } from '../theme/typography';
import { RetroTvError } from '../components/RetroTvError';
import { isNotFoundMessage } from '../api/client';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  style?: ViewStyle;
  /**
   * Where the error sits. 'inline' (default) is a section of a screen; 'screen' means the whole
   * screen's subject failed to load, so a not-found error shows the retro TV.
   */
  variant?: 'inline' | 'screen';
  /** Force the quiet not-found presentation; detected from `message` when omitted. */
  notFound?: boolean;
}

// RetroTvError's natural height (padding + antenna + cabinet + stand) — used to collapse the
// layout box to the scaled size, since a transform alone leaves the full-size gap around it.
const TV_HEIGHT = 306;
const TV_SCALE = 0.75;

/**
 * Error message as plain text on the page (no tinted card or icon tile): a short red title, the
 * hint in grey, and a "Try again" link.
 * "Not found" errors are not failures, so they render quietly instead: a muted line (inline) or the
 * retro TV (screen), with no red card.
 */
export function ErrorState({
  title = 'Something went wrong',
  message = 'Check your connection. Pull down to refresh or retry.',
  onRetry,
  retryLabel = 'Try again',
  style,
  variant = 'inline',
  notFound,
}: ErrorStateProps) {
  const { colors } = useTheme();

  if (notFound ?? isNotFoundMessage(message)) {
    const retry = onRetry ? (
      <Pressable onPress={onRetry} hitSlop={8} accessibilityRole="button" accessibilityLabel="Try again">
        <Typography variant="bodySmall" color="textMuted" style={styles.quietRetry}>
          Try again
        </Typography>
      </Pressable>
    ) : null;

    if (variant === 'screen') {
      return (
        <View style={[styles.screen, style]}>
          <View style={styles.tvBox}>
            <RetroTvError errorCode="404" errorMessage="NOT FOUND" scale={TV_SCALE} />
          </View>
          <Typography variant="bodySmall" color="textMuted" style={styles.quietText}>
            {message}
          </Typography>
          {retry}
        </View>
      );
    }

    return (
      <View style={[styles.quiet, style]}>
        <Typography variant="bodySmall" color="textMuted" style={styles.quietText}>
          {message}
        </Typography>
        {retry}
      </View>
    );
  }

  return (
    <View accessibilityRole="alert" style={[styles.plain, style]}>
      <Typography variant="body" style={[styles.title, { color: colors.dangerText }]}>
        {title}
      </Typography>
      <Typography variant="bodySmall" color="textMuted" style={styles.message}>
        {message}
      </Typography>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={retryLabel}
          style={({ pressed }) => [styles.retryWrap, pressed && styles.pressed]}
        >
          <Typography variant="button" color="primary" style={styles.retry}>
            {retryLabel}
          </Typography>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  plain: { gap: 3, paddingVertical: 8 },
  title: { fontFamily: FONT_FAMILIES.bodySemiBold },
  message: { lineHeight: 19 },
  retryWrap: { alignSelf: 'flex-start', marginTop: 6 },
  retry: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 14 },
  pressed: { opacity: 0.6 },
  quiet: { alignItems: 'center', gap: 6, paddingVertical: 24, paddingHorizontal: 16 },
  quietText: { textAlign: 'center', maxWidth: 320 },
  quietRetry: { textDecorationLine: 'underline' },
  screen: { alignItems: 'center', gap: 6, paddingVertical: 16 },
  tvBox: { height: TV_HEIGHT * TV_SCALE, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
});
