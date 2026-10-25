import React, { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { AppHeader } from '../../src/components/AppHeader';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { FilterChips } from '../../src/components/FilterChips';
import { ListRow } from '../../src/components/ListRow';
import { SectionHeader } from '../../src/components/SectionHeader';
import { Checkbox } from '../../src/forms/Checkbox';
import { TextInput } from '../../src/forms/TextInput';
import { TextArea } from '../../src/forms/TextArea';
import { EmptyState } from '../../src/feedback/EmptyState';
import { ErrorState } from '../../src/feedback/ErrorState';
import { SkeletonCard } from '../../src/feedback/Skeleton';
import { Icon } from '../../src/icons/Icon';
import { Typography } from '../../src/typography/Typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useResponsive } from '../../src/responsive/useResponsive';
import { ApiError, getErrorMessage } from '../../src/api/client';
import { resolveMediaUrl } from '../../src/api/config';
import { challengesRepository, type ChallengeDetail as Detail, type Proof } from '../../src/repositories/ChallengesRepository';
import { registrationRepository } from '../../src/repositories/RegistrationRepository';
import { stravaRepository, type StravaActivity } from '../../src/repositories/StravaRepository';
import type { Team } from '../../src/api/types';
import { canSubmit, proofError } from '../../services/challengeLogic';
import { useAuth } from '../../store/auth';
import TargetWatermark from '../../assets/illustrations/challenge-target-watermark.svg';

const date = (value: string | null) => value ? new Date(value).toLocaleString() : 'No fixed deadline';
const messages: Record<string, string> = {
  already_accepted: 'You already accepted this challenge. Refresh to see your progress.', challenge_full: 'This challenge is full.',
  challenge_not_active: 'This challenge is not active.', challenge_not_open_yet: 'This challenge has not opened yet.', challenge_window_closed: 'Acceptance has closed.', challenge_submissions_closed: 'The submission window has closed.', deadline_passed: 'The submission deadline has passed.',
  not_team_captain: 'Your captain must accept for the team.', invalid_team_size: 'Your team needs the required number of members before accepting.',
  member_already_participating: 'A team member is already taking this challenge.', team_required: 'Choose your team before accepting.',
  participation_not_in_progress: 'This challenge can no longer be edited. Refresh to see its status.',
};
const failure = (err: unknown) => err instanceof ApiError && messages[err.code] ? messages[err.code] : getErrorMessage(err);

export default function ChallengeDetail() {
  const { colors } = useTheme();
  const { gutter } = useResponsive();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { key, participationId } = (useRoute<any>().params ?? {}) as { key: string; participationId?: string };
  const [data, setData] = useState<Detail | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamOffset, setTeamOffset] = useState<number | null>(null);
  const [teamName, setTeamName] = useState('');
  const [stravaActivities, setStravaActivities] = useState<StravaActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [percent, setPercent] = useState('0');
  const [progressNotes, setProgressNotes] = useState('');
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [notes, setNotes] = useState('');
  const [proofIssue, setProofIssue] = useState<string | null>(null);
  const version = useRef(0);
  const mutation = useRef(false);
  const c = data?.challenge;
  const p = data?.my_participation;
  const load = useCallback(async (refresh = false) => {
    const request = ++version.current;
    if (refresh) setRefreshing(true); else { setLoading(true); setData(null); }
    setError(null);
    try {
      const [detail, directParticipation] = await Promise.all([
        challengesRepository.get(key),
        participationId ? challengesRepository.participation(participationId).catch(() => null) : Promise.resolve(null),
      ]);
      const resolvedDetail: Detail = directParticipation ? { ...detail, my_participation: directParticipation } : detail;
      const teamRows = resolvedDetail.challenge.teaming.enabled && !resolvedDetail.my_participation ? await challengesRepository.teams(resolvedDetail.challenge._id) : [];
      if (resolvedDetail.my_participation && resolvedDetail.challenge.submission.proof_types.includes('url')) {
        stravaRepository.activities().then(res => {
          if (request === version.current) setStravaActivities(res.activities.slice(0, 5));
        }).catch(() => {});
      }
      if (request !== version.current) return;
      setData(resolvedDetail); setTeams(teamRows); setTeamOffset(teamRows.length === 20 ? 20 : null);
    } catch (err) { if (request === version.current) setError(failure(err)); }
    finally { if (request === version.current) { setLoading(false); setRefreshing(false); } }
  }, [key, participationId]);
  useFocusEffect(useCallback(() => { void load(); return () => { version.current += 1; }; }, [load]));
  useEffect(() => {
    setPercent(String(p?.progress.percent ?? 0)); setProgressNotes(p?.progress.notes ?? '');
    setProofs(p?.submission?.proofs.length ? p.submission.proofs : c?.submission.proof_types.some(t => t === 'url' || t === 'text') ? [{ type: c.submission.proof_types.includes('url') ? 'url' : 'text', value: '' }] : []);
    setNotes(p?.submission?.notes ?? ''); setProofIssue(null);
  }, [p?._id, p?.submission?.version, key, c?._id]);
  const act = async (work: () => Promise<unknown>, success?: string) => {
    if (mutation.current) return;
    mutation.current = true; setBusy(true); setError(null); setNotice(null);
    try { await work(); if (success) setNotice(success); }
    catch (err) { setError(failure(err)); }
    finally { mutation.current = false; setBusy(false); }
  };
  const openResource = async (url: string) => {
    try {
      if (!/^https?:\/\//i.test(url)) throw new Error('This resource does not have a supported web address.');
      await Linking.openURL(url);
    } catch (err) { setError(getErrorMessage(err)); }
  };
  const myTeam = teams.find(t => t.status !== 'disbanded' && t.members.some(m => m.user_id === user?.id));
  const captainTeam = teams.find(t => t.status !== 'disbanded' && t.captain_user_id === user?.id);
  const accepted = async () => {
    if (!c) return;
    await challengesRepository.accept(c._id, c.teaming.enabled ? captainTeam?._id : undefined);
    await load(true);
  };
  const submit = () => {
    if (!c || !p) return;
    const issue = proofError(proofs, c); setProofIssue(issue);
    if (issue) return;
    void act(async () => {
      const participation = await challengesRepository.submit(p._id, proofs.map(proof => ({ ...proof, value: proof.value.trim() })), notes);
      setData(current => current ? { ...current, my_participation: participation } : current);
    }, 'Proof submitted. Your current review status is shown below.');
  };
  const proofOptions = c?.submission.proof_types.filter(t => t === 'url' || t === 'text').map(value => ({ value, label: value === 'url' ? 'Link' : 'Text' })) ?? [];
  const editable = !!p && canSubmit(p);
  const acceptsNow = c?.status === 'active' && (!c.window.opens_at || Date.parse(c.window.opens_at) <= Date.now()) && (!c.window.closes_at || Date.parse(c.window.closes_at) >= Date.now()) && (!c.window.submissions_close_at || Date.parse(c.window.submissions_close_at) >= Date.now());
  const teamReady = !c?.teaming.enabled || !!captainTeam && captainTeam.members.length >= (c.teaming.team_size_min ?? 1) && captainTeam.members.length <= (c.teaming.team_size_max ?? Infinity);
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.screen, { backgroundColor: colors.background }]}>
    <AppHeader title="Challenge" showBackButton showMenuButton={false} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}>
      {loading && <View style={styles.body}><SkeletonCard /><SkeletonCard /></View>}
      {error && <View style={styles.body}><ErrorState message={error} onRetry={() => void load(true)} /></View>}
      {notice && <View style={styles.body}><Typography color="success" accessibilityLiveRegion="polite">{notice}</Typography></View>}
      {!loading && c && <>
        {!p && <View style={styles.hero}>
          {c.cover_media_url ? <Image source={{ uri: resolveMediaUrl(c.cover_media_url) }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <>
            <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none"><Defs><LinearGradient id="challenge-hero" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={colors.warning} stopOpacity={0.85} /><Stop offset="1" stopColor={colors.background} /></LinearGradient></Defs><Rect width="100%" height="100%" fill="url(#challenge-hero)" /></Svg>
            <View style={styles.watermark} pointerEvents="none"><TargetWatermark /></View>
          </>}
          <View style={styles.row}><Badge label={c.difficulty} variant={c.difficulty === 'legend' ? 'primary' : 'warning'} /><Badge label={c.kind} /><Badge label={c.domain} variant="success" /></View>
        </View>}
        <View style={[styles.body, { paddingHorizontal: gutter }]}>
          {p && <View style={styles.row}><Badge label={c.difficulty} variant="info" /><Badge label={p.status.replaceAll('_', ' ')} variant={p.status === 'approved' ? 'success' : p.status === 'rejected' ? 'danger' : 'primary'} /></View>}
          {p?.status === 'approved' && <View style={[styles.resultIcon, { backgroundColor: colors.successMuted }]}><Icon name="check" size={40} color="success" /></View>}
          <Typography variant="h1">{c.title}</Typography>
          <Card variant="inner"><View style={styles.row}><Icon name="coins" color="warning" size={22} /><View style={styles.flex}><Typography variant="mono">+{p?.reward?.points_awarded ?? p?.challenge_snapshot.award_points ?? c.award_points} points</Typography><Typography variant="caption" color="textMuted">{p?.status === 'approved' ? 'Approved reward · check your points history' : 'Awarded on approval'}</Typography></View></View></Card>
          {!p && <>
            <View style={styles.grid}>
              <View style={styles.tile}><Card><Icon name="calendar" color="primary" size={18} /><Typography variant="label" color="textMuted">Acceptance closes</Typography><Typography>{date(c.window.closes_at)}</Typography></Card></View>
              <View style={styles.tile}><Card><Icon name="clock" color="primary" size={18} /><Typography variant="label" color="textMuted">Time limit</Typography><Typography>{c.window.time_limit_minutes ? `${c.window.time_limit_minutes} min after acceptance` : 'No personal time limit'}</Typography></Card></View>
              <View style={styles.tile}><Card><Icon name="map-pin" color="primary" size={18} /><Typography variant="label" color="textMuted">Location</Typography><Typography>{c.location?.name ?? 'Online'}</Typography>{c.location?.details && <Typography variant="caption" color="textMuted">{c.location.details}</Typography>}</Card></View>
              <View style={styles.tile}><Card><Icon name="users" color="primary" size={18} /><Typography variant="label" color="textMuted">Teaming</Typography><Typography>{c.teaming.enabled ? `${c.teaming.team_size_min}–${c.teaming.team_size_max} members` : 'Individual challenge'}</Typography></Card></View>
            </View>
            {c.grants_hall_of_fame && <Badge label="Hall of Fame honour on approval" icon="sparkles" variant="primary" />}
          </>}
          {c.description ? <><SectionHeader title="The brief" /><Typography>{c.description}</Typography></> : <Card><EmptyState icon="lock" title="Brief unlocks when you accept" description="Accept when you are ready. Your personal timer starts immediately." /></Card>}
          {!!c.resources.length && <><SectionHeader title="Resources" /><Card>{c.resources.map((r, index) => <ListRow key={`${r.url}-${index}`} title={r.label} icon="external-link" onPress={() => void openResource(r.url)} />)}</Card></>}
          {!p && c.teaming.enabled && <>
            <SectionHeader title="Your challenge team" />
            <Typography color="textMuted">The captain accepts for the whole team once the roster is ready. Acceptance locks the roster.</Typography>
            {teams.filter(t => t.status !== 'disbanded').map(t => <Card key={t._id}><Card.Header title={t.name} subtitle={`${t.members.length} / ${c.teaming.team_size_max} members · ${t.status}`} /><Typography variant="caption" color="textMuted">{t.members.map(m => m.display_name || 'Player').join(', ')}</Typography>
              {t.invite_code && <Typography selectable variant="mono">Invite code: {t.invite_code}</Typography>}
              {t.captain_user_id === user?.id ? <Badge label="Your team · captain" variant="primary" /> : t.members.some(m => m.user_id === user?.id) ? <Typography color="textMuted">Waiting for your captain to accept.</Typography> : t.status === 'forming' && t.join_policy === 'open' && !myTeam ? <Button label="Join team" variant="outline" disabled={busy} onPress={() => void act(async () => { await registrationRepository.joinTeam(t._id); await load(true); })} /> : null}
            </Card>)}
            {teamOffset != null && <Button label="More teams" variant="outline" disabled={busy} onPress={() => void act(async () => { const next = await challengesRepository.teams(c._id, teamOffset); setTeams(current => [...current, ...next.filter(t => !current.some(old => old._id === t._id))]); setTeamOffset(next.length === 20 ? teamOffset + 20 : null); })} />}
            {!myTeam && <Card><TextInput label="Create an open team" value={teamName} onChangeText={setTeamName} maxLength={60} placeholder="Team name" /><Button label="Create team" variant="outline" disabled={busy || !teamName.trim()} onPress={() => void act(async () => { await challengesRepository.createTeam(c._id, teamName); setTeamName(''); await load(true); })} /></Card>}
          </>}
          {p && <>
            {p.deadline_at && <Typography variant="caption" color="textMuted">Submission deadline: {date(p.deadline_at)}</Typography>}
            {p.status === 'accepted' && <>
              <Card><View style={styles.row}><Svg width={88} height={88} viewBox="0 0 88 88"><Circle cx={44} cy={44} r={37} fill="none" stroke={colors.surfaceInner} strokeWidth={7} /><Circle cx={44} cy={44} r={37} fill="none" stroke={colors.success} strokeWidth={7} strokeDasharray={`${p.progress.percent * 2.3248} 232.48`} rotation={-90} origin="44,44" /></Svg><View style={styles.flex}><Typography variant="mono">{p.progress.percent}% complete</Typography><Typography color="textMuted">Keep a record of your progress.</Typography></View></View></Card>
              {!!p.progress.steps.length && <><SectionHeader title="Checklist" /><Card>{p.progress.steps.map(step => <Checkbox key={step.key} label={step.label} checked={step.done} disabled={busy} onChange={done => void act(async () => { const updated = await challengesRepository.progress(p._id, { steps: p.progress.steps.map(s => s.key === step.key ? { ...s, done } : s) }); setData(current => current ? { ...current, my_participation: updated } : current); })} />)}</Card></>}
              <TextInput label="Progress (%)" value={percent} onChangeText={setPercent} keyboardType="number-pad" maxLength={3} helperText="Enter a whole number from 0 to 100." />
              <TextArea label="Progress notes" value={progressNotes} onChangeText={setProgressNotes} maxLength={2000} showCharCount />
              <Button label="Save progress" variant="outline" disabled={busy || !/^\d{1,3}$/.test(percent) || Number(percent) > 100} onPress={() => void act(async () => { const updated = await challengesRepository.progress(p._id, { percent: Number(percent), notes: progressNotes.trim() || null }); setData(current => current ? { ...current, my_participation: updated } : current); }, 'Progress saved.')} />
            </>}
            {p.status !== 'accepted' && <Card><Card.Header title={p.status === 'approved' ? 'Challenge complete' : p.status === 'rejected' ? 'Changes needed' : p.status === 'expired' ? 'The deadline has passed' : p.status === 'withdrawn' ? 'Participation withdrawn' : 'Under review'} /><Typography>{p.review?.reason ?? (p.status === 'approved' ? 'Your effort has been recognised.' : p.status === 'under_review' || p.status === 'submitted' ? 'Your proof is with the reviewers. You can update it before the deadline.' : 'See the current status above for the outcome.')}</Typography>{p.review?.reviewed_at && <Typography variant="caption" color="textMuted">Reviewed {date(p.review.reviewed_at)}</Typography>}</Card>}
            {p.reward?.hall_of_fame_entry_id && <Button label="See your honour" variant="outline" onPress={() => navigation.navigate('HallOfFameDetail', { slugOrId: p.reward!.hall_of_fame_entry_id })} />}
            {p.submission && <><SectionHeader title="Submitted proof" /><Card>{p.submission.proofs.map((proof, index) => proof.type === 'url' ? <ListRow key={index} icon="external-link" title={proof.name || `Link ${index + 1}`} subtitle={proof.value} onPress={() => void openResource(proof.value)} /> : <Typography key={index}>{proof.value}</Typography>)}{p.submission.notes && <Typography color="textMuted">{p.submission.notes}</Typography>}</Card></>}
            {editable && c.submission.requires_proof && <>
              <SectionHeader title={p.submission ? 'Update proof' : 'Submit proof'} />
              {proofOptions.length === 0 ? <Typography color="textMuted">This challenge has no supported proof format. Please contact the organiser.</Typography> : <>
                {c.submission.proof_types.includes('url') && stravaActivities.length > 0 && (
                  <Card variant="inner">
                    <Typography variant="label" color="textMuted">Attach a synced Strava activity</Typography>
                    {stravaActivities.map((actItem) => {
                      const actUrl = `https://www.strava.com/activities/${actItem._id}`;
                      const attached = proofs.some((pr) => pr.type === 'url' && pr.value === actUrl);
                      return (
                        <ListRow
                          key={actItem._id}
                          icon="activity"
                          title={actItem.name}
                          subtitle={`${actItem.type} · ${(actItem.distance_meters / 1000).toFixed(1)} km · ${new Date(actItem.start_date).toLocaleDateString()}`}
                          trailing={<Badge label={attached ? 'Attached' : 'Use link'} variant={attached ? 'success' : 'primary'} />}
                          onPress={() => {
                            setProofIssue(null);
                            setProofs((current) => {
                              if (current.some((pr) => pr.type === 'url' && pr.value === actUrl)) return current;
                              const emptyIdx = current.findIndex((pr) => !pr.value.trim());
                              if (emptyIdx >= 0) {
                                return current.map((pr, idx) => idx === emptyIdx ? { type: 'url', value: actUrl, name: actItem.name } : pr);
                              }
                              return [...current, { type: 'url', value: actUrl, name: actItem.name }];
                            });
                          }}
                        />
                      );
                    })}
                  </Card>
                )}
                {proofs.map((proof, index) => <Card key={index}><FilterChips options={proofOptions} value={proof.type} onChange={type => { setProofIssue(null); setProofs(current => current.map((item, i) => i === index ? { ...item, type: type as Proof['type'] } : item)); }} />
                  {proof.type === 'url' ? <TextInput label={`Proof link ${index + 1}`} value={proof.value} onChangeText={value => setProofs(current => current.map((item, i) => i === index ? { ...item, value } : item))} keyboardType="url" autoCapitalize="none" autoCorrect={false} placeholder="https://" maxLength={5000} /> : <TextArea label={`Proof ${index + 1}`} value={proof.value} onChangeText={value => setProofs(current => current.map((item, i) => i === index ? { ...item, value } : item))} maxLength={5000} showCharCount />}
                  {proofs.length > 1 && <Button label="Remove proof" variant="ghost" onPress={() => setProofs(current => current.filter((_, i) => i !== index))} />}
                </Card>)}
                {proofs.length < Math.min(c.submission.max_files, 20) && <Button label="Add another proof" variant="outline" onPress={() => setProofs(current => [...current, { type: proofOptions[0].value as Proof['type'], value: '' }])} />}
                <TextArea label="Note for reviewers (optional)" value={notes} onChangeText={setNotes} maxLength={500} showCharCount />
                {proofIssue && <ErrorState title="Check your proof" message={proofIssue} />}
                <Button label={p.submission ? 'Resubmit proof' : 'Submit proof'} loading={busy} onPress={submit} />
                <Button label="View Strava activities" variant="ghost" onPress={() => navigation.navigate('StravaConnect')} />
              </>}
            </>}
            {p.status === 'accepted' && !c.submission.requires_proof && <Typography color="textMuted">No proof upload is required. The organiser will review your participation.</Typography>}
            {p.status === 'approved' && <Button label="View points history" onPress={() => navigation.navigate('Points')} />}
            <Button label="Find another challenge" variant="outline" onPress={() => navigation.navigate('Challenges')} />
          </>}
          {!p && <Typography variant="caption" color="textMuted">{c.counts.accepted} accepted · {c.counts.approved} completed</Typography>}
        </View>
      </>}
    </ScrollView>
    {!loading && c && !p && <View style={[styles.cta, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <Typography variant="caption" color="textMuted">{!acceptsNow ? 'Acceptance is closed or has not opened yet.' : c.window.time_limit_minutes ? `Your ${c.window.time_limit_minutes}-minute timer starts when you accept.` : 'Ready when you are.'}</Typography>
      <Button label={c.teaming.enabled ? 'Accept for team' : 'Accept and start'} fullWidth loading={busy} disabled={!acceptsNow || !teamReady} onPress={() => void act(accepted)} />
    </View>}
  </KeyboardAvoidingView>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, content: { width: '100%', maxWidth: 720, alignSelf: 'center' }, body: { padding: 20, gap: 20 }, hero: { minHeight: 200, justifyContent: 'flex-end', padding: 20, overflow: 'hidden' }, watermark: { position: 'absolute', right: 0, top: -20, transform: [{ rotate: '12deg' }] }, row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 }, flex: { flex: 1, minWidth: 100, gap: 4 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, tile: { flexGrow: 1, flexBasis: '46%', minWidth: 128 }, resultIcon: { alignSelf: 'center', padding: 24, borderRadius: 60 }, cta: { padding: 16, gap: 10, borderTopWidth: 1 } });
