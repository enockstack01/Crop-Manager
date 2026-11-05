import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../theme/ThemeProvider';
import { radius } from '../theme/theme';
import { AppText, PageHeader, Screen } from '../components/ui';
import { Button } from '../components/Button';
import { SelectField } from '../components/fields';
import { ErrorNote, OfflineResult } from '../features/ai/AiBits';
import { offlineCrops } from '../ml/crops';
import { t } from '../i18n';

/**
 * Scan a leaf on this phone: the crop-disease model that ships inside the app reads the photo and the screen shows
 * what it found (the three most likely matches, the plant part, general advice for that type of problem). It works
 * with no internet, never sends the photo anywhere and never asks the assistant to write a report; for the full
 * report there is "Diagnose with AI" in Crop Scouting.
 */
export function ScanScreen() {
  const { colors } = useTheme();
  const [uri, setUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [crop, setCrop] = useState('');
  const crops = useMemo(() => offlineCrops(), []);

  const run = async (photo: string, forCrop = crop) => {
    setBusy(true);
    setError('');
    setResult(null);
    setUri(photo);
    try {
      // loaded only when needed: the model code is large and does not run in Expo Go
      const { diagnoseOffline } = await import('../ml/offline');
      setResult(await diagnoseOffline(photo, { crop: forCrop }));
    } catch {
      setError(t('This phone could not run the scan. Close other apps and try again.'));
    } finally {
      setBusy(false);
    }
  };

  // choosing or changing the crop re-reads the same photo, no new photo needed
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (uri) run(uri, crop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crop]);

  const pick = async (fromCamera: boolean) => {
    const perm = fromCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError(t('Permission denied'));
      return;
    }
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.7, mediaTypes: ['images'] })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'] });
    if (res.canceled || !res.assets?.length) return;
    await run(res.assets[0].uri);
  };

  return (
    <Screen>
      <PageHeader title="Scan a leaf" subtitle="Take or choose a photo of one leaf. The scan runs on this phone, works without internet and shows what it finds." />
      <View style={{ marginBottom: 12 }}>
        <SelectField label="Which crop? (optional)" value={crop} onChangeValue={setCrop} options={crops} placeholder="Any crop" />
      </View>
      {uri ? (
        <Image source={{ uri }} resizeMode="cover" style={{ width: '100%', height: 220, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, marginBottom: 12 }} />
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button title="Take photo" icon="camera" loading={busy} onPress={() => pick(true)} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Choose photo" icon="image" kind="secondary" loading={busy} onPress={() => pick(false)} />
        </View>
      </View>
      {busy ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16 }}>
          <ActivityIndicator color={colors.primary} />
          <AppText variant="subtitle" style={{ fontSize: 13 }}>{t('Checking the photo on this phone…')}</AppText>
        </View>
      ) : null}
      <ErrorNote message={error} />
      {result && !busy ? <OfflineResult result={result} scan /> : null}
      <AppText variant="caption" style={{ marginTop: 16 }}>
        {t('A screening aid, not a diagnosis. For a full written report, add a scouting record and use the AI diagnosis button.')}
      </AppText>
    </Screen>
  );
}
