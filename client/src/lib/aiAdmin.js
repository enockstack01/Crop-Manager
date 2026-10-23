import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api.js';

/* Admin side of the AI assistant: models, limits and usage. */
export const useAiAdmin = (days = 30) =>
  useQuery({ queryKey: ['admin', 'ai', days], queryFn: () => api.get('/admin/ai', { params: { days } }).then((r) => r.data), placeholderData: (p) => p });

export function useAiAdminMutations() {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ['admin'] });
  return {
    saveModels: useMutation({ mutationFn: (body) => api.put('/admin/ai/models', body).then((r) => r.data), onSuccess: inv }),
    saveLimits: useMutation({ mutationFn: (body) => api.put('/admin/settings/ai-limits', body).then((r) => r.data), onSuccess: inv }),
    test: useMutation({ mutationFn: (task) => api.post('/admin/ai/test', { task }, { timeout: 60_000 }).then((r) => r.data) }),
  };
}
