import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

/* The greenhouse tab: crops, fruit counts with a photo check, and the dashboard (same server endpoints as the web app). */
export const useGhDashboard = (days = 30) =>
  useQuery({ queryKey: ['greenhouse', 'dashboard', days], queryFn: () => api.get('/greenhouse/dashboard', { params: { days } }).then((r) => r.data), staleTime: 60_000 });

export const useGhCatalog = () =>
  useQuery({ queryKey: ['greenhouse', 'catalog'], queryFn: () => api.get('/greenhouse/catalog').then((r) => r.data), staleTime: 60_000 });

export const useGhCrops = () =>
  useQuery({ queryKey: ['greenhouse', 'crops'], queryFn: () => api.get('/greenhouse/crops').then((r) => r.data.data as any[]), staleTime: 60_000 });

export const useGhCounts = (params: Record<string, any>) =>
  useQuery({ queryKey: ['greenhouse', 'counts', params], queryFn: () => api.get('/greenhouse/counts', { params }).then((r) => r.data), placeholderData: (prev: any) => prev });

export const useGhHouses = () =>
  useQuery({ queryKey: ['greenhouse', 'houses'], queryFn: () => api.get('/greenhouse/houses').then((r) => r.data.data as any[]), staleTime: 30_000 });

export const useGhLayout = (id?: string) =>
  useQuery({ queryKey: ['greenhouse', 'layout', id], queryFn: () => api.get(`/greenhouse/houses/${id}/layout`).then((r) => r.data), enabled: !!id, staleTime: 15_000 });

export const useGhPlant = (id?: string, row?: number, plant?: number) =>
  useQuery({ queryKey: ['greenhouse', 'plant', id, row, plant], queryFn: () => api.get(`/greenhouse/houses/${id}/plants/${row}/${plant}`).then((r) => r.data), enabled: !!(id && row && plant) });

const LONG = { timeout: 90000 }; // the photo is counted on the server: allow time

export function useGhMutations() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: ['greenhouse'] });
  const opts = { onSuccess: done };
  return {
    addCrop: useMutation({ mutationFn: (body: any) => api.post('/greenhouse/crops', body).then((r) => r.data), ...opts }),
    removeCrop: useMutation({ mutationFn: (id: string) => api.delete(`/greenhouse/crops/${id}`).then((r) => r.data), ...opts }),
    createCount: useMutation({ mutationFn: (body: any) => api.post('/greenhouse/counts', body, LONG).then((r) => r.data), ...opts }),
    updateCount: useMutation({ mutationFn: ({ id, ...body }: any) => api.put(`/greenhouse/counts/${id}`, body, LONG).then((r) => r.data), ...opts }),
    removeCount: useMutation({ mutationFn: (id: string) => api.delete(`/greenhouse/counts/${id}`).then((r) => r.data), ...opts }),
    reverify: useMutation({ mutationFn: (id: string) => api.post(`/greenhouse/counts/${id}/verify`, {}, LONG).then((r) => r.data), ...opts }),
    addHouse: useMutation({ mutationFn: (body: any) => api.post('/greenhouse/houses', body).then((r) => r.data), ...opts }),
    updateHouse: useMutation({ mutationFn: ({ id, ...body }: any) => api.put(`/greenhouse/houses/${id}`, body).then((r) => r.data), ...opts }),
    removeHouse: useMutation({ mutationFn: (id: string) => api.delete(`/greenhouse/houses/${id}`).then((r) => r.data), ...opts }),
    check: useMutation({ mutationFn: (body: any) => api.post('/greenhouse/check', body, LONG).then((r) => r.data) }),
  };
}

export * from './greenhouseRules';
