import { MODULES } from './modules';
import { offlineLlmSupported } from '../ml/capability';

export type NavItem = { route: string; label: string; icon: string };
export type NavSection = { label?: string; items: NavItem[] };

/** Labels and Font Awesome icons exactly as in the web sidebar (client/src/components/Sidebar.jsx). */
const WEB_NAV: Record<string, { label: string; icon: string }> = {
  farms: { label: 'Farms', icon: 'tractor' },
  fields: { label: 'Fields', icon: 'map' },
  crops: { label: 'Crops', icon: 'leaf' },
  varieties: { label: 'Varieties', icon: 'seedling' },
  seasons: { label: 'Seasons', icon: 'calendar-days' },
  'crop-cycles': { label: 'Crop Cycles', icon: 'rotate' },
  planting: { label: 'Planting', icon: 'seedling' },
  activities: { label: 'Field Activities', icon: 'list-check' },
  irrigation: { label: 'Irrigation', icon: 'droplet' },
  fertilizers: { label: 'Fertilizer', icon: 'flask' },
  'crop-protection': { label: 'Crop Protection', icon: 'shield-halved' },
  scouting: { label: 'Crop Scouting', icon: 'magnifying-glass' },
  harvest: { label: 'Harvest', icon: 'wheat-awn' },
  inventory: { label: 'Inventory', icon: 'boxes-stacked' },
  equipment: { label: 'Equipment', icon: 'gear' },
  maintenance: { label: 'Equipment Maintenance', icon: 'wrench' },
  expenses: { label: 'Expenses', icon: 'receipt' },
  sales: { label: 'Sales', icon: 'hand-holding-dollar' },
};

const moduleItem = (key: string): NavItem => {
  const m = MODULES.find((x) => x.key === key)!;
  const web = WEB_NAV[key];
  return { route: m.key, label: web?.label ?? m.title, icon: web?.icon ?? m.icon };
};

/** Drawer layout — mirrors client/src/components/Sidebar.jsx SECTIONS. */
export const NAV_SECTIONS: NavSection[] = [
  { items: [{ route: 'dashboard', label: 'Dashboard', icon: 'table-cells-large' }] },
  {
    label: 'Farm Management',
    items: ['farms', 'fields', 'crops', 'varieties', 'seasons'].map(moduleItem),
  },
  {
    label: 'Production',
    items: ['crop-cycles', 'planting', 'activities', 'irrigation', 'fertilizers', 'crop-protection', 'scouting', 'harvest'].map(moduleItem),
  },
  {
    label: 'Resources',
    items: ['inventory', 'equipment', 'maintenance'].map(moduleItem),
  },
  {
    label: 'Finance',
    items: ['expenses', 'sales'].map(moduleItem),
  },
  {
    label: 'Tools',
    items: [
      { route: 'assistant', label: 'AI Assistant', icon: 'wand-magic-sparkles' },
      { route: 'scan', label: 'Scan a plant', icon: 'leaf' },
      { route: 'offline-tools', label: 'Offline tools', icon: 'cloud-off-outline' },
      { route: 'offline-assistant', label: 'Offline assistant', icon: 'microchip' },
      { route: 'calculators', label: 'Agricultural Calculators', icon: 'calculator' },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { route: 'reports', label: 'Reports', icon: 'file-lines' },
      { route: 'calendar', label: 'Calendar', icon: 'calendar-check' },
      { route: 'weather', label: 'Weather', icon: 'cloud-sun' },
    ],
  },
  {
    label: 'System',
    items: [{ route: 'settings', label: 'Settings', icon: 'gear' }],
  },
];

/** Platform administration (web sidebar "Administration"), shown to system administrators only. */
export const ADMIN_SECTION: NavSection = {
  label: 'Administration',
  items: [
    { route: 'admin-overview', label: 'Admin Overview', icon: 'gauge-high' },
    { route: 'admin-users', label: 'User Management', icon: 'users-gear' },
    { route: 'admin-orgs', label: 'Organizations', icon: 'building' },
    { route: 'admin-audit', label: 'Audit log', icon: 'clipboard-list' },
    { route: 'admin-ai', label: 'AI assistant', icon: 'wand-magic-sparkles' },
    { route: 'admin-data', label: 'Data Browser', icon: 'database' },
    { route: 'admin-settings', label: 'System Settings', icon: 'sliders' },
  ],
};

/**
 * The menu keeps every entry for every farm account; the account type decides which groups come first (an agronomist works with crops and
 * diagnosis first, a farm manager with the operation). Mirrors sectionsFor in client/src/components/Sidebar.jsx.
 */
const FIRST: Record<string, string[]> = {
  Agronomist: ['Dashboard', 'Tools', 'Production', 'Farm Management', 'Analytics'],
  'Farm Manager': ['Dashboard', 'Production', 'Resources', 'Finance', 'Analytics'],
};
export function sectionsFor(role?: string): NavSection[] {
  const all = offlineLlmSupported() ? NAV_SECTIONS : NAV_SECTIONS.map((s) => ({ ...s, items: s.items.filter((i) => i.route !== 'offline-assistant') })); // a 32-bit phone is not offered the offline assistant
  const order = FIRST[role || ''];
  if (!order) return all;
  const key = (s: NavSection) => s.label || 'Dashboard';
  const rank = (s: NavSection) => { const i = order.indexOf(key(s)); return i === -1 ? order.length : i; };
  return [...all].sort((a, b) => rank(a) - rank(b)); // stable: groups not named keep their order
}

/** Organization workspace (mirrors the web sidebar for organization users). */
const ORG_BASE: NavItem[] = [
  { route: 'org-dashboard', label: 'Overview', icon: 'table-cells-large' },
  { route: 'org-farmers', label: 'Farmers', icon: 'users' },
  { route: 'org-invitations', label: 'Invitations', icon: 'envelope' },
  { route: 'org-links', label: 'Referral links', icon: 'link' },
];
const ORG_SYSTEM: NavSection = { label: 'System', items: [{ route: 'settings', label: 'Settings', icon: 'gear' }] };
export const ORG_ADMIN_SECTIONS: NavSection[] = [
  { items: ORG_BASE },
  { label: 'Organization', items: [{ route: 'org-team', label: 'Team', icon: 'user-group' }, { route: 'org-profile', label: 'Organization', icon: 'building' }, { route: 'org-activity', label: 'Activity', icon: 'clock-rotate-left' }] },
  ORG_SYSTEM,
];
export const ORG_STAFF_SECTIONS: NavSection[] = [
  { items: ORG_BASE },
  { label: 'Organization', items: [{ route: 'org-profile', label: 'Organization', icon: 'building' }] },
  ORG_SYSTEM,
];
