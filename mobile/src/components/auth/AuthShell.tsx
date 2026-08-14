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
  /** Smaller hero band (OTP / Complete Profile — handoffSpec §6.1, §7.1). */
  compact?: boolean;
  /** Login/Sign-Up segmented toggle below the wordmark (handoffSpec §3.3). */
  tabs?: AuthTabs;
  /** Circular back button + heading mode (no wordmark/tabs). */
  onBack?: () => void;
  heading?: string;
  subtitle?: string;
}

/**
 * Shared auth shell (auth specs §2): light canvas (`#FAF7F2`), full-bleed
 * hero band fading into the page, BGSC wordmark, then either the Login/Sign
 * Up segmented toggle or a back button + heading. Content is scrollable and
 * keyboard-aware. Auth screens are the light-mode exception to the dark
 * glass canvas — flat light surfaces, per handoffSpec §2.
 *
 * TODO(auth): hero band is a placeholder block — drop in the final pixel-art
 * hero (cat.gif) when the asset ships; it should harmonize with the teal
 * palette (handoffSpec §14).
 */
export function AuthShell({ children, compact = false, tabs, onBack, heading, subtitle }: AuthShellProps) {
  const colors = lightColors;
  const insets = useSafeAreaInsets();

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
        <View
          style={[
            styles.hero,
            compact ? styles.heroCompact : null,
            { backgroundColor: colors.backgroundMid, borderBottomColor: colors.border },
          ]}
        />
        <View style={[styles.body, { paddingTop: insets.top + 20 }]}>
          {onBack ? (
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
              <Ionicons name="arrow-back" size={20} color={colors.text} />
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
    height: 180,
    borderBottomWidth: 1,
  },
  heroCompact: {
    height: 120,
  },
  body: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  wordmark: {
    alignItems: 'center',
    marginTop: 20,
  },
  tabs: {
    marginTop: 24,
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
