import { onlineManager, QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from './api';
import { enqueue, flushOutbox, newTempId } from './offline';

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

/** Apply `fn` to every cached copy (lists, pickers, single records) of a resource. */
function updateCaches(qc: QueryClient, resource: string, fn: (rows: any[]) => any[], one?: (row: any) => any) {
  qc.setQueriesData({ queryKey: [resource] }, (old: any) => {
    if (!old) return old;
    if (Array.isArray(old)) return fn(old);
    if (Array.isArray(old.data)) {
      const data = fn(old.data);
      return { ...old, data, total: typeof old.total === 'number' ? old.total + (data.length - old.data.length) : old.total };
    }
    return one ? one(old) : old;
  });
}

/**
 * Send a change to the server, or — when the phone is offline or the server can't
 * be reached — queue it (lib/offline.ts) and apply it to the cached data at once.
 * Queued results carry `_offline: true`.
 */
export async function writeOrQueue(
  qc: QueryClient,
  op: { method: 'post' | 'put' | 'delete'; url: string; resource: string; body?: any; tempId?: string },
  applyLocally: () => any,
) {
  const queueIt = () => {
    enqueue(op);
    const result = applyLocally();
    return { ...(result || {}), _offline: true };
  };
  if (!onlineManager.isOnline()) return queueIt();
  // a record created offline keeps its temporary id until it is synced: go through the queue
  if (/\/local-/.test(op.url)) {
    const result = queueIt();
    flushOutbox(qc);
    return result;
  }
  try {
    return (await api.request({ method: op.method, url: op.url, data: op.body })).data;
  } catch (e) {
    if (e instanceof ApiError && e.network) return queueIt();
    throw e;
  }
}

export function useResourceMutations(resource: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [resource] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };
  // offline results are already in the cache; refetching would only hide them until synced
  const onSuccess = (data: any) => {
    if (!data?._offline) invalidate();
  };

  const create = useMutation({
    networkMode: 'always',
    mutationFn: (body: any) => {
      const tempId = newTempId();
      return writeOrQueue(qc, { method: 'post', url: `/${resource}`, resource, body, tempId }, () => {
        const row = { ...body, id: tempId, created_at: new Date().toISOString(), _offline: true };
        updateCaches(qc, resource, (rows) => [row, ...rows]);
        return row;
      });
    },
    onSuccess,
  });
  const update = useMutation({
    networkMode: 'always',
    mutationFn: ({ id, ...body }: any) =>
      writeOrQueue(qc, { method: 'put', url: `/${resource}/${id}`, resource, body }, () => {
        const patch = (r: any) => (r?.id === id ? { ...r, ...body, _offline: true } : r);
        updateCaches(qc, resource, (rows) => rows.map(patch), patch);
        return { id, ...body };
      }),
    onSuccess,
  });
  const remove = useMutation({
    networkMode: 'always',
    mutationFn: (id: string) =>
      writeOrQueue(qc, { method: 'delete', url: `/${resource}/${id}`, resource }, () => {
        updateCaches(qc, resource, (rows) => rows.filter((r) => r?.id !== id));
        return { id, deleted: true };
      }),
    onSuccess,
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
