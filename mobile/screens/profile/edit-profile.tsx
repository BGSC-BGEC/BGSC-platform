import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ProfileLayout } from './profile-layout';
import { ProfilePhoto } from './profile-photo';
import { TextInput } from '../../src/forms/TextInput';
import { TextArea } from '../../src/forms/TextArea';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Badge } from '../../src/components/Badge';
import { InterestTile } from '../../src/components/InterestTile';
import { ListRow } from '../../src/components/ListRow';
import { SectionHeader } from '../../src/components/SectionHeader';
import { Typography } from '../../src/typography/Typography';
import { Skeleton } from '../../src/feedback/Skeleton';
import { ErrorState } from '../../src/feedback/ErrorState';
import { usersRepository } from '../../src/repositories/UsersRepository';
import { useAsyncResource } from '../../src/hooks/useAsyncResource';
import { useAuth } from '../../store/auth';
import { normalizePhone } from '../../src/utils/account';
import { getErrorMessage, getFieldErrors } from '../../src/api/client';

const SUGGESTED_INTERESTS = [
  'Football', 'Cricket', 'Basketball', 'Badminton',
  'Volleyball', 'Table Tennis', 'Athletics', 'Fitness',
  'Valorant', 'BGMI', 'FIFA', 'Chess',
  'Web Dev', 'AI / ML',
] as const;

export default function EditProfile() {
  const navigation = useNavigation<any>();
  const { refreshUser } = useAuth();
  const profile = useAsyncResource(() => usersRepository.me(), []);
  const [form, setForm] = useState({ full_name: '', bio: '', phone_number: '', interests: '', instagram: '', linkedin: '', steam_id: '' });
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (profile.data) { const p = profile.data.profile; setForm({ full_name: p.full_name || '', bio: p.bio || '', phone_number: p.phone_number || '', interests: p.interests.join(', '), instagram: p.social_links?.instagram || '', linkedin: p.social_links?.linkedin || '', steam_id: p.social_links?.steam_id || '' }); } }, [profile.data]);
  const set = (field: keyof typeof form) => (value: string) => { setForm(prev => ({ ...prev, [field]: value })); setErrors(prev => ({ ...prev, [field]: '' })); };
  const selectedInterests = useMemo(
    () => [...new Set(form.interests.split(',').map(v => v.trim()).filter(Boolean))],
    [form.interests],
  );
  const toggleInterest = (label: string) => {
    const exists = selectedInterests.some(item => item.toLowerCase() === label.toLowerCase());
    const next = exists
      ? selectedInterests.filter(item => item.toLowerCase() !== label.toLowerCase())
      : [...selectedInterests, label];
    set('interests')(next.join(', '));
  };
  const save = async () => {
    if (busy) return;
    const interests = selectedInterests;
    const invalid: Record<string, string> = {};
    if (!form.full_name.trim()) invalid.full_name = 'Enter your full name.';
    if (interests.length > 30 || interests.some(v => v.length > 40)) invalid.interests = 'Use up to 30 interests, each at most 40 characters.';
    const phone = form.phone_number.trim() ? normalizePhone(form.phone_number) : null;
    if (form.phone_number.trim() && !phone) invalid.phone_number = 'Use an international number, for example +919876543210.';
    setErrors(invalid); if (Object.keys(invalid).length) return;
    setBusy(true); setError(null);
    try { await usersRepository.update({ full_name: form.full_name.trim(), bio: form.bio, phone_number: phone || null, interests, social_links: { instagram: form.instagram.trim() || null, linkedin: form.linkedin.trim() || null, steam_id: form.steam_id.trim() || null } }); await refreshUser(); navigation.goBack(); } catch (err) { setError(getErrorMessage(err)); setErrors(getFieldErrors(err)); } finally { setBusy(false); }
  };
  return <ProfileLayout title="Edit profile">
    {profile.loading && <Skeleton.Card />}{profile.error && <ErrorState message={profile.error} onRetry={() => void profile.reload()} />}
    {profile.data && <>
      <ProfilePhoto name={profile.data.profile.full_name || profile.data.username} uri={profile.data.profile.avatar_url} onChange={async () => { await profile.reload(); await refreshUser(); }} />
      {error && <ErrorState message={error} />}
      <TextInput label="USERNAME" value={profile.data.username} disabled helperText="Your username cannot be changed." />
      <TextInput label="FULL NAME" value={form.full_name} onChangeText={set('full_name')} maxLength={120} error={errors.full_name} autoComplete="name" disabled={busy} />
      <TextArea label="BIO" value={form.bio} onChangeText={set('bio')} maxLength={250} showCharCount disabled={busy} error={errors.bio} />
      <Card>
        <ListRow title="Email" subtitle={profile.data.email} trailing={<Badge label={profile.data.is_email_verified ? 'Verified' : 'Unverified'} variant={profile.data.is_email_verified ? 'success' : 'warning'} />} />
        <ListRow
          title="Phone verification"
          subtitle={profile.data.profile.phone_number || 'Add and verify your phone number'}
          trailing={<Badge label={profile.data.is_phone_verified ? 'Verified' : 'Verify'} variant={profile.data.is_phone_verified ? 'success' : 'warning'} />}
          onPress={() => navigation.navigate('PhoneOtp')}
        />
        <Typography variant="caption" color="textMuted">Email changes are not available yet. Tap phone verification to verify via SMS OTP.</Typography>
      </Card>
      <TextInput label="PHONE" value={form.phone_number} onChangeText={set('phone_number')} keyboardType="phone-pad" maxLength={25} error={errors.phone_number} helperText="Use your country code. Changing your phone resets its verification." disabled={busy} />
      <Button label={profile.data.is_phone_verified ? 'Verify another number' : 'Verify phone'} variant="outline" onPress={() => navigation.navigate('PhoneOtp')} disabled={busy} />
      <SectionHeader title="Interests" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {SUGGESTED_INTERESTS.map((label) => (
          <InterestTile
            key={label}
            label={label}
            selected={selectedInterests.some(item => item.toLowerCase() === label.toLowerCase())}
            onToggle={() => toggleInterest(label)}
          />
        ))}
      </View>
      <TextArea label="CUSTOM INTERESTS" value={form.interests} onChangeText={set('interests')} helperText="Tap tiles above or separate custom interests with commas." error={errors.interests} disabled={busy} />
      <SectionHeader title="Socials" />
      <TextInput label="INSTAGRAM" value={form.instagram} onChangeText={set('instagram')} maxLength={64} autoCapitalize="none" disabled={busy} error={errors['social_links.instagram']} />
      <TextInput label="LINKEDIN" value={form.linkedin} onChangeText={set('linkedin')} maxLength={128} autoCapitalize="none" disabled={busy} error={errors['social_links.linkedin']} />
      <TextInput label="STEAM" value={form.steam_id} onChangeText={set('steam_id')} maxLength={64} autoCapitalize="none" disabled={busy} error={errors['social_links.steam_id']} />
      <View style={{ paddingTop: 8 }}><Button label="Save changes" fullWidth loading={busy} onPress={() => void save()} /></View>
    </>}
  </ProfileLayout>;
}
