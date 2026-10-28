import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Linking, Platform, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '../../src/components/AppHeader';
import { Avatar } from '../../src/components/Avatar';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { ListRow } from '../../src/components/ListRow';
import { SectionHeader } from '../../src/components/SectionHeader';
import { StatTile } from '../../src/components/StatTile';
import { EmptyState } from '../../src/feedback/EmptyState';
import { ErrorState } from '../../src/feedback/ErrorState';
import { SkeletonCard } from '../../src/feedback/Skeleton';
import { Icon } from '../../src/icons/Icon';
import { Typography } from '../../src/typography/Typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useResponsive } from '../../src/responsive/useResponsive';
import { ApiError, getErrorMessage } from '../../src/api/client';
import { stravaRepository, type StravaPage, type StravaStatus } from '../../src/repositories/StravaRepository';
import { stravaCallback } from '../../services/challengeLogic';
import { useAuth } from '../../store/auth';
import { usePopup } from '../../src/popups/PopupProvider';
import ConnectionDots from '../../assets/illustrations/connection-dots.svg';

let lastHandledCallback: string | null = null;
function stravaError(error: unknown) {
  if (!(error instanceof ApiError)) return getErrorMessage(error);
  if (error.code === 'sync_cooldown') return `Please wait ${Number((error.details as { retry_after?: number } | undefined)?.retry_after ?? 60)} seconds before syncing again.`;
  const messages: Record<string, string> = {
    strava_not_configured: 'Strava connection is not available yet. Please try again later.',
    strava_not_connected: 'Connect your Strava account first.',
    strava_reauth_required: 'Your Strava permission needs to be renewed. Connect again to continue.',
    strava_scope_insufficient: 'Allow activity access on Strava to connect your account.',
    strava_rate_limited: 'Strava is busy. Please try syncing again later.',
  };
  return messages[error.code] ?? error.message;
}

