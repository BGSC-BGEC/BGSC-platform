import React, { useEffect } from 'react';
import { Image, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';

import { AppHeader } from '../../src/components/AppHeader';
import { Avatar } from '../../src/components/Avatar';
import { Card } from '../../src/components/Card';
import { ListRow } from '../../src/components/ListRow';
import { Icon, type IconName } from '../../src/icons/Icon';
import { Typography } from '../../src/typography/Typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useResponsive } from '../../src/responsive/useResponsive';
import AuraLift, { useAuraLiftContext } from '../../src/components/reacticx/organisms/aura-lift';

type DevLinks = Partial<Record<'github' | 'linkedin' | 'instagram' | 'website', string>>;

interface Dev {
  name: string;
  role: string;
  /** Photo URL; initials are shown without one. */
  avatarUrl?: string;
  links?: DevLinks;
}

/**
 * ─── EDIT ME ────────────────────────────────────────────────────────────────────────────
 * The dev team, in display order. Paste each social URL into its empty '' slot, e.g.
 *   github: 'https://github.com/…', linkedin: 'https://www.linkedin.com/in/…',
 *   instagram: 'https://instagram.com/…'   (website: 'https://…' also works)
 * An icon shows for every key listed; an empty one is inert until filled. Delete a key to
 * hide its icon. Add `avatarUrl` for a photo (initials are shown without one).
 */
const SOCIALS_TBD: DevLinks = { github: '', linkedin: '', instagram: '' };

const DEV_TEAM: Dev[] = [
  { name: 'Nikunj Goyal', role: 'Backend', links: { ...SOCIALS_TBD } },
  { name: 'Chaitanya Ahuja', role: 'Frontend · Mobile + Web', links: { ...SOCIALS_TBD } },
  { name: 'Jeet Shah', role: 'Frontend · Mobile', links: { ...SOCIALS_TBD } },
  { name: 'Dhruvin Davada', role: 'Backend', links: { ...SOCIALS_TBD } },
  { name: 'Satyam Suman', role: 'Frontend · Web', links: { ...SOCIALS_TBD } },
];

/** One-line description under the logo. Placeholder too: edit to taste. */
const ABOUT_LINE = 'The BGEC dev team behind the BGSC app: designing, building and running it for the campus.';

/** BGEC club logo (same asset as the player card's BGEC option); wide, 983 × 623. */
const BGEC_LOGO = require('../../assets/images/card-logos/bgec.png');
const BGEC_LOGO_ASPECT = 983 / 623;
const BGEC_LOGO_HEIGHT = 64;

const LINK_META: Record<keyof DevLinks, { icon: IconName; label: string }> = {
  github: { icon: 'logo-github', label: 'GitHub' },
  linkedin: { icon: 'logo-linkedin', label: 'LinkedIn' },
  instagram: { icon: 'logo-instagram', label: 'Instagram' },
  website: { icon: 'globe-outline', label: 'Website' },
};

const GRID_GAP = 12;

/** "About the devs": the team as profile cards, then app version info. Opened from the sidebar. */
export default function AboutDevs() {
  const { colors } = useTheme();
  const { gutter, contentWidth } = useResponsive();
  // Two cards per row inside the content column.
  const cardWidth = Math.floor((Math.min(contentWidth, 720 - gutter * 2) - GRID_GAP) / 2);

  const version = Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '—';
  const build = Constants.nativeBuildVersion ?? (Platform.OS === 'web' ? 'web' : 'dev');

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <AppHeader title="About" showBackButton showMenuButton={false} showNotifications={false} />
      {/* Aura lift: a GPU colour wash that sweeps up the page once on open; tap the logo to
          replay. The background colour makes the snapshot it animates opaque. */}
      <AuraLift duration={1800} style={{ backgroundColor: colors.background }}>
      <AuraOnOpen />
      <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: gutter, paddingTop: gutter }]}>
        {/* App identity */}
        <View style={styles.intro}>
          <AuraLogo />
          <Typography variant="displayTitle">Project Team</Typography>
          <Typography color="textMuted" style={styles.centerText}>
            {ABOUT_LINE}
          </Typography>
        </View>

        <Typography variant="h2">The team</Typography>
        <View style={styles.grid}>
          {DEV_TEAM.map((dev) => (
            <DevCard key={`${dev.name}-${dev.role}`} dev={dev} width={cardWidth} />
          ))}
        </View>

        <Typography variant="h2">App info</Typography>
        <Card>
          <ListRow icon="info-circle" title="Version" trailing={<Typography variant="mono">{version}</Typography>} />
          <ListRow icon="code-slash-outline" title="Build" trailing={<Typography variant="mono">{build}</Typography>} />
          <ListRow
            icon={Platform.OS === 'ios' ? 'logo-apple' : Platform.OS === 'android' ? 'logo-android' : 'globe-outline'}
            title="Platform"
            trailing={<Typography variant="mono">{`${Platform.OS} ${Platform.Version ?? ''}`.trim()}</Typography>}
          />
        </Card>

        <Typography variant="caption" color="textMuted" style={styles.centerText}>
          Made with care by the BGEC dev team
        </Typography>
      </ScrollView>
      </AuraLift>
    </SafeAreaView>
  );
}

