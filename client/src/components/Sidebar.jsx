import { NavLink } from 'react-router-dom';
import { useClerk } from '@clerk/clerk-react';

const SECTIONS = [
  { items: [{ to: '/', icon: 'fa-th-large', label: 'Dashboard', end: true }] },
  {
    label: 'Farm Management',
    items: [
      { to: '/farms', icon: 'fa-tractor', label: 'Farms' },
      { to: '/fields', icon: 'fa-map', label: 'Fields' },
      { to: '/crops', icon: 'fa-leaf', label: 'Crops' },
      { to: '/varieties', icon: 'fa-seedling', label: 'Varieties' },
      { to: '/seasons', icon: 'fa-calendar-alt', label: 'Seasons' },
    ],
  },
  {
    label: 'Production',
    items: [
      { to: '/crop-cycles', icon: 'fa-sync-alt', label: 'Crop Cycles' },
      { to: '/planting', icon: 'fa-hand-holding-seedling', label: 'Planting' },
      { to: '/activities', icon: 'fa-tasks', label: 'Field Activities' },
      { to: '/irrigation', icon: 'fa-tint', label: 'Irrigation' },
      { to: '/fertilizers', icon: 'fa-flask', label: 'Fertilizer' },
      { to: '/crop-protection', icon: 'fa-shield-alt', label: 'Crop Protection' },
      { to: '/scouting', icon: 'fa-search', label: 'Crop Scouting' },
      { to: '/harvest', icon: 'fa-wheat-awn', label: 'Harvest' },
    ],
  },
  {
    label: 'Resources',
    items: [
      { to: '/inventory', icon: 'fa-boxes', label: 'Inventory' },
      { to: '/equipment', icon: 'fa-cog', label: 'Equipment' },
      { to: '/maintenance', icon: 'fa-wrench', label: 'Equipment Maintenance' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { to: '/expenses', icon: 'fa-receipt', label: 'Expenses' },
      { to: '/sales', icon: 'fa-hand-holding-usd', label: 'Sales' },
    ],
  },
  { label: 'Tools', items: [{ to: '/calculators', icon: 'fa-calculator', label: 'Agricultural Calculators' }] },
  {
    label: 'Analytics',
    items: [
      { to: '/reports', icon: 'fa-file-alt', label: 'Reports' },
      { to: '/calendar', icon: 'fa-calendar-check', label: 'Calendar' },
    ],
  },
  { label: 'System', items: [{ to: '/settings', icon: 'fa-cog', label: 'Settings' }] },
];

const ADMIN_SECTION = {
  label: 'Administration',
  items: [
    { to: '/admin', icon: 'fa-gauge-high', label: 'Admin Overview', end: true },
    { to: '/admin/users', icon: 'fa-users-gear', label: 'User Management' },
    { to: '/admin/data', icon: 'fa-database', label: 'Data Browser' },
  ],
};

export function Sidebar({ collapsed, mobileOpen, isAdmin, onToggle, onNavigate }) {
  const { signOut } = useClerk();

  return (
    <aside
      className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''} ${mobileOpen ? 'sidebar-mobile-open' : ''}`}
      id="sidebar"
    >
      <div className="sidebar-header">
        <div className="sidebar-logo-icon">
          <i className="fas fa-seedling" />
        </div>
        <div className="sidebar-logo-text">
          Crop<span>Manager</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {(isAdmin ? [...SECTIONS, ADMIN_SECTION] : SECTIONS).map((section, i) => (
          <div key={section.label || i}>
            {section.label && <div className="sidebar-label">{section.label}</div>}
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onNavigate}
                className={({ isActive }) => (isActive ? 'nav-active' : undefined)}
              >
                <i className={`fas ${item.icon}`} />
                <span className="sidebar-nav-text">{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
        <div className="sidebar-label">Session</div>
        <a
          href="#logout"
          onClick={(e) => {
            e.preventDefault();
            signOut({ redirectUrl: '/' });
          }}
        >
          <i className="fas fa-sign-out-alt" />
          <span className="sidebar-nav-text">Logout</span>
        </a>
      </nav>

      <div className="sidebar-footer">
        <button className="sidebar-toggle" onClick={onToggle}>
          <i className={`fas ${collapsed ? 'fa-chevron-right' : 'fa-chevron-left'}`} />
          <span className="sidebar-nav-text">Collapse</span>
        </button>
      </div>
    </aside>
  );
}
