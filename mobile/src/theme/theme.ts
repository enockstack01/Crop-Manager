/**
 * Design tokens ported 1:1 from the web app's CSS custom properties
 * (client/src/styles/style.css :root and .dark-mode) so both apps look the same.
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
  placeholder: string;
  border: string;
  orange: string;
  red: string;
  blue: string;
  purple: string;
  green: string;
  overlay: string;
  stripe: string;
  tableHover: string;
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
  placeholder: '#9E9E9E',
  border: '#E0E0E0',
  orange: '#F9A825',
  red: '#D32F2F',
  blue: '#1976D2',
  purple: '#7B1FA2',
  green: '#2E7D32',
  overlay: 'rgba(0,0,0,0.5)',
  stripe: '#F9FAFB',
  tableHover: '#F0F4F0',
  headerText: '#FFFFFF',
};

// the web's .dark-mode only overrides surfaces and text; brand colours stay the same
export const dark: Palette = {
  ...light,
  primaryLight: '#1B3A1D',
  bg: '#121212',
  card: '#1E1E1E',
  surface: '#1E1E1E',
  input: '#2A2A2A',
  text: '#E0E0E0',
  textLight: '#9E9E9E',
  border: '#333333',
  overlay: 'rgba(0,0,0,0.7)',
  stripe: '#252525',
  tableHover: '#2E3A2E',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

/** web: --radius 10px (cards), 8px (buttons, inputs), 6px (badges) */
export const radius = {
  sm: 6,
  md: 8,
  lg: 10,
  xl: 16,
  pill: 999,
};

/** web: --shadow 0 2px 8px rgba(0,0,0,.08) / --shadow-lg 0 8px 30px rgba(0,0,0,.12) */
export function shadow(level: 1 | 2 | 3 = 1) {
  const y = [0, 2, 4, 8][level];
  return {
    shadowColor: '#000000',
    shadowOpacity: [0, 0.08, 0.1, 0.12][level],
    shadowRadius: [0, 8, 12, 30][level] / 2,
    shadowOffset: { width: 0, height: y },
    elevation: [0, 2, 4, 8][level],
  };
}

export const font = {
  xs: 11,
  sm: 12,
  md: 13,
  base: 14,
  lg: 15,
  xl: 16,
  xxl: 24,
  huge: 34,
};

/** Inter, as on the web (loaded in App.tsx via @expo-google-fonts/inter) */
export const FONTS = {
  '400': 'Inter_400Regular',
  '500': 'Inter_500Medium',
  '600': 'Inter_600SemiBold',
  '700': 'Inter_700Bold',
  '800': 'Inter_800ExtraBold',
} as const;
export type Weight = keyof typeof FONTS;
/** fontFamily for a weight (Android needs a distinct family per weight) */
export const ff = (weight: Weight | string = '400') => FONTS[(String(weight) in FONTS ? String(weight) : '400') as Weight];

/** web .kpi-icon.{green|blue|orange|red|purple} — [light bg, dark bg, icon colour] */
export const KPI_TONES: Record<'green' | 'blue' | 'orange' | 'red' | 'purple', [string, string, string]> = {
  green: ['#E8F5E9', '#1A3D1E', '#2E7D32'],
  blue: ['#E3F2FD', '#1A3A5C', '#1976D2'],
  orange: ['#FFF8E1', '#3D3420', '#F9A825'],
  red: ['#FFEBEE', '#3D1A1A', '#D32F2F'],
  purple: ['#F3E5F5', '#2D1A3D', '#7B1FA2'],
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
