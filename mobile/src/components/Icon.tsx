import React from 'react';
import { StyleProp, TextStyle } from 'react-native';
import { FontAwesome6, MaterialCommunityIcons } from '@expo/vector-icons';
// the free solid set's glyph names (FontAwesome6 does not expose glyphMap statically)
import FA_META from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/FontAwesome6Free_meta.json';

/*
 * The web app uses Font Awesome 6 (solid). Icon renders the same glyphs so both apps
 * match. It accepts Font Awesome names directly ('tractor', 'wheat-awn', …) and also
 * the Material names used across the codebase, translated to the icon the web shows
 * in the same place. Anything unknown falls back to Material Community Icons.
 */
const TO_FA: Record<string, string> = {
  // navigation / modules (web sidebar icons)
  'view-dashboard': 'table-cells-large',
  'map-outline': 'map',
  sprout: 'seedling',
  seed: 'seedling',
  'seed-outline': 'seedling',
  'calendar-range': 'calendar-days',
  sync: 'rotate',
  'clipboard-check-outline': 'list-check',
  water: 'droplet',
  'water-outline': 'droplet',
  'flask-outline': 'flask',
  'shield-check': 'shield-halved',
  'magnify-scan': 'magnifying-glass',
  barley: 'wheat-awn',
  'package-variant': 'boxes-stacked',
  'package-variant-closed': 'boxes-stacked',
  'package-variant-closed-remove': 'box-archive',
  cog: 'gear',
  cash: 'hand-holding-dollar',
  'cash-multiple': 'hand-holding-dollar',
  'calculator-variant': 'calculator',
  'file-chart': 'file-lines',
  'chart-box-outline': 'chart-column',
  'weather-pouring': 'cloud-rain',
  'vector-square': 'vector-square',
  'arrow-expand-all': 'expand',
  'arrow-expand-horizontal': 'arrows-left-right',
  'scale-balance': 'scale-balanced',
  grid: 'table-cells',
  atom: 'atom',
  alert: 'triangle-exclamation',
  // actions & chrome
  plus: 'plus',
  pencil: 'pen',
  'trash-can-outline': 'trash-can',
  'content-save': 'floppy-disk',
  check: 'check',
  close: 'xmark',
  'close-circle': 'circle-xmark',
  magnify: 'magnifying-glass',
  'filter-variant': 'filter',
  refresh: 'rotate-right',
  restore: 'rotate-left',
  logout: 'right-from-bracket',
  login: 'right-to-bracket',
  'arrow-right': 'arrow-right',
  'arrow-up-bold': 'arrow-up',
  'arrow-down-bold': 'arrow-down',
  'chevron-right': 'chevron-right',
  'chevron-left': 'chevron-left',
  'chevron-down': 'chevron-down',
  calendar: 'calendar',
  'calendar-check': 'calendar-check',
  camera: 'camera',
  'image-multiple': 'images',
  'email-outline': 'envelope',
  'email-fast-outline': 'paper-plane',
  'lock-outline': 'lock',
  'lock-reset': 'key',
  'lock-check-outline': 'lock',
  'shield-key-outline': 'shield-halved',
  'shield-check-outline': 'shield-halved',
  'account-outline': 'user',
  'account-plus-outline': 'user-plus',
  'eye-outline': 'eye',
  'eye-off-outline': 'eye-slash',
  'cloud-off-outline': 'cloud',
  'alert-circle-outline': 'circle-exclamation',
  'inbox-outline': 'inbox',
  'check-circle': 'circle-check',
  information: 'circle-info',
  'chart-line': 'chart-line',
  leaf: 'leaf',
  tractor: 'tractor',
  receipt: 'receipt',
  wrench: 'wrench',
  flask: 'flask',
  calculator: 'calculator',
};

const SOLID = new Set<string>((FA_META as any).solid ?? []);
const hasFA = (name: string) => SOLID.has(name);

export function Icon({
  name,
  size = 16,
  color,
  style,
}: {
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  // mapped names first: some Material names also exist in FA but mean something else (e.g. 'water')
  const fa = TO_FA[name] ?? (hasFA(name) ? name : undefined);
  if (fa) return <FontAwesome6 name={fa as any} size={size} color={color} style={style} solid />;
  return <MaterialCommunityIcons name={name as any} size={size + 2} color={color} style={style} />;
}
