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
  AuthBackButton,
  AuthCheckbox,
} from '../../src/auth';
import { TextInput } from '../../src/forms/TextInput';
import { Typography } from '../../src/typography/Typography';

export default function CompleteProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { completeProfile, isLoading, error, clearError } = useAuth();

  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [contact, setContact] = useState('+91 ');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    password?: string;
    repeatPassword?: string;
    contact?: string;
    terms?: string;
  }>({});

  const handleFinishPress = async () => {
    clearError();
    const errors: typeof fieldErrors = {};

    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
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
    await completeProfile(password, contact.trim());
  };

  const handleToSPress = () => {
    Alert.alert(
      'Terms of Service',
      'By completing your BGSC profile, you agree to student sports and tournament community rules.',
      [{ text: 'Understood' }]
    );
  };

  const handlePrivacyPress = () => {
    Alert.alert(
      'Privacy Policy',
      'Your profile data is encrypted and securely stored.',
      [{ text: 'Understood' }]
    );
  };

  return (
    <AuthBackground heroHeight={260}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AuthCard style={styles.card}>
            {/* Top Back Navigation */}
            <View style={styles.backRow}>
              <AuthBackButton onPress={() => navigation.goBack()} />
            </View>

            {/* Header */}
            <View style={styles.header}>
              <Typography variant="h1" style={styles.title}>
                Complete your profile
              </Typography>
            </View>

            <View style={styles.form}>
              <TextInput
                label="SET A PASSWORD"
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
                onPress={handleFinishPress}
                style={({ pressed }) => [
                  styles.finishButton,
                  pressed && styles.buttonPressed,
                  isLoading && styles.buttonDisabled,
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#111111" />
                ) : (
                  <Typography variant="button" style={styles.finishButtonText}>
                    Finish
                  </Typography>
                )}
              </Pressable>
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
  card: {
    minHeight: 520,
    paddingTop: 18,
    gap: 16,
  },
  backRow: {
    marginBottom: 4,
  },
  header: {
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111111',
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
  finishButton: {
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
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
  finishButtonText: {
    color: '#111111',
    fontSize: 15,
    fontWeight: '700',
  },
});

