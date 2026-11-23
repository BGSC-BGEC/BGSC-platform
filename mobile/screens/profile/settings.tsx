import { useEffect, useState, type ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ProfileLayout } from './profile-layout';
import { usersRepository, type UserSettings } from '../../src/repositories/UsersRepository';
import { notificationsRepository } from '../../src/repositories/NotificationsRepository';
import { stravaRepository } from '../../src/repositories/StravaRepository';
import { useAsyncResource } from '../../src/hooks/useAsyncResource';
import { useTheme } from '../../src/theme/ThemeProvider';
import { FONT_FAMILIES } from '../../src/theme/typography';
import { SegmentedTabs } from '../../src/components/SegmentedTabs';
import { Switch } from '../../src/forms/Switch';
import { Icon } from '../../src/icons/Icon';
import { Typography } from '../../src/typography/Typography';
import { Skeleton } from '../../src/feedback/Skeleton';
import { ErrorState } from '../../src/feedback/ErrorState';
import { usePopup } from '../../src/popups/PopupProvider';
import { getErrorMessage } from '../../src/api/client';

const CATEGORY_LABELS = { announcement: 'Announcements', event: 'Events', challenge: 'Challenges', system: 'System' } as const;

/**
 * Settings as plain grouped lists (bold section name, hairline-divided rows, switch or chevron on
 * the right) — no boxed cards or icon tiles.
 */
export default function Settings() {
  const navigation = useNavigation<any>();
  const { setMode } = useTheme();
  const popup = usePopup();
  const profile = useAsyncResource(() => usersRepository.me(), []);
  const preferences = useAsyncResource(() => notificationsRepository.preferences(), []);
  const strava = useAsyncResource(() => stravaRepository.status(), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const settings = profile.data?.settings;
  useEffect(() => { if (settings?.theme) setMode(settings.theme); }, [settings?.theme, setMode]);
  const change = async (body: Parameters<typeof usersRepository.settings>[0]) => {
    if (busy) return;
    setBusy(true); setError(null);
    try { const updated = await usersRepository.settings(body); profile.setData(updated); } catch (err) { setError(getErrorMessage(err)); } finally { setBusy(false); }
  };
  const category = async (key: 'announcement' | 'event' | 'challenge' | 'system', enabled: boolean) => {
    if (busy) return;
    setBusy(true); setError(null);
    try { preferences.setData(await notificationsRepository.updatePreferences({ in_app: { [key]: enabled } })); } catch (err) { setError(getErrorMessage(err)); } finally { setBusy(false); }
  };
  const openUrl = (url: string) => { void Linking.openURL(url).catch(err => setError(getErrorMessage(err))); };
  const privacyUrl = process.env.EXPO_PUBLIC_PRIVACY_URL;
  const termsUrl = process.env.EXPO_PUBLIC_TERMS_URL;

  return (
    <ProfileLayout
      title="Settings"
      refreshing={profile.refreshing || preferences.refreshing}
      onRefresh={() => { void profile.reload(); void preferences.reload(); void strava.reload(); }}
    >
      {error && <ErrorState message={error} />}
      {profile.error && <ErrorState message={profile.error} onRetry={() => void profile.reload()} />}
      {profile.loading && <Skeleton.Card />}
      {settings && (
        <>
          <Section title="Appearance">
            <SegmentedTabs<UserSettings['theme']>
              tabs={[{ label: 'Light', value: 'light' }, { label: 'Dark', value: 'dark' }, { label: 'System', value: 'system' }]}
              value={settings.theme}
              onChange={theme => { if (!busy) void change({ theme }); }}
            />
            <Typography color="textMuted" style={styles.note}>
              System follows your phone’s appearance.
            </Typography>
          </Section>

          <Section title="Privacy">
            <Row
              title="Public profile"
              caption="Signed-in members can see your full player card."
              last
              trailing={<Switch value={settings.privacy.is_profile_public} disabled={busy} accessibilityLabel="Public profile" onValueChange={value => void change({ privacy: { is_profile_public: value } })} />}
            />
          </Section>

          <Section title="Notifications">
            <Row
              title="Email"
              caption="Email delivery is being set up."
              trailing={<Switch value={settings.notifications.email} disabled={busy} accessibilityLabel="Email notifications" onValueChange={email => void change({ notifications: { email } })} />}
            />
            <Row
              title="WhatsApp"
              caption="Delivery is not available yet."
              last={!preferences.data}
              trailing={<Switch value={settings.notifications.whatsapp} disabled={busy} accessibilityLabel="WhatsApp notifications" onValueChange={whatsapp => void change({ notifications: { whatsapp } })} />}
            />
            {preferences.loading && <Skeleton height={44} />}
            {preferences.error && <ErrorState message={preferences.error} onRetry={() => void preferences.reload()} />}
            {preferences.data && (
              <>
                <Typography color="textMuted" style={styles.subhead}>
                  IN THE APP
                </Typography>
                {(['announcement', 'event', 'challenge', 'system'] as const).map((key, i, all) => (
                  <Row
                    key={key}
                    title={CATEGORY_LABELS[key]}
                    last={i === all.length - 1}
                    trailing={<Switch value={preferences.data!.in_app[key]} disabled={busy} accessibilityLabel={`${CATEGORY_LABELS[key]} notifications`} onValueChange={value => void category(key, value)} />}
                  />
                ))}
              </>
            )}
          </Section>

          <Section title="Integrations">
            <Row
              title="Strava"
              caption={strava.data?.connected ? 'Connected' : 'Connect your activities'}
              value={strava.data?.connected ? 'On' : undefined}
              last
              onPress={() => navigation.navigate('StravaConnect')}
            />
            {strava.error && <ErrorState message={strava.error} onRetry={() => void strava.reload()} />}
          </Section>

          <Section title="Security & data">
            <Row
              title="Change password"
              caption="Use the password reset flow if you signed up with email"
              onPress={() => void popup.info('Change password', 'Password changes are handled via Forgot Password on the sign-in screen, or managed by Google if you use Google Sign-In.')}
            />
            <Row
              title="Download my data"
              caption="Request a copy of your BGSC account data"
              onPress={() => void popup.info('Data export', 'Self-service data export will be enabled in the next release. Contact support via Feedback for an immediate copy.')}
            />
            <Row
              title="Privacy policy"
              caption={privacyUrl ? undefined : 'Policy link has not been published yet.'}
              external
              onPress={privacyUrl ? () => openUrl(privacyUrl) : undefined}
            />
            <Row
              title="Terms"
              caption={termsUrl ? undefined : 'Terms link has not been published yet.'}
              external
              last
              onPress={termsUrl ? () => openUrl(termsUrl) : undefined}
            />
          </Section>

          {/* Set apart at the end, in red, with no chevron decoration competing with it */}
          <Pressable
            onPress={() => navigation.navigate('DeleteAccount')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.danger, pressed && styles.pressed]}
          >
            <Typography color="danger" style={styles.rowTitle}>
              Delete account
            </Typography>
          </Pressable>
        </>
      )}
    </ProfileLayout>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Typography color="text" style={styles.sectionTitle}>
        {title}
      </Typography>
      <View>{children}</View>
    </View>
  );
}

