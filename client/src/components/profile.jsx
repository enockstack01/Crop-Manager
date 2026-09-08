import { createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

const ProfileCtx = createContext({ profile: null, isLoading: true });
export const useProfile = () => useContext(ProfileCtx);

export function ProfileProvider({ children }) {
  const { data, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get('/profile').then((r) => r.data),
    staleTime: 60_000,
  });
  return <ProfileCtx.Provider value={{ profile: data || null, isLoading }}>{children}</ProfileCtx.Provider>;
}
