import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuth } from '../../store/auth';
import {
  AuthBackground,
  AuthCard,
  AuthBackButton,
  OtpCells,
} from '../../src/auth';
import { Typography } from '../../src/typography/Typography';

export default function OtpScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<any>();
  const { verifyOtp, isLoading, error, pendingEmail, clearError } = useAuth();

  const targetEmail = route.params?.email || pendingEmail || 'your email';
  const [code, setCode] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleContinue = async () => {
    clearError();
    if (!code || code.length < 4) {
      setLocalError('Please enter the complete 4-digit code');
      return;
    }

    setLocalError(null);
    const success = await verifyOtp(targetEmail, code);
    if (!success) {
      setLocalError(error || 'Invalid verification code');
    }
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

            {/* Verification Header */}
            <View style={styles.header}>
              <Typography variant="h1" style={styles.title}>
                Verification Code
              </Typography>
              <Typography variant="body" style={styles.subtitle}>
                We have sent the verification code to your email address
              </Typography>
            </View>

            {/* 4-Digit OTP Input Cells */}
            <OtpCells
              code={code}
              onChangeCode={(newCode) => {
                setCode(newCode);
                if (localError) setLocalError(null);
              }}
              length={4}
            />

            {(localError || error) ? (
              <Typography variant="bodySmall" color="danger" align="center" style={styles.errorText}>
                {localError || error}
              </Typography>
            ) : null}

            {/* Continue Button */}
            <Pressable
              disabled={isLoading}
              onPress={handleContinue}
              style={({ pressed }) => [
                styles.continueButton,
                pressed && styles.buttonPressed,
                isLoading && styles.buttonDisabled,
              ]}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#111111" />
              ) : (
                <Typography variant="button" style={styles.continueButtonText}>
                  Continue
                </Typography>
              )}
            </Pressable>
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
    minHeight: 460,
    paddingTop: 18,
    gap: 16,
  },
  backRow: {
    marginBottom: 6,
  },
  header: {
    gap: 8,
    marginTop: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111111',
  },
  subtitle: {
    fontSize: 14,
    color: '#777067',
    lineHeight: 20,
    maxWidth: '92%',
  },
  errorText: {
    marginTop: -8,
    marginBottom: 4,
  },
  continueButton: {
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
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
  continueButtonText: {
    color: '#111111',
    fontSize: 15,
    fontWeight: '700',
  },
});

