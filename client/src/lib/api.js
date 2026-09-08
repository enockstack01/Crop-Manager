import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
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
