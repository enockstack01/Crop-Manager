import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

/**
 * Generic data hooks for any REST resource exposed by the server registry.
 * `resource` is the URL path segment, e.g. 'farms', 'crop-cycles'.
 * Mirrors client/src/lib/useResource.js.
 */

export type ListResponse<T = any> = {
  data: T[];
  page?: number;
  perPage?: number;
  total?: number;
  totalPages?: number;
};

export function useList<T = any>(resource: string, params: Record<string, any> = {}, options: any = {}) {
  return useQuery<ListResponse<T>>({
    queryKey: [resource, 'list', params],
    queryFn: () => api.get(`/${resource}`, { params }).then((r) => r.data),
    placeholderData: (prev) => prev,
    ...options,
  });
}

/** Fetch every row (used to populate pickers). */
export function useAll<T = any>(resource: string, params: Record<string, any> = {}, options: any = {}) {
  const query = useQuery<T[]>({
    queryKey: [resource, 'all', params],
    queryFn: () =>
      api.get(`/${resource}`, { params: { perPage: 1000, ...params } }).then((r) => r.data.data),
    staleTime: 30_000,
    ...options,
  });
  return { ...query, items: query.data ?? [] };
}

export function useOne<T = any>(resource: string, id?: string, options: any = {}) {
  return useQuery<T>({
    queryKey: [resource, 'one', id],
    queryFn: () => api.get(`/${resource}/${id}`).then((r) => r.data),
    enabled: !!id,
    ...options,
  });
}

export function useResourceMutations(resource: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [resource] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const create = useMutation({
    mutationFn: (body: any) => api.post(`/${resource}`, body).then((r) => r.data),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, ...body }: any) => api.put(`/${resource}/${id}`, body).then((r) => r.data),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/${resource}/${id}`).then((r) => r.data),
    onSuccess: invalidate,
  });

  return { create, update, remove, invalidate };
}

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard').then((r) => r.data),
  });
}

export function useProfile() {
  const query = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get('/profile').then((r) => r.data),
    staleTime: 60_000,
    // the startup gate shows its own Retry, so fail fast instead of stacking timeouts
    retry: false,
  });
  return {
    profile: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error as any,
    refetch: query.refetch,
  };
}
