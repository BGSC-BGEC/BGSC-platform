import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import { FONTS } from '@/core/theme/fonts';
import type { SocialLink, SponsorStats, UserProfile } from '@/core/types';
import { useColors } from '@/hooks/use-colors';
import { formatCompact } from '@/components/profile/PlayerCard';

const PLATFORM_ICONS: Record<SocialLink['platform'], keyof typeof Ionicons.glyphMap> = {
  discord: 'logo-discord',
  instagram: 'logo-instagram',
  linkedin: 'logo-linkedin',
  x: 'logo-twitter',
  twitch: 'logo-twitch',
  youtube: 'logo-youtube',
};

export interface UserInfoCardProps {
  profile: UserProfile | undefined;
  sponsor: SponsorStats | null | undefined;
  loading: boolean;
}

/**
 * User info panel (profile spec §4): tags from friends (hidden when empty),
 * contact rows, social links, and sponsor stats. All sub-sections are
 * optional — absent data hides the row entirely.
 *
 * TODO(Phase 2): tap-to-copy on contact rows needs expo-clipboard (not in the
 * approved package list); Strava/Steam connection cards are Phase 4 (§9.1/§9.2).
 */
export function UserInfoCard({ profile, sponsor, loading }: UserInfoCardProps) {
  const colors = useColors();

  if (loading && !profile) {
    return (
      <GlassCard accessibilityLabel="Loading profile info">
        <SkeletonBlock width="40%" height={14} radius={4} />
        <SkeletonBlock width="80%" height={14} radius={4} />
        <SkeletonBlock width="60%" height={14} radius={4} />
      </GlassCard>
    );
  }
  if (!profile) return null;

  const friendTags = profile.friendTags ?? [];
  const newsletters = profile.newsletterSubscriptions ?? [];
  const socials = profile.socialLinks ?? [];

  return (
    <GlassCard accessibilityLabel="Profile information">
      {friendTags.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Tags from friends</Text>
          <View style={styles.chipRow}>
            {friendTags.map((t) => (
              <View key={t} style={[styles.infoChip, { borderColor: colors.border }]}>
                <Text style={[styles.infoChipText, { color: colors.textMuted }]}>{t}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Contact</Text>
        <Text style={[styles.contactRow, { color: colors.text }]} numberOfLines={1}>
          {profile.email}
        </Text>
        {profile.contact ? (
          <Text style={[styles.contactRow, { color: colors.text }]} numberOfLines={1}>
            {profile.contact}
          </Text>
        ) : null}
        {newsletters.length > 0 ? (
          <Text style={[styles.contactRow, { color: colors.textMuted }]} numberOfLines={2}>
            {newsletters.join(' · ')}
          </Text>
        ) : null}
      </View>

      {socials.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Social links</Text>
          <View style={styles.socialRow}>
            {socials.map((link) => (
              <Pressable
                key={link.platform}
                onPress={() => {
                  void WebBrowser.openBrowserAsync(link.url);
                }}
                accessibilityRole="link"
                accessibilityLabel={`Open ${link.platform} profile`}
                style={({ pressed }) => [
                  styles.socialButton,
                  { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Ionicons name={PLATFORM_ICONS[link.platform]} size={20} color={colors.text} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <SponsorBlock sponsor={sponsor} loading={loading} />
    </GlassCard>
  );
}

function SponsorBlock({
  sponsor,
  loading,
}: {
  sponsor: SponsorStats | null | undefined;
  loading: boolean;
}) {
  const colors = useColors();

  if (loading && sponsor === undefined) {
    return (
      <View style={styles.section}>
        <SkeletonBlock width={140} height={16} radius={4} />
        <View style={styles.sponsorStatsRow}>
          {[1, 2, 3].map((i) => (
            <SkeletonBlock key={i} height={56} radius={12} style={{ flex: 1 }} />
          ))}
        </View>
      </View>
    );
  }

  if (sponsor === null || sponsor === undefined) {
    return (
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Sponsor</Text>
        <Text style={[styles.contactRow, { color: colors.textMuted }]}>
          Not affiliated with a sponsor yet
        </Text>
      </View>
    );
  }

  const statBlocks = [
    { label: 'Rank', value: `#${sponsor.rank}` },
    { label: 'Fans', value: formatCompact(sponsor.fansContributed) },
    { label: 'Events Won', value: formatCompact(sponsor.eventsWon) },
  ];

  return (
    <View style={styles.section}>
      <View style={styles.sponsorHeader}>
        {sponsor.sponsorLogoUrl ? (
          <Image
            source={{ uri: sponsor.sponsorLogoUrl }}
            style={styles.sponsorLogo}
            contentFit="contain"
            accessibilityLabel={`${sponsor.sponsorName} logo`}
          />
        ) : (
          <Ionicons name="trophy-outline" size={18} color={colors.accent} />
        )}
        <Text style={[styles.sponsorName, { color: colors.text }]} numberOfLines={1}>
          {sponsor.sponsorName}
        </Text>
      </View>
      <View style={styles.sponsorStatsRow}>
        {statBlocks.map((b) => (
          <View key={b.label} style={[styles.sponsorStat, { backgroundColor: colors.surfaceMuted }]}>
            <Text
              style={[styles.sponsorStatValue, { color: colors.text }]}
              adjustsFontSizeToFit
              numberOfLines={1}
            >
              {b.value}
            </Text>
            <Text style={[styles.sponsorStatLabel, { color: colors.textMuted }]}>{b.label}</Text>
          </View>
        ))}
      </View>
      <Text style={[styles.affiliates, { color: colors.textMuted }]}>
        Ranked among {sponsor.totalAffiliates} affiliated {sponsor.totalAffiliates === 1 ? 'player' : 'players'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingVertical: 8,
  },
  sectionLabel: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  infoChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  infoChipText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
  },
  contactRow: {
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 22,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 10,
  },
  socialButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sponsorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sponsorLogo: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  sponsorName: {
    fontFamily: FONTS.semibold,
    fontSize: 15,
    flexShrink: 1,
  },
  sponsorStatsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sponsorStat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 2,
  },
  sponsorStatValue: {
    fontFamily: FONTS.hero,
    fontSize: 24,
    fontVariant: ['tabular-nums'],
  },
  sponsorStatLabel: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  affiliates: {
    fontFamily: FONTS.body,
    fontSize: 12,
    marginTop: 8,
  },
});
