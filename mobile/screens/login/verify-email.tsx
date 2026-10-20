import React, { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { StackActions, useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';

import { useAuth } from '../../store/auth';
import { authRepository } from '../../src/repositories/AuthRepository';
import { AuthScaffold } from '../../src/auth/AuthScaffold';
import { Button } from '../../src/components/Button';
import { Icon } from '../../src/icons/Icon';
import { Typography } from '../../src/typography/Typography';
import { FONT_FAMILIES } from '../../src/theme/typography';
import { useTheme } from '../../src/theme/ThemeProvider';

const RESEND_COOLDOWN_S = 60;
const POLL_MS = 5000;
const STEPS = ['Open the email from BGSC', 'Tap “Verify my email”', 'Come back — you’ll be signed in'];

/** v2 Verify your email (56:2070). First onboarding step after sign-up. */
export default function VerifyEmailScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { user, refreshUser, setOnboarding, logout } = useAuth();
  const { colors } = useTheme();
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);
  const [resent, setResent] = useState(false);

  const next = () => {
    setOnboarding('interests');
    // Replace, so this screen (and its polling) unmounts.
    navigation.dispatch(StackActions.replace('GetStarted'));
  };

  // The link is opened in a browser, so check the account until it flips to verified.
  useEffect(() => {
    // A slow response must not overlap the next tick (or advance twice).
    let inFlight = false;
    const timer = setInterval(async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const me = await authRepository.me();
        if (me.isEmailVerified) {
          clearInterval(timer);
          await refreshUser();
          next();
        }
      } catch {
        // offline for a moment — keep polling
      } finally {
        inFlight = false;
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const resend = async () => {
    if (!user?.email || cooldown > 0) return;
    setCooldown(RESEND_COOLDOWN_S);
    try {
      await authRepository.resendVerification(user.email);
      setResent(true);
    } catch {
      setCooldown(0);
    }
  };

  const mm = Math.floor(cooldown / 60);
  const ss = String(cooldown % 60).padStart(2, '0');

  return (
    <AuthScaffold onBack={logout} gap={24}>
      <View style={styles.top}>
        <View style={[styles.ringOuter, { backgroundColor: colors.accentMuted }]}>
          <View style={[styles.ringInner, { backgroundColor: colors.primarySolid }]}>
            <Icon name="message" size={36} color="white" />
          </View>
        </View>
        <Typography variant="displayHero" color="text" align="center" style={styles.title}>
          Check your inbox.
        </Typography>
        <Typography variant="body" color="textMuted" align="center">
          We sent a verification link to
        </Typography>
        <Typography variant="mono" color="text" align="center">
          {user?.email ?? 'your email'}
        </Typography>
      </View>

      <View style={[styles.steps, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {STEPS.map((step, i) => (
          <View key={step} style={styles.step}>
            <View style={[styles.stepNo, { backgroundColor: colors.accentMuted }]}>
              <Typography variant="mono" color="text" style={styles.stepNoText}>
                {i + 1}
              </Typography>
            </View>
            <Typography variant="body" color="text" style={styles.stepText}>
              {step}
            </Typography>
          </View>
        ))}
      </View>

      <Button label="Open mail app" fullWidth onPress={() => void Linking.openURL('mailto:').catch(() => undefined)} />

      <View style={styles.inline}>
        <Typography variant="body" color="textMuted" style={styles.small}>
          {resent && cooldown > 0 ? 'Sent again.' : 'Didn’t get it?'}
        </Typography>
        {cooldown > 0 ? (
          <Typography variant="mono" color="textMuted" style={styles.mono}>
            Resend in {mm}:{ss}
          </Typography>
        ) : (
          <Pressable onPress={resend} hitSlop={8} accessibilityRole="button">
            <Typography color="text" style={styles.link}>
              Resend
            </Typography>
          </Pressable>
        )}
      </View>

      <View style={styles.inline}>
        <Typography variant="bodySmall" color="textMuted">
          Check spam · Wrong email?
        </Typography>
        <Pressable onPress={logout} hitSlop={8} accessibilityRole="button" accessibilityHint="Signs out so you can sign up again">
          <Typography color="text" style={styles.link}>
            Change it
          </Typography>
        </Pressable>
      </View>

      {/* Mail delivery isn't live yet, so verification can't be a hard gate. */}
      <Pressable onPress={next} hitSlop={8} accessibilityRole="button">
        <Typography color="textMuted" style={styles.later}>
          I’ll verify later
        </Typography>
      </Pressable>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  top: { alignSelf: 'stretch', alignItems: 'center', gap: 16, paddingTop: 24 },
  ringOuter: { padding: 24, borderRadius: 999 },
  ringInner: { padding: 20, borderRadius: 999 },
  title: { fontSize: 36, lineHeight: 52 },
  steps: { alignSelf: 'stretch', gap: 12, padding: 16, borderRadius: 20, borderWidth: 1 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepNo: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  stepNoText: { fontSize: 12 },
  stepText: { flex: 1 },
  inline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  small: { fontSize: 13 },
  mono: { fontSize: 12 },
  link: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 12, lineHeight: 20, textDecorationLine: 'underline' },
  later: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 13, lineHeight: 20 },
});
