import React, { useState } from 'react';
import { View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';
import { api } from '../lib/api';
import { spacing } from '../theme/theme';
import { AppText, Screen } from '../components/ui';
import { Button } from '../components/Button';
import { SelectField, TextField } from '../components/fields';
import { USER_ROLES } from '../lib/options';

export function OnboardingScreen({ profile }: { profile: any }) {
  const qc = useQueryClient();
  const { signOut } = useAuth();
  const [values, setValues] = useState({
    full_name: profile?.full_name || '',
    role: profile?.role || 'Farmer',
    phone: profile?.phone || '',
    location: profile?.location || '',
  });

  const save = useMutation({
    mutationFn: (body: any) => api.put('/profile', { ...body, onboarded: true }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  });

  const set = (k: string) => (v: string) => setValues((prev) => ({ ...prev, [k]: v }));

  return (
    <Screen>
      <AppText variant="title">Welcome to CropManager</AppText>
      <AppText variant="subtitle" style={{ marginBottom: spacing.lg }}>
        Tell us a little about yourself. You can change this anytime in Settings.
      </AppText>

      <View style={{ gap: spacing.md }}>
        <TextField label="Full Name" required value={values.full_name} onChangeValue={set('full_name')} />
        <SelectField label="Role" value={values.role} onChangeValue={set('role')} options={USER_ROLES} placeholder="" />
        <TextField label="Phone" value={values.phone} onChangeValue={set('phone')} placeholder="+260 …" />
        <TextField label="Location" value={values.location} onChangeValue={set('location')} placeholder="City, Country" />
        <Button
          title="Get started"
          icon="check"
          loading={save.isPending}
          disabled={!values.full_name.trim()}
          onPress={() => save.mutate(values)}
        />
        <Button title="Sign out" kind="ghost" onPress={() => signOut()} />
      </View>
    </Screen>
  );
}
