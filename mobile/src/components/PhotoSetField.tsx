import React, { useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../lib/api';
import { mediaUrl } from '../env';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing } from '../theme/theme';
import { AppText } from './ui';
import { Button } from './Button';
import { Icon } from './Icon';
import { useToast } from './Toast';
import { t } from '../i18n';

/**
 * Up to `max` photos of a plant (the sick leaf, the stem, the whole plant): taken straight with the camera
 * or picked from the gallery. Each is uploaded and the list of URLs is returned through `onChange`.
 * `autoCamera` opens the camera as soon as the field appears.
 */
export function PhotoSetField({
  label = 'Photos of the affected plant',
  urls,
  onChange,
  max = 3,
  autoCamera = false,
}: {
  label?: string;
  urls: string[];
  onChange: (urls: string[]) => void;
  max?: number;
  autoCamera?: boolean;
}) {
  const { colors } = useTheme();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const full = urls.length >= max;

  const upload = async (assets: ImagePicker.ImagePickerAsset[]) => {
    setBusy(true);
    try {
      const out: string[] = [];
      for (const a of assets.slice(0, max - urls.length)) {
        const form = new FormData();
        form.append('file', { uri: a.uri, type: a.mimeType || 'image/jpeg', name: a.fileName || `photo-${Date.now()}.jpg` } as any);
        const { data } = await api.post('/uploads', form, { headers: { 'Content-Type': 'multipart/form-data' } });
        out.push(data.url);
      }
      onChange([...urls, ...out]);
    } catch (e: any) {
      toast(e?.message || t('Upload failed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const pick = async (fromCamera: boolean) => {
    const perm = fromCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast(t('Permission denied'), 'error');
      return;
    }
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.7, mediaTypes: ['images'] })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: max - urls.length });
    if (res.canceled || !res.assets?.length) return;
    await upload(res.assets);
  };

  useEffect(() => {
    if (autoCamera) pick(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ gap: 8 }}>
      <AppText variant="label">{t(label)}</AppText>
      {urls.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {urls.map((u) => (
            <View key={u} style={{ width: 96, height: 96 }}>
              <Image source={{ uri: mediaUrl(u) }} style={{ width: 96, height: 96, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }} resizeMode="cover" />
              <Pressable
                onPress={() => onChange(urls.filter((x) => x !== u))}
                accessibilityRole="button"
                accessibilityLabel={t('Remove')}
                style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name="xmark" size={11} color="#fff" />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      {!full ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button title="Take photo" icon="camera" loading={busy} onPress={() => pick(true)} style={{ flex: 1 }} />
          <Button title="Choose photo" kind="secondary" icon="image" loading={busy} onPress={() => pick(false)} style={{ flex: 1 }} />
        </View>
      ) : null}
      <AppText variant="caption" style={{ color: colors.textLight }}>{t('Up to {{n}} photos: the sick leaf, the stem, the whole plant.', { n: max })}</AppText>
    </View>
  );
}
