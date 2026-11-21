import { createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

const ProfileCtx = createContext({ profile: null, isLoading: true });
export const useProfile = () => useContext(ProfileCtx);

/** Records a data collector may add and edit (their own entries): the field work. */
export const COLLECTOR_RESOURCES = ['planting-records', 'field-activities', 'irrigation-records', 'fertilizer-applications', 'crop-protection-records', 'crop-scouting-records', 'harvest-records'];

/** true for a data collector's account: they work in their farm manager's farm with a simpler dashboard. */
export const useIsCollector = () => useContext(ProfileCtx).profile?.user_type === 'collector';

export function ProfileProvider({ children }) {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get('/profile').then((r) => r.data),
    staleTime: 60_000,
    retry: 1,
  });
  return (
    <ProfileCtx.Provider value={{ profile: data || null, isLoading, isError, error, refetch, isFetching }}>
      {children}
    </ProfileCtx.Provider>
  );
}
