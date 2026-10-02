import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { api } from '../lib/api';
import { formatDateTime } from '../lib/format';
import { CURRENCY_OPTIONS, REQUESTABLE_ACCOUNT_TYPES } from '../lib/currencies';
import { useTheme } from '../theme/ThemeProvider';
import { KPI_TONES, spacing } from '../theme/theme';
import { AppText } from '../components/ui';
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';
import { NumberField, SelectField, TextAreaField, TextField } from '../components/fields';
import { AuthError, AuthLayout } from './auth/AuthLayout';

/**
 * Shown instead of the app to signed-in users whose account is not active yet:
 * the access-request form, then "request sent", or the on-hold / rejected /
 * deactivated notice (mirrors client/src/components/AccountGate.jsx).
 */
export function AccountGateScreen({ profile, onRefresh, refreshing }: { profile: any; onRefresh: () => void; refreshing: boolean }) {
  const status = profile.account_status || 'new';
  const [resubmit, setResubmit] = useState(false);

  // while waiting for approval, check back every 30 s so the app opens on its own
  useEffect(() => {
    if (status !== 'pending') return undefined;
    const t = setInterval(onRefresh, 30_000);
    return () => clearInterval(t);
  }, [status, onRefresh]);

  if (status === 'new' || (status === 'rejected' && resubmit)) {
    return <RequestForm profile={profile} onCancel={status === 'rejected' ? () => setResubmit(false) : undefined} />;
  }
  return <StatusNotice profile={profile} onRefresh={onRefresh} refreshing={refreshing} onResubmit={() => setResubmit(true)} />;
}

function SignOutButton() {
  const { signOut } = useAuth();
  return <Button title="Sign out" kind="ghost" onPress={() => signOut()} />;
}

function RequestForm({ profile, onCancel }: { profile: any; onCancel?: () => void }) {
  const qc = useQueryClient();
  const { user } = useUser();
  const prev = profile.access_request || {};
  const [v, setV] = useState({
    full_name: profile.full_name || user?.fullName || '',
    phone: profile.phone || '',
    account_type: prev.account_type || 'Farmer',
    organization: prev.organization || '',
    country: prev.country || '',
    location: '',
    farm_size: prev.farm_size != null ? String(prev.farm_size) : '',
    farm_size_unit: prev.farm_size_unit || 'hectares',
    main_crops: prev.main_crops || '',
    currency: profile.currency || 'USD',
    message: prev.message || '',
  });
  const set = (k: keyof typeof v) => (val: string) => setV((s) => ({ ...s, [k]: val }));

  const submit = useMutation({
    mutationFn: (body: any) => api.post('/profile/access-request', body).then((r) => r.data),
    onSuccess: (p) => qc.setQueryData(['profile'], p),
  });

  return (
    <AuthLayout
      heading="Request your account"
      intro="Tell us about you and your farm. An administrator reviews every request before the dashboard is unlocked."
      title="Account request"
      subtitle="Fields marked * are required"
      footer={<SignOutButton />}
    >
      <View style={{ gap: spacing.md }}>
        <AuthError message={submit.isError ? (submit.error as any)?.message || 'Could not send your request' : ''} />
        <TextField
          label="Full Name"
          icon="account-outline"
          value={v.full_name}
          onChangeValue={set('full_name')}
          autoComplete="name"
          placeholder={v.account_type}
          hint={`Leave blank to be shown as “${v.account_type}”`}
        />
        <TextField label="Phone" icon="phone-outline" value={v.phone} onChangeValue={set('phone')} keyboardType="phone-pad" autoComplete="tel" />
        <SelectField label="Account Type" required value={v.account_type} onChangeValue={set('account_type')} options={REQUESTABLE_ACCOUNT_TYPES} />
        <TextField label="Farm / Organisation Name" required value={v.organization} onChangeValue={set('organization')} placeholder="e.g. Green Valley Farm" />
        <TextField label="Country" required value={v.country} onChangeValue={set('country')} autoComplete="country" />
        <TextField label="District / Town" value={v.location} onChangeValue={set('location')} />
        <NumberField label="Farm Size" value={v.farm_size} onChangeValue={set('farm_size')} placeholder="0" />
        <SelectField label="Unit" value={v.farm_size_unit} onChangeValue={set('farm_size_unit')} options={['hectares', 'acres']} />
        <TextField label="Main Crops" value={v.main_crops} onChangeValue={set('main_crops')} placeholder="e.g. Maize, beans, coffee" />
        <SelectField label="Default Currency" required value={v.currency} onChangeValue={set('currency')} options={CURRENCY_OPTIONS} hint="You can pick another one on each record" />
        <TextAreaField label="Anything else we should know?" value={v.message} onChangeValue={set('message')} />
        <Button
          title="Send request"
          icon="paper-plane"
          loading={submit.isPending}
          disabled={!v.organization.trim() || !v.country.trim()}
          onPress={() => submit.mutate(v)}
          style={{ marginTop: spacing.xs }}
        />
        {onCancel ? <Button title="Cancel" kind="secondary" onPress={onCancel} /> : null}
      </View>
    </AuthLayout>
  );
}

