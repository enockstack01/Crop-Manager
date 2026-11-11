import axios, { AxiosError } from 'axios';
import { onlineManager } from '@tanstack/react-query';
import { API_URL } from '../env';

// generous timeout: a sleeping free-tier host can take 30–60s to wake on the first request
export const api = axios.create({ baseURL: API_URL, timeout: 60000 });

type TokenGetter = () => Promise<string | null>;
let tokenGetter: TokenGetter | null = null;

/** Wired once from a component that has access to Clerk's `useAuth().getToken`. */
export function setTokenGetter(fn: TokenGetter | null) {
  tokenGetter = fn;
}

api.interceptors.request.use(async (config) => {
  if (tokenGetter) {
    try {
      const token = await tokenGetter();
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch {
      /* not signed in yet */
    }
  }
  return config;
});

export class ApiError extends Error {
  status?: number;
  /** true when the server was never reached (offline, wrong address, firewall, timeout) */
  network: boolean;
  /** machine-readable reason from the server (translated by the screens) */
  code?: string;
  constructor(message: string, status?: number, network = false, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.network = network;
    this.code = code;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<any>) => {
    if (!error.response) {
      const timedOut = error.code === 'ECONNABORTED' || /timeout/i.test(error.message);
      // A read that fails before any answer is tried once more: the first request after the phone reconnects, changes network or wakes
      // from sleep often fails while the connection settles. Writes are never repeated here (they have their own offline queue).
      const cfg: any = error.config;
      if (cfg && !timedOut && (cfg.method || 'get').toLowerCase() === 'get' && !cfg.__retried && onlineManager.isOnline()) {
        cfg.__retried = true;
        await new Promise((r) => setTimeout(r, 1500));
        return api.request(cfg);
      }
      const offline = !onlineManager.isOnline();
      return Promise.reject(
        new ApiError(timedOut ? 'The server took too long to respond' : offline ? 'No internet connection' : 'Could not reach the server', undefined, true),
      );
    }
    const message =
      (error.response.data as any)?.message ||
      error.response.statusText ||
      error.message ||
      'Request failed';
    return Promise.reject(new ApiError(message, error.response.status, false, (error.response.data as any)?.details?.code));
  },
);
