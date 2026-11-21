import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

/* The farm manager's team of data collectors, and the data collector's own page. */
export const useTeam = (includeRemoved = false) =>
  useQuery({ queryKey: ['team', 'list', includeRemoved], queryFn: () => api.get('/team', { params: includeRemoved ? { include: 'removed' } : {} }).then((r) => r.data), staleTime: 15_000 });

export const useMember = (id?: string) =>
  useQuery({ queryKey: ['team', 'member', id], queryFn: () => api.get(`/team/${id}`).then((r) => r.data), enabled: !!id });

export const useCollectorDashboard = () =>
  useQuery({ queryKey: ['collector-dashboard'], queryFn: () => api.get('/dashboard/collector').then((r) => r.data), staleTime: 15_000 });

export function useTeamMutations() {
  const qc = useQueryClient();
  const done = () => { qc.invalidateQueries({ queryKey: ['team'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); qc.invalidateQueries({ queryKey: ['tasks'] }); };
  return {
    invite: useMutation({ mutationFn: (body: { name: string; email: string; phone?: string }) => api.post('/team', body).then((r) => r.data), onSuccess: done }),
    resend: useMutation({ mutationFn: (id: string) => api.post(`/team/${id}/resend`).then((r) => r.data), onSuccess: done }),
    remove: useMutation({ mutationFn: (id: string) => api.delete(`/team/${id}`).then((r) => r.data), onSuccess: done }),
  };
}

/** The tasks: the farm manager sees all and hands them out; a data collector's list is already limited to theirs and the ones for everyone. */
export const useTasks = (status?: 'open' | 'done') =>
  useQuery({ queryKey: ['tasks', status || 'all'], queryFn: () => api.get('/tasks', { params: { perPage: 100, ...(status ? { status } : {}), sort: 'due_date', order: 'asc' } }).then((r) => r.data.data as any[]), staleTime: 15_000 });

export function useTaskMutations() {
  const qc = useQueryClient();
  const done = () => { qc.invalidateQueries({ queryKey: ['tasks'] }); qc.invalidateQueries({ queryKey: ['collector-dashboard'] }); };
  return {
    create: useMutation({ mutationFn: (body: any) => api.post('/tasks', body).then((r) => r.data), onSuccess: done }),
    setStatus: useMutation({ mutationFn: ({ id, status, completion_note }: { id: string; status: 'open' | 'done'; completion_note?: string }) => api.put(`/tasks/${id}`, { status, ...(completion_note ? { completion_note } : {}) }).then((r) => r.data), onSuccess: done }),
    remove: useMutation({ mutationFn: (id: string) => api.delete(`/tasks/${id}`).then((r) => r.data), onSuccess: done }),
  };
}