/** A settings row: title and caption on the left; a switch, value or chevron on the right. */
function Row({
  title,
  caption,
  value,
  trailing,
  onPress,
  external = false,
  last = false,
}: {
  title: string;
  caption?: string;
  value?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  external?: boolean;
  last?: boolean;
}) {
  const { colors } = useTheme();
  const body = (
    <>
      <View style={styles.rowText}>
        <Typography color={onPress || trailing ? 'text' : 'textMuted'} style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Typography>
        {caption ? (
          <Typography color="textMuted" style={styles.caption} numberOfLines={2}>
            {caption}
          </Typography>
        ) : null}
      </View>
      {value ? (
        <Typography color="textMuted" style={styles.value}>
          {value}
        </Typography>
      ) : null}
      {trailing ?? (onPress ? <Icon name={external ? 'external-link' : 'chevron-right'} size={external ? 16 : 18} color="textMuted" /> : null)}
    </>
  );
  const rowStyle = [styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }];
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityHint={caption} style={({ pressed }) => [...rowStyle, pressed && styles.pressed]}>
      {body}
    </Pressable>
  ) : (
    <View style={rowStyle}>{body}</View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 6, marginTop: 4 },
  sectionTitle: { fontFamily: FONT_FAMILIES.bodyBold, fontSize: 18, lineHeight: 24, marginBottom: 2 },
  subhead: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 11, lineHeight: 16, letterSpacing: 1, marginTop: 18, marginBottom: 2 },
  note: { fontSize: 13, lineHeight: 18, marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 12 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 16, lineHeight: 21 },
  caption: { fontSize: 13, lineHeight: 18 },
  value: { fontSize: 15 },
  danger: { paddingVertical: 14, marginTop: 8 },
  pressed: { opacity: 0.6 },
});
