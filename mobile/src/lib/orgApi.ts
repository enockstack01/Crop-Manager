import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useProfile } from './useResource';
import { t } from '../i18n';

/*
 * Organization accounts on the phone: the same data hooks as the web app (client/src/lib/orgApi.js).
 * Screens pick their text from `reason` codes sent by the server, so every message is translated.
 */
export const REASONS: Record<string, string> = {
  invalid: 'This invitation link is no longer valid. Please contact your organization.',
  revoked: 'This invitation link is no longer valid. Please contact your organization.',
  expired: 'This invitation link has expired. Please ask your organization for a new link.',
  link_full: 'This invitation link has reached its limit. Please ask your organization for a new link.',
  org_limit: 'This organization cannot accept more farmers at the moment. Please contact your organization.',
  org_suspended: 'This organization is not accepting new farmers at the moment.',
  already_member: 'You are already a member of this organization.',
  other_org: 'You are currently linked to another organization. Leave it first or contact support.',
  consent_required: 'You must agree to share a summary of your farm activity to join.',
  org_account: 'This account belongs to an organization, so it cannot join as a farmer.',
  admin_account: 'Administrator accounts cannot join an organization as a farmer.',
  account_blocked: 'Your account is not active. Please contact support.',
  name_taken: 'An organization with this name already exists.',
  account_in_use: 'This account is already used as a farmer account. Register the organization with a new account.',
  already_in_org: 'Your account already belongs to an organization.',
  org_pending: 'Referral links can be created once the organization is approved.',
  email_is_farmer: 'This email belongs to a farmer account. Invite a different email address.',
  in_other_org: 'This person already works for another organization.',
};

export const reasonText = (err: any): string =>
  err?.code && REASONS[err.code] ? t(REASONS[err.code]) : err?.message || t('Something went wrong');

/** The signed-in user's organization membership and farmer link, from the profile. */
export function useMyOrg() {
  const { profile } = useProfile();
  const ctx = profile?.org_context;
  return {
    orgId: (ctx?.membership?.organization?.id as string) || '',
    role: (ctx?.membership?.role as string) || '',
    farmerOrg: ctx?.farmer_org || null,
    platformRole: (ctx?.platform_role as string) || 'farmer',
  };
}

const get = (url: string, params?: any) => api.get(url, { params }).then((r) => r.data);

export const useOrg = (orgId: string) => useQuery({ queryKey: ['org', orgId], queryFn: () => get(`/organizations/${orgId}`), enabled: !!orgId });
export const useOrgDashboard = (orgId: string, filters: Record<string, string>) =>
  useQuery({ queryKey: ['org', orgId, 'dashboard', filters], queryFn: () => get(`/organizations/${orgId}/dashboard`, filters), enabled: !!orgId, placeholderData: (p: any) => p });
export const useOrgFarmers = (orgId: string, params: Record<string, any>) =>
  useQuery({ queryKey: ['org', orgId, 'farmers', params], queryFn: () => get(`/organizations/${orgId}/farmers`, params), enabled: !!orgId, placeholderData: (p: any) => p });
export const useOrgLinks = (orgId: string) => useQuery({ queryKey: ['org', orgId, 'links'], queryFn: () => get(`/organizations/${orgId}/referral-links`), enabled: !!orgId, refetchInterval: 30_000 });
export const useOrgMembers = (orgId: string, enabled = true) => useQuery({ queryKey: ['org', orgId, 'members'], queryFn: () => get(`/organizations/${orgId}/members`), enabled: !!orgId && enabled });

export function useOrgMutations(orgId: string) {
  const qc = useQueryClient();
  const onSuccess = () => qc.invalidateQueries({ queryKey: ['org', orgId] });
  return {
    update: useMutation({ mutationFn: (body: any) => api.patch(`/organizations/${orgId}`, body).then((r) => r.data), onSuccess }),
    createLink: useMutation({ mutationFn: (body: any) => api.post(`/organizations/${orgId}/referral-links`, body).then((r) => r.data), onSuccess }),
    revokeLink: useMutation({ mutationFn: (id: string) => api.delete(`/organizations/${orgId}/referral-links/${id}`).then((r) => r.data), onSuccess }),
    invite: useMutation({ mutationFn: (body: any) => api.post(`/organizations/${orgId}/members`, body).then((r) => r.data), onSuccess }),
    removeMember: useMutation({ mutationFn: (id: string) => api.delete(`/organizations/${orgId}/members/${id}`).then((r) => r.data), onSuccess }),
    removeFarmer: useMutation({ mutationFn: (farmerId: string) => api.delete(`/organizations/${orgId}/farmers/${farmerId}`).then((r) => r.data), onSuccess }),
  };
}

export function useFarmerOrgMutations() {
  const qc = useQueryClient();
  const onSuccess = () => qc.invalidateQueries({ queryKey: ['profile'] });
  return {
    leave: useMutation({ mutationFn: () => api.post('/me/organization/leave').then((r) => r.data), onSuccess }),
    join: useMutation({ mutationFn: (token: string) => api.post(`/join/${token}`, { consent: true }).then((r) => r.data), onSuccess }),
    register: useMutation({ mutationFn: (body: any) => api.post('/organizations/register', body).then((r) => r.data), onSuccess }),
  };
}
