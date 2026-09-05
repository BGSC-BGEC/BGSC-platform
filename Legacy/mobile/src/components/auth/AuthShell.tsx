import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Logo } from '@/components/logo';
import { SegmentedToggle } from '@/components/SegmentedToggle';
import { FONTS } from '@/core/theme/fonts';
import { lightColors } from '@/core/theme/tokens';

export interface AuthTabs {
  options: string[];
  value: string;
  onChange: (value: string) => void;
}

export interface AuthShellProps {
  children: ReactNode;
  compact?: boolean;
  tabs?: AuthTabs;
  onBack?: () => void;
  /** Show a back button alongside tabs (when accessed from inside the app). */
  showBack?: boolean;
  heading?: string;
  subtitle?: string;
}

export function AuthShell({ children, compact = false, tabs, onBack, showBack, heading, subtitle }: AuthShellProps) {
  const colors = lightColors;
  const insets = useSafeAreaInsets();

  const heroHeight = compact ? 130 : 200;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero band: teal gradient using stacked Views */}
        <View style={[styles.hero, { height: heroHeight + insets.top }]}>
          <View style={[StyleSheet.absoluteFill, styles.heroGradientTop]} />
          <View style={[StyleSheet.absoluteFill, styles.heroGradientBottom]} />
          {/* Subtle pattern dots */}
          <View style={[StyleSheet.absoluteFill, styles.heroNoise]} />
        </View>

        <View style={styles.body}>
          {/* Back button when accessed from within the app alongside tabs */}
          {showBack && tabs ? (
            <View style={styles.backRow}>
              <Pressable
                onPress={onBack}
                accessibilityRole="button"
                accessibilityLabel="Go back"
                hitSlop={8}
                style={({ pressed }) => [
                  styles.back,
                  {
                    backgroundColor: colors.surfaceSolid,
                    borderColor: colors.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Ionicons name="arrow-back" size={18} color={colors.text} />
              </Pressable>
            </View>
          ) : onBack ? (
            <Pressable
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={8}
              style={({ pressed }) => [
                styles.back,
                {
                  backgroundColor: colors.surfaceSolid,
                  borderColor: colors.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Ionicons name="arrow-back" size={18} color={colors.text} />
            </Pressable>
          ) : (
            <View style={styles.wordmark}>
              <Logo />
            </View>
          )}

          {tabs ? (
            <View style={styles.tabs}>
              <SegmentedToggle
                options={tabs.options}
                value={tabs.value}
                onChange={tabs.onChange}
                accessibilityLabel="Login or sign up"
              />
            </View>
          ) : null}

          {heading ? <Text style={[styles.heading, { color: colors.text }]}>{heading}</Text> : null}
          {subtitle ? (
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
          ) : null}

          <View style={styles.content}>{children}</View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
  },
  hero: {
    overflow: 'hidden',
  },
  heroGradientTop: {
    backgroundColor: '#0B3D45',
    bottom: '40%',
  },
  heroGradientBottom: {
    top: '60%',
    backgroundColor: '#FAF7F2',
  },
  heroNoise: {
    backgroundColor: 'transparent',
    opacity: 0.08,
  },
  body: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  wordmark: {
    alignItems: 'center',
    marginBottom: 4,
  },
  tabs: {
    marginTop: 20,
    alignSelf: 'center',
    width: 280,
    maxWidth: '100%',
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  heading: {
    fontFamily: FONTS.heading,
    fontSize: 28,
    marginTop: 8,
  },
  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  content: {
    marginTop: 32,
    gap: 20,
  },
});
