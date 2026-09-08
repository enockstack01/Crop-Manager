import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api.js';

export function useAdminOverview() {
  return useQuery({ queryKey: ['admin', 'overview'], queryFn: () => api.get('/admin/overview').then((r) => r.data) });
}

export function useAdminUsers(params = {}) {
  return useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: () => api.get('/admin/users', { params }).then((r) => r.data),
    placeholderData: (p) => p,
  });
}

export function useAdminUser(userId) {
  return useQuery({
    queryKey: ['admin', 'user', userId],
    queryFn: () => api.get(`/admin/users/${userId}`).then((r) => r.data),
    enabled: !!userId,
  });
}

export function useAdminResources() {
  return useQuery({
    queryKey: ['admin', 'resources'],
    queryFn: () => api.get('/admin/resources').then((r) => r.data),
    staleTime: Infinity,
  });
}

export function useAdminData(resource, params = {}) {
  return useQuery({
    queryKey: ['admin', 'data', resource, params],
    queryFn: () => api.get(`/admin/data/${resource}`, { params }).then((r) => r.data),
    enabled: !!resource,
    placeholderData: (p) => p,
  });
}

export function useAdminSettings() {
  return useQuery({ queryKey: ['admin', 'settings'], queryFn: () => api.get('/admin/settings').then((r) => r.data) });
}

export function useAdminSettingsMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin'] });
  const addAdmin = useMutation({
    mutationFn: (email) => api.post('/admin/settings/admins', { email }).then((r) => r.data),
    onSuccess: invalidate,
  });
  const removeAdmin = useMutation({
    mutationFn: (email) => api.delete(`/admin/settings/admins/${encodeURIComponent(email)}`).then((r) => r.data),
    onSuccess: invalidate,
  });
  return { addAdmin, removeAdmin };
}

export function useAdminDataMutations() {
  const qc = useQueryClient();
  const deleteRecord = useMutation({
    mutationFn: ({ resource, id }) => api.delete(`/admin/data/${resource}/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'data'] }),
  });
  return { deleteRecord };
}

export function useAdminUserMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin'] });

  const update = useMutation({
    mutationFn: ({ userId, ...body }) => api.patch(`/admin/users/${userId}`, body).then((r) => r.data),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (userId) => api.delete(`/admin/users/${userId}`).then((r) => r.data),
    onSuccess: invalidate,
  });
  const reseed = useMutation({
    mutationFn: (userId) => api.post(`/admin/users/${userId}/reseed`).then((r) => r.data),
    onSuccess: invalidate,
  });
  return { update, remove, reseed };
}
