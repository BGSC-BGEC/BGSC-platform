import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Circle } from 'react-native-svg';

import { useAuth } from '../../store/auth';
import { AuthScaffold } from '../../src/auth/AuthScaffold';
import { AuthBanner } from '../../src/auth/AuthBanner';
import { Button } from '../../src/components/Button';
import { Icon, type IconName } from '../../src/icons/Icon';
import { Typography } from '../../src/typography/Typography';
import { FONT_FAMILIES } from '../../src/theme/typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { formatDate } from '../../src/utils/format';

/** Matches the backend restore window for soft-deleted accounts. */
const RESTORE_WINDOW_DAYS = 45;
const RING = 150;
const STROKE = 8;

const COMES_BACK: Array<{ icon: IconName; text: string }> = [
  { icon: 'coins', text: 'Your points and your rank' },
  { icon: 'sparkles', text: 'Player card and achievements' },
  { icon: 'calendar', text: 'Event history (active registrations were cancelled)' },
];

/** v2 Restore account (58:2107). Reached from Login when the account is scheduled for deletion. */
export default function RestoreAccountScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { restoreCandidate, restoreAccount, cancelRestore, clearError, isLoading, error } = useAuth();

  const days = restoreCandidate?.daysRemaining ?? null;
  const deletesOn = days != null ? formatDate(new Date(Date.now() + days * 86400000).toISOString(), { day: 'numeric', month: 'short' }) : null;
  const progress = days != null ? Math.min(1, days / RESTORE_WINDOW_DAYS) : 1;
  const r = (RING - STROKE) / 2;
  const circumference = 2 * Math.PI * r;

  // Any way out (button, hardware back, swipe) drops the held credentials.
  useEffect(
    () =>
      navigation.addListener('beforeRemove', () => {
        cancelRestore();
        clearError();
      }),
    [navigation, cancelRestore, clearError],
  );

  const leave = () => navigation.goBack();

  return (
    <AuthScaffold gap={24} onBack={leave}>
      <View style={styles.top}>
        <View style={styles.ring} accessibilityLabel={days != null ? `${days} days left to restore` : undefined}>
          <Svg width={RING} height={RING}>
            <Circle cx={RING / 2} cy={RING / 2} r={r} stroke={colors.surfaceInner} strokeWidth={STROKE} fill="none" />
            <Circle
              cx={RING / 2}
              cy={RING / 2}
              r={r}
              stroke={colors.primary}
              strokeWidth={STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${circumference * progress} ${circumference}`}
              transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
            />
          </Svg>
          <View style={styles.ringLabel}>
            <Typography color="text" style={styles.days}>
              {days ?? '—'}
            </Typography>
            <Typography variant="bodySmall" color="textMuted">
              days left
            </Typography>
          </View>
        </View>

        <Typography variant="displayHero" color="text" align="center" style={styles.title}>
          Welcome back.
        </Typography>
        <Typography variant="body" color="textMuted" align="center">
          Your account is scheduled for deletion{deletesOn ? ` on ${deletesOn}` : ''}. Restore it now and everything
          comes back — points, card, history.
        </Typography>
      </View>

      <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {COMES_BACK.map((item) => (
          <View key={item.text} style={styles.item}>
            <View style={[styles.itemIcon, { backgroundColor: colors.accentMuted }]}>
              <Icon name={item.icon} size={16} color="primary" />
            </View>
            <Typography variant="body" color="text" style={styles.itemText}>
              {item.text}
            </Typography>
          </View>
        ))}
      </View>

      {error ? <AuthBanner message={error} /> : null}

      <Button label="Restore my account" fullWidth loading={isLoading} onPress={() => void restoreAccount()} />
      <Pressable onPress={leave} hitSlop={8} accessibilityRole="button">
        <Typography color="textMuted" style={styles.leave}>
          Continue with deletion
        </Typography>
      </Pressable>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  top: { alignSelf: 'stretch', alignItems: 'center', gap: 16 },
  ring: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  ringLabel: { position: 'absolute', alignItems: 'center' },
  days: { fontFamily: FONT_FAMILIES.hero, fontSize: 52, lineHeight: 52 },
  title: { fontSize: 34, lineHeight: 52 },
  list: { alignSelf: 'stretch', gap: 12, padding: 16, borderRadius: 20, borderWidth: 1 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemIcon: { padding: 8, borderRadius: 12 },
  itemText: { flex: 1, fontSize: 13 },
  leave: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 13, lineHeight: 20 },
});
