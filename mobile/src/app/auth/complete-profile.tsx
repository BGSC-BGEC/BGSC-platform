import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { AuthCheckbox } from '@/components/auth/AuthCheckbox';
import { AuthShell } from '@/components/auth/AuthShell';
import { useAuthScreen } from '@/components/auth/use-auth-screen';
import { GlassInput } from '@/components/GlassInput';
import { PillButton } from '@/components/PillButton';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import { useToast } from '@/components/Toast';
import { AuthRepository } from '@/core/repositories/AuthRepository';
import { useAuthStore } from '@/core/stores/authStore';
import { FONTS } from '@/core/theme/fonts';
import { lightColors } from '@/core/theme/tokens';

const PASSWORD_RE = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const CONTACT_RE = /^\d{10}$/;

/**
 * Complete Profile (handoffSpec §7 / auth-mobile-spec §7) — Google sign-ups
 * only: set a password + contact for the OAuth profile, then
 * `AuthRepository.completeGoogleProfile`. Requires the session adopted by the
 * auth callback; cold entries without a session get a sign-in gate.
 */
export default function CompleteProfileScreen() {
  useAuthScreen();
  const colors = lightColors;
  const toast = useToast();
  const status = useAuthStore((s) => s.status);

  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [contactDigits, setContactDigits] = useState('');
  const [tos, setTos] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const contact = `+91 ${contactDigits}`;
  const onChangeContact = (t: string) =>
    setContactDigits(t.replace(/\D/g, '').replace(/^91/, '').slice(0, 10));

  const errors = {
    password: PASSWORD_RE.test(password) ? null : 'Min 8 chars, 1 uppercase, 1 number, 1 special',
    repeat: repeat === password ? null : 'Passwords do not match',
    contact: CONTACT_RE.test(contactDigits) ? null : 'Please enter a valid phone number',
    tos: tos ? null : 'You must accept the Terms of Service',
  };
  const canSubmit = Object.values(errors).every((e) => e === null);

  const onFinish = async () => {
    setBanner(null);
    if (!canSubmit) {
      setAttempted(true);
      return;
    }
    setSubmitting(true);
    try {
      await AuthRepository.completeGoogleProfile({
        password,
        contact: `+91${contactDigits}`,
      });
      toast.show('Profile complete — welcome to BGSC!');
      // TODO(auth): route to the Get Started / Onboarding flow when it ships
      // (handoffSpec §15); drawer is the temporary landing.
      router.replace('/(drawer)');
    } catch {
      setBanner("Couldn't save your profile — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const onBack = () => {
    Alert.alert('Discard changes?', 'Your progress will be lost. Go back?', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Go back', style: 'destructive', onPress: () => router.back() },
    ]);
  };

  // Gate: this step needs the session adopted by the OAuth callback.
  if (status === 'unknown' || status === 'loading') {
    return (
      <AuthShell compact onBack={onBack} heading="Complete your profile">
        <SkeletonBlock height={48} radius={999} />
        <SkeletonBlock height={48} radius={999} />
        <SkeletonBlock height={48} radius={999} />
      </AuthShell>
    );
  }
  if (status !== 'authenticated') {
    return (
      <AuthShell compact heading="Complete your profile">
        <View style={[styles.banner, { backgroundColor: colors.accentMuted, borderColor: colors.border }]}>
          <Text style={[styles.bannerText, { color: colors.text }]}>
            Your session expired — please sign in again to finish setting up your profile.
          </Text>
        </View>
        <PillButton
          label="Back to login"
          variant="primary"
          onPress={() => router.replace('/login')}
          accessibilityLabel="Back to login"
        />
      </AuthShell>
    );
  }

  const err = (key: keyof typeof errors) => (attempted ? errors[key] : null);

  return (
    <AuthShell
      compact
      onBack={onBack}
      heading="Complete your profile"
      subtitle="Set a password so you can sign in with email too."
    >
      <GlassInput
        label="Set a Password"
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
        secureTextEntry
        textContentType="password"
        error={err('password')}
        accessibilityLabel="Set a password"
        scheme="light"
      />

      <GlassInput
        label="Repeat Password"
        value={repeat}
        onChangeText={setRepeat}
        placeholder="••••••••"
        secureTextEntry
        textContentType="password"
        error={err('repeat')}
        accessibilityLabel="Repeat password"
        scheme="light"
      />

      <GlassInput
        label="Contact"
        value={contact}
        onChangeText={onChangeContact}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        error={err('contact')}
        accessibilityLabel="Contact phone number"
        scheme="light"
      />

      <AuthCheckbox
        checked={tos}
        onChange={() => setTos((t) => !t)}
        accessibilityLabel="Accept terms of service and privacy policy"
      >
        <Text style={[styles.caption, { color: colors.text }]}>
          By signing up, you agree to our{' '}
          <Text
            onPress={() => toast.show('Terms of Service — coming soon.')}
            accessibilityRole="link"
            style={[styles.link, { color: colors.accent }]}
          >
            ToS
          </Text>{' '}
          and{' '}
          <Text
            onPress={() => toast.show('Privacy Policy — coming soon.')}
            accessibilityRole="link"
            style={[styles.link, { color: colors.accent }]}
          >
            Privacy Policy
          </Text>
          .
        </Text>
      </AuthCheckbox>
      {attempted && errors.tos ? (
        <Text style={[styles.tosError, { color: colors.danger }]}>{errors.tos}</Text>
      ) : null}

      {banner ? (
        <View style={[styles.banner, { backgroundColor: colors.accentMuted, borderColor: colors.border }]}>
          <Text style={[styles.bannerText, { color: colors.text }]}>{banner}</Text>
        </View>
      ) : null}

      <PillButton
        label="Finish"
        variant="primary"
        loading={submitting}
        disabled={!canSubmit || submitting}
        onPress={() => void onFinish()}
        accessibilityLabel="Finish profile setup"
      />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  caption: {
    fontFamily: FONTS.body,
    fontSize: 12,
    lineHeight: 18,
  },
  link: {
    fontFamily: FONTS.semibold,
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  tosError: {
    fontFamily: FONTS.body,
    fontSize: 12,
    marginTop: -12,
  },
  banner: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bannerText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    lineHeight: 18,
  },
});
