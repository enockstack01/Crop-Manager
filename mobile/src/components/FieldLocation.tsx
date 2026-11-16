import React, { useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius } from '../theme/theme';
import { AppText } from './ui';
import { Button } from './Button';
import { Icon } from './Icon';
import { FormApi, NumberField } from './fields';
import { coordinateError, readExactPosition, ROUGH_METRES } from '../lib/fieldLocation';
import { t } from '../i18n';

/**
 * The exact point of a field, asked every time a field is recorded. The phone's position is NEVER taken by itself: the person is asked
 * whether they are standing in the field. If yes, the position is read when they press the button and put in the boxes; if no, they type
 * the field's own coordinates. The two boxes are required either way, and the weather for the field is read at that point.
 */
export function FieldLocation({ f }: { f: FormApi }) {
  const { colors } = useTheme();
  const hasPoint = coordinateError(f.values.latitude, f.values.longitude) === null;
  const [mode, setMode] = useState<'here' | 'typed' | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [accuracy, setAccuracy] = useState<number | null>(null);

  const capture = async () => {
    setBusy(true);
    setMsg('');
    try {
      const p = await readExactPosition();
      f.set('latitude', String(p.lat));
      f.set('longitude', String(p.lon));
      setAccuracy(p.accuracy);
    } catch (e: any) {
      setMsg(t(e?.message || 'Your position could not be found. Try again, or type the coordinates instead.'));
    } finally {
      setBusy(false);
    }
  };

  const choose = (m: 'here' | 'typed') => { setMode(m); setMsg(''); setAccuracy(null); };

  return (
    <View style={{ gap: 10, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.card }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="location-dot" size={14} color={colors.primary} />
        <AppText weight="700" style={{ fontSize: 15, flex: 1 }}>{t('Exact location of the field')} <AppText style={{ color: colors.red }}>*</AppText></AppText>
      </View>
      <AppText style={{ fontSize: 13, lineHeight: 19, color: colors.textLight }}>{t('The weather for this field is read at its exact point, so the coordinates are required.')}</AppText>

      <AppText weight="700" style={{ fontSize: 14 }}>{t('Are you standing in the field right now?')}</AppText>
      <View style={{ gap: 8 }}>
        <Button title="Yes, I am in the field" icon="street-view" kind={mode === 'here' ? 'primary' : 'secondary'} onPress={() => choose('here')} />
        <Button title="No, I will type the coordinates" icon="keyboard" kind={mode === 'typed' ? 'primary' : 'secondary'} onPress={() => choose('typed')} />
      </View>

      {mode === 'here' ? (
        <View style={{ gap: 8 }}>
          <AppText style={{ fontSize: 13, lineHeight: 19, color: colors.textLight }}>{t('Stand in the middle of the field, then press the button. Your position now is saved as the position of the field.')}</AppText>
          <Button title={busy ? 'Finding your position...' : accuracy != null ? 'Measure again' : 'Use my exact position now'} icon="crosshairs" loading={busy} onPress={capture} />
          {accuracy != null ? (
            <AppText style={{ fontSize: 13, lineHeight: 19, color: accuracy > ROUGH_METRES ? colors.red : colors.textLight }}>
              {accuracy > ROUGH_METRES
                ? t('The position is only accurate to about {{m}} metres. Go to open ground and measure again, or type the coordinates.', { m: accuracy })
                : t('Position found, accurate to about {{m}} metres.', { m: accuracy })}
            </AppText>
          ) : null}
        </View>
      ) : null}
      {mode === 'typed' ? (
        <AppText style={{ fontSize: 13, lineHeight: 19, color: colors.textLight }}>{t('Type the exact latitude and longitude of the field, for example -1.950000 and 30.060000. In a maps app, press and hold on the field and copy the two numbers.')}</AppText>
      ) : null}
      {mode === null && hasPoint ? (
        <AppText style={{ fontSize: 13, lineHeight: 19, color: colors.textLight }}>{t('These are the saved coordinates of the field. To change them, answer the question above.')}</AppText>
      ) : null}
      {msg ? <AppText accessibilityRole="alert" style={{ fontSize: 13, lineHeight: 19, color: colors.red }}>{msg}</AppText> : null}

      <NumberField label="Latitude" required {...f.bind('latitude')} placeholder="-1.950000" />
      <NumberField label="Longitude" required {...f.bind('longitude')} placeholder="30.060000" />
    </View>
  );
}
