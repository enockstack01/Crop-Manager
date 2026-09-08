import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api.js';

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard').then((r) => r.data),
  });
}
