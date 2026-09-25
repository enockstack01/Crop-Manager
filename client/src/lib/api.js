import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
});

let tokenGetter = null;
export function setTokenGetter(fn) {
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

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (!error.response) {
      // never reached the API (server down, offline, or timed out)
      const timedOut = error.code === 'ECONNABORTED' || /timeout/i.test(error.message || '');
      const wrapped = new Error(timedOut ? 'The server took too long to respond' : 'Could not reach the server');
      wrapped.network = true;
      wrapped.original = error;
      return Promise.reject(wrapped);
    }
    const message =
      error.response?.data?.message ||
      error.response?.statusText ||
      error.message ||
      'Request failed';
    const wrapped = new Error(message);
    wrapped.status = error.response?.status;
    wrapped.original = error;
    return Promise.reject(wrapped);
  }
);
