import React, { useState } from 'react';
import { Image, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { api } from '../lib/api';
import { useProfile } from '../lib/useResource';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Confirm';
import { useTheme } from '../theme/ThemeProvider';
import { AppText, ChartCard, Grid, Loading, PageHeader, Screen, useLayout } from '../components/ui';
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';
import { SelectField, TextField } from '../components/fields';

/** web "Profile Settings" page: Personal Information card, plus appearance and account. */
export function SettingsScreen() {
  const { profile, isLoading } = useProfile();
  const { user } = useUser();
  const { signOut } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const { mode, setMode, colors } = useTheme();
  const { isTablet } = useLayout();
  const [values, setValues] = useState<Record<string, any> | null>(null);

  const mutate = useMutation({
    mutationFn: (body: any) => api.put('/profile', body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      toast('Profile updated successfully');
    },
    onError: (e: any) => toast(e?.message || 'Failed to update profile', 'error'),
  });

  if (isLoading) return <Loading />;

  const current = values ?? {
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
    location: profile?.location || '',
  };
  const set = (k: string) => (v: string) => setValues({ ...current, [k]: v });
  const avatar = profile?.avatar_url || (user?.hasImage ? user.imageUrl : null);
  const email = profile?.email || user?.primaryEmailAddress?.emailAddress || '';

  const onSignOut = async () => {
    if (await confirm('Sign out of CropManager on this device?', { confirmLabel: 'Sign out', danger: true })) signOut();
  };

  return (
    <Screen>
      <PageHeader title="Profile Settings" />

      <View style={{ gap: 20, maxWidth: 720, width: '100%' }}>
        <ChartCard title="Personal Information" icon="user">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={{ width: 72, height: 72, borderRadius: 12 }} />
            ) : (
              <View style={{ width: 72, height: 72, borderRadius: 12, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="user" size={26} color={colors.primary} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <AppText weight="600" style={{ fontSize: 14 }}>{current.full_name || 'Your profile'}</AppText>
              <AppText style={{ fontSize: 12, color: colors.textLight, marginTop: 2 }} numberOfLines={1}>{email}</AppText>
            </View>
          </View>

          <View style={{ gap: 18 }}>
            <Grid columns={isTablet ? 2 : 1} gap={18}>
              <TextField label="Full Name" required value={current.full_name} onChangeValue={set('full_name')} />
              <TextField label="Email" value={email} onChangeValue={() => {}} editable={false} />
            </Grid>
            <Grid columns={isTablet ? 2 : 1} gap={18}>
              <TextField label="Phone" value={current.phone} onChangeValue={set('phone')} placeholder="+260 xxx xxx xxx" keyboardType="phone-pad" />
              <TextField label="Location" value={current.location} onChangeValue={set('location')} placeholder="City, Country" />
            </Grid>
            <TextField label="Role" hint="Your role is managed by an administrator." value={profile?.role || 'Farmer'} onChangeValue={() => {}} editable={false} />
            <View style={{ alignSelf: 'flex-start' }}>
              <Button title="Save Changes" icon="content-save" loading={mutate.isPending} onPress={() => mutate.mutate(current)} />
            </View>
          </View>
        </ChartCard>

        <ChartCard title="Appearance" icon="palette">
          <SelectField
            label="Theme"
            value={mode}
            onChangeValue={(v) => setMode(v as any)}
            options={[
              { value: 'system', label: 'System default' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
            placeholder=""
          />
        </ChartCard>

        <ChartCard title="Account" icon="shield-halved">
          <AppText style={{ fontSize: 13, color: colors.textLight, marginBottom: 14 }}>Signed in as {email}</AppText>
          <View style={{ alignSelf: 'flex-start' }}>
            <Button title="Sign out" kind="danger" icon="logout" onPress={onSignOut} />
          </View>
        </ChartCard>

        <AppText variant="caption" style={{ textAlign: 'center', marginTop: 4 }}>CropManager Mobile v2.0.0</AppText>
      </View>
    </Screen>
  );
}
