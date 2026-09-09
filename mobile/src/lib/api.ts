import axios, { AxiosError } from 'axios';
import { API_URL } from '../env';

export const api = axios.create({ baseURL: API_URL, timeout: 20000 });

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
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError<any>) => {
    const message =
      (error.response?.data as any)?.message ||
      error.response?.statusText ||
      error.message ||
      'Request failed';
    return Promise.reject(new ApiError(message, error.response?.status));
  },
);
