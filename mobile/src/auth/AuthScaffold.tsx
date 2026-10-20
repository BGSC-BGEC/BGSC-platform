import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemeProvider, useTheme } from '../theme/ThemeProvider';
import { AuthBackButton } from './AuthBackButton';

const HERO_HEIGHT = 300;
/** Content starts 40px above the hero's bottom edge so the fade runs under the heading. */
const CONTENT_TOP = 260;

export interface AuthScaffoldProps {
  children: React.ReactNode;
  onBack?: () => void;
  /** Vertical gap between direct children (v2 uses 20 on forms, 24 on message screens) */
  gap?: number;
  /** Centre children horizontally (verify / restore screens) */
  centered?: boolean;
}

function Hero() {
  const { colors } = useTheme();
  return (
    <View style={styles.hero} pointerEvents="none">
      <Image source={require('../../assets/auth/cat.gif')} style={StyleSheet.absoluteFill} contentFit="cover" />
      {/* Fade to the background: clear for 55%, 70% by 80%, solid at the bottom edge */}
      <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="auth-hero-fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.background} stopOpacity={0} />
            <Stop offset="0.55" stopColor={colors.background} stopOpacity={0} />
            <Stop offset="0.8" stopColor={colors.background} stopOpacity={0.7} />
            <Stop offset="1" stopColor={colors.background} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#auth-hero-fade)" />
      </Svg>
    </View>
  );
}

function Body({ children, onBack, gap = 20, centered }: AuthScaffoldProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            { gap, paddingBottom: insets.bottom + 40 },
            centered && styles.centered,
          ]}
        >
          <Hero />
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
      {onBack ? <AuthBackButton onPress={onBack} style={{ position: 'absolute', left: 20, top: insets.top + 12 }} /> : null}
    </View>
  );
}

/**
 * v2 auth layout — light "Auth" palette, cat hero fading into the cream background,
 * keyboard-safe scrolling content. Every sign-in / sign-up screen renders inside this.
 */
export function AuthScaffold(props: AuthScaffoldProps) {
  return (
    <ThemeProvider initialMode="light">
      <Body {...props} />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  hero: { position: 'absolute', top: 0, left: 0, right: 0, height: HERO_HEIGHT, overflow: 'hidden' },
  content: { flexGrow: 1, paddingTop: CONTENT_TOP, paddingHorizontal: 24 },
  centered: { alignItems: 'center' },
});
