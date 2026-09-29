import React, { useState } from 'react';
import { View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { api } from '../lib/api';
import { spacing } from '../theme/theme';
import { Button } from '../components/Button';
import { TextField } from '../components/fields';
import { useToast } from '../components/Toast';
import { AuthError, AuthLayout } from './auth/AuthLayout';

export function OnboardingScreen({ profile }: { profile: any }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { signOut } = useAuth();
  const { user } = useUser();
  // new accounts join as Farmers; an administrator can change the role later.
  // Google sign-ups arrive with a name on the Clerk user — use it as the default.
  const [values, setValues] = useState({ full_name: profile?.full_name || user?.fullName || '' });

  const save = useMutation({
    mutationFn: (body: any) => api.put('/profile', { ...body, onboarded: true }).then((r) => r.data),
    onSuccess: () => {
      toast('Welcome aboard!');
      qc.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  const set = (k: string) => (v: string) => setValues((prev) => ({ ...prev, [k]: v }));

  return (
    <AuthLayout
      heading="Welcome to CropManager"
      intro="Tell us a little about yourself to finish setting up your account."
      title="Confirm your name"
      subtitle="You'll join as a Farmer — an administrator can change your role later."
    >
      <View style={{ gap: spacing.md }}>
        <AuthError message={save.isError ? (save.error as any)?.message || 'Could not save your profile' : ''} />
        <TextField label="Full Name" icon="account-outline" required value={values.full_name} onChangeValue={set('full_name')} autoComplete="name" />
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
