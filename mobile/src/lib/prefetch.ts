import { onlineManager, QueryClient } from '@tanstack/react-query';
import { api } from './api';
import { MODULES } from '../navigation/modules';
import { PER_PAGE } from '../screens/CrudScreen';

/*
 * Saves the first page of every list (and the lists the pickers use) on the phone while there is internet, so that the whole app can be opened
 * with no signal: a list the person has never visited would otherwise be empty offline. It asks for exactly what each screen asks for first
 * (same query key), a few at a time so it never competes with what the person is doing, and stops quietly if the connection drops.
 */
const PICKERS = ['farms', 'fields', 'crops', 'crop-varieties', 'seasons', 'crop-cycles', 'inventory-items', 'equipment'];
let running = false;
let lastRun = 0;

export async function prefetchForOffline(qc: QueryClient, force = false) {
  if (running || !onlineManager.isOnline()) return;
  if (!force && Date.now() - lastRun < 10 * 60 * 1000) return; // at most every ten minutes
  running = true;
  try {
    const jobs: (() => Promise<unknown>)[] = [];
    for (const m of MODULES) {
      const params = { page: 1, perPage: PER_PAGE, sort: m.defaultSort?.sort ?? 'created_at', order: m.defaultSort?.order ?? 'desc' };
      jobs.push(() => qc.prefetchQuery({ queryKey: [m.resource, 'list', params], queryFn: () => api.get(`/${m.resource}`, { params }).then((r) => r.data), staleTime: 60_000 }));
    }
    for (const resource of PICKERS) {
      jobs.push(() => qc.prefetchQuery({ queryKey: [resource, 'all', {}], queryFn: () => api.get(`/${resource}`, { params: { perPage: 1000 } }).then((r) => r.data.data), staleTime: 60_000 }));
    }
    let next = 0;
    const worker = async () => {
      while (next < jobs.length && onlineManager.isOnline()) {
        const job = jobs[next++];
        try { await job(); } catch { /* the next visit loads it */ }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    lastRun = Date.now();
  } finally {
    running = false;
  }
}
