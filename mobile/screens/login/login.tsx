import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  StackActions,
  useFocusEffect,
  useNavigation,
  useRoute,
  type NavigationProp,
  type ParamListBase,
} from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../store/auth';
import { AuthTabs } from '../../src/auth/AuthTabs';
import { AuthBanner } from '../../src/auth/AuthBanner';
import { BrandMark } from '../../src/auth/BrandMark';
import { GoogleButton } from '../../src/auth/GoogleButton';
import { TextInput } from '../../src/forms/TextInput';
import { Switch } from '../../src/forms/Switch';
import { Button } from '../../src/components/Button';
import { Typography } from '../../src/typography/Typography';
import { FONT_FAMILIES } from '../../src/theme/typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { CosmicSpaceBackground, GlassCard } from '../../src/auth/CosmicSpaceView';

type FieldErrors = { login?: string; password?: string };

/** v2 Cosmic Space Login — email or username + password; deleted accounts continue to Restore. */
export default function LoginScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const insets = useSafeAreaInsets();
  const { login, googleSignIn, isLoading, error, clearError, restoreCandidate } = useAuth();
  const notice = (useRoute().params as { notice?: string } | undefined)?.notice;

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [googleNotice, setGoogleNotice] = useState<string | null>(null);

  // Auth error drop when leaving screen
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useFocusEffect(useCallback(() => clearError, []));

  useEffect(() => {
    if (restoreCandidate) navigation.navigate('RestoreAccount');
  }, [restoreCandidate, navigation]);

  const submit = async () => {
    clearError();
    setGoogleNotice(null);
    const errors: FieldErrors = {};
    if (!identifier.trim()) errors.login = 'Enter your BITS email or username.';
    if (!password) errors.password = 'Enter your password.';
    setFieldErrors(errors);
    if (errors.login || errors.password) return;
    await login(identifier.trim(), password);
  };

  return (
    <View style={styles.screen}>
      {/* Cosmic Canvas / Starfield Background */}
      <CosmicSpaceBackground showAstronaut astronautTop={insets.top + 20} astronautRight={16} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 },
          ]}
        >
          {/* Header Row */}
          <View style={styles.headerRow}>
            <BrandMark />
          </View>

          {/* Heading */}
          <View style={styles.heading}>
            <Typography variant="displayHero" color="text" style={styles.title}>
              Welcome back.
            </Typography>
            <Typography variant="body" color="textMuted">
              Log in with your BITS email or campus username.
            </Typography>
          </View>

          {/* Mode Tabs */}
          <AuthTabs mode="login" onChange={() => navigation.dispatch(StackActions.replace('Register'))} />

          {/* Error / Notice Banners */}
          {error ? (
            <AuthBanner message={error} />
          ) : googleNotice ? (
            <AuthBanner message={googleNotice} tone="info" />
          ) : notice ? (
            <AuthBanner message={notice} tone="success" />
          ) : null}

          {/* Glass Form Container */}
          <GlassCard style={styles.formCard}>
            <View style={styles.formFields}>
              <TextInput
                label="EMAIL OR USERNAME"
                value={identifier}
                onChangeText={(t) => {
                  setIdentifier(t);
                  if (fieldErrors.login) setFieldErrors((p) => ({ ...p, login: undefined }));
                }}
                placeholder="f2025xxxx@goa.bits-pilani.ac.in"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                textContentType="username"
                returnKeyType="next"
                error={fieldErrors.login}
              />

              <TextInput
                label="PASSWORD"
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }));
                }}
                placeholder="••••••••"
                secureTextEntry
                autoComplete="password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={submit}
                error={fieldErrors.password}
              />

              {/* Keep Logged in & Forgot Password */}
              <View style={styles.optionsRow}>
                <Switch
                  value={keepLoggedIn}
                  onValueChange={setKeepLoggedIn}
                  accessibilityLabel="Keep me logged in"
                />
                <Typography variant="body" color="text" style={styles.rowLabel}>
                  Keep me logged in
                </Typography>
                <Pressable
                  onPress={() => navigation.navigate('ForgotPassword')}
                  hitSlop={8}
                  accessibilityRole="link"
                >
                  <Typography color="primary" style={styles.forgotLink}>
                    Forgot password?
                  </Typography>
                </Pressable>
              </View>

              {/* Submit Button */}
              <Button label="Sign In" onPress={submit} loading={isLoading} fullWidth />

              {/* Or Divider */}
              <OrDivider />

              {/* Google Button */}
              <GoogleButton
                label="Continue with Campus Google"
                disabled={isLoading}
                onPress={async () => {
                  clearError();
                  setGoogleNotice(null);
                  const res = await googleSignIn();
                  // Browser closed before finishing: a gentle notice, not an error.
                  if (res.cancelled) setGoogleNotice('Google sign-in was cancelled.');
                }}
              />
            </View>
          </GlassCard>

          {/* Terms Footer */}
          <Typography variant="bodySmall" color="textMuted" align="center" style={styles.footerNotice}>
            BGSC Platform &bull; BITS Goa Sports & Esports Community
          </Typography>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function OrDivider() {
  const { colors } = useTheme();
  return (
    <View style={styles.divider}>
      <View style={[styles.line, { backgroundColor: colors.border }]} />
      <Typography variant="bodySmall" color="textMuted">
        or
      </Typography>
      <View style={[styles.line, { backgroundColor: colors.border }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#03060f',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    gap: 18,
    flexGrow: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  heading: {
    gap: 4,
  },
  title: {
    fontSize: 36,
    lineHeight: 46,
  },
  formCard: {
    marginTop: 4,
  },
  formFields: {
    gap: 16,
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowLabel: {
    flex: 1,
    fontSize: 13,
  },
  forgotLink: {
    fontFamily: FONT_FAMILIES.bodySemiBold,
    fontSize: 13,
    lineHeight: 20,
    textDecorationLine: 'underline',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 2,
  },
  line: {
    flex: 1,
    height: 1,
  },
  footerNotice: {
    marginTop: 8,
    opacity: 0.7,
  },
});
