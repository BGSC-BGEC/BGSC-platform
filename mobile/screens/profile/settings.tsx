import { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ProfileLayout } from './profile-layout';
import { usersRepository, type UserSettings } from '../../src/repositories/UsersRepository';
import { notificationsRepository } from '../../src/repositories/NotificationsRepository';
import { stravaRepository } from '../../src/repositories/StravaRepository';
import { useAsyncResource } from '../../src/hooks/useAsyncResource';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Card } from '../../src/components/Card';
import { ListRow } from '../../src/components/ListRow';
import { SegmentedTabs } from '../../src/components/SegmentedTabs';
import { Switch } from '../../src/forms/Switch';
import { Typography } from '../../src/typography/Typography';
import { Skeleton } from '../../src/feedback/Skeleton';
import { ErrorState } from '../../src/feedback/ErrorState';
import { usePopup } from '../../src/popups/PopupProvider';
import { getErrorMessage } from '../../src/api/client';

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
  const privacyUrl = process.env.EXPO_PUBLIC_PRIVACY_URL;
  const termsUrl = process.env.EXPO_PUBLIC_TERMS_URL;
  return <ProfileLayout title="Settings" refreshing={profile.refreshing || preferences.refreshing} onRefresh={() => { void profile.reload(); void preferences.reload(); void strava.reload(); }}>
    {error && <ErrorState message={error} />}{profile.error && <ErrorState message={profile.error} onRetry={() => void profile.reload()} />}{profile.loading && <Skeleton.Card />}
    {settings && <>
      <Typography variant="label" color="textMuted">APPEARANCE</Typography>
      <Card><SegmentedTabs<UserSettings['theme']> tabs={[{ label: 'Light', value: 'light' }, { label: 'Dark', value: 'dark' }, { label: 'System', value: 'system' }]} value={settings.theme} onChange={theme => { if (!busy) void change({ theme }); }} /><Typography variant="caption" color="textMuted">System follows your phone’s appearance.</Typography></Card>
      <Typography variant="label" color="textMuted">PRIVACY</Typography>
      <Card><ListRow title="Public profile" subtitle="Signed-in members can see your full player card." icon="user" trailing={<Switch value={settings.privacy.is_profile_public} disabled={busy} accessibilityLabel="Public profile" onValueChange={value => void change({ privacy: { is_profile_public: value } })} />} /></Card>
      <Typography variant="label" color="textMuted">NOTIFICATIONS</Typography>
      <Card>
        <ListRow title="Email" subtitle="Email delivery is being set up." icon="mail" trailing={<Switch value={settings.notifications.email} disabled={busy} accessibilityLabel="Email notifications" onValueChange={email => void change({ notifications: { email } })} />} />
        <ListRow title="WhatsApp" subtitle="Delivery is not available yet." icon="message" trailing={<Switch value={settings.notifications.whatsapp} disabled={busy} accessibilityLabel="WhatsApp notifications" onValueChange={whatsapp => void change({ notifications: { whatsapp } })} />} />
        {preferences.loading && <Skeleton height={44} />}{preferences.error && <ErrorState message={preferences.error} onRetry={() => void preferences.reload()} />}
        {preferences.data && (['announcement', 'event', 'challenge', 'system'] as const).map(key => <ListRow key={key} title={{ announcement: 'Announcements', event: 'Events', challenge: 'Challenges', system: 'System' }[key]} subtitle="In-app notifications" trailing={<Switch value={preferences.data!.in_app[key]} disabled={busy} accessibilityLabel={`${key} notifications`} onValueChange={value => void category(key, value)} />} />)}
      </Card>
      <Typography variant="label" color="textMuted">INTEGRATIONS</Typography>
      <Card><ListRow title="Strava" subtitle={strava.data?.connected ? 'Connected' : 'Connect your activities'} icon="activity" onPress={() => navigation.navigate('StravaConnect')} />{strava.error && <ErrorState message={strava.error} onRetry={() => void strava.reload()} />}</Card>
      <Typography variant="label" color="textMuted">SECURITY & DATA</Typography>
      <Card>
        <ListRow
          title="Change password"
          subtitle="Use the password reset flow if you signed up with email"
          icon="lock"
          onPress={() => void popup.info('Change password', 'Password changes are handled via Forgot Password on the sign-in screen, or managed by Google if you use Google Sign-In.')}
        />
        <ListRow
          title="Download my data"
          subtitle="Request a copy of your BGSC account data"
          icon="download"
          onPress={() => void popup.info('Data export', 'Self-service data export will be enabled in the next release. Contact support via Feedback for an immediate copy.')}
        />
        <ListRow title="Privacy policy" subtitle={privacyUrl ? undefined : 'Policy link has not been published yet.'} icon="external-link" onPress={privacyUrl ? () => { void Linking.openURL(privacyUrl).catch(err => setError(getErrorMessage(err))); } : undefined} />
        <ListRow title="Terms" subtitle={termsUrl ? undefined : 'Terms link has not been published yet.'} icon="external-link" onPress={termsUrl ? () => { void Linking.openURL(termsUrl).catch(err => setError(getErrorMessage(err))); } : undefined} />
        <ListRow title="Delete account" danger icon="delete" onPress={() => navigation.navigate('DeleteAccount')} />
      </Card>
    </>}
  </ProfileLayout>;
}
