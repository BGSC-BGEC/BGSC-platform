import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppHeader } from '../../src/components/AppHeader';
import { Button } from '../../src/components/Button';
import { Icon, type IconName } from '../../src/icons/Icon';
import { Typography } from '../../src/typography/Typography';
import { useTheme } from '../../src/theme/ThemeProvider';

const COMING: Array<{ icon: IconName; text: string }> = [
  { icon: 'image', text: 'Share match moments and highlights' },
  { icon: 'users', text: 'Follow friends and find teammates' },
  { icon: 'target', text: 'Challenge friends head-to-head' },
];

/** v2 Social · coming soon (73:2502). The feed is post-MVP; this tab sets expectations. */
export default function SocialScreen() {
  const { colors } = useTheme();
  // ponytail: in-memory only — swap for a real waitlist call when the feed service exists.
  const [notify, setNotify] = useState(false);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader title="Social" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Ghost of a feed post */}
        <View
          style={[styles.ghost, { backgroundColor: colors.surface, borderColor: colors.border }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <View style={styles.ghostRow}>
            <View style={[styles.ghostAvatar, { backgroundColor: colors.surfaceInner }]} />
            <View style={styles.ghostLines}>
              <View style={[styles.ghostLine, { width: 140, backgroundColor: colors.surfaceInner }]} />
              <View style={[styles.ghostLine, { width: 90, backgroundColor: colors.surfaceInner }]} />
            </View>
          </View>
          <View style={[styles.ghostMedia, { backgroundColor: colors.surfaceInner }]} />
        </View>

        <View style={styles.hero}>
          <View style={[styles.heroIcon, { backgroundColor: colors.accentMuted }]}>
            <Icon name="users" size={28} color="primary" />
          </View>
          <Typography variant="displayHero" color="text" align="center" style={styles.title}>
            The campus feed is coming.
          </Typography>
          <Typography variant="body" color="textMuted" align="center">
            Posts, highlights and squads from across BGSC — all in one place. We’re building it now.
          </Typography>
        </View>

        <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {COMING.map((item) => (
            <View key={item.text} style={styles.item}>
              <View style={[styles.itemIcon, { backgroundColor: colors.accentMuted }]}>
                <Icon name={item.icon} size={16} color="primary" />
              </View>
              <Typography variant="body" color="text" style={styles.itemText}>
                {item.text}
              </Typography>
            </View>
          ))}
        </View>

        <Button
          label={notify ? 'You’re on the list' : 'Notify me when it’s live'}
          variant="outline"
          fullWidth
          disabled={notify}
          onPress={() => setNotify(true)}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, gap: 20 },
  ghost: { opacity: 0.55, gap: 12, padding: 16, borderRadius: 24, borderWidth: 1 },
  ghostRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ghostAvatar: { width: 36, height: 36, borderRadius: 18 },
  ghostLines: { flex: 1, gap: 8 },
  ghostLine: { height: 10, borderRadius: 5 },
  ghostMedia: { height: 120, borderRadius: 16 },
  hero: { alignItems: 'center', gap: 12 },
  heroIcon: { padding: 16, borderRadius: 999 },
  title: { fontSize: 28, lineHeight: 48 },
  list: { gap: 12, padding: 16, borderRadius: 20, borderWidth: 1 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemIcon: { padding: 8, borderRadius: 12 },
  itemText: { flex: 1, fontSize: 13 },
});
