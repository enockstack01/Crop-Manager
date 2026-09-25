import React, { useState } from 'react';
import { View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { api } from '../lib/api';
import { spacing } from '../theme/theme';
import { Button } from '../components/Button';
import { SelectField, TextField } from '../components/fields';
import { useToast } from '../components/Toast';
import { USER_ROLES } from '../lib/options';
import { AuthError, AuthLayout } from './auth/AuthLayout';

export function OnboardingScreen({ profile }: { profile: any }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { signOut } = useAuth();
  const { user } = useUser();
  const [values, setValues] = useState({
    // Google sign-ups arrive with a name on the Clerk user — use it as the default
    full_name: profile?.full_name || user?.fullName || '',
    role: profile?.role || 'Farmer',
    phone: profile?.phone || '',
    location: profile?.location || '',
  });

  const save = useMutation({
    mutationFn: (body: any) => api.put('/profile', { ...body, onboarded: true }).then((r) => r.data),
    onSuccess: () => {
      toast('Welcome aboard!');
      qc.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  const set = (k: string) => (v: string) => setValues((prev) => ({ ...prev, [k]: v }));

  return (
    <AuthLayout title="Welcome to CropManager" subtitle="Tell us a little about yourself. You can change this anytime in Settings.">
      <View style={{ gap: spacing.md }}>
        <AuthError message={save.isError ? (save.error as any)?.message || 'Could not save your profile' : ''} />
        <TextField label="Full Name" icon="account-outline" required value={values.full_name} onChangeValue={set('full_name')} autoComplete="name" />
        <SelectField label="Role" value={values.role} onChangeValue={set('role')} options={USER_ROLES} placeholder="" />
        <TextField label="Phone" icon="phone-outline" value={values.phone} onChangeValue={set('phone')} placeholder="+260 …" keyboardType="phone-pad" autoComplete="tel" />
        <TextField label="Location" icon="map-marker-outline" value={values.location} onChangeValue={set('location')} placeholder="City, Country" />
        <Button
          title="Get started"
          icon="arrow-right"
          loading={save.isPending}
          disabled={!values.full_name.trim()}
          onPress={() => save.mutate(values)}
          style={{ marginTop: spacing.xs }}
        />
        <Button title="Sign out" kind="ghost" onPress={() => signOut()} />
      </View>
    </AuthLayout>
  );
}
