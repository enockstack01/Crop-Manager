/**
 * Agricoders brand tokens (Brand and Template Guidelines v1.0, section 4), mirroring the web app's
 * CSS custom properties (client/src/styles/style.css :root and .dark-mode) so both apps look the same.
 * No light greens anywhere: Mist is the only tint, and only as a page background.
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
  primary: '#2E7D32',       // Leaf Green: icon circles, links, main chart series
  primaryLight: '#F3F8F3',  // Mist
  primaryDark: '#1B5E20',   // Forest Green: titles, headers, primary buttons
  bg: '#F3F8F3',
  card: '#FFFFFF',
  surface: '#FFFFFF',
  input: '#FFFFFF',
  text: '#1C2B1E',          // Ink
  textLight: '#5B6B5D',     // Slate
  placeholder: '#5B6B5D',
  border: '#D5E3D6',        // Fern
  orange: '#F9A825',        // Harvest Amber: one highlight per view
  red: '#C62828',           // Alert Red: critical only
  blue: '#1B5E20',          // legacy accent keys now map to the brand greens and Slate
  purple: '#5B6B5D',
  green: '#2E7D32',
  overlay: 'rgba(15,31,20,0.55)',
  stripe: '#F3F8F3',
  tableHover: 'rgba(213,227,214,0.5)',
  headerText: '#FFFFFF',
};

// dark mode: deep green surfaces with softer brand greens, as in the Agriplan app
export const dark: Palette = {
  ...light,
  primary: '#81C784',
  primaryLight: '#1B3A1D',
  primaryDark: '#A5D6A7',
  bg: '#0C140D',
  card: '#111814',
  surface: '#111814',
  input: '#182019',
  text: '#E6EEE7',
  textLight: '#9AA79B',
  placeholder: '#6B776C',
  border: '#26332A',
  overlay: 'rgba(0,0,0,0.7)',
  stripe: '#141C15',
  tableHover: '#1B2A1D',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

/** Agriplan app style: 16 radius cards, pill buttons and badges, 12 radius inputs */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

/** Cards are flat (level 1 has no shadow); only floating sheets and buttons lift. */
export function shadow(level: 1 | 2 | 3 = 1) {
  const y = [0, 0, 4, 8][level];
  return {
    shadowColor: '#000000',
    shadowOpacity: [0, 0, 0.1, 0.12][level],
    shadowRadius: [0, 0, 12, 30][level] / 2,
    shadowOffset: { width: 0, height: y },
    elevation: [0, 0, 4, 8][level],
  };
}

/** Calibri sets slightly smaller than other fonts, so the scale sits one point higher. */
export const font = {
  xs: 12,
  sm: 13,
  md: 14,
  base: 15,
  lg: 16,
  xl: 17,
  xxl: 26,
  huge: 36,
};

/** The forest green of the app bar, the hero card and the side menu. */
export const FOREST = '#1B5E20';
export const AMBER = '#F9A825';

/** Carlito, the metric-compatible Calibri (loaded in App.tsx via @expo-google-fonts/carlito); Regular and Bold only */
export const FONTS = {
  '400': 'Carlito_400Regular',
  '500': 'Carlito_400Regular',
  '600': 'Carlito_700Bold',
  '700': 'Carlito_700Bold',
  '800': 'Carlito_700Bold',
} as const;
export type Weight = keyof typeof FONTS;
/** fontFamily for a weight (Android needs a distinct family per weight) */
export const ff = (weight: Weight | string = '400') => FONTS[(String(weight) in FONTS ? String(weight) : '400') as Weight];

/** web .kpi-icon.*: solid circle with a white glyph — [light bg, dark bg, glyph colour]. Leaf Green, Harvest Amber, Alert Red only. */
export const KPI_TONES: Record<'green' | 'blue' | 'orange' | 'red' | 'purple', [string, string, string]> = {
  green: ['#2E7D32', '#2E7D32', '#FFFFFF'],
  blue: ['#2E7D32', '#2E7D32', '#FFFFFF'],
  orange: ['#F9A825', '#F9A825', '#FFFFFF'],
  red: ['#C62828', '#C62828', '#FFFFFF'],
  purple: ['#2E7D32', '#2E7D32', '#FFFFFF'],
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

export const CHART_PALETTE = ['#2E7D32', '#F9A825', '#1B5E20', '#5B6B5D', '#14532D', '#1C2B1E'];
