import { useEffect, useRef, useState } from 'react';
import { UserButton } from '@clerk/clerk-react';
import { useQueryClient } from '@tanstack/react-query';
import { useList, useResourceMutations } from '../lib/useResource.js';
import { formatDateTime } from '../lib/format.js';
import { useToast } from './Toast.jsx';

export function Topbar({ onMobileMenu, dark, onToggleDark, profile }) {
  const [notifOpen, setNotifOpen] = useState(false);
  const wrapRef = useRef(null);
  const toast = useToast();
  const qc = useQueryClient();
  const { update } = useResourceMutations('notifications');

  const { data } = useList('notifications', { is_read: false, perPage: 10, sort: 'created_at', order: 'desc' });
  const notifs = data?.data || [];

  useEffect(() => {
    const close = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const markAllRead = async () => {
    await Promise.all(notifs.map((n) => update.mutateAsync({ id: n.id, is_read: true })));
    qc.invalidateQueries({ queryKey: ['notifications'] });
    toast('All notifications marked as read', 'info');
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button id="mobile-menu-btn" onClick={onMobileMenu}>
          <i className="fas fa-bars" />
        </button>
        <div className="topbar-search">
          <i className="fas fa-search" />
          <input
            type="text"
            placeholder="Search..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.target.value.trim().length >= 2) {
                toast('Global search is coming in a future phase', 'info');
              }
            }}
          />
        </div>
      </div>

      <div className="topbar-right">
        <button className="topbar-btn" title="Toggle Dark Mode" onClick={onToggleDark}>
          <i className={`fas ${dark ? 'fa-sun' : 'fa-moon'}`} />
        </button>

        <div className="dropdown" ref={wrapRef}>
          <button
            className="topbar-btn"
            onClick={(e) => {
              e.stopPropagation();
              setNotifOpen((o) => !o);
            }}
          >
            <i className="fas fa-bell" />
            {notifs.length > 0 && (
              <span className="badge-count" style={{ display: 'flex' }}>
                {notifs.length}
              </span>
            )}
          </button>
          <div className={`dropdown-menu notif-dropdown ${notifOpen ? 'dropdown-active' : ''}`}>
            <div className="dropdown-menu-header">
              <span>Notifications</span>
              <button onClick={markAllRead}>Mark all read</button>
            </div>
            {notifs.length === 0 ? (
              <div className="dropdown-empty">No new notifications</div>
            ) : (
              notifs.map((n) => (
                <div key={n.id} className="notif-item unread">
                  <div className={`notif-icon ${n.type || 'info'}`}>
                    <i className="fas fa-bell" />
                  </div>
                  <div className="notif-content">
                    <div className="notif-text">{n.message || n.title}</div>
                    <div className="notif-time">{formatDateTime(n.created_at)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="topbar-user" style={{ gap: 10 }}>
          <div className="topbar-user-info">
            <div className="topbar-user-name">{profile?.full_name || 'User'}</div>
            <div className="topbar-user-role">{profile?.role || 'Farmer'}</div>
          </div>
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>
    </header>
  );
}