/** Plays the aura once, after the screen's slide-in has settled (so the snapshot is final). */
function AuraOnOpen() {
  const { toggle } = useAuraLiftContext();
  useEffect(() => {
    const t = setTimeout(toggle, 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/** BGEC logo; tapping it replays the aura. */
function AuraLogo() {
  const { toggle, isRunning } = useAuraLiftContext();
  return (
    <Pressable
      onPress={toggle}
      disabled={isRunning}
      accessibilityRole="button"
      accessibilityLabel="BGEC logo. Replay animation"
      hitSlop={8}
    >
      <Image
        source={BGEC_LOGO}
        style={{ height: BGEC_LOGO_HEIGHT, width: BGEC_LOGO_HEIGHT * BGEC_LOGO_ASPECT }}
        resizeMode="contain"
      />
    </Pressable>
  );
}

function DevCard({ dev, width }: { dev: Dev; width: number }) {
  const { colors } = useTheme();
  // Every listed key gets an icon; empty URLs are placeholders (shown, but inert).
  const links = (Object.keys(LINK_META) as Array<keyof DevLinks>).filter((k) => dev.links && k in dev.links);

  return (
    <Card style={{ ...styles.devCard, width }}>
      <Avatar name={dev.name} uri={dev.avatarUrl} size={64} />
      <View style={styles.devText}>
        <Typography variant="h4" numberOfLines={1} style={styles.centerText}>
          {dev.name}
        </Typography>
        <Typography variant="caption" color="textMuted" numberOfLines={2} style={styles.centerText}>
          {dev.role}
        </Typography>
      </View>
      {links.length ? (
        <View style={styles.links}>
          {links.map((k) => (
            <Pressable
              key={k}
              onPress={() => {
                const url = dev.links?.[k];
                if (url) void Linking.openURL(url).catch(() => undefined);
              }}
              disabled={!dev.links?.[k]}
              accessibilityRole="link"
              accessibilityLabel={`${dev.name} on ${LINK_META[k].label}`}
              hitSlop={6}
              style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}
            >
              <Icon name={LINK_META[k].icon} size={20} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingBottom: 40, gap: 16, width: '100%', maxWidth: 720, alignSelf: 'center' },
  intro: { alignItems: 'center', gap: 6, paddingVertical: 8 },
  centerText: { textAlign: 'center' },
  // Centred so an odd last card sits in the middle; full rows are unaffected (they fill the width).
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: GRID_GAP },
  devCard: { alignItems: 'center', gap: 10, paddingVertical: 18 },
  devText: { alignItems: 'center', gap: 2, alignSelf: 'stretch' },
  links: { flexDirection: 'row', gap: 4 },
  // Bare icons (no pills), 36px tap area.
  linkBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
});
