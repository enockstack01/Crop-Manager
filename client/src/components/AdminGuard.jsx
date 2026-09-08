import { Navigate, Outlet } from 'react-router-dom';
import { useProfile } from './profile.jsx';
import { Loading } from './ui.jsx';

export function AdminGuard() {
  const { profile, isLoading } = useProfile();
  if (isLoading) return <Loading />;
  if (!profile?.is_admin) return <Navigate to="/" replace />;
  return <Outlet />;
}
