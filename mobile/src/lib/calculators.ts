// Agricultural calculators — math ported verbatim from client/src/lib/calculators.js
import { formatNumber } from './format';

const num = (v: any) => parseFloat(v) || 0;

export type CalcField = {
  name: string;
  label: string;
  type: 'number' | 'select';
  options?: string[];
  default?: string | number;
};
export type CalcResult = { label: string; value: string };
export type Calculator = {
  type: string;
  title: string;
  icon: string;
  desc: string;
  fields: CalcField[];
  compute: (v: Record<string, any>) => CalcResult[];
};

export const CALCULATORS: Calculator[] = [
  {
    type: 'fertilizer',
    title: 'Fertilizer Calculator',
    icon: 'flask-outline',
    desc: 'Calculate total fertilizer needed based on area and rate.',
    fields: [
      { name: 'area', label: 'Area', type: 'number' },
      { name: 'unit', label: 'Area Unit', type: 'select', options: ['hectares', 'acres'], default: 'hectares' },
      { name: 'rate', label: 'Application Rate', type: 'number' },
      { name: 'rateUnit', label: 'Rate Unit', type: 'select', options: ['kg/ha', 'kg/acre', 'bags/ha'], default: 'kg/ha' },
    ],
    compute: (v) => [
      { label: 'Total Fertilizer Required', value: `${formatNumber((num(v.area) * num(v.rate)).toFixed(2))} ${v.rateUnit || 'kg'} / ${v.unit || 'ha'}` },
    ],
  },
  {
    type: 'npk',
    title: 'NPK Calculator',
    icon: 'atom',
    desc: 'Calculate N, P, K quantities from a fertilizer blend.',
    fields: [
      { name: 'qty', label: 'Fertilizer Quantity (kg)', type: 'number' },
      { name: 'n', label: 'N %', type: 'number' },
      { name: 'p', label: 'P %', type: 'number' },
      { name: 'k', label: 'K %', type: 'number' },
    ],
    compute: (v) => [
      { label: 'Nitrogen (N)', value: `${formatNumber(((num(v.qty) * num(v.n)) / 100).toFixed(2))} kg` },
      { label: 'Phosphorus (P)', value: `${formatNumber(((num(v.qty) * num(v.p)) / 100).toFixed(2))} kg` },
      { label: 'Potassium (K)', value: `${formatNumber(((num(v.qty) * num(v.k)) / 100).toFixed(2))} kg` },
      { label: 'Total Fertilizer', value: `${formatNumber(num(v.qty).toFixed(2))} kg` },
    ],
  },
  {
    type: 'seed-rate',
    title: 'Seed Rate Calculator',
    icon: 'seed-outline',
    desc: 'Calculate total seed requirement for a given area.',
    fields: [
      { name: 'area', label: 'Area', type: 'number' },
      { name: 'unit', label: 'Area Unit', type: 'select', options: ['hectares', 'acres'], default: 'hectares' },
      { name: 'rate', label: 'Seed Rate', type: 'number' },
      { name: 'rateUnit', label: 'Rate Unit', type: 'select', options: ['kg/ha', 'kg/acre'], default: 'kg/ha' },
    ],
    compute: (v) => [
      { label: 'Total Seed Required', value: `${formatNumber((num(v.area) * num(v.rate)).toFixed(2))} ${v.rateUnit || 'kg'} / ${v.unit || 'ha'}` },
    ],
  },
  {
    type: 'plant-population',
    title: 'Plant Population Calculator',
    icon: 'grid',
    desc: 'Estimate plant population from spacing and area.',
    fields: [
      { name: 'row', label: 'Row Spacing (cm)', type: 'number' },
      { name: 'plant', label: 'Plant Spacing (cm)', type: 'number' },
      { name: 'area', label: 'Area (hectares)', type: 'number' },
    ],
    compute: (v) => {
      const perSqm = 10000 / (num(v.row) * num(v.plant));
      const perHa = perSqm * 10000;
      return [
        { label: 'Plants per m²', value: perSqm.toFixed(1) },
        { label: 'Plants per Hectare', value: formatNumber(Math.round(perHa)) },
        { label: 'Estimated Total Population', value: formatNumber(Math.round(perHa * num(v.area))) },
      ];
    },
  },
  {
    type: 'irrigation',
    title: 'Irrigation Calculator',
    icon: 'water-outline',
    desc: 'Estimate water requirements for irrigation.',
    fields: [
      { name: 'area', label: 'Area', type: 'number' },
      { name: 'areaUnit', label: 'Area Unit', type: 'select', options: ['hectares', 'acres'], default: 'hectares' },
      { name: 'depth', label: 'Application Depth (mm)', type: 'number' },
      { name: 'eff', label: 'Application Efficiency (%)', type: 'number', default: 80 },
    ],
    compute: (v) => {
      const areaM2 = v.areaUnit === 'acres' ? num(v.area) * 4046.86 : num(v.area) * 10000;
      const volM3 = areaM2 * (num(v.depth) / 1000);
      const eff = num(v.eff) || 80;
      return [
        { label: 'Water Volume', value: `${formatNumber(volM3.toFixed(1))} m³ (${formatNumber((volM3 * 1000).toFixed(0))} litres)` },
        { label: 'Gross Water Needed', value: `${formatNumber((volM3 / (eff / 100)).toFixed(1))} m³` },
        { label: 'Application Efficiency', value: `${eff}%` },
      ];
    },
  },
  {
    type: 'rainfall',
    title: 'Rainfall Calculator',
    icon: 'weather-pouring',
    desc: 'Calculate water volume from rainfall depth.',
    fields: [
      { name: 'depth', label: 'Rainfall Depth (mm)', type: 'number' },
      { name: 'area', label: 'Area', type: 'number' },
      { name: 'areaUnit', label: 'Area Unit', type: 'select', options: ['hectares', 'acres'], default: 'hectares' },
    ],
    compute: (v) => {
      const areaM2 = v.areaUnit === 'acres' ? num(v.area) * 4046.86 : num(v.area) * 10000;
      const volM3 = areaM2 * (num(v.depth) / 1000);
      return [
        { label: 'Rainfall Depth', value: `${formatNumber(num(v.depth))} mm over ${v.area || 0} ${v.areaUnit || 'hectares'}` },
        { label: 'Water Volume', value: `${formatNumber(volM3.toFixed(1))} m³ (${formatNumber((volM3 * 1000).toFixed(0))} L)` },
      ];
    },
  },
  {
    type: 'area',
    title: 'Field Area Calculator',
    icon: 'vector-square',
    desc: 'Calculate area for rectangles, squares, triangles and circles.',
    fields: [
      { name: 'shape', label: 'Shape', type: 'select', options: ['rectangle', 'square', 'triangle', 'circle'], default: 'rectangle' },
      { name: 'l', label: 'Length / Side (m)', type: 'number' },
      { name: 'w', label: 'Width (m)', type: 'number' },
      { name: 'base', label: 'Triangle Base (m)', type: 'number' },
      { name: 'b', label: 'Triangle Height (m)', type: 'number' },
      { name: 'r', label: 'Circle Radius (m)', type: 'number' },
    ],
    compute: (v) => {
      let m2 = 0;
      if (v.shape === 'rectangle') m2 = num(v.l) * num(v.w);
      else if (v.shape === 'square') m2 = num(v.l) * num(v.l);
      else if (v.shape === 'triangle') m2 = (num(v.base) * num(v.b)) / 2;
      else if (v.shape === 'circle') m2 = Math.PI * num(v.r) * num(v.r);
      const ha = m2 / 10000;
      return [
        { label: 'Square Metres (m²)', value: m2.toFixed(2) },
        { label: 'Hectares (ha)', value: ha.toFixed(4) },
        { label: 'Acres', value: (ha * 2.471).toFixed(4) },
      ];
    },
  },
  {
    type: 'yield',
    title: 'Yield Calculator',
    icon: 'scale-balance',
    desc: 'Calculate yield per hectare or acre.',
    fields: [
      { name: 'qty', label: 'Total Harvest Quantity (kg)', type: 'number' },
      { name: 'area', label: 'Area', type: 'number' },
      { name: 'areaUnit', label: 'Area Unit', type: 'select', options: ['hectares', 'acres'], default: 'hectares' },
    ],
    compute: (v) => {
      const areaHa = v.areaUnit === 'acres' ? num(v.area) * 0.404686 : num(v.area);
      const yHa = areaHa ? num(v.qty) / areaHa : 0;
      return [
        { label: 'Yield per Hectare', value: `${yHa.toFixed(2)} kg/ha` },
        { label: 'Yield per Acre', value: `${(yHa * 2.471).toFixed(2)} kg/ac` },
      ];
    },
  },
  {
    type: 'crop-spacing',
    title: 'Crop Spacing Calculator',
    icon: 'arrow-expand-horizontal',
    desc: 'Calculate plants per hectare from spacing.',
    fields: [
      { name: 'row', label: 'Row Spacing (cm)', type: 'number' },
      { name: 'plant', label: 'Plant Spacing (cm)', type: 'number' },
      { name: 'area', label: 'Area (hectares)', type: 'number' },
    ],
    compute: (v) => {
      const perSqm = 10000 / (num(v.row) * num(v.plant));
      const perHa = perSqm * 10000;
      return [
        { label: 'Plants per m²', value: perSqm.toFixed(2) },
        { label: 'Plants per Hectare', value: formatNumber(Math.round(perHa)) },
        { label: 'Estimated Total', value: formatNumber(Math.round(perHa * num(v.area))) },
      ];
    },
  },
];

export const CALCULATOR_BY_TYPE: Record<string, Calculator> = Object.fromEntries(
  CALCULATORS.map((c) => [c.type, c]),
);
