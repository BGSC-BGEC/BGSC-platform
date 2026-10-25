import { useState } from 'react';
import { Pressable, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Avatar } from '../../src/components/Avatar';
import { BottomSheet } from '../../src/components/BottomSheet';
import { Button } from '../../src/components/Button';
import { Typography } from '../../src/typography/Typography';
import { ErrorState } from '../../src/feedback/ErrorState';
import { usersRepository } from '../../src/repositories/UsersRepository';
import { getErrorMessage } from '../../src/api/client';

export function ProfilePhoto({ name, uri, onChange }: { name: string; uri?: string | null; onChange: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pick = async (camera: boolean) => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const permission = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error(`Allow ${camera ? 'camera' : 'photo library'} access in your phone settings to choose a photo.`);
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 };
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return;
      const asset = result.assets[0];
      await usersRepository.avatar(asset.uri, asset.mimeType || 'image/jpeg');
      await onChange(); setOpen(false);
    } catch (err) { setError(getErrorMessage(err)); } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true); setError(null);
    try { await usersRepository.removeAvatar(); await onChange(); setOpen(false); } catch (err) { setError(getErrorMessage(err)); } finally { setBusy(false); }
  };
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="Change profile photo" onPress={() => setOpen(true)} style={{ alignItems: 'center', gap: 12 }}><Avatar name={name} uri={uri} size={88} /><Typography variant="button" color="primary">Change photo</Typography></Pressable>
    <BottomSheet visible={open} onClose={() => { if (!busy) setOpen(false); }} dismissOnBackdrop={!busy}>
      <Typography variant="h2">Profile photo</Typography><Typography color="textMuted">Crop your photo to a square. JPG, PNG or WEBP, up to 10 MB.</Typography>
      {error && <ErrorState message={error} />}
      <View style={{ gap: 12 }}><Button label="Choose from library" disabled={busy} loading={busy} onPress={() => void pick(false)} /><Button label="Take a photo" variant="secondary" disabled={busy} onPress={() => void pick(true)} />{uri && <Button label="Remove photo" variant="destructive" disabled={busy} onPress={() => void remove()} />}</View>
    </BottomSheet>
  </>;
}
