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

export default function LoginScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { login, googleSignIn, isLoading, error, clearError } = useAuth();

  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const handleLoginPress = async () => {
    clearError();
    const errors: { email?: string; password?: string } = {};

    if (!emailOrUsername.trim()) {
      errors.email = 'Email or username is required';
    }
    if (!password) {
      errors.password = 'Password is required';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    await login(emailOrUsername.trim(), password);
  };

  const handleGooglePress = async () => {
    clearError();
    const result = await googleSignIn();
    if (result.success && result.requiresProfileCompletion) {
      navigation.navigate('CompleteProfile');
    }
  };

  const handleForgotPassword = () => {
    Alert.alert(
      'Reset Password',
      'Please enter your university email to receive a password reset link.',
      [{ text: 'OK' }]
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
              mode="login"
              onChange={(mode) => {
                if (mode === 'register') {
                  navigation.navigate('Register');
                }
              }}
            />

            <View style={styles.form}>
              <TextInput
                label="EMAIL OR USERNAME"
                value={emailOrUsername}
                onChangeText={(text) => {
                  setEmailOrUsername(text);
                  if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }));
                }}
                placeholder="example@email.com"
                autoCapitalize="none"
                autoCorrect={false}
                error={fieldErrors.email}
              />

              <View style={styles.passwordFieldContainer}>
                <View style={styles.passwordHeader}>
                  <Pressable onPress={handleForgotPassword} style={styles.forgotLink}>
                    <Typography variant="labelSmall" style={styles.forgotText}>
                      Forgot?
                    </Typography>
                  </Pressable>
                </View>
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
              </View>

              <AuthCheckbox
                checked={rememberMe}
                onChange={setRememberMe}
                type="remember"
              />

              {error ? (
                <Typography variant="bodySmall" color="danger" align="center" style={styles.errorBanner}>
                  {error}
                </Typography>
              ) : null}

              <Pressable
                disabled={isLoading}
                onPress={handleLoginPress}
                style={({ pressed }) => [
                  styles.loginButton,
                  pressed && styles.buttonPressed,
                  isLoading && styles.buttonDisabled,
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#111111" />
                ) : (
                  <Typography variant="button" style={styles.loginButtonText}>
                    Login
                  </Typography>
                )}
              </Pressable>

              <AuthDivider />

              <GoogleButton
                label="Login with google"
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
    gap: 14,
  },
  passwordFieldContainer: {
    position: 'relative',
  },
  passwordHeader: {
    position: 'absolute',
    right: 4,
    top: 0,
    zIndex: 10,
  },
  forgotLink: {
    padding: 2,
  },
  forgotText: {
    color: '#6E665D',
    fontSize: 11,
    fontWeight: '600',
  },
  errorBanner: {
    marginVertical: -4,
  },
  loginButton: {
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
  loginButtonText: {
    color: '#111111',
    fontSize: 15,
    fontWeight: '700',
  },
});