import React, { useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius } from '../../theme/theme';
import { AppText, Screen } from '../../components/ui';
import { Button } from '../../components/Button';
import { SelectField, TextField } from '../../components/fields';
import { reasonText, useFarmerOrgMutations } from '../../lib/orgApi';
import { t } from '../../i18n';

const TYPES = ['Cooperative', 'NGO', 'Company', 'Government', 'Other'];

/** Organization sign-up on the phone: the person is already signed in; an administrator approves the organization. */
export function OrgRegisterScreen({ email, onBack }: { email?: string; onBack: () => void }) {
  const { colors } = useTheme();
  const { register } = useFarmerOrgMutations();
  const [v, setV] = useState({ name: '', type: 'Cooperative', country: 'Rwanda', district: '', sector: '', contact_email: '', contact_phone: '', full_name: '', phone: '' });
  const [error, setError] = useState('');
  const set = (k: string) => (val: string) => setV((x) => ({ ...x, [k]: val }));

  const submit = async () => {
    setError('');
    try {
      await register.mutateAsync({ ...v, contact_email: v.contact_email || email || '' });
    } catch (err) {
      setError(reasonText(err));
    }
  };

  return (
    <Screen>
      <View style={{ gap: 4, maxWidth: 560, width: '100%', alignSelf: 'center', paddingTop: 12 }}>
        <AppText weight="700" style={{ fontSize: 22, color: colors.primaryDark }}>{t('Register your organization')}</AppText>
        <AppText variant="subtitle" style={{ fontSize: 13, marginBottom: 12 }}>
          {t('Cooperatives, NGOs, companies and programmes bring their farmers onto CropManager with referral links and see a summary of their crop activity. A CropManager administrator approves each organization before it can invite farmers.')}
        </AppText>
        <TextField label="Organization name" required value={v.name} onChangeValue={set('name')} />
        <SelectField label="Type" value={v.type} onChangeValue={set('type')} options={TYPES.map((x) => ({ value: x, label: t(x) }))} placeholder="" />
        <TextField label="Country" value={v.country} onChangeValue={set('country')} />
        <TextField label="District" value={v.district} onChangeValue={set('district')} />
        <TextField label="Sector" value={v.sector} onChangeValue={set('sector')} />
        <TextField label="Contact email" value={v.contact_email} onChangeValue={set('contact_email')} keyboardType="email-address" autoCapitalize="none" placeholder={email || ''} />
        <TextField label="Contact phone" value={v.contact_phone} onChangeValue={set('contact_phone')} keyboardType="phone-pad" />
        <TextField label="Your name" required value={v.full_name} onChangeValue={set('full_name')} />
        <TextField label="Your phone" value={v.phone} onChangeValue={set('phone')} keyboardType="phone-pad" />
        {error ? (
          <View style={{ borderWidth: 1, borderColor: colors.red, borderRadius: radius.md, padding: 12, marginBottom: 12 }}>
            <AppText style={{ fontSize: 13, color: colors.red }}>{error}</AppText>
          </View>
        ) : null}
        <Button title="Register organization" icon="building" loading={register.isPending} disabled={!v.name.trim() || !v.full_name.trim()} onPress={submit} />
        <View style={{ height: 8 }} />
        <Button title="Back" kind="ghost" onPress={onBack} />
      </View>
    </Screen>
  );
}
