import React, { useState } from 'react';
import { View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { api } from '../lib/api';
import { useProfile } from '../lib/useResource';
import { useToast } from '../components/Toast';
import { useTheme } from '../theme/ThemeProvider';
import { spacing } from '../theme/theme';
import { AppText, Card, Loading, Screen, SectionTitle } from '../components/ui';
import { Button } from '../components/Button';
import { SelectField, TextField } from '../components/fields';

export function SettingsScreen() {
  const { profile, isLoading } = useProfile();
  const { user } = useUser();
  const { signOut } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const { mode, setMode, colors } = useTheme();
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

  return (
    <Screen>
      <SectionTitle>Personal Information</SectionTitle>
      <Card style={{ gap: spacing.md }}>
        <TextField label="Full Name" required value={current.full_name} onChangeValue={set('full_name')} />
        <TextField label="Email" value={profile?.email || user?.primaryEmailAddress?.emailAddress || ''} onChangeValue={() => {}} editable={false} />
        <TextField label="Phone" value={current.phone} onChangeValue={set('phone')} placeholder="+260 …" />
        <TextField label="Location" value={current.location} onChangeValue={set('location')} placeholder="City, Country" />
        <TextField label="Role" hint="Your role is managed by an administrator." value={profile?.role || 'Farmer'} onChangeValue={() => {}} editable={false} />
        <Button title="Save Changes" icon="content-save" loading={mutate.isPending} onPress={() => mutate.mutate(current)} />
      </Card>

      <SectionTitle>Appearance</SectionTitle>
      <Card>
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
      </Card>

      <SectionTitle>Account</SectionTitle>
      <Card style={{ gap: spacing.sm }}>
        <AppText variant="caption">Signed in as {user?.primaryEmailAddress?.emailAddress}</AppText>
        <Button title="Sign out" kind="danger" icon="logout" onPress={() => signOut()} />
      </Card>

      <View style={{ height: spacing.xxl }} />
      <AppText variant="caption" style={{ textAlign: 'center', color: colors.textLight }}>CropManager Mobile v2.0.0</AppText>
    </Screen>
  );
}