const NOTICES: Record<string, { icon: string; tone: keyof typeof KPI_TONES; title: string; body: string }> = {
  pending: {
    icon: 'paper-plane',
    tone: 'green',
    title: 'Your request has been sent',
    body: 'Thank you! Your account request has been received and is being reviewed. Look forward to hearing from us soon — the app opens as soon as an administrator approves it.',
  },
  on_hold: {
    icon: 'circle-pause',
    tone: 'orange',
    title: 'Your account is on hold',
    body: 'Access to your account has been paused by an administrator. We will be in touch, or contact us for more information.',
  },
  rejected: {
    icon: 'circle-xmark',
    tone: 'red',
    title: 'Your request was not approved',
    body: 'An administrator reviewed your account request and could not approve it. You can update your details and send a new request.',
  },
  deactivated: {
    icon: 'user-slash',
    tone: 'red',
    title: 'Your account has been deactivated',
    body: 'This account can no longer access CropManager. Contact an administrator if you think this is a mistake.',
  },
};

function StatusNotice({ profile, onRefresh, refreshing, onResubmit }: { profile: any; onRefresh: () => void; refreshing: boolean; onResubmit: () => void }) {
  const { colors, isDark } = useTheme();
  const n = NOTICES[profile.account_status] || NOTICES.pending;
  const [bgLight, bgDark, fg] = KPI_TONES[n.tone];
  const req = profile.access_request;

  return (
    <AuthLayout heading={n.title} intro={n.body} title="Account status" subtitle={profile.email || ''} footer={<SignOutButton />}>
      <View style={{ gap: spacing.md, alignItems: 'stretch' }}>
        <View style={{ alignSelf: 'center', width: 72, height: 72, borderRadius: 20, backgroundColor: isDark ? bgDark : bgLight, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={n.icon} size={30} color={fg} />
        </View>

        {profile.status_reason && profile.account_status !== 'pending' ? (
          <View style={{ padding: 12, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: '#F9A825', backgroundColor: isDark ? '#3D3420' : '#FFF8E1' }}>
            <AppText style={{ fontSize: 13, lineHeight: 19 }}>
              <AppText weight="600" style={{ fontSize: 13 }}>Note from the administrator: </AppText>
              {profile.status_reason}
            </AppText>
          </View>
        ) : null}

        {profile.account_status === 'pending' && req?.submitted_at ? (
          <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14 }}>
            {[
              ['Account type', req.account_type],
              ['Farm / organisation', req.organization],
              ['Sent', formatDateTime(req.submitted_at)],
            ].map(([label, value], i) => (
              <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
                <AppText variant="subtitle" style={{ fontSize: 13 }}>{label}</AppText>
                <AppText weight="600" style={{ fontSize: 13, flexShrink: 1, textAlign: 'right' }}>{value}</AppText>
              </View>
            ))}
          </View>
        ) : null}

        {profile.account_status === 'rejected' ? <Button title="Send a new request" icon="rotate" onPress={onResubmit} /> : null}
        <Button title="Check status" icon="arrows-rotate" kind="secondary" loading={refreshing} onPress={onRefresh} />
      </View>
    </AuthLayout>
  );
}
