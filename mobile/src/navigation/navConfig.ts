import { MODULES } from './modules';

export type NavItem = { route: string; label: string; icon: string };
export type NavSection = { label?: string; items: NavItem[] };

const moduleItem = (key: string): NavItem => {
  const m = MODULES.find((x) => x.key === key)!;
  return { route: m.key, label: m.title, icon: m.icon };
};

/** Drawer layout — mirrors client/src/components/Sidebar.jsx SECTIONS. */
export const NAV_SECTIONS: NavSection[] = [
  { items: [{ route: 'dashboard', label: 'Dashboard', icon: 'view-dashboard' }] },
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
    items: [{ route: 'calculators', label: 'Calculators', icon: 'calculator-variant' }],
  },
  {
    label: 'Analytics',
    items: [
      { route: 'reports', label: 'Reports', icon: 'file-chart' },
      { route: 'calendar', label: 'Calendar', icon: 'calendar-check' },
    ],
  },
  {
    label: 'System',
    items: [{ route: 'settings', label: 'Settings', icon: 'cog' }],
  },
];
