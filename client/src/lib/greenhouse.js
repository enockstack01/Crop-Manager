import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api.js';

/* The greenhouse tab: crops, fruit counts with a photo check, and the dashboard. */
export const useGhDashboard = (days = 30) =>
  useQuery({ queryKey: ['greenhouse', 'dashboard', days], queryFn: () => api.get('/greenhouse/dashboard', { params: { days } }).then((r) => r.data), staleTime: 60_000 });

export const useGhCatalog = () =>
  useQuery({ queryKey: ['greenhouse', 'catalog'], queryFn: () => api.get('/greenhouse/catalog').then((r) => r.data), staleTime: 60_000 });

export const useGhCrops = () =>
  useQuery({ queryKey: ['greenhouse', 'crops'], queryFn: () => api.get('/greenhouse/crops').then((r) => r.data.data), staleTime: 60_000 });

export const useGhCounts = (params) =>
  useQuery({ queryKey: ['greenhouse', 'counts', params], queryFn: () => api.get('/greenhouse/counts', { params }).then((r) => r.data), placeholderData: (prev) => prev });

export const useGhHouses = () =>
  useQuery({ queryKey: ['greenhouse', 'houses'], queryFn: () => api.get('/greenhouse/houses').then((r) => r.data.data), staleTime: 30_000 });

export const useGhLayout = (id) =>
  useQuery({ queryKey: ['greenhouse', 'layout', id], queryFn: () => api.get(`/greenhouse/houses/${id}/layout`).then((r) => r.data), enabled: !!id, staleTime: 15_000 });

export const useGhPlant = (id, row, plant) =>
  useQuery({ queryKey: ['greenhouse', 'plant', id, row, plant], queryFn: () => api.get(`/greenhouse/houses/${id}/plants/${row}/${plant}`).then((r) => r.data), enabled: !!(id && row && plant) });

export function useGhMutations() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: ['greenhouse'] });
  const opts = { onSuccess: done };
  return {
    addCrop: useMutation({ mutationFn: (body) => api.post('/greenhouse/crops', body).then((r) => r.data), ...opts }),
    removeCrop: useMutation({ mutationFn: (id) => api.delete(`/greenhouse/crops/${id}`).then((r) => r.data), ...opts }),
    createCount: useMutation({ mutationFn: (body) => api.post('/greenhouse/counts', body, { timeout: 90000 }).then((r) => r.data), ...opts }),
    updateCount: useMutation({ mutationFn: ({ id, ...body }) => api.put(`/greenhouse/counts/${id}`, body, { timeout: 90000 }).then((r) => r.data), ...opts }),
    removeCount: useMutation({ mutationFn: (id) => api.delete(`/greenhouse/counts/${id}`).then((r) => r.data), ...opts }),
    reverify: useMutation({ mutationFn: (id) => api.post(`/greenhouse/counts/${id}/verify`, {}, { timeout: 90000 }).then((r) => r.data), ...opts }),
    addHouse: useMutation({ mutationFn: (body) => api.post('/greenhouse/houses', body).then((r) => r.data), ...opts }),
    updateHouse: useMutation({ mutationFn: ({ id, ...body }) => api.put(`/greenhouse/houses/${id}`, body).then((r) => r.data), ...opts }),
    removeHouse: useMutation({ mutationFn: (id) => api.delete(`/greenhouse/houses/${id}`).then((r) => r.data), ...opts }),
    check: useMutation({ mutationFn: (body) => api.post('/greenhouse/check', body, { timeout: 90000 }).then((r) => r.data) }),
  };
}

/** How each verdict looks and reads. */
export const VERDICTS = {
  match: { label: 'Matches', tone: 'success', icon: 'fa-circle-check' },
  close: { label: 'Close', tone: 'info', icon: 'fa-circle-check' },
  mismatch: { label: 'Does not match', tone: 'danger', icon: 'fa-triangle-exclamation' },
  inconclusive: { label: 'Not sure', tone: 'warning', icon: 'fa-circle-question' },
  not_checked: { label: 'Not checked', tone: 'neutral', icon: 'fa-circle-minus' },
  failed: { label: 'Check failed', tone: 'warning', icon: 'fa-plug-circle-xmark' },
};
