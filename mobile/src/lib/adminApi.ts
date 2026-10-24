import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

/* System administration: overview, users, data, settings, AI models and limits (server: /api/admin). */
const get = (path: string, params?: Record<string, any>) => api.get(path, { params }).then((r) => r.data);

export const useAdminOverview = () => useQuery({ queryKey: ['admin', 'overview'], queryFn: () => get('/admin/overview') });
export const useAdminUsers = (params: Record<string, any> = {}) =>
  useQuery({ queryKey: ['admin', 'users', params], queryFn: () => get('/admin/users', params), placeholderData: (p: any) => p });
export const useAdminUser = (userId: string) => useQuery({ queryKey: ['admin', 'user', userId], queryFn: () => get(`/admin/users/${userId}`), enabled: !!userId });
export const useAdminResources = () => useQuery({ queryKey: ['admin', 'resources'], queryFn: () => get('/admin/resources'), staleTime: Infinity });
export const useAdminData = (resource: string, params: Record<string, any> = {}) =>
  useQuery({ queryKey: ['admin', 'data', resource, params], queryFn: () => get(`/admin/data/${resource}`, params), enabled: !!resource, placeholderData: (p: any) => p });
export const useAdminSettings = () => useQuery({ queryKey: ['admin', 'settings'], queryFn: () => get('/admin/settings') });
export const useAiAdmin = (days = 30) => useQuery({ queryKey: ['admin', 'ai', days], queryFn: () => get('/admin/ai', { days }), placeholderData: (p: any) => p });

export function useAdminMutations() {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ['admin'] });
  return {
    updateUser: useMutation({ mutationFn: ({ userId, ...body }: any) => api.patch(`/admin/users/${userId}`, body).then((r) => r.data), onSuccess: inv }),
    removeUser: useMutation({ mutationFn: (userId: string) => api.delete(`/admin/users/${userId}`).then((r) => r.data), onSuccess: inv }),
    reseedUser: useMutation({ mutationFn: (userId: string) => api.post(`/admin/users/${userId}/reseed`).then((r) => r.data), onSuccess: inv }),
    deleteRecord: useMutation({ mutationFn: ({ resource, id }: any) => api.delete(`/admin/data/${resource}/${id}`).then((r) => r.data), onSuccess: inv }),
    addAdmin: useMutation({ mutationFn: (email: string) => api.post('/admin/settings/admins', { email }).then((r) => r.data), onSuccess: inv }),
    removeAdmin: useMutation({ mutationFn: (email: string) => api.delete(`/admin/settings/admins/${encodeURIComponent(email)}`).then((r) => r.data), onSuccess: inv }),
    saveModels: useMutation({ mutationFn: (body: any) => api.put('/admin/ai/models', body).then((r) => r.data), onSuccess: inv }),
    saveLimits: useMutation({ mutationFn: (body: any) => api.put('/admin/settings/ai-limits', body).then((r) => r.data), onSuccess: inv }),
    testAi: useMutation({ mutationFn: (task: string) => api.post('/admin/ai/test', { task }, { timeout: 60000 }).then((r) => r.data) }),
  };
}

/* ------------------------------------------------------------ organizations (admin) */
export const useAdminOrgs = (params: Record<string, any>) => useQuery({ queryKey: ['admin', 'orgs', params], queryFn: () => get('/admin/organizations', params), placeholderData: (p: any) => p });
export const useAdminOrg = (id: string) => useQuery({ queryKey: ['admin', 'org', id], queryFn: () => get(`/admin/organizations/${id}`), enabled: !!id });
export const useAdminPlatformStats = () => useQuery({ queryKey: ['admin', 'platform-stats'], queryFn: () => get('/admin/platform-stats') });
export const useAdminAudit = (params: Record<string, any>) => useQuery({ queryKey: ['admin', 'audit', params], queryFn: () => get('/admin/audit-logs', params), placeholderData: (p: any) => p });
export const useAdminOrgSettings = () => useQuery({ queryKey: ['admin', 'org-settings'], queryFn: () => get('/admin/settings/organizations') });

