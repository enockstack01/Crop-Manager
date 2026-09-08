import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.jsx';
import { Topbar } from './Topbar.jsx';
import { ProfileProvider, useProfile } from './profile.jsx';
import { OnboardingModal } from './OnboardingModal.jsx';
import { Loading } from './ui.jsx';

function readDark() {
  try {
    return localStorage.getItem('darkMode') === 'true';
  } catch {
    return false;
  }
}

function Shell() {
  const { profile, isLoading } = useProfile();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(readDark);

  useEffect(() => {
    document.documentElement.classList.toggle('dark-mode', dark);
    try {
      localStorage.setItem('darkMode', String(dark));
    } catch {
      /* ignore */
    }
  }, [dark]);

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
          {isLoading ? <Loading /> : <Outlet />}
        </div>
      </main>

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
