import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { flushOutbox, useOfflineState } from '../lib/offline';
import { ff } from '../theme/theme';
import { t } from '../i18n';
import { Icon } from './Icon';

/**
 * A small pill at the bottom of the screen: "Offline — N changes saved on this phone",
 * "Syncing N changes…", or "N changes waiting to sync" (tap to retry). Hidden when
 * online with nothing to sync.
 */
export function OfflineBanner() {
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const { online, pending, syncing } = useOfflineState();
  if (online && !pending) return null;

  const text = !online
    ? pending
      ? t('Offline — {{count}} change(s) saved on this phone', { count: pending })
      : t('Offline — showing saved data')
    : syncing
      ? t('Syncing {{count}} change(s)…', { count: pending })
      : t('{{count}} change(s) waiting to sync — tap to retry', { count: pending });

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 12, alignItems: 'center' }}>
      <Pressable
        onPress={() => online && flushOutbox(qc)}
        accessibilityRole={online ? 'button' : 'text'}
        accessibilityLabel={text}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '92%',
          paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999,
          backgroundColor: online ? '#1565C0' : '#37474F',
          shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4,
        }}
      >
        <Icon name={online ? (syncing ? 'arrows-rotate' : 'cloud-arrow-up') : 'cloud-off-outline'} size={13} color="#fff" />
        <Text style={{ color: '#fff', fontSize: 12.5, fontFamily: ff('600') }} numberOfLines={2}>{text}</Text>
      </Pressable>
    </View>
  );
}
