import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../store/auth';
import { authRepository } from '../../src/repositories/AuthRepository';
import { InterestTile } from '../../src/components/InterestTile';
import { StickyCTABar } from '../../src/components/StickyCTABar';
import { Icon, type IconName } from '../../src/icons/Icon';
import { Typography } from '../../src/typography/Typography';
import { FONT_FAMILIES } from '../../src/theme/typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { getErrorMessage } from '../../src/api/client';
import { ErrorState } from '../../src/feedback/ErrorState';

const GROUPS: Array<{ title: string; icon: IconName; options: string[] }> = [
  { title: 'SPORTS', icon: 'trophy', options: ['Football', 'Basketball', 'Cricket', 'Badminton', 'TT'] },
  { title: 'ESPORTS', icon: 'zap', options: ['Valorant', 'CS', 'Tekken', 'Minecraft', 'Other'] },
  { title: 'GAMING', icon: 'sparkles', options: ['Story mode', 'Indie'] },
  { title: 'GAME DEV', icon: 'settings', options: ['Unity', 'Unreal', 'From scratch'] },
];
const MIN_PICKS = 3;
const H_PADDING = 20;
const TILE_GAP = 8;

/** v2 Get started · interests (58:2024). Last onboarding step; saves to profile.interests. */
export default function GetStartedScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { setOnboarding, refreshUser } = useAuth();
  const [picked, setPicked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tileWidth = Math.floor((width - H_PADDING * 2 - TILE_GAP * 2) / 3);
  const toggle = (label: string) =>
    setPicked((p) => (p.includes(label) ? p.filter((x) => x !== label) : [...p, label]));

  const finish = () => setOnboarding(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await authRepository.setInterests(picked);
      await refreshUser();
      finish();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.progressBlock}>
          <View style={styles.progress}>
            <View style={[styles.progressBar, { backgroundColor: colors.primary }]} />
            <View style={[styles.progressBar, { backgroundColor: colors.primary }]} />
          </View>
          <View style={styles.stepRow}>
            <Typography color="textMuted" style={styles.stepLabel}>
              STEP 2 OF 2 · INTERESTS
            </Typography>
            <Pressable onPress={finish} hitSlop={8} accessibilityRole="button">
              <Typography color="textMuted" style={styles.skip}>
                Skip
              </Typography>
            </Pressable>
          </View>
        </View>

        <View style={styles.heading}>
          <Typography variant="displayHero" color="text" style={styles.title}>
            What are you into?
          </Typography>
          <Typography variant="body" color="textMuted">
            Pick at least {MIN_PICKS}. We’ll tune your home feed, event suggestions and challenge picks.
          </Typography>
        </View>

        {error ? <ErrorState title="Couldn’t save your picks" message={error} onRetry={save} /> : null}

        {GROUPS.map((group) => (
          <View key={group.title} style={styles.group}>
            <View style={styles.groupHeader}>
              <Icon name={group.icon} size={16} color="textMuted" />
              <Typography color="textMuted" style={styles.groupTitle}>
                {group.title}
              </Typography>
            </View>
            <View style={styles.tiles}>
              {group.options.map((label) => (
                <InterestTile
                  key={label}
                  label={label}
                  width={tileWidth}
                  selected={picked.includes(label)}
                  onToggle={() => toggle(label)}
                />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <StickyCTABar
        title={`${picked.length} selected`}
        subtitle={picked.length < MIN_PICKS ? `Pick ${MIN_PICKS - picked.length} more` : 'You can change these in your profile'}
        cta={{ label: 'Continue', onPress: save, loading: saving, disabled: picked.length < MIN_PICKS }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: H_PADDING, paddingBottom: 32, gap: 20 },
  progressBlock: { gap: 8 },
  progress: { flexDirection: 'row', gap: 8 },
  progressBar: { flex: 1, height: 4, borderRadius: 999 },
  stepRow: { flexDirection: 'row', alignItems: 'center' },
  stepLabel: { flex: 1, fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 10, lineHeight: 15, letterSpacing: 1 },
  skip: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 13, lineHeight: 20 },
  heading: { gap: 8 },
  title: { fontSize: 36, lineHeight: 52 },
  group: { gap: 12 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  groupTitle: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 11, lineHeight: 15, letterSpacing: 1 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: TILE_GAP },
});
