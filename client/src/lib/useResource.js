import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api.js';

/**
 * Generic data hooks for any REST resource exposed by the server registry.
 * `resource` is the URL path segment, e.g. 'farms', 'crop-cycles'.
 */

export function useList(resource, params = {}, options = {}) {
  return useQuery({
    queryKey: [resource, 'list', params],
    queryFn: () => api.get(`/${resource}`, { params }).then((r) => r.data),
    placeholderData: (prev) => prev,
    ...options,
  });
}

/** Fetch every row (used to populate <select> dropdowns). */
export function useAll(resource, params = {}, options = {}) {
  const query = useQuery({
    queryKey: [resource, 'all', params],
    queryFn: () =>
      api.get(`/${resource}`, { params: { perPage: 1000, ...params } }).then((r) => r.data.data),
    staleTime: 30_000,
    ...options,
  });
  return { ...query, items: query.data || [] };
}

export function useOne(resource, id, options = {}) {
  return useQuery({
    queryKey: [resource, 'one', id],
    queryFn: () => api.get(`/${resource}/${id}`).then((r) => r.data),
    enabled: !!id,
    ...options,
  });
}

export function useResourceMutations(resource) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [resource] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const create = useMutation({
    mutationFn: (body) => api.post(`/${resource}`, body).then((r) => r.data),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, ...body }) => api.put(`/${resource}/${id}`, body).then((r) => r.data),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id) => api.delete(`/${resource}/${id}`).then((r) => r.data),
    onSuccess: invalidate,
  });

  return { create, update, remove, invalidate };
}
