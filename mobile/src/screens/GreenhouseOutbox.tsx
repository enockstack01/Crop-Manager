import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { onlineManager } from '@tanstack/react-query';
import { useTheme } from '../theme/ThemeProvider';
import { radius } from '../theme/theme';
import { AppText, Badge } from '../components/ui';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { useConfirm } from '../components/Confirm';
import { useToast } from '../components/Toast';
import { formatDate } from '../lib/format';
import { useGhOutbox } from '../lib/ghOutboxRuntime';
import { t } from '../i18n';

/**
 * Fruit counts recorded without a signal and not sent yet. Shown at the top of the Greenhouse screen only while something is waiting:
 * how many, a button to send now, and a list where a count the server refused can be read, tried again or deleted.
 */
export function OutboxBanner() {
  const { colors } = useTheme();
  const toast = useToast();
  const confirm = useConfirm();
  const { items, waiting, failed, sending, sendNow, remove, retry } = useGhOutbox();
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  const online = onlineManager.isOnline();
  const tint = failed ? colors.orange : colors.primary;

  const send = async () => {
    const r = await sendNow();
    if (r.sent) toast(t('{{n}} counts sent', { n: r.sent }));
    else if (r.stopped === 'network') toast(t('Still no connection. Your counts stay on the phone.'), 'info');
    else if (r.stopped === 'auth') toast(t('Please sign in again, then the counts are sent.'), 'info');
    else if (r.stopped === 'server') toast(t('The server is busy. It will be tried again in a minute.'), 'info');
  };

  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={t('Counts waiting to be sent')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: tint, backgroundColor: colors.card, marginBottom: 12 }}>
        <Icon name={sending ? 'rotate' : 'cloud-arrow-up'} size={18} color={tint} />
        <View style={{ flex: 1 }}>
          <AppText weight="700" style={{ fontSize: 14 }}>
            {waiting ? t('{{n}} counts waiting to be sent', { n: waiting }) : t('Counts need your attention')}
          </AppText>
          <AppText style={{ fontSize: 12, color: colors.textLight }}>
            {failed ? t('{{n}} could not be saved. Tap to read why.', { n: failed }) : online ? (sending ? t('Sending...') : t('They are sent by themselves.')) : t('No connection. They are sent when you are back online.')}
          </AppText>
        </View>
        {waiting && online ? <Button title="Send now" size="sm" kind="secondary" loading={sending} onPress={send} /> : null}
      </Pressable>

      <Sheet visible={open} onClose={() => setOpen(false)} title={t('Counts on this phone')}>
        <View style={{ gap: 12 }}>
          {items.map((q) => (
            <View key={q.id} style={{ gap: 6, padding: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: q.status === 'failed' ? colors.red : colors.border, backgroundColor: colors.card }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <AppText weight="700" style={{ fontSize: 15, flex: 1 }}>{q.place || t('Fruit count')}</AppText>
                <Badge label={q.status === 'failed' ? t('Needs attention') : t('Waiting')} tone={q.status === 'failed' ? 'danger' : 'info'} />
              </View>
              <AppText style={{ fontSize: 13, color: colors.textLight }}>{q.body.recorded_count} {t('fruit')} · {q.photos.length} {t('photos')} · {formatDate(q.recorded_at.slice(0, 10))}</AppText>
              {q.status === 'failed' ? <AppText style={{ fontSize: 13, color: colors.red }}>{q.error}</AppText> : null}
              <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
                {q.status === 'failed' ? <Button title="Try again" size="sm" kind="secondary" onPress={() => retry(q.id)} /> : null}
                <Button
                  title="Delete" size="sm" kind="secondary"
                  onPress={async () => { if (await confirm(t('Delete this count from the phone? It has not been saved yet and will be lost.'), { confirmLabel: 'Delete' })) await remove(q.id); }}
                />
              </View>
            </View>
          ))}
          {!items.length ? <AppText>{t('Nothing is waiting.')}</AppText> : null}
        </View>
      </Sheet>
    </>
  );
}
