import { useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { ProfileLayout } from './profile-layout';
import { useAuth } from '../../store/auth';
import { usersRepository } from '../../src/repositories/UsersRepository';
import { Button } from '../../src/components/Button';
import { TextInput } from '../../src/forms/TextInput';
import { OtpCells } from '../../src/auth/OtpCells';
import { Typography } from '../../src/typography/Typography';
import { ErrorState } from '../../src/feedback/ErrorState';
import { ApiError, getErrorMessage } from '../../src/api/client';
import { normalizePhone } from '../../src/utils/account';

export default function PhoneOtp() {
  const navigation = useNavigation<any>();
  const { user, refreshUser } = useAuth();
  const [phone, setPhone] = useState(user?.contact || '+91');
  const [sentPhone, setSentPhone] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [expires, setExpires] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const seconds = Math.max(0, Math.ceil((expires - now) / 1000));
  const send = async () => {
    const number = normalizePhone(phone);
    if (!number) { setError('Enter your international number, for example +919876543210.'); return; }
    if (busy) return;
    setBusy(true); setError(null);
    try { const result = await usersRepository.sendPhoneOtp(number); setSentPhone(number); setOtp(''); setLocked(false); setExpires(Date.now() + result.expires_in * 1000); } catch (err) { if (err instanceof ApiError && err.code === 'too_many_attempts') setLocked(true); setError(err instanceof ApiError && err.status === 429 ? 'Too many attempts. Wait for the current code to expire before trying again.' : getErrorMessage(err)); } finally { setBusy(false); }
  };
  const verify = async () => {
    if (!sentPhone || otp.length !== 6 || busy || locked) return;
    setBusy(true); setError(null);
    try { await usersRepository.verifyPhoneOtp(sentPhone, otp); await refreshUser(); navigation.goBack(); } catch (err) {
      if (err instanceof ApiError && err.code === 'too_many_attempts') setLocked(true);
      const messages: Record<string, string> = { invalid_otp: 'That code is incorrect. Try again.', otp_expired: 'That code has expired. Request a new one.', no_otp_pending: 'Request a new code to continue.', phone_number_taken: 'That phone number is already verified on another account.', too_many_attempts: 'Too many attempts. Wait for the current code to expire before trying again.' };
      setError(err instanceof ApiError ? messages[err.code] || getErrorMessage(err) : getErrorMessage(err));
    } finally { setBusy(false); }
  };
  return <ProfileLayout title="Verify phone">
    <Typography variant="h1">{sentPhone ? 'Enter the code' : 'Verify your phone'}</Typography>
    {sentPhone ? <>
      <Typography color="textMuted">Sent to {sentPhone}</Typography><Button label="Edit number" variant="ghost" disabled={busy} onPress={() => { setSentPhone(null); setOtp(''); setError(null); }} />
      <OtpCells value={otp} onChange={setOtp} disabled={busy || locked || seconds === 0} />
      <Typography variant="caption" color="textMuted">{seconds ? `Code expires in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : 'Code expired. Request a new code.'}</Typography>
      <Button label="Verify" loading={busy} disabled={otp.length !== 6 || locked || seconds === 0} onPress={() => void verify()} />
      <Button label="Resend code" variant="ghost" disabled={busy || (locked && seconds > 0)} onPress={() => void send()} />
    </> : <><TextInput label="PHONE NUMBER" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" maxLength={25} helperText="Include your country code. Your full phone number stays private." disabled={busy} /><Button label="Send code" loading={busy} onPress={() => void send()} /></>}
    {error && <ErrorState message={error} />}
  </ProfileLayout>;
}
