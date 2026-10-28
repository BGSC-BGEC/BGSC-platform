import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  StackActions,
  useFocusEffect,
  useNavigation,
  useRoute,
  type NavigationProp,
  type ParamListBase,
} from '@react-navigation/native';

import { useAuth } from '../../store/auth';
import { AuthScaffold } from '../../src/auth/AuthScaffold';
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

type FieldErrors = { login?: string; password?: string };

/** v2 Login (55:2048) — email or username + password; deleted accounts continue to Restore. */
export default function LoginScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { login, googleSignIn, isLoading, error, clearError, restoreCandidate } = useAuth();
  // Set by flows that end on Login, e.g. a finished password reset.
  const notice = (useRoute().params as { notice?: string } | undefined)?.notice;

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // The auth error is shared across Login/Register/Restore: drop it when leaving this screen.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useFocusEffect(useCallback(() => clearError, []));

  // Right password on a soft-deleted account: offer the restore instead of an error.
  useEffect(() => {
    if (restoreCandidate) navigation.navigate('RestoreAccount');
  }, [restoreCandidate, navigation]);

  const submit = async () => {
    clearError();
    const errors: FieldErrors = {};
    if (!identifier.trim()) errors.login = 'Enter your BITS email or username.';
    if (!password) errors.password = 'Enter your password.';
    setFieldErrors(errors);
    if (errors.login || errors.password) return;
    await login(identifier.trim(), password);
  };

  return (
    <AuthScaffold onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}>
      <BrandMark />
      <View style={styles.heading}>
        <Typography variant="displayHero" color="text" style={styles.title}>
          Welcome back.
        </Typography>
        <Typography variant="body" color="textMuted">
          Log in with your BITS email or username.
        </Typography>
      </View>

      <AuthTabs mode="login" onChange={() => navigation.dispatch(StackActions.replace('Register'))} />

      {error ? <AuthBanner message={error} /> : notice ? <AuthBanner message={notice} tone="success" /> : null}

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

      <View style={styles.row}>
        {/* Sessions always persist in SecureStore; the switch mirrors the v2 design. */}
        <Switch value={keepLoggedIn} onValueChange={setKeepLoggedIn} accessibilityLabel="Keep me logged in" />
        <Typography variant="body" color="text" style={styles.rowLabel}>
          Keep me logged in
        </Typography>
        <Pressable onPress={() => navigation.navigate('ForgotPassword')} hitSlop={8} accessibilityRole="link">
          <Typography color="text" style={styles.link}>
            Forgot password?
          </Typography>
        </Pressable>
      </View>

      <Button label="Log in" onPress={submit} loading={isLoading} fullWidth />

      <OrDivider />

      <GoogleButton
        label="Continue with Google"
        disabled={isLoading}
        onPress={async () => {
          clearError();
          await googleSignIn();
        }}
      />

      <Typography variant="bodySmall" color="textMuted" align="center">
        By continuing you agree to the Terms and Privacy Policy.
      </Typography>
    </AuthScaffold>
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
  heading: { gap: 4 },
  title: { fontSize: 38, lineHeight: 52 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowLabel: { flex: 1, fontSize: 13 },
  link: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 13, lineHeight: 20, textDecorationLine: 'underline' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  line: { flex: 1, height: 1 },
});