export default function StravaConnect() {
  const { colors } = useTheme();
  const { gutter } = useResponsive();
  const { user } = useAuth();
  const popup = usePopup();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [status, setStatus] = useState<StravaStatus | null>(null);
  const [page, setPage] = useState<StravaPage>({ activities: [], next_cursor: null });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reauthorize, setReauthorize] = useState(false);
  const version = useRef(0);
  const mutation = useRef(false);
  const load = useCallback(async (refresh = false) => {
    const request = ++version.current;
    refresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const connection = await stravaRepository.status();
      const activityPage = connection.connected ? await stravaRepository.activities() : { activities: [], next_cursor: null };
      if (request !== version.current) return;
      setStatus(connection); setPage(activityPage);
    } catch (err) { if (request === version.current) setError(stravaError(err)); }
    finally { if (request === version.current) { setLoading(false); setRefreshing(false); } }
  }, []);
  useFocusEffect(useCallback(() => { void load(); return () => { version.current += 1; }; }, [load]));
  const handleCallback = useCallback(async (url: string) => {
    const callback = stravaCallback(url);
    if (!callback || lastHandledCallback === url) return;
    lastHandledCallback = url;
    navigation.setParams({ callbackUrl: undefined });
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.history.replaceState(null, '', window.location.pathname);
    if ('error' in callback) { setError(callback.error); return; }
    mutation.current = true; setBusy(true); setError(null);
    // Invalidate any status read started before OAuth completed.
    version.current += 1;
    try {
      const connected = await stravaRepository.link(callback);
      setStatus(connected); setReauthorize(false); setNotice('Strava connected. Sync now to import your activities.');
      await load(true);
    } catch (err) { setError(stravaError(err)); }
    finally { mutation.current = false; setBusy(false); setLoading(false); }
  }, [load, navigation]);
  useEffect(() => {
    const subscription = Linking.addEventListener('url', event => { void handleCallback(event.url); });
    void Linking.getInitialURL().then(url => { if (url) void handleCallback(url); }).catch(() => setError('Could not read the Strava return link. Please connect again.'));
    return () => subscription.remove();
  }, [handleCallback]);
  useEffect(() => { if (route.params?.callbackUrl) void handleCallback(route.params.callbackUrl); }, [route.params?.callbackUrl, handleCallback]);
  const connect = async () => {
    if (mutation.current) return;
    mutation.current = true; setBusy(true); setError(null);
    try {
      const { url } = await stravaRepository.connect();
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || !['www.strava.com', 'strava.com'].includes(parsed.hostname)) throw new Error('The Strava authorization address was invalid.');
      await Linking.openURL(url);
      setNotice('Finish authorization in your browser, then return to BGSC.');
    } catch (err) { setError(stravaError(err)); }
    finally { mutation.current = false; setBusy(false); }
  };
  const sync = async () => {
    if (mutation.current) return;
    mutation.current = true; setBusy(true); setError(null);
    try {
      const result = await stravaRepository.sync();
      await load(true);
      setNotice(`${result.synced} activities synced.${result.skipped ? ` ${result.skipped} could not be imported.` : ''}${result.has_more ? ' Strava limited this batch. More history may be available.' : ''}`);
    } catch (err) { setError(stravaError(err)); if (err instanceof ApiError && err.code === 'strava_reauth_required') setReauthorize(true); }
    finally { mutation.current = false; setBusy(false); }
  };
  const disconnect = async () => {
    if (mutation.current || !await popup.confirm({ title: 'Disconnect Strava?', message: 'This removes your Strava connection and synced activity feed from BGSC. You can connect again later.', confirmLabel: 'Disconnect', destructive: true })) return;
    mutation.current = true; setBusy(true); setError(null);
    try {
      await stravaRepository.disconnect();
      version.current += 1;
      setStatus({ connected: false, athlete_id: null, last_synced_at: null }); setPage({ activities: [], next_cursor: null }); setNotice('Strava disconnected.'); setReauthorize(false);
    } catch (err) { setError(stravaError(err)); }
    finally { mutation.current = false; setBusy(false); }
  };
  const loadMore = async () => {
    if (!page.next_cursor || more || busy) return;
    const request = version.current;
    setMore(true); setError(null);
    try {
      const next = await stravaRepository.activities(page.next_cursor);
      if (request === version.current) setPage(current => ({ next_cursor: next.next_cursor, activities: [...current.activities, ...next.activities.filter(a => !current.activities.some(old => old._id === a._id))] }));
    } catch (err) { if (request === version.current) setError(stravaError(err)); }
    finally { setMore(false); }
  };
  const totals = page.activities.reduce((sum, a) => ({ distance: sum.distance + a.distance_meters, seconds: sum.seconds + a.moving_time_seconds }), { distance: 0, seconds: 0 });
  return <View style={[styles.screen, { backgroundColor: colors.background }]}>
    <AppHeader title="Strava" showBackButton showMenuButton={false} />
    <FlatList data={status?.connected && !loading ? page.activities : []} keyExtractor={a => a._id}
      contentContainerStyle={[styles.content, { paddingHorizontal: gutter, paddingTop: gutter, paddingBottom: insets.bottom + 32 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}
      ListHeaderComponent={<View style={styles.stack}>
        {error && <ErrorState message={error} onRetry={() => void load(true)} />}
        {notice && <Typography color="textMuted" accessibilityLiveRegion="polite">{notice}</Typography>}
        {loading ? <><SkeletonCard /><SkeletonCard /></> : status?.connected ? <>
          <Card><View style={styles.row}><Avatar name={user?.fullName ?? user?.username} uri={user?.avatar_url} size={48} /><View style={styles.flex}><Typography variant="button">{user?.fullName ?? user?.username ?? 'Your account'}</Typography><Typography variant="caption" color="textMuted">Strava athlete {status.athlete_id}</Typography></View><Badge label="Connected" variant="success" /></View>{status.last_synced_at && <Typography variant="caption" color="textMuted">Latest imported activity: {new Date(status.last_synced_at).toLocaleString()}</Typography>}</Card>
          <Typography variant="caption" color="textMuted">Totals for the {page.activities.length} loaded activities</Typography>
          <View style={styles.row}><StatTile value={(totals.distance / 1000).toFixed(1)} caption="km" /><StatTile value={`${Math.floor(totals.seconds / 3600)}h ${Math.floor(totals.seconds / 60) % 60}m`} caption="moving" /><StatTile value={page.activities.length} caption="activities" /></View>
          <SectionHeader title="Recent activities" />
          <Button label="Sync now" variant="outline" loading={busy} onPress={() => void sync()} />
          {reauthorize && <Button label="Renew Strava connection" disabled={busy} onPress={() => void connect()} />}
          {!page.activities.length && <EmptyState icon="activity" title="Your next chapter starts here" description="Sync your Strava activities to see them in BGSC." />}
        </> : status && <>
          <View style={styles.hero}><View style={styles.row}><View style={[styles.brand, { backgroundColor: colors.primarySolid }]}><Typography variant="h4" color="primaryText">BGSC</Typography></View><ConnectionDots /><View style={[styles.brand, { backgroundColor: colors.surfaceInner }]}><Icon name="activity" color="primary" size={24} /></View></View><Typography variant="h1" align="center">Connect Strava</Typography><Typography align="center" color="textMuted">Bring your activity history into BGSC and share activity links as challenge proof.</Typography></View>
          <Card><Typography variant="label" color="textMuted">What we read</Typography><ListRow title="Activity type, distance and moving time" subtitle="Your first sync may include historical activities." icon="activity" /><ListRow title="Activity date and privacy" subtitle="Private activities remain hidden from other players’ feeds." icon="calendar" /><ListRow title="No location trace or private notes" subtitle="BGSC does not post activities on your behalf." icon="lock" /></Card>
          <Button label="Connect with Strava" loading={busy} fullWidth onPress={() => void connect()} />
          <Typography variant="caption" align="center" color="textMuted">Opens Strava to authorize access. Disconnect here at any time.</Typography>
        </>}
      </View>}
      renderItem={({ item }) => <Card style={styles.activity}><ListRow icon="activity" title={item.name} subtitle={`${item.type} · ${(item.distance_meters / 1000).toFixed(1)} km · ${Math.floor(item.moving_time_seconds / 60)} min`} onPress={() => { void Linking.openURL(`https://www.strava.com/activities/${encodeURIComponent(item._id)}`).catch(err => setError(getErrorMessage(err))); }} /><View style={styles.row}><Typography variant="caption" color="textMuted">{new Date(item.start_date).toLocaleDateString()}</Typography>{item.is_private && <Badge label="Private" variant="muted" />}</View></Card>}
      ListFooterComponent={!loading && status?.connected ? <View style={styles.footer}>{page.next_cursor && <Button label="Load more activities" variant="outline" loading={more} disabled={busy} onPress={() => void loadMore()} />}<Button label="Disconnect Strava" variant="ghost" labelColor={colors.dangerText} disabled={busy} onPress={() => void disconnect()} /></View> : undefined}
    />
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 20 }, stack: { gap: 20, marginBottom: 16 }, row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }, flex: { flex: 1, minWidth: 100, gap: 4 }, brand: { padding: 16, borderRadius: 20 }, hero: { alignItems: 'center', gap: 24, paddingVertical: 20 }, activity: { marginBottom: 12 }, footer: { gap: 16, paddingTop: 20 } });