export function useAdminOrgMutations() {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ['admin'] });
  return {
    create: useMutation({ mutationFn: (body: any) => api.post('/admin/organizations', body).then((r) => r.data), onSuccess: inv }),
    patch: useMutation({ mutationFn: ({ id, ...body }: any) => api.patch(`/admin/organizations/${id}`, body).then((r) => r.data), onSuccess: inv }),
    remove: useMutation({ mutationFn: (id: string) => api.delete(`/admin/organizations/${id}`).then((r) => r.data), onSuccess: inv }),
    importFarmers: useMutation({ mutationFn: ({ id, ...body }: any) => api.post(`/admin/organizations/${id}/import-farmers`, body).then((r) => r.data), onSuccess: inv }),
    saveSettings: useMutation({ mutationFn: (body: any) => api.put('/admin/settings/organizations', body).then((r) => r.data), onSuccess: inv }),
  };
}

/** Account lifecycle labels (server: models/system.models.js ACCOUNT_STATUSES). */
export const STATUS_META: Record<string, { label: string; tone: 'neutral' | 'warning' | 'success' | 'info' | 'danger' }> = {
  new: { label: 'No request yet', tone: 'neutral' },
  pending: { label: 'Pending approval', tone: 'warning' },
  active: { label: 'Active', tone: 'success' },
  on_hold: { label: 'On hold', tone: 'info' },
  rejected: { label: 'Rejected', tone: 'danger' },
  deactivated: { label: 'Deactivated', tone: 'danger' },
};

export const ACCOUNT_ACTIONS: Record<string, { status: string; label: string; icon: string; kind: 'primary' | 'secondary' | 'danger'; reason?: boolean; done: string }> = {
  approve: { status: 'active', label: 'Approve', icon: 'circle-check', kind: 'primary', done: 'Account approved' },
  reject: { status: 'rejected', label: 'Reject', icon: 'circle-xmark', kind: 'danger', reason: true, done: 'Request rejected' },
  hold: { status: 'on_hold', label: 'Put on hold', icon: 'circle-pause', kind: 'secondary', reason: true, done: 'Account put on hold' },
  activate: { status: 'active', label: 'Activate', icon: 'user-check', kind: 'primary', done: 'Account activated' },
  reactivate: { status: 'active', label: 'Re-activate', icon: 'rotate-left', kind: 'primary', done: 'Account re-activated' },
  deactivate: { status: 'deactivated', label: 'Deactivate', icon: 'user-slash', kind: 'secondary', reason: true, done: 'Account deactivated' },
};

/** Which actions make sense for an account in each status. */
export function actionsFor(status: string): string[] {
  switch (status) {
    case 'pending': return ['approve', 'reject', 'hold'];
    case 'active': return ['hold', 'deactivate'];
    case 'on_hold': return ['activate', 'deactivate'];
    case 'rejected': return ['approve'];
    case 'deactivated': return ['reactivate'];
    default: return ['approve'];
  }
}

export const RECORD_LABELS: Record<string, string> = {
  Farm: 'Farms', Field: 'Fields', Crop: 'Crops', CropVariety: 'Varieties', Season: 'Seasons',
  CropCycle: 'Crop cycles', PlantingRecord: 'Planting records', FieldActivity: 'Field activities',
  IrrigationRecord: 'Irrigation records', FertilizerApplication: 'Fertilizer applications',
  CropProtectionRecord: 'Crop protection', CropScoutingRecord: 'Scouting records',
  HarvestRecord: 'Harvest records', InventoryItem: 'Inventory items', InventoryTransaction: 'Stock movements',
  Equipment: 'Equipment', EquipmentMaintenance: 'Maintenance', Expense: 'Expenses', Sale: 'Sales',
  Notification: 'Notifications', CalculationHistory: 'Calculations',
};
