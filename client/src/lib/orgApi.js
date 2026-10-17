import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api.js';
import { useProfile } from '../components/profile.jsx';
import { t } from '../i18n/index.js';

/*
 * Organization accounts: data hooks for the organization workspace, the farmer side and the system admin panel.
 * Screens pick their text from `reason` codes sent by the server, so every message is available in
 * Kinyarwanda, English, French and Swahili.
 */
export const REASONS = {
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
  reason_required: 'Enter the reason for changing the farmer limit',
  email_is_farmer: 'This email belongs to a farmer account. Invite a different email address.',
  in_other_org: 'This person already works for another organization.',
};

/** The message for an API error: translated from its reason code when it has one. */
export const reasonText = (err) => (err?.code && REASONS[err.code] ? t(REASONS[err.code]) : err?.message || t('Something went wrong'));

/** The signed-in user's organization membership (organization staff) from the profile. */
export function useMyOrg() {
  const { profile } = useProfile();
  const ctx = profile?.org_context;
  return {
    orgId: ctx?.membership?.organization?.id || '',
    org: ctx?.membership?.organization || null,
    role: ctx?.membership?.role || '',
    farmerOrg: ctx?.farmer_org || null,
    platformRole: ctx?.platform_role || 'farmer',
  };
}

const get = (url, params) => api.get(url, { params }).then((r) => r.data);

/* ---------------------------------------------------------------- workspace */
export const useOrg = (orgId) => useQuery({ queryKey: ['org', orgId], queryFn: () => get(`/organizations/${orgId}`), enabled: !!orgId });
export const useOrgDashboard = (orgId, filters) =>
  useQuery({ queryKey: ['org', orgId, 'dashboard', filters], queryFn: () => get(`/organizations/${orgId}/dashboard`, filters), enabled: !!orgId, placeholderData: (p) => p });
export const useOrgFarmers = (orgId, params) =>
  useQuery({ queryKey: ['org', orgId, 'farmers', params], queryFn: () => get(`/organizations/${orgId}/farmers`, params), enabled: !!orgId, placeholderData: (p) => p });
export const useOrgLinks = (orgId) => useQuery({ queryKey: ['org', orgId, 'links'], queryFn: () => get(`/organizations/${orgId}/referral-links`), enabled: !!orgId, refetchInterval: 30_000 });
export const useOrgMembers = (orgId, enabled = true) => useQuery({ queryKey: ['org', orgId, 'members'], queryFn: () => get(`/organizations/${orgId}/members`), enabled: !!orgId && enabled });

export function useOrgMutations(orgId) {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ['org', orgId] });
  const mut = (fn) => useMutation({ mutationFn: fn, onSuccess: inv }); // eslint-disable-line react-hooks/rules-of-hooks
  return {
    update: mut((body) => api.patch(`/organizations/${orgId}`, body).then((r) => r.data)),
    createLink: mut((body) => api.post(`/organizations/${orgId}/referral-links`, body).then((r) => r.data)),
    revokeLink: mut((id) => api.delete(`/organizations/${orgId}/referral-links/${id}`).then((r) => r.data)),
    invite: mut((body) => api.post(`/organizations/${orgId}/members`, body).then((r) => r.data)),
    removeMember: mut((id) => api.delete(`/organizations/${orgId}/members/${id}`).then((r) => r.data)),
    removeFarmer: mut(({ farmerId, reason }) => api.delete(`/organizations/${orgId}/farmers/${farmerId}`, { data: { reason } }).then((r) => r.data)),
  };
}

/** Downloads the filtered farmer list as a CSV file. */
export async function downloadFarmersCsv(orgId, params) {
  const res = await api.get(`/organizations/${orgId}/farmers`, { params: { ...params, format: 'csv' }, responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `farmers-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------- farmer */
export function useFarmerOrgMutations() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ['profile'] });
  return {
    leave: useMutation({ mutationFn: () => api.post('/me/organization/leave').then((r) => r.data), onSuccess: refresh }),
    join: useMutation({ mutationFn: ({ token }) => api.post(`/join/${token}`, { consent: true }).then((r) => r.data), onSuccess: refresh }),
    register: useMutation({ mutationFn: (body) => api.post('/organizations/register', body).then((r) => r.data), onSuccess: refresh }),
  };
}

/* -------------------------------------------------------------- system admin */
export const useAdminOrgs = (params) => useQuery({ queryKey: ['admin', 'orgs', params], queryFn: () => get('/admin/organizations', params), placeholderData: (p) => p });
export const useAdminOrg = (id) => useQuery({ queryKey: ['admin', 'org', id], queryFn: () => get(`/admin/organizations/${id}`), enabled: !!id });
export const useAdminPlatformStats = () => useQuery({ queryKey: ['admin', 'platform-stats'], queryFn: () => get('/admin/platform-stats') });
export const useAdminAudit = (params) => useQuery({ queryKey: ['admin', 'audit', params], queryFn: () => get('/admin/audit-logs', params), placeholderData: (p) => p });
export const useAdminOrgSettings = () => useQuery({ queryKey: ['admin', 'org-settings'], queryFn: () => get('/admin/settings/organizations') });

export function useAdminOrgMutations() {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ['admin'] });
  return {
    create: useMutation({ mutationFn: (body) => api.post('/admin/organizations', body).then((r) => r.data), onSuccess: inv }),
    patch: useMutation({ mutationFn: ({ id, ...body }) => api.patch(`/admin/organizations/${id}`, body).then((r) => r.data), onSuccess: inv }),
    remove: useMutation({ mutationFn: (id) => api.delete(`/admin/organizations/${id}`).then((r) => r.data), onSuccess: inv }),
    importFarmers: useMutation({ mutationFn: ({ id, ...body }) => api.post(`/admin/organizations/${id}/import-farmers`, body, { timeout: 120_000 }).then((r) => r.data), onSuccess: inv }),
    saveSettings: useMutation({ mutationFn: (body) => api.put('/admin/settings/organizations', body).then((r) => r.data), onSuccess: inv }),
  };
}
