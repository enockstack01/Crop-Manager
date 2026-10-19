import React, { useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { api } from '../lib/api';
import { pendingJoin } from '../lib/pendingJoin';
import { REASONS, reasonText, useFarmerOrgMutations } from '../lib/orgApi';
import { useTheme } from '../theme/ThemeProvider';
import { radius } from '../theme/theme';
import { AppText, Screen } from '../components/ui';
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';
import { t } from '../i18n';

const ICON = require('../../assets/brand/cropmanager-icon.png');

/**
 * Shown to a signed-in farmer who opened an organization referral link: which organization invited them,
 * what joining shares, and the consent. The server checks the link again when they join.
 */
export function JoinScreen({ token, onDone }: { token: string; onDone: () => void }) {
  const { colors } = useTheme();
  const { join } = useFarmerOrgMutations();
  const [state, setState] = useState<{ loading?: boolean; info?: any; code?: string; message?: string; unreachable?: boolean }>({ loading: true });
  const [attempt, setAttempt] = useState(0);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    api.get(`/join/${token}`)
      .then((r) => live && setState({ info: r.data }))
      .catch((err: any) => {
        if (!live) return;
        // a server that cannot be reached is not a bad link: keep the link and offer a retry
        if (err.network || (err.status || 0) >= 500) setState({ unreachable: true });
        else setState({ code: err.code || 'invalid', message: err.message });
      });
    return () => { live = false; };
  }, [token, attempt]);

  const finish = async () => { await pendingJoin.clear(); onDone(); };
  const go = async () => {
    setError('');
    try {
      await join.mutateAsync(token);
      await finish();
    } catch (err) {
      setError(reasonText(err));
      await pendingJoin.clear();
    }
  };
  const org = state.info?.organization;

  return (
    <Screen>
      <View style={{ gap: 14, maxWidth: 520, width: '100%', alignSelf: 'center', paddingTop: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Image source={ICON} style={{ width: 44, height: 44, borderRadius: 10 }} />
          <View>
            <AppText weight="700" style={{ fontSize: 18, color: colors.primaryDark }}>CropManager</AppText>
            <AppText style={{ fontSize: 11, color: colors.textLight }}>by Agricoders</AppText>
          </View>
        </View>

        {state.loading ? <AppText variant="subtitle">{t('Checking your invitation…')}</AppText> : null}

        {state.unreachable ? (
          <>
            <AppText weight="700" style={{ fontSize: 22, color: colors.primaryDark }}>{t('Could not reach CropManager')}</AppText>
            <AppText variant="subtitle" style={{ fontSize: 13 }}>{t('Check your internet connection and try again. Your invitation link is still valid.')}</AppText>
            <Button title="Try again" icon="rotate" onPress={() => { setState({ loading: true }); setAttempt((a) => a + 1); }} />
          </>
        ) : null}

        {state.code ? (
          <>
            <AppText weight="700" style={{ fontSize: 22, color: colors.primaryDark }}>{t('This link cannot be used')}</AppText>
            <View style={{ borderWidth: 1, borderColor: colors.red, borderRadius: radius.md, padding: 12 }}>
              <AppText style={{ fontSize: 13, color: colors.red }}>{t(REASONS[state.code] || state.message || REASONS.invalid)}</AppText>
            </View>
            <AppText variant="subtitle" style={{ fontSize: 13 }}>{t('Ask your organization for a new link, or continue as an independent farmer.')}</AppText>
            <Button title="Continue to CropManager" onPress={finish} />
          </>
        ) : null}

        {org ? (
          <>
            <AppText weight="700" style={{ fontSize: 22, lineHeight: 28, color: colors.primaryDark }}>{t('You are invited to join {{name}}', { name: org.name })}</AppText>
            <AppText variant="subtitle" style={{ fontSize: 13 }}>{[t(org.type), org.district, org.country].filter(Boolean).join(' · ')}</AppText>
            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, flexDirection: 'row', gap: 10 }}>
              <Icon name="shield-halved" size={14} color={colors.primary} />
              <AppText style={{ flex: 1, fontSize: 13, lineHeight: 20 }}>
                {t('Joining shares a summary of your crop activity (farms, crops, planting, harvests and field activity) with this organization. They cannot edit your records, and you can leave at any time in Settings.')}
              </AppText>
            </View>
            <Pressable onPress={() => setConsent((c) => !c)} accessibilityRole="checkbox" accessibilityState={{ checked: consent }} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <View style={{ width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: colors.primary, backgroundColor: consent ? colors.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                {consent ? <Icon name="check" size={12} color="#FFFFFF" /> : null}
              </View>
              <AppText style={{ flex: 1, fontSize: 13, lineHeight: 20 }}>{t('I agree to share a summary of my crop activity with {{name}}.', { name: org.name })}</AppText>
            </Pressable>
            {error ? (
              <View style={{ borderWidth: 1, borderColor: colors.red, borderRadius: radius.md, padding: 12 }}>
                <AppText style={{ fontSize: 13, color: colors.red }}>{error}</AppText>
              </View>
            ) : null}
            <Button title={t('Join {{name}}', { name: org.name })} icon="check" loading={join.isPending} disabled={!consent} onPress={go} />
            <Button title="Not now" kind="ghost" onPress={finish} />
          </>
        ) : null}
      </View>
    </Screen>
  );
}
