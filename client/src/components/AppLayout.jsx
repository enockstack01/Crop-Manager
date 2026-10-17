import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.jsx';
import { Topbar } from './Topbar.jsx';
import { ProfileProvider, useProfile } from './profile.jsx';
import { OnboardingModal } from './OnboardingModal.jsx';
import { AccountGate } from './AccountGate.jsx';
import { EmptyState, Loading } from './ui.jsx';
import { setCurrency } from '../lib/format.js';
import { setLanguage } from '../i18n/index.js';
import { useMyOrg } from '../lib/orgApi.js';

function readDark() {
  try {
    return localStorage.getItem('darkMode') === 'true';
  } catch {
    return false;
  }
}

function Shell() {
  const { profile, isLoading, isError, error, refetch, isFetching } = useProfile();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(readDark);
  const org = useMyOrg();

  useEffect(() => {
    document.documentElement.classList.toggle('dark-mode', dark);
    try {
      localStorage.setItem('darkMode', String(dark));
    } catch {
      /* ignore */
    }
  }, [dark]);

  // the language saved on the profile (chosen on any device) wins over this browser's
  useEffect(() => {
    if (profile?.language) setLanguage(profile.language);
  }, [profile?.language]);

  // a farmer who opened a referral link before signing in goes back to finish joining
  let pendingToken = null;
  let orgIntent = false;
  try {
    pendingToken = localStorage.getItem('pending_join');
    orgIntent = localStorage.getItem('org_intent') === '1';
  } catch { /* storage unavailable */ }
  if (profile && !profile.is_admin && profile.org_context?.platform_role === 'farmer') {
    if (pendingToken && !profile.org_context?.farmer_org) return <Navigate to={`/join/${pendingToken}`} replace />;
    if (orgIntent && profile.account_status === 'new') return <Navigate to="/organization/register" replace />;
  }

  // accounts that are not approved yet see the request form / status page instead of the app
  if (profile && !profile.is_admin && profile.account_status !== 'active') {
    return <AccountGate profile={profile} onRefresh={() => refetch()} refreshing={isFetching} />;
  }

  // the default currency pre-fills new records (each record keeps its own currency)
  setCurrency(profile?.currency);

  return (
    <div className="app-layout">
      <div
        className={`sidebar-overlay ${mobileOpen ? 'active' : ''}`}
        onClick={() => setMobileOpen(false)}
      />
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        isAdmin={!!profile?.is_admin}
        orgRole={!profile?.is_admin && org.platformRole === 'org_user' ? org.role || 'org_staff' : ''}
        onToggle={() => setCollapsed((c) => !c)}
        onNavigate={() => setMobileOpen(false)}
      />

      <main className={`main-content ${collapsed ? 'main-content-expanded' : ''}`}>
        <Topbar
          profile={profile}
          dark={dark}
          onToggleDark={() => setDark((d) => !d)}
          onMobileMenu={() => setMobileOpen(true)}
        />
        <div className="main-content-inner">
          {isLoading ? (
            <Loading label="Loading your account..." />
          ) : isError ? (
            <EmptyState
              icon={error?.network ? 'fa-plug-circle-xmark' : 'fa-exclamation-triangle'}
              title={error?.network ? "Can't reach the CropManager server" : 'Could not load your account'}
              description={
                error?.network
                  ? 'You are signed in, but the API did not respond. Make sure the server is running, then try again.'
                  : error?.message
              }
              actionLabel="Try again"
              onAction={() => refetch()}
            />
          ) : (
            <Outlet />
          )}
        </div>
      </main>

      {/* administrators skip the access request; they only confirm their name once */}
      {profile && !profile.onboarded && <OnboardingModal profile={profile} />}
    </div>
  );
}

export function AppLayout() {
  return (
    <ProfileProvider>
      <Shell />
    </ProfileProvider>
  );
}
