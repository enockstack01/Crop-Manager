/**
 * Design tokens ported from the web app's CSS custom properties
 * (client/src/styles/style.css :root and .dark-mode).
 */
export type Palette = {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  bg: string;
  card: string;
  surface: string;
  input: string;
  text: string;
  textLight: string;
  border: string;
  orange: string;
  red: string;
  blue: string;
  purple: string;
  green: string;
  overlay: string;
  stripe: string;
  headerText: string;
};

export const light: Palette = {
  primary: '#2E7D32',
  primaryLight: '#E8F5E9',
  primaryDark: '#1B5E20',
  bg: '#F5F7FA',
  card: '#FFFFFF',
  surface: '#FFFFFF',
  input: '#FFFFFF',
  text: '#263238',
  textLight: '#546E7A',
  border: '#E0E0E0',
  orange: '#F9A825',
  red: '#D32F2F',
  blue: '#1976D2',
  purple: '#7B1FA2',
  green: '#2E7D32',
  overlay: 'rgba(0,0,0,0.5)',
  stripe: '#F9FAFB',
  headerText: '#FFFFFF',
};

export const dark: Palette = {
  primary: '#4CAF50',
  primaryLight: '#1B3A1D',
  primaryDark: '#2E7D32',
  bg: '#121212',
  card: '#1E1E1E',
  surface: '#1E1E1E',
  input: '#2A2A2A',
  text: '#E0E0E0',
  textLight: '#9E9E9E',
  border: '#333333',
  orange: '#F9A825',
  red: '#EF5350',
  blue: '#42A5F5',
  purple: '#AB47BC',
  green: '#66BB6A',
  overlay: 'rgba(0,0,0,0.7)',
  stripe: '#252525',
  headerText: '#FFFFFF',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999,
};

/** Soft, layered elevation — used for cards, sheets, the FAB and toasts. */
export function shadow(level: 1 | 2 | 3 = 1) {
  const y = [0, 1, 4, 8][level];
  return {
    shadowColor: '#0B2A10',
    shadowOpacity: [0, 0.06, 0.1, 0.16][level],
    shadowRadius: [0, 4, 10, 18][level],
    shadowOffset: { width: 0, height: y },
    elevation: [0, 1, 4, 8][level],
  };
}

export const font = {
  xs: 11,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 26,
  huge: 34,
};

/** Status → chip colours, mirrors format.js:badgeClass. */
export const STATUS_TONES: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'neutral'> = {
  Active: 'success', Fallow: 'neutral', Preparing: 'warning', Maintenance: 'info',
  Planned: 'info', Planted: 'primary', Growing: 'success', 'Ready for Harvest': 'warning',
  Harvested: 'primary', Completed: 'success', Cancelled: 'danger',
  Available: 'success', 'In Use': 'info', Damaged: 'danger', Retired: 'neutral',
  Pending: 'warning', 'Partially Paid': 'info', Paid: 'success',
  Low: 'warning', Moderate: 'info', High: 'danger', Critical: 'danger',
  Healthy: 'success', 'Under Observation': 'warning', 'At Risk': 'danger',
  'In Stock': 'success', 'Low Stock': 'warning', 'Out of Stock': 'danger',
  Excellent: 'success', Good: 'success', Average: 'warning', Poor: 'danger', Rejected: 'danger',
};

export const CHART_PALETTE = [
  '#2E7D32', '#1976D2', '#F9A825', '#D32F2F', '#7B1FA2',
  '#00897B', '#E65100', '#5D4037', '#37474F', '#C2185B',
];
