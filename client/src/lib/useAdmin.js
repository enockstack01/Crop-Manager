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
  return { update, remove };
}
