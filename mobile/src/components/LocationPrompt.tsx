import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme/ThemeProvider';
import { radius } from '../theme/theme';
import { openLocationSettings, useDeviceLocation, LocationState } from '../lib/location';
import { Icon } from './Icon';
import { Button } from './Button';
import { Sheet } from './Sheet';
import { AppText } from './ui';
import { t } from '../i18n';

const ASKED_KEY = 'cropmanager-location-asked';

const COPY: Record<'ask' | 'blocked' | 'off', { title: string; text: string; action: string; icon: string }> = {
  ask: {
    title: 'Turn on your location',
    text: 'Allow location to get the weather, rain forecast and farm advice for exactly where you are.',
    action: 'Turn on location', icon: 'location-crosshairs',
  },
  off: {
    title: 'Location is switched off',
    text: 'Switch location on in your phone to get the weather and advice for exactly where you are.',
    action: 'Turn on location', icon: 'location-dot',
  },
  blocked: {
    title: 'Location is blocked',
    text: 'Location access was refused. Open your phone settings and allow location for CropManager to get precise weather.',
    action: 'Open settings', icon: 'location-dot',
  },
};

/** What the button does for a given state: ask / switch on, or send the person to the phone's settings. */
function useAction(state: LocationState, request: () => Promise<void>) {
  return state === 'blocked' ? () => openLocationSettings() : request;
}

/** An inline card asking the person to turn location on. Renders nothing once location is on. */
export function LocationCard() {
  const { colors } = useTheme();
  const { state, busy, request } = useDeviceLocation();
  const act = useAction(state, request);
  if (state === 'unknown' || state === 'on') return null;
  const c = COPY[state];
  return (
    <View style={{ flexDirection: 'row', gap: 12, padding: 14, marginBottom: 16, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={c.icon} size={17} color={colors.primary} />
      </View>
      <View style={{ flex: 1, gap: 10 }}>
        <View>
          <AppText weight="700" style={{ fontSize: 15 }}>{t(c.title)}</AppText>
          <AppText variant="subtitle" style={{ fontSize: 13, marginTop: 2, lineHeight: 19 }}>{t(c.text)}</AppText>
        </View>
        <Button title={c.action} size="sm" icon="location-crosshairs" loading={busy} onPress={act} style={{ alignSelf: 'flex-start' }} />
      </View>
    </View>
  );
}

/**
 * Shown once, the first time the farmer reaches the home page with location off: explains why
 * location helps, then asks. "Not now" is remembered, and the weather page keeps a card for later.
 */
export function LocationAskSheet() {
  const { state, busy, request } = useDeviceLocation();
  const [seen, setSeen] = useState(true); // assume seen until storage says otherwise, so it never flashes
  const act = useAction(state, request);

  useEffect(() => {
    AsyncStorage.getItem(ASKED_KEY).then((v) => setSeen(!!v)).catch(() => setSeen(true));
  }, []);

  const close = () => {
    setSeen(true);
    AsyncStorage.setItem(ASKED_KEY, '1').catch(() => {});
  };
  const visible = !seen && (state === 'ask' || state === 'off' || state === 'blocked');
  const c = COPY[state === 'ask' || state === 'off' || state === 'blocked' ? state : 'ask'];

  return (
    <Sheet visible={visible} onClose={close} title={c.title} size="sm">
      <View style={{ alignItems: 'center', gap: 14, paddingVertical: 8 }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={c.icon} size={30} color="#1B5E20" />
        </View>
        <AppText style={{ fontSize: 15, lineHeight: 22, textAlign: 'center' }}>{t(c.text)}</AppText>
        <AppText variant="subtitle" style={{ fontSize: 13, textAlign: 'center' }}>{t('Your position is used only to look up the weather and is not stored.')}</AppText>
        <View style={{ alignSelf: 'stretch', gap: 8 }}>
          <Button title={c.action} icon="location-crosshairs" loading={busy} onPress={async () => { await act(); close(); }} />
          <Button title="Not now" kind="ghost" onPress={close} />
        </View>
      </View>
    </Sheet>
  );
}
