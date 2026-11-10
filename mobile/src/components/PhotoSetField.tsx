import React, { useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../lib/api';
import { shrinkPhoto } from '../lib/photo';
import { mediaUrl } from '../env';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing } from '../theme/theme';
import { AppText } from './ui';
import { Button } from './Button';
import { Icon } from './Icon';
import { useToast } from './Toast';
import { t } from '../i18n';

/** The copy of each picked photo that stays on the phone, so the on-phone model can read it (key: server URL, or the photo itself). */
const LOCAL = new Map<string, string>();
/** A photo that could not be uploaded (no signal) and so exists only on this phone. */
export const isLocalPhoto = (u: string) => /^(file|content):/i.test(u);
/** The file on this phone for a photo in the list, or null when it is not known (for example after an app restart). */
export const localPhotoFor = (u: string): string | null => LOCAL.get(u) || (isLocalPhoto(u) ? u : null);

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
        // a camera photo is 5 to 15 MB: it is made small on the phone first, so the upload takes seconds and not minutes
        const small = await shrinkPhoto(a);
        const form = new FormData();
        form.append('file', { uri: small.uri, type: small.mimeType, name: `photo-${Date.now()}.jpg` } as any);
        try {
          const { data } = await api.post('/uploads', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 180000 });
          LOCAL.set(data.url, small.uri);
          out.push(data.url);
        } catch (e: any) {
          // no signal: keep the photo on the phone so it can still be checked with the model on the phone
          if (!e?.network) throw e;
          LOCAL.set(small.uri, small.uri);
          out.push(small.uri);
          toast(t('No connection. The photo stays on this phone and can be checked offline.'), 'info');
        }
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
      ? await ImagePicker.launchCameraAsync({ quality: 1, mediaTypes: ['images'] })
      : await ImagePicker.launchImageLibraryAsync({ quality: 1, mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: max - urls.length });
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
      {busy ? <AppText variant="caption" style={{ color: colors.textLight }}>{t('Preparing and sending the photo… this can take a moment on mobile data.')}</AppText> : null}
      <AppText variant="caption" style={{ color: colors.textLight }}>{t('Up to {{n}} photos: the sick leaf, the stem, the whole plant.', { n: max })}</AppText>
    </View>
  );
}
