import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuth } from '../../store/auth';
import {
  AuthBackground,
  AuthCard,
  AuthHeader,
  AuthTabs,
  AuthCheckbox,
  AuthDivider,
  GoogleButton,
} from '../../src/auth';
import { TextInput } from '../../src/forms/TextInput';
import { Typography } from '../../src/typography/Typography';

export default function RegisterScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { register, googleSignIn, isLoading, error, clearError } = useAuth();

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [contact, setContact] = useState('+91 ');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string;
    username?: string;
    email?: string;
    password?: string;
    repeatPassword?: string;
    contact?: string;
    terms?: string;
  }>({});

  const handleRegisterPress = async () => {
    clearError();
    const errors: typeof fieldErrors = {};

    const trimmedName = fullName.trim();
    if (trimmedName.length < 2) {
      errors.fullName = 'Please enter your full name';
    }

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      errors.username = 'Username is required';
    } else if (!/^[a-zA-Z0-9_]{3,30}$/.test(trimmedUsername)) {
      errors.username = '3–30 letters, numbers or underscores';
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      errors.email = 'Email is required';
    } else if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      errors.email = 'Please enter a valid university email';
    }

    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }

    if (password !== repeatPassword) {
      errors.repeatPassword = 'Passwords do not match';
    }

    if (!termsAccepted) {
      errors.terms = 'You must agree to the Terms of Service';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    // The backend signs new members in straight away; the navigator switches to
    // the app once the session is stored. Email is verified via the emailed link.
    await register({
      email: trimmedEmail,
      username: trimmedUsername,
      fullName: trimmedName,
      password,
      contact: contact.trim(),
    });
  };

  const handleGooglePress = async () => {
    clearError();
    const result = await googleSignIn();
    if (result.success && result.requiresProfileCompletion) {
      navigation.navigate('GetStarted');
    }
  };

  const handleToSPress = () => {
    Alert.alert(
      'Terms of Service',
      'By using the BGSC Platform, you agree to abide by BITS Goa campus community guidelines and respect tournament rules.',
      [{ text: 'Understood' }]
    );
  };

  const handlePrivacyPress = () => {
    Alert.alert(
      'Privacy Policy',
      'Your university credentials and match data are kept strictly confidential within the campus student community.',
      [{ text: 'Understood' }]
    );
  };

  return (
    <AuthBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AuthCard>
            <AuthHeader />

            <AuthTabs
              mode="register"
              onChange={(mode) => {
                if (mode === 'login') {
                  navigation.navigate('Login');
                }
              }}
            />

            <View style={styles.form}>
              <TextInput
                label="FULL NAME"
                value={fullName}
                onChangeText={(text) => {
                  setFullName(text);
                  if (fieldErrors.fullName) setFieldErrors((p) => ({ ...p, fullName: undefined }));
                }}
                placeholder="Your name"
                autoCapitalize="words"
                error={fieldErrors.fullName}
              />

              <TextInput
                label="USERNAME"
                value={username}
                onChangeText={(text) => {
                  setUsername(text);
                  if (fieldErrors.username) setFieldErrors((p) => ({ ...p, username: undefined }));
                }}
                placeholder="player_one"
                autoCapitalize="none"
                autoCorrect={false}
                error={fieldErrors.username}
              />

              <TextInput
                label="EMAIL"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }));
                }}
                placeholder="example@email.com"
                autoCapitalize="none"
                autoCorrect={false}
                error={fieldErrors.email}
              />

              <TextInput
                label="PASSWORD"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }));
                }}
                placeholder="••••••••"
                secureTextEntry
                error={fieldErrors.password}
              />

              <TextInput
                label="REPEAT PASSWORD"
                value={repeatPassword}
                onChangeText={(text) => {
                  setRepeatPassword(text);
                  if (fieldErrors.repeatPassword) setFieldErrors((p) => ({ ...p, repeatPassword: undefined }));
                }}
                placeholder="••••••••"
                secureTextEntry
                error={fieldErrors.repeatPassword}
              />

              <TextInput
                label="CONTACT"
                value={contact}
                onChangeText={(text) => {
                  setContact(text);
                  if (fieldErrors.contact) setFieldErrors((p) => ({ ...p, contact: undefined }));
                }}
                placeholder="+91"
                keyboardType="phone-pad"
                error={fieldErrors.contact}
              />

              <AuthCheckbox
                checked={termsAccepted}
                onChange={(checked) => {
                  setTermsAccepted(checked);
                  if (fieldErrors.terms) setFieldErrors((p) => ({ ...p, terms: undefined }));
                }}
                type="terms"
                onToSPress={handleToSPress}
                onPrivacyPress={handlePrivacyPress}
              />

              {fieldErrors.terms ? (
                <Typography variant="bodySmall" color="danger" style={styles.fieldError}>
                  {fieldErrors.terms}
                </Typography>
              ) : null}

              {error ? (
                <Typography variant="bodySmall" color="danger" align="center" style={styles.errorBanner}>
                  {error}
                </Typography>
              ) : null}

              <Pressable
                disabled={isLoading}
                onPress={handleRegisterPress}
                style={({ pressed }) => [
                  styles.registerButton,
                  pressed && styles.buttonPressed,
                  isLoading && styles.buttonDisabled,
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#111111" />
                ) : (
                  <Typography variant="button" style={styles.registerButtonText}>
                    Sign Up
                  </Typography>
                )}
              </Pressable>

              <AuthDivider />

              <GoogleButton
                label="Sign Up with google"
                onPress={handleGooglePress}
                disabled={isLoading}
              />
            </View>
          </AuthCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  form: {
    gap: 13,
  },
  fieldError: {
    fontSize: 11,
    marginTop: -4,
    paddingHorizontal: 4,
  },
  errorBanner: {
    marginVertical: -4,
  },
  registerButton: {
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 4,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  registerButtonText: {
    color: '#111111',
    fontSize: 15,
    fontWeight: '700',
  },
});

