import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { ProfileLayout } from './profile-layout';
import { useAuth } from '../../store/auth';
import { useAsyncResource } from '../../src/hooks/useAsyncResource';
import { usersRepository } from '../../src/repositories/UsersRepository';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { Checkbox } from '../../src/forms/Checkbox';
import { TextInput } from '../../src/forms/TextInput';
import { TextArea } from '../../src/forms/TextArea';
import { Typography } from '../../src/typography/Typography';
import { Skeleton } from '../../src/feedback/Skeleton';
import { ErrorState } from '../../src/feedback/ErrorState';
import { getErrorMessage } from '../../src/api/client';

export default function DeleteAccount() {
  const navigation = useNavigation<any>();
  const { logout } = useAuth();
  const preview = useAsyncResource(() => usersRepository.deletionPreview(), []);
  const [confirm, setConfirm] = useState('');
  const [reason, setReason] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = async () => {
    if (confirm !== 'DELETE' || !preview.data || busy) return;
    setBusy(true); setError(null);
    try { await usersRepository.delete({ confirm: 'DELETE', reason: reason.trim() || undefined, research_consent: consent }); await logout(); } catch (err) { setError(getErrorMessage(err)); } finally { setBusy(false); }
  };
  return <ProfileLayout title="Delete account">
    <Typography variant="h1">Delete your account?</Typography><Typography color="textMuted">Read what happens to your account before confirming.</Typography>
    {preview.loading && <Skeleton.Card />}{preview.error && <ErrorState message={preview.error} onRetry={() => void preview.reload()} />}
    {preview.data && <>
      <Card><Typography variant="h3">Hidden immediately</Typography>{preview.data.hidden_immediately.map(text => <Typography key={text}>• {text}</Typography>)}</Card>
      <Card><Typography variant="h3">Retained indefinitely</Typography>{preview.data.retained_indefinitely.map(text => <Typography key={text}>• {text}</Typography>)}</Card>
      <Card variant="accent"><Typography variant="h3">{preview.data.restore_window_days} days to restore</Typography>{preview.data.notes.map(text => <Typography key={text} variant="bodySmall">{text}</Typography>)}</Card>
      <TextInput label="TYPE DELETE TO CONFIRM" value={confirm} onChangeText={setConfirm} autoCapitalize="characters" autoCorrect={false} disabled={busy} />
      <TextArea label="REASON (OPTIONAL)" value={reason} onChangeText={setReason} maxLength={500} showCharCount disabled={busy} />
      <Checkbox checked={consent} onChange={setConsent} label="I consent to research use of my identifiable data." subtitle="Optional. Your data is retained whether or not you consent." disabled={busy} />
      {error && <ErrorState message={error} />}
      <Button label="Delete my account" variant="destructive" fullWidth disabled={confirm !== 'DELETE'} loading={busy} onPress={() => void remove()} />
      <Button label="Keep my account" variant="outline" fullWidth disabled={busy} onPress={() => navigation.goBack()} />
    </>}
  </ProfileLayout>;
}
