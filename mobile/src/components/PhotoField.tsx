import React, { useState } from 'react';
import { Image, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../lib/api';
import { mediaUrl } from '../env';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing } from '../theme/theme';
import { AppText } from './ui';
import { Button } from './Button';
import { useToast } from './Toast';

/**
 * Field-scouting photo picker. Uploads to POST /api/uploads (multipart)
 * and stores the returned relative `/uploads/...` URL — same contract as the web app.
 */
export function PhotoField({
  label = 'Photo',
  value,
  onChange,
}: {
  label?: string;
  value?: string | null;
  onChange: (url: string | null) => void;
}) {
  const { colors } = useTheme();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const upload = async (uri: string, mime: string, name: string) => {
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', { uri, type: mime, name } as any);
      const { data } = await api.post('/uploads', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onChange(data.url);
      toast('Photo uploaded');
    } catch (e: any) {
      toast(e?.message || 'Upload failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const pick = async (fromCamera: boolean) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast('Permission denied', 'error');
      return;
    }
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.6, mediaTypes: ['images'] })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.6, mediaTypes: ['images'] });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    const name = a.fileName || `photo-${Date.now()}.jpg`;
    await upload(a.uri, a.mimeType || 'image/jpeg', name);
  };

  return (
    <View style={{ gap: 6 }}>
      <AppText variant="label">{label}</AppText>
      {value ? (
        <View style={{ gap: spacing.sm }}>
          <Image
            source={{ uri: mediaUrl(value) }}
            style={{ width: '100%', height: 200, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }}
            resizeMode="cover"
          />
          <Button title="Remove photo" kind="secondary" size="sm" icon="trash-can-outline" onPress={() => onChange(null)} />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button title="Camera" kind="secondary" size="sm" icon="camera" loading={busy} onPress={() => pick(true)} style={{ flex: 1 }} />
          <Button title="Gallery" kind="secondary" size="sm" icon="image-multiple" loading={busy} onPress={() => pick(false)} style={{ flex: 1 }} />
        </View>
      )}
    </View>
  );
}
