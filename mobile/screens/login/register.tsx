import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StackActions, useFocusEffect, useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';

import { useAuth } from '../../store/auth';
import { AuthScaffold } from '../../src/auth/AuthScaffold';
import { AuthTabs } from '../../src/auth/AuthTabs';
import { AuthBanner } from '../../src/auth/AuthBanner';
import { TextInput } from '../../src/forms/TextInput';
import { Checkbox } from '../../src/forms/Checkbox';
import { Button } from '../../src/components/Button';
import { Icon } from '../../src/icons/Icon';
import { Typography } from '../../src/typography/Typography';
import { FONT_FAMILIES } from '../../src/theme/typography';
import { useTheme } from '../../src/theme/ThemeProvider';

type Field = 'fullName' | 'username' | 'email' | 'password' | 'repeat';

const USERNAME = /^[a-zA-Z0-9_]{3,30}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Advisory strength rules — the backend only requires 8+ characters. */
const RULES = [
  { label: '8+ chars', test: (p: string) => p.length >= 8 },
  { label: 'Uppercase', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Number', test: (p: string) => /\d/.test(p) },
  { label: 'Symbol', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];
const STRENGTH_COPY = ['Too short', 'Weak — keep going', 'Okay — add a number or symbol', 'Good — add a symbol to make it strong', 'Strong password'];

/** v2 Create account (56:1996). Sign-up continues to Verify email → Get started. */
export default function RegisterScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { register, isLoading, error, clearError } = useAuth();
  const { colors } = useTheme();

  const [form, setForm] = useState({ fullName: '', username: '', email: '', contact: '+91 ', password: '', repeat: '' });
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field | 'terms', string>>>({});

  // The auth error is shared across Login/Register/Restore: drop it when leaving this screen.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useFocusEffect(useCallback(() => clearError, []));

  const set = (key: keyof typeof form) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key as Field]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const passed = useMemo(() => RULES.map((r) => r.test(form.password)), [form.password]);
  const score = form.password ? passed.filter(Boolean).length : 0;
  const meterColor = score >= 4 ? colors.success : score >= 2 ? colors.warning : colors.danger;

  const submit = async () => {
    clearError();
    const e: typeof errors = {};
    if (form.fullName.trim().length < 2) e.fullName = 'Enter your full name.';
    if (!USERNAME.test(form.username.trim())) e.username = '3–30 letters, numbers or underscores.';
    if (!EMAIL.test(form.email.trim())) e.email = 'Enter a valid email address.';
    if (form.password.length < 8) e.password = 'Use at least 8 characters.';
    if (form.repeat !== form.password) e.repeat = 'Passwords don’t match.';
    if (!agreed) e.terms = 'Accept the Terms to continue.';
    setErrors(e);
    if (Object.values(e).some(Boolean)) return;

    await register({
      fullName: form.fullName.trim(),
      username: form.username.trim(),
      email: form.email.trim(),
      password: form.password,
      contact: form.contact.trim(),
    });
    // On success the navigator swaps to onboarding (Verify email) on its own.
  };

  return (
    <AuthScaffold onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}>
      <View style={styles.heading}>
        <Typography variant="displayHero" color="text" style={styles.title}>
          Join BGSC.
        </Typography>
        <Typography variant="body" color="textMuted">
          Takes a minute. You’ll verify your email next.
        </Typography>
      </View>

      <AuthTabs mode="register" onChange={() => navigation.dispatch(StackActions.replace('Login'))} />

      {error ? <AuthBanner message={error} /> : null}

      <TextInput label="FULL NAME" value={form.fullName} onChangeText={set('fullName')} autoComplete="name" textContentType="name" error={errors.fullName} />
      <TextInput
        label="USERNAME"
        value={form.username}
        onChangeText={set('username')}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username-new"
        error={errors.username}
      />
      <TextInput
        label="BITS EMAIL"
        value={form.email}
        onChangeText={set('email')}
        placeholder="f2025xxxx@goa.bits-pilani.ac.in"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        error={errors.email}
      />
      <TextInput
        label="PHONE"
        value={form.contact}
        onChangeText={set('contact')}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        helperText="We’ll send a 6-digit code to verify it later."
      />

      <View style={styles.passwordBlock}>
        <TextInput
          label="PASSWORD"
          value={form.password}
          onChangeText={set('password')}
          secureTextEntry
          autoComplete="password-new"
          textContentType="newPassword"
          error={errors.password}
        />
        <View style={styles.meter} accessibilityLabel={`Password strength: ${STRENGTH_COPY[score]}`}>
          {RULES.map((r, i) => (
            <View
              key={r.label}
              style={[styles.meterBar, { backgroundColor: i < score ? meterColor : colors.surfaceInner }]}
            />
          ))}
        </View>
        {form.password ? (
          <Typography variant="bodySmall" color="text">
            {STRENGTH_COPY[score]}
          </Typography>
        ) : null}
        <View style={styles.rules}>
          {RULES.map((r, i) => (
            <View
              key={r.label}
              style={[styles.rule, { backgroundColor: passed[i] ? colors.successMuted : colors.surfaceInner }]}
            >
              <Icon name={passed[i] ? 'check' : 'plus'} size={12} color={passed[i] ? 'success' : 'textMuted'} />
              <Typography color={passed[i] ? 'text' : 'textMuted'} style={styles.ruleText}>
                {r.label}
              </Typography>
            </View>
          ))}
        </View>
      </View>

      <TextInput
        label="REPEAT PASSWORD"
        value={form.repeat}
        onChangeText={set('repeat')}
        secureTextEntry
        autoComplete="password-new"
        error={errors.repeat}
      />

      <View>
        <Checkbox
          checked={agreed}
          onChange={(v) => {
            setAgreed(v);
            if (errors.terms) setErrors((e) => ({ ...e, terms: undefined }));
          }}
          label="I agree to the Terms and Privacy Policy."
        />
        {errors.terms ? (
          <Typography variant="bodySmall" style={{ color: colors.dangerText }}>
            {errors.terms}
          </Typography>
        ) : null}
      </View>

      <Button label="Create account" onPress={submit} loading={isLoading} fullWidth />
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  heading: { gap: 4 },
  title: { fontSize: 38, lineHeight: 52 },
  passwordBlock: { gap: 8 },
  meter: { flexDirection: 'row', gap: 4 },
  meterBar: { flex: 1, height: 4, borderRadius: 999 },
  rules: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 6 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  ruleText: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 11, lineHeight: 15 },
});
