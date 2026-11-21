import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api.js';

/* The farm manager's team of data collectors, and the data collector's own page. */
export const useTeam = ({ includeRemoved = false } = {}) =>
  useQuery({ queryKey: ['team', 'list', includeRemoved], queryFn: () => api.get('/team', { params: includeRemoved ? { include: 'removed' } : {} }).then((r) => r.data), staleTime: 15_000 });

export const useMember = (id) =>
  useQuery({ queryKey: ['team', 'member', id], queryFn: () => api.get(`/team/${id}`).then((r) => r.data), enabled: !!id });

export const useCollectorDashboard = () =>
  useQuery({ queryKey: ['collector-dashboard'], queryFn: () => api.get('/dashboard/collector').then((r) => r.data), staleTime: 15_000 });

export function useTeamMutations() {
  const qc = useQueryClient();
  const done = () => { qc.invalidateQueries({ queryKey: ['team'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); qc.invalidateQueries({ queryKey: ['tasks'] }); };
  return {
    invite: useMutation({ mutationFn: (body) => api.post('/team', body).then((r) => r.data), onSuccess: done }),
    update: useMutation({ mutationFn: ({ id, ...body }) => api.put(`/team/${id}`, body).then((r) => r.data), onSuccess: done }),
    resend: useMutation({ mutationFn: (id) => api.post(`/team/${id}/resend`).then((r) => r.data), onSuccess: done }),
    remove: useMutation({ mutationFn: (id) => api.delete(`/team/${id}`).then((r) => r.data), onSuccess: done }),
  };
}

/** A data collector's task: mark done (with a note) or open again. */
export function useTaskDone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, completion_note }) => api.put(`/tasks/${id}`, { status, ...(completion_note ? { completion_note } : {}) }).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); qc.invalidateQueries({ queryKey: ['collector-dashboard'] }); qc.invalidateQueries({ queryKey: ['list', 'tasks'] }); },
  });
}

/** What the apps show for a person's team status. */
export const MEMBER_STATUS = {
  active: { label: 'Active', tone: 'success' },
  invited: { label: 'Waiting for sign-in', tone: 'warning' },
  expired: { label: 'Invitation expired', tone: 'danger' },
  removed: { label: 'Removed', tone: 'secondary' },
};

/** "2 hours ago", "yesterday", "12 Nov": how long since something happened. */
export function ago(iso, now = Date.now()) {
  if (!iso) return null;
  const ms = now - new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  const min = Math.round(ms / 60000);
  if (min < 2) return { key: 'just now' };
  if (min < 60) return { key: '{{n}} minutes ago', n: min };
  const h = Math.round(min / 60);
  if (h < 24) return { key: h === 1 ? '1 hour ago' : '{{n}} hours ago', n: h };
  const d = Math.round(h / 24);
  if (d < 14) return { key: d === 1 ? 'yesterday' : '{{n}} days ago', n: d };
  return { key: 'on {{date}}', date: new Date(iso).toISOString().slice(0, 10) };
}
