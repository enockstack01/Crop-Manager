import { MODULES } from './modules';

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
      { route: 'calculators', label: 'Agricultural Calculators', icon: 'calculator' },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { route: 'reports', label: 'Reports', icon: 'file-lines' },
      { route: 'calendar', label: 'Calendar', icon: 'calendar-check' },
    ],
  },
  {
    label: 'System',
    items: [{ route: 'settings', label: 'Settings', icon: 'gear' }],
  },
];

/** Organization workspace (mirrors the web sidebar for organization users). */
const ORG_BASE: NavItem[] = [
  { route: 'org-dashboard', label: 'Overview', icon: 'table-cells-large' },
  { route: 'org-farmers', label: 'Farmers', icon: 'users' },
  { route: 'org-links', label: 'Referral links', icon: 'link' },
];
const ORG_SYSTEM: NavSection = { label: 'System', items: [{ route: 'settings', label: 'Settings', icon: 'gear' }] };
export const ORG_ADMIN_SECTIONS: NavSection[] = [
  { items: ORG_BASE },
  { label: 'Organization', items: [{ route: 'org-team', label: 'Team', icon: 'user-group' }, { route: 'org-profile', label: 'Organization', icon: 'building' }] },
  ORG_SYSTEM,
];
export const ORG_STAFF_SECTIONS: NavSection[] = [
  { items: ORG_BASE },
  { label: 'Organization', items: [{ route: 'org-profile', label: 'Organization', icon: 'building' }] },
  ORG_SYSTEM,
];
