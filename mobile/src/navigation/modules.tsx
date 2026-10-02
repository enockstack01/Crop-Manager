import React from 'react';
import { useAll } from '../lib/useResource';
import { formatCurrency, formatDate, formatNumber } from '../lib/format';
import { mediaUrl } from '../env';
import { Image } from 'react-native';
import { STATUS_TONES } from '../theme/theme';
import { FormApi, DateField, NumberField, SelectField, TextAreaField, TextField, MoneyField } from '../components/fields';
import { PhotoField } from '../components/PhotoField';
import { CycleSelect, FarmFieldRow } from '../components/relationFields';
import {
  ACTIVITY_TYPES, AREA_UNITS, CYCLE_STATUS, EQUIPMENT_STATUS, EXPENSE_CATEGORIES,
  FARM_TYPES, FERTILIZER_METHODS, FERTILIZER_TYPES, FIELD_STATUS, GROWING_PERIOD_UNITS,
  HARVEST_QUALITY, INVENTORY_CATEGORIES, INVENTORY_UNITS, IRRIGATION_METHODS, PAYMENT_STATUS,
  PLANT_HEALTH, PROBLEM_TYPES, PROTECTION_METHODS, SEASON_STATUS, SEVERITIES, SPACING_UNITS,
  WATER_UNITS,
} from '../lib/options';

/* --------------------------------------------------------------- types */
export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'neutral';
export type RowView = {
  title: string;
  subtitle?: string;
  badge?: { label: string; tone: Tone } | null;
  right?: string;
};
export type FilterDef = { key: string; placeholder: string; options: { value: string; label: string }[] };

export type ModuleConfig = {
  key: string;
  resource: string;
  title: string;
  subtitle: string;
  icon: string;
  section: string;
  addLabel: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  defaultSort?: { sort: string; order: 'asc' | 'desc' };
  emptyIcon: string;
  emptyTitle: string;
  emptyDescription: string;
  useFilters?: () => FilterDef[];
  row: (r: any) => RowView;
  detail: (r: any) => [string, React.ReactNode][];
  initial: Record<string, any>;
  Form: (form: FormApi) => React.ReactNode;
  fromRow?: (r: any) => Record<string, any>;
  toPayload?: (v: any) => any;
  validate?: (v: any) => string | null;
  formTitle: string;
  /** extra per-row actions, e.g. inventory stock in/out */
  rowActions?: 'inventory-stock';
};

const tone = (s?: string): Tone => (s ? STATUS_TONES[s] ?? 'neutral' : 'neutral');
const numOrNull = (v: any) => (v === '' || v == null ? null : Number(v));
const n0 = (v: any) => Number(v) || 0;
const farmField = (r: any) => [r.farms?.name || '—', r.fields?.name].filter(Boolean).join(' / ');

/* ============================================================ FARM MGMT */
const farms: ModuleConfig = {
  key: 'farms', resource: 'farms', section: 'Farm Management',
  title: 'Farms', subtitle: 'Manage your farm locations and details.',
  icon: 'tractor', addLabel: 'Add Farm', formTitle: 'Farm',
  searchPlaceholder: 'Search farms...', defaultSort: { sort: 'created_at', order: 'desc' },
  emptyIcon: 'tractor', emptyTitle: 'No Farms Yet',
  emptyDescription: 'Start by adding your first farm to begin managing crop production.',
  row: (r) => ({ title: r.name, subtitle: r.location || r.district || '—', badge: r.farm_type ? { label: r.farm_type, tone: 'neutral' } : null, right: `${formatNumber(r.total_area)} ${r.area_unit || 'ha'}` }),
  detail: (r) => [
    ['Farm Name', r.name], ['Code', r.code], ['Location', r.location], ['District', r.district],
    ['Province', r.province], ['Country', r.country],
    ['Total Area', `${formatNumber(r.total_area)} ${r.area_unit || 'ha'}`], ['Farm Type', r.farm_type],
    ['Description', r.description], ['Notes', r.notes],
  ],
  initial: {
    name: '', code: '', description: '', location: '', district: '', province: '',
    country: 'Zambia', total_area: '', area_unit: 'hectares', farm_type: 'Crop', notes: '',
  },
  toPayload: (v) => ({ ...v, total_area: v.total_area === '' ? null : Number(v.total_area) }),
  Form: (f) => (
    <>
      <TextField label="Farm Name" required {...f.bind('name')} placeholder="e.g. Greenfield Farm" />
      <TextField label="Farm Code" {...f.bind('code')} placeholder="e.g. GF-001" />
      <TextAreaField label="Description" {...f.bind('description')} />
      <TextField label="Location" {...f.bind('location')} />
      <TextField label="District" {...f.bind('district')} />
      <TextField label="Province" {...f.bind('province')} />
      <TextField label="Country" {...f.bind('country')} />
      <NumberField label="Total Area" {...f.bind('total_area')} />
      <SelectField label="Area Unit" {...f.bind('area_unit')} options={AREA_UNITS} placeholder="" />
      <SelectField label="Farm Type" {...f.bind('farm_type')} options={FARM_TYPES} placeholder="" />
      <TextAreaField label="Notes" {...f.bind('notes')} />
    </>
  ),
};

const fields: ModuleConfig = {
  key: 'fields', resource: 'fields', section: 'Farm Management',
  title: 'Fields', subtitle: 'Track crop production areas within each farm.',
  icon: 'map-outline', addLabel: 'Add Field', formTitle: 'Field',
  searchPlaceholder: 'Search fields...',
  emptyIcon: 'map-outline', emptyTitle: 'No Fields Yet',
  emptyDescription: 'Add your first field to start tracking crop production areas.',
  useFilters: () => {
    const { items: fm } = useAll('farms');
    return [
      { key: 'farm_id', placeholder: 'All Farms', options: fm.map((f: any) => ({ value: f.id, label: f.name })) },
      { key: 'status', placeholder: 'All Statuses', options: FIELD_STATUS.map((s) => ({ value: s, label: s })) },
    ];
  },
  row: (r) => ({ title: r.name, subtitle: r.farms?.name || '—', badge: r.status ? { label: r.status, tone: tone(r.status) } : null, right: `${formatNumber(r.area)} ${r.area_unit || 'ha'}` }),
  detail: (r) => [
    ['Field Name', r.name], ['Farm', r.farms?.name], ['Code', r.code],
    ['Area', `${formatNumber(r.area)} ${r.area_unit || 'ha'}`], ['Location', r.location],
    ['Soil Type', r.soil_type], ['Soil pH', r.soil_ph], ['Status', r.status],
    ['Latitude', r.latitude], ['Longitude', r.longitude], ['Notes', r.notes],
  ],
  initial: {
    farm_id: '', name: '', code: '', area: '', area_unit: 'hectares', location: '',
    latitude: '', longitude: '', soil_type: '', soil_ph: '', status: 'Active', notes: '',
  },
  fromRow: (r) => ({ farm_id: r.farm_id || '' }),
  toPayload: (v) => ({ ...v, area: numOrNull(v.area), soil_ph: numOrNull(v.soil_ph), latitude: numOrNull(v.latitude), longitude: numOrNull(v.longitude) }),
  Form: (f) => {
    const { items: farmList } = useAll('farms');
    return (
      <>
        <SelectField label="Farm" required {...f.bind('farm_id')} placeholder="Select Farm" options={farmList.map((x: any) => ({ value: x.id, label: x.name }))} />
        <TextField label="Field Name" required {...f.bind('name')} placeholder="e.g. North Block" />
        <TextField label="Field Code" {...f.bind('code')} />
        <TextField label="Location" {...f.bind('location')} />
        <NumberField label="Area" {...f.bind('area')} />
        <SelectField label="Area Unit" {...f.bind('area_unit')} options={AREA_UNITS} placeholder="" />
        <TextField label="Soil Type" {...f.bind('soil_type')} placeholder="e.g. Sandy loam" />
        <NumberField label="Soil pH" {...f.bind('soil_ph')} />
        <NumberField label="Latitude" {...f.bind('latitude')} />
        <NumberField label="Longitude" {...f.bind('longitude')} />
        <SelectField label="Status" {...f.bind('status')} options={FIELD_STATUS} placeholder="" />
        <TextAreaField label="Notes" {...f.bind('notes')} />
      </>
    );
  },
};

const crops: ModuleConfig = {
  key: 'crops', resource: 'crops', section: 'Farm Management',
  title: 'Crops', subtitle: 'Build your crop database.',
  icon: 'leaf', addLabel: 'Add Crop', formTitle: 'Crop',
  searchPlaceholder: 'Search crops...', defaultSort: { sort: 'name', order: 'asc' },
  emptyIcon: 'leaf', emptyTitle: 'No Crops Yet',
  emptyDescription: 'Add your first crop to start building your crop database.',
  row: (r) => ({ title: r.name, subtitle: r.description || '—', badge: r.category ? { label: r.category, tone: 'primary' } : null, right: r.typical_growing_period ? `${r.typical_growing_period} ${r.growing_period_unit || 'days'}` : '' }),
  detail: (r) => [
    ['Crop Name', r.name], ['Category', r.category],
    ['Growing Period', r.typical_growing_period ? `${r.typical_growing_period} ${r.growing_period_unit || 'days'}` : '—'],
    ['Description', r.description], ['Notes', r.notes],
  ],
  initial: { name: '', category: '', description: '', typical_growing_period: '', growing_period_unit: 'days', notes: '' },
  toPayload: (v) => ({ ...v, typical_growing_period: v.typical_growing_period === '' ? null : Number(v.typical_growing_period) }),
  Form: (f) => (
    <>
      <TextField label="Crop Name" required {...f.bind('name')} placeholder="e.g. Maize" />
      <TextField label="Category" {...f.bind('category')} placeholder="e.g. Cereal" />
      <NumberField label="Typical Growing Period" {...f.bind('typical_growing_period')} />
      <SelectField label="Period Unit" {...f.bind('growing_period_unit')} options={GROWING_PERIOD_UNITS} placeholder="" />
      <TextAreaField label="Description" {...f.bind('description')} />
      <TextAreaField label="Notes" {...f.bind('notes')} />
    </>
  ),
};

const varieties: ModuleConfig = {
  key: 'varieties', resource: 'crop-varieties', section: 'Farm Management',
  title: 'Varieties', subtitle: 'Track different types within each crop.',
  icon: 'sprout', addLabel: 'Add Variety', formTitle: 'Variety',
  searchPlaceholder: 'Search varieties...',
  emptyIcon: 'sprout', emptyTitle: 'No Varieties Yet',
  emptyDescription: 'Add crop varieties to track different types within each crop.',
  useFilters: () => {
    const { items: cr } = useAll('crops');
    return [{ key: 'crop_id', placeholder: 'All Crops', options: cr.map((c: any) => ({ value: c.id, label: c.name })) }];
  },
  row: (r) => ({ title: r.name, subtitle: r.seed_source || '—', badge: r.crops?.name ? { label: r.crops.name, tone: 'primary' } : null, right: r.maturity_period ? `${r.maturity_period} ${r.maturity_period_unit || 'days'}` : '' }),
  detail: (r) => [
    ['Variety Name', r.name], ['Crop', r.crops?.name],
    ['Maturity Period', r.maturity_period ? `${r.maturity_period} ${r.maturity_period_unit || 'days'}` : '—'],
    ['Seed Source', r.seed_source], ['Description', r.description], ['Notes', r.notes],
  ],
  initial: { crop_id: '', name: '', description: '', maturity_period: '', maturity_period_unit: 'days', seed_source: '', notes: '' },
  fromRow: (r) => ({ crop_id: r.crop_id || '' }),
  toPayload: (v) => ({ ...v, maturity_period: v.maturity_period === '' ? null : Number(v.maturity_period) }),
  Form: (f) => {
    const { items: cr } = useAll('crops');
    return (
      <>
        <SelectField label="Crop" required {...f.bind('crop_id')} placeholder="Select Crop" options={cr.map((c: any) => ({ value: c.id, label: c.name }))} />
        <TextField label="Variety Name" required {...f.bind('name')} placeholder="e.g. SC 627" />
        <NumberField label="Maturity Period" {...f.bind('maturity_period')} />
        <SelectField label="Period Unit" {...f.bind('maturity_period_unit')} options={GROWING_PERIOD_UNITS} placeholder="" />
        <TextField label="Seed Source" {...f.bind('seed_source')} placeholder="e.g. SeedCo" />
        <TextAreaField label="Description" {...f.bind('description')} />
        <TextAreaField label="Notes" {...f.bind('notes')} />
      </>
    );
  },
};

const seasons: ModuleConfig = {
  key: 'seasons', resource: 'seasons', section: 'Farm Management',
  title: 'Seasons', subtitle: 'Organize crop production by growing period.',
  icon: 'calendar-range', addLabel: 'Add Season', formTitle: 'Season',
  searchPlaceholder: 'Search seasons...',
  emptyIcon: 'calendar-range', emptyTitle: 'No Seasons Yet',
  emptyDescription: 'Define your growing seasons to organize crop production by period.',
  useFilters: () => [{ key: 'status', placeholder: 'All Statuses', options: SEASON_STATUS.map((s) => ({ value: s, label: s })) }],
  row: (r) => ({ title: r.name, subtitle: `${formatDate(r.start_date)} – ${formatDate(r.end_date)}`, badge: r.status ? { label: r.status, tone: tone(r.status) } : null }),
  detail: (r) => [
    ['Season Name', r.name], ['Status', r.status], ['Start Date', formatDate(r.start_date)],
    ['End Date', formatDate(r.end_date)], ['Description', r.description], ['Notes', r.notes],
  ],
  initial: { name: '', start_date: '', end_date: '', description: '', status: 'Active', notes: '' },
  toPayload: (v) => ({ ...v, start_date: v.start_date || null, end_date: v.end_date || null }),
  Form: (f) => (
    <>
      <TextField label="Season Name" required {...f.bind('name')} placeholder="e.g. 2025/2026 Rainy" />
      <DateField label="Start Date" {...f.bind('start_date')} />
      <DateField label="End Date" {...f.bind('end_date')} />
      <SelectField label="Status" {...f.bind('status')} options={SEASON_STATUS} placeholder="" />
      <TextAreaField label="Description" {...f.bind('description')} />
      <TextAreaField label="Notes" {...f.bind('notes')} />
    </>
  ),
};

/* ============================================================ PRODUCTION */
const cropCycles: ModuleConfig = {
  key: 'crop-cycles', resource: 'crop-cycles', section: 'Production',
  title: 'Crop Cycles', subtitle: 'Track production from planting to harvest.',
  icon: 'sync', addLabel: 'Add Crop Cycle', formTitle: 'Crop Cycle',
  searchable: false,
  emptyIcon: 'sync', emptyTitle: 'No Crop Cycles Yet',
  emptyDescription: 'Create your first crop cycle to start tracking production from planting to harvest.',
  useFilters: () => {
    const { items: fm } = useAll('farms');
    const { items: cr } = useAll('crops');
    const { items: se } = useAll('seasons');
    return [
      { key: 'farm_id', placeholder: 'All Farms', options: fm.map((f: any) => ({ value: f.id, label: f.name })) },
      { key: 'crop_id', placeholder: 'All Crops', options: cr.map((c: any) => ({ value: c.id, label: c.name })) },
      { key: 'season_id', placeholder: 'All Seasons', options: se.map((s: any) => ({ value: s.id, label: s.name })) },
      { key: 'status', placeholder: 'All Statuses', options: CYCLE_STATUS.map((s) => ({ value: s, label: s })) },
    ];
  },
  row: (r) => ({
    title: `${r.crops?.name || '—'}${r.crop_varieties?.name ? ` · ${r.crop_varieties.name}` : ''}`,
    subtitle: `${farmField(r)}${r.seasons?.name ? ` — ${r.seasons.name}` : ''}`,
    badge: r.status ? { label: r.status, tone: tone(r.status) } : null,
    right: r.area_planted ? `${formatNumber(r.area_planted)} ${r.area_unit || 'ha'}` : '',
  }),
  detail: (r) => [
    ['Farm', r.farms?.name], ['Field', r.fields?.name], ['Crop', r.crops?.name], ['Variety', r.crop_varieties?.name],
    ['Season', r.seasons?.name], ['Status', r.status], ['Planting Date', formatDate(r.planting_date)],
    ['Expected Harvest', formatDate(r.expected_harvest_date)], ['Actual Harvest', formatDate(r.actual_harvest_date)],
    ['Area Planted', r.area_planted ? `${formatNumber(r.area_planted)} ${r.area_unit || 'ha'}` : '—'],
    ['Seed Quantity', r.seed_quantity ? `${formatNumber(r.seed_quantity)} ${r.seed_unit || 'kg'}` : '—'],
    ['Expected Production', r.expected_production ? `${formatNumber(r.expected_production)} ${r.expected_production_unit || 'kg'}` : '—'],
    ['Actual Production', r.actual_production ? `${formatNumber(r.actual_production)} ${r.actual_production_unit || 'kg'}` : '—'],
    ['Notes', r.notes],
  ],
  initial: {
    farm_id: '', field_id: '', crop_id: '', variety_id: '', season_id: '',
    planting_date: '', expected_harvest_date: '', actual_harvest_date: '',
    area_planted: '', area_unit: 'hectares', seed_quantity: '', seed_unit: 'kg',
    expected_production: '', expected_production_unit: 'kg',
    actual_production: '', actual_production_unit: 'kg', status: 'Planned', notes: '',
  },
  fromRow: (r) => ({
    farm_id: r.farm_id || '', field_id: r.field_id || '', crop_id: r.crop_id || '',
    variety_id: r.variety_id || '', season_id: r.season_id || '',
  }),
  toPayload: (v) => ({
    ...v,
    variety_id: v.variety_id || null, season_id: v.season_id || null,
    planting_date: v.planting_date || null, expected_harvest_date: v.expected_harvest_date || null,
    actual_harvest_date: v.actual_harvest_date || null,
    area_planted: numOrNull(v.area_planted), seed_quantity: numOrNull(v.seed_quantity),
    expected_production: numOrNull(v.expected_production), actual_production: numOrNull(v.actual_production),
  }),
  Form: (f) => {
    const { values, set } = f;
    const { items: farmList } = useAll('farms');
    const { items: cropList } = useAll('crops');
    const { items: seasonList } = useAll('seasons');
    const { items: fieldList } = useAll('fields', { farm_id: values.farm_id }, { enabled: !!values.farm_id });
    const { items: varietyList } = useAll('crop-varieties', { crop_id: values.crop_id }, { enabled: !!values.crop_id });
    return (
      <>
        <SelectField label="Farm" required value={values.farm_id} onChangeValue={(v) => { set('farm_id', v); set('field_id', ''); }} placeholder="Select Farm" options={farmList.map((x: any) => ({ value: x.id, label: x.name }))} />
        <SelectField label="Field" required value={values.field_id} onChangeValue={(v) => set('field_id', v)} placeholder="Select Field" options={fieldList.map((x: any) => ({ value: x.id, label: x.name }))} />
        <SelectField label="Crop" required value={values.crop_id} onChangeValue={(v) => { set('crop_id', v); set('variety_id', ''); }} placeholder="Select Crop" options={cropList.map((x: any) => ({ value: x.id, label: x.name }))} />
        <SelectField label="Variety" value={values.variety_id} onChangeValue={(v) => set('variety_id', v)} placeholder="No Variety" options={varietyList.map((x: any) => ({ value: x.id, label: x.name }))} />
        <SelectField label="Season" value={values.season_id} onChangeValue={(v) => set('season_id', v)} placeholder="Select Season" options={seasonList.map((x: any) => ({ value: x.id, label: x.name }))} />
        <DateField label="Planting Date" {...f.bind('planting_date')} />
        <DateField label="Expected Harvest" {...f.bind('expected_harvest_date')} />
        <DateField label="Actual Harvest" {...f.bind('actual_harvest_date')} />
        <NumberField label="Area Planted" {...f.bind('area_planted')} />
        <SelectField label="Area Unit" {...f.bind('area_unit')} options={AREA_UNITS} placeholder="" />
        <NumberField label="Seed Quantity" {...f.bind('seed_quantity')} />
        <TextField label="Seed Unit" {...f.bind('seed_unit')} />
        <NumberField label="Expected Production" {...f.bind('expected_production')} />
        <TextField label="Expected Prod. Unit" {...f.bind('expected_production_unit')} />
        <NumberField label="Actual Production" {...f.bind('actual_production')} />
        <TextField label="Actual Prod. Unit" {...f.bind('actual_production_unit')} />
        <SelectField label="Status" {...f.bind('status')} options={CYCLE_STATUS} placeholder="" />
        <TextAreaField label="Notes" {...f.bind('notes')} />
      </>
    );
  },
};

const planting: ModuleConfig = {
  key: 'planting', resource: 'planting-records', section: 'Production',
  title: 'Planting Records', subtitle: 'Record planting details for your crop cycles.',
  icon: 'seed', addLabel: 'Add Planting Record', formTitle: 'Planting Record',
  searchPlaceholder: 'Search by source or method...', defaultSort: { sort: 'planting_date', order: 'desc' },
  emptyIcon: 'seed', emptyTitle: 'No Planting Records',
  emptyDescription: 'Record planting details for your crop cycles.',
  row: (r) => ({
    title: r.crop_cycles?.crops?.name || '—',
    subtitle: `${r.crop_cycles?.farms?.name || ''} / ${r.crop_cycles?.fields?.name || ''}`,
    right: formatDate(r.planting_date),
    badge: r.seed_quantity ? { label: `${formatNumber(r.seed_quantity)} ${r.seed_unit || 'kg'}`, tone: 'neutral' } : null,
  }),
  detail: (r) => [
    ['Date', formatDate(r.planting_date)], ['Crop', r.crop_cycles?.crops?.name],
    ['Farm', r.crop_cycles?.farms?.name], ['Field', r.crop_cycles?.fields?.name],
    ['Seed Quantity', r.seed_quantity ? `${formatNumber(r.seed_quantity)} ${r.seed_unit || 'kg'}` : '—'],
    ['Seed Cost', r.seed_cost ? formatCurrency(r.seed_cost, r.currency) : '—'],
    ['Row Spacing', r.row_spacing ? `${r.row_spacing} ${r.spacing_unit || 'cm'}` : '—'],
    ['Plant Spacing', r.plant_spacing ? `${r.plant_spacing} ${r.spacing_unit || 'cm'}` : '—'],
    ['Seed Source', r.seed_source], ['Method', r.planting_method], ['Notes', r.notes],
  ],
  initial: {
    currency: '',
    crop_cycle_id: '', planting_date: '', seed_quantity: '', seed_unit: 'kg', seed_source: '',
    seed_cost: '', row_spacing: '', plant_spacing: '', spacing_unit: 'cm', planting_method: '', notes: '',
  },
  fromRow: (r) => ({ crop_cycle_id: r.crop_cycle_id || '' }),
  toPayload: (v) => ({
    ...v, seed_quantity: numOrNull(v.seed_quantity), seed_cost: numOrNull(v.seed_cost),
    row_spacing: numOrNull(v.row_spacing), plant_spacing: numOrNull(v.plant_spacing),
  }),
  Form: (f) => (
    <>
      <CycleSelect form={f} required />
      <DateField label="Planting Date" required {...f.bind('planting_date')} />
      <TextField label="Planting Method" {...f.bind('planting_method')} placeholder="e.g. Row planting" />
      <NumberField label="Seed Quantity" {...f.bind('seed_quantity')} />
      <TextField label="Seed Unit" {...f.bind('seed_unit')} />
      <TextField label="Seed Source" {...f.bind('seed_source')} />
      <MoneyField label="Seed Cost" form={f} name="seed_cost" />
      <NumberField label="Row Spacing" {...f.bind('row_spacing')} />
      <NumberField label="Plant Spacing" {...f.bind('plant_spacing')} />
      <SelectField label="Spacing Unit" {...f.bind('spacing_unit')} options={SPACING_UNITS} placeholder="" />
      <TextAreaField label="Notes" {...f.bind('notes')} />
    </>
  ),
};

const activities: ModuleConfig = {
  key: 'activities', resource: 'field-activities', section: 'Production',
  title: 'Field Activities', subtitle: 'Track all work done on your farm.',
  icon: 'clipboard-check-outline', addLabel: 'Add Activity', formTitle: 'Activity',
  searchPlaceholder: 'Search description or person...', defaultSort: { sort: 'activity_date', order: 'desc' },
  emptyIcon: 'clipboard-check-outline', emptyTitle: 'No Activities',
  emptyDescription: 'Record field activities to track all work done on your farm.',
  useFilters: () => {
    const { items: fm } = useAll('farms');
    return [
      { key: 'farm_id', placeholder: 'All Farms', options: fm.map((f: any) => ({ value: f.id, label: f.name })) },
      { key: 'activity_type', placeholder: 'All Types', options: ACTIVITY_TYPES.map((s) => ({ value: s, label: s })) },
    ];
  },
  row: (r) => ({
    title: r.activity_type, subtitle: `${farmField(r)}${r.description ? ` — ${r.description}` : ''}`,
    right: formatDate(r.activity_date),
    badge: r.total_cost ? { label: formatCurrency(r.total_cost, r.currency), tone: 'neutral' } : null,
  }),
  detail: (r) => [
    ['Date', formatDate(r.activity_date)], ['Type', r.activity_type], ['Farm', r.farms?.name], ['Field', r.fields?.name],
    ['Crop', r.crop_cycles?.crops?.name], ['Performed By', r.performed_by],
    ['Labor Cost', formatCurrency(r.labor_cost, r.currency)], ['Equipment Cost', formatCurrency(r.equipment_cost, r.currency)],
    ['Material Cost', formatCurrency(r.material_cost, r.currency)], ['Total Cost', formatCurrency(r.total_cost, r.currency)],
    ['Description', r.description], ['Notes', r.notes],
  ],
  initial: {
    currency: '',
    farm_id: '', field_id: '', crop_cycle_id: '', activity_type: '', activity_date: '',
    description: '', labor_cost: 0, equipment_cost: 0, material_cost: 0, performed_by: '', notes: '',
  },
  fromRow: (r) => ({ farm_id: r.farm_id || '', field_id: r.field_id || '', crop_cycle_id: r.crop_cycle_id || '' }),
  toPayload: (v) => ({
    ...v, farm_id: v.farm_id || null, field_id: v.field_id || null, crop_cycle_id: v.crop_cycle_id || null,
    labor_cost: n0(v.labor_cost), equipment_cost: n0(v.equipment_cost), material_cost: n0(v.material_cost),
  }),
  Form: (f) => (
    <>
      <FarmFieldRow form={f} />
      <CycleSelect form={f} />
      <SelectField label="Activity Type" required {...f.bind('activity_type')} placeholder="Select Type" options={ACTIVITY_TYPES} />
      <DateField label="Date" required {...f.bind('activity_date')} />
      <TextAreaField label="Description" {...f.bind('description')} />
      <MoneyField label="Labor Cost" form={f} name="labor_cost" />
      <MoneyField label="Equipment Cost" form={f} name="equipment_cost" />
      <MoneyField label="Material Cost" form={f} name="material_cost" />
      <TextField label="Performed By" {...f.bind('performed_by')} />
      <TextAreaField label="Notes" {...f.bind('notes')} />
    </>
  ),
};

const irrigation: ModuleConfig = {
  key: 'irrigation', resource: 'irrigation-records', section: 'Production',
  title: 'Irrigation', subtitle: 'Track water applications across your fields.',
  icon: 'water', addLabel: 'Add Irrigation', formTitle: 'Irrigation Record',
  searchable: false, defaultSort: { sort: 'irrigation_date', order: 'desc' },
  emptyIcon: 'water', emptyTitle: 'No Irrigation Records',
  emptyDescription: 'Track water applications across your fields.',
  useFilters: () => {
    const { items: fm } = useAll('farms');
    return [
      { key: 'farm_id', placeholder: 'All Farms', options: fm.map((f: any) => ({ value: f.id, label: f.name })) },
      { key: 'irrigation_method', placeholder: 'All Methods', options: IRRIGATION_METHODS.map((s) => ({ value: s, label: s })) },
    ];
  },
  row: (r) => ({
    title: r.irrigation_method, subtitle: farmField(r), right: formatDate(r.irrigation_date),
    badge: r.water_volume ? { label: `${formatNumber(r.water_volume)} ${r.water_unit || 'm³'}`, tone: 'info' } : null,
  }),
  detail: (r) => [
    ['Date', formatDate(r.irrigation_date)], ['Method', r.irrigation_method], ['Farm', r.farms?.name], ['Field', r.fields?.name],
    ['Volume', r.water_volume ? `${formatNumber(r.water_volume)} ${r.water_unit || 'm³'}` : '—'],
    ['Duration', r.duration_hours ? `${r.duration_hours} hours` : '—'],
    ['Area Irrigated', r.area_irrigated ? `${formatNumber(r.area_irrigated)} ${r.area_unit || 'ha'}` : '—'],
    ['Cost', formatCurrency(r.cost, r.currency)], ['Operator', r.operator], ['Notes', r.notes],
  ],
  initial: {
    currency: '',
    farm_id: '', field_id: '', crop_cycle_id: '', irrigation_date: '', irrigation_method: '',
    duration_hours: '', water_volume: '', water_unit: 'cubic metres', area_irrigated: '',
    area_unit: 'hectares', cost: 0, operator: '', notes: '',
  },
  fromRow: (r) => ({ farm_id: r.farm_id || '', field_id: r.field_id || '', crop_cycle_id: r.crop_cycle_id || '' }),
  toPayload: (v) => ({
    ...v, farm_id: v.farm_id || null, field_id: v.field_id || null, crop_cycle_id: v.crop_cycle_id || null,
    duration_hours: numOrNull(v.duration_hours), water_volume: numOrNull(v.water_volume),
    area_irrigated: numOrNull(v.area_irrigated), cost: n0(v.cost),
  }),
  Form: (f) => (
    <>
      <FarmFieldRow form={f} />
      <CycleSelect form={f} />
      <SelectField label="Method" required {...f.bind('irrigation_method')} placeholder="Select Method" options={IRRIGATION_METHODS} />
      <DateField label="Date" required {...f.bind('irrigation_date')} />
      <NumberField label="Duration (hours)" {...f.bind('duration_hours')} />
      <MoneyField label="Cost" form={f} name="cost" />
      <NumberField label="Water Volume" {...f.bind('water_volume')} />
      <SelectField label="Water Unit" {...f.bind('water_unit')} options={WATER_UNITS} placeholder="" />
      <NumberField label="Area Irrigated" {...f.bind('area_irrigated')} />
      <SelectField label="Area Unit" {...f.bind('area_unit')} options={AREA_UNITS} placeholder="" />
      <TextField label="Operator" {...f.bind('operator')} />
      <TextAreaField label="Notes" {...f.bind('notes')} />
    </>
  ),
};

const fertilizers: ModuleConfig = {
  key: 'fertilizers', resource: 'fertilizer-applications', section: 'Production',
  title: 'Fertilizer', subtitle: 'Track fertilizer applications for your crops.',
  icon: 'flask', addLabel: 'Add Application', formTitle: 'Fertilizer Application',
  searchPlaceholder: 'Search fertilizer or supplier...', defaultSort: { sort: 'application_date', order: 'desc' },
  emptyIcon: 'flask', emptyTitle: 'No Fertilizer Records',
  emptyDescription: 'Track fertilizer applications for your crops.',
  useFilters: () => {
    const { items: fm } = useAll('farms');
    return [
      { key: 'farm_id', placeholder: 'All Farms', options: fm.map((f: any) => ({ value: f.id, label: f.name })) },
      { key: 'fertilizer_type', placeholder: 'All Types', options: FERTILIZER_TYPES.map((s) => ({ value: s, label: s })) },
    ];
  },
  row: (r) => ({
    title: r.fertilizer_name, subtitle: farmField(r), right: formatDate(r.application_date),
    badge: r.fertilizer_type ? { label: r.fertilizer_type, tone: 'primary' } : null,
  }),
  detail: (r) => [
    ['Date', formatDate(r.application_date)], ['Fertilizer', r.fertilizer_name], ['Type', r.fertilizer_type],
    ['Method', r.application_method], ['Quantity', r.quantity ? `${formatNumber(r.quantity)} ${r.unit || 'kg'}` : '—'],
    ['Cost', formatCurrency(r.cost, r.currency)], ['Farm', r.farms?.name], ['Field', r.fields?.name],
    ['Supplier', r.supplier], ['Applied By', r.applied_by], ['Notes', r.notes],
  ],
  initial: {
    currency: '',
    farm_id: '', field_id: '', crop_cycle_id: '', application_date: '', fertilizer_name: '',
    fertilizer_type: '', quantity: '', unit: 'kg', application_method: '', cost: 0,
    supplier: '', applied_by: '', notes: '',
  },
  fromRow: (r) => ({ farm_id: r.farm_id || '', field_id: r.field_id || '', crop_cycle_id: r.crop_cycle_id || '' }),
  toPayload: (v) => ({
    ...v, farm_id: v.farm_id || null, field_id: v.field_id || null, crop_cycle_id: v.crop_cycle_id || null,
    quantity: numOrNull(v.quantity), cost: n0(v.cost),
  }),
  Form: (f) => (
    <>
      <FarmFieldRow form={f} />
      <CycleSelect form={f} />
      <TextField label="Fertilizer Name" required {...f.bind('fertilizer_name')} />
      <SelectField label="Type" required {...f.bind('fertilizer_type')} placeholder="Select Type" options={FERTILIZER_TYPES} />
      <DateField label="Application Date" required {...f.bind('application_date')} />
      <SelectField label="Method" {...f.bind('application_method')} placeholder="Select Method" options={FERTILIZER_METHODS} />
      <NumberField label="Quantity" {...f.bind('quantity')} />
      <TextField label="Unit" {...f.bind('unit')} />
      <MoneyField label="Cost" form={f} name="cost" />
      <TextField label="Supplier" {...f.bind('supplier')} />
      <TextField label="Applied By" {...f.bind('applied_by')} />
      <TextAreaField label="Notes" {...f.bind('notes')} />
    </>
  ),
};

const cropProtection: ModuleConfig = {
  key: 'crop-protection', resource: 'crop-protection-records', section: 'Production',
  title: 'Crop Protection', subtitle: 'Record pest, disease, and weed management activities.',
  icon: 'shield-check', addLabel: 'Add Record', formTitle: 'Crop Protection Record',
  searchPlaceholder: 'Search problem or product...', defaultSort: { sort: 'protection_date', order: 'desc' },
  emptyIcon: 'shield-check', emptyTitle: 'No Crop Protection Records',
  emptyDescription: 'Record pest, disease, and weed management activities.',
  useFilters: () => {
    const { items: fm } = useAll('farms');
    return [
      { key: 'farm_id', placeholder: 'All Farms', options: fm.map((f: any) => ({ value: f.id, label: f.name })) },
      { key: 'problem_type', placeholder: 'All Types', options: PROBLEM_TYPES.map((s) => ({ value: s, label: s })) },
      { key: 'severity', placeholder: 'All Severities', options: SEVERITIES.map((s) => ({ value: s, label: s })) },
    ];
  },
  row: (r) => ({
    title: r.problem_name, subtitle: `${r.problem_type} · ${farmField(r)}`, right: formatDate(r.protection_date),
    badge: r.severity ? { label: r.severity, tone: tone(r.severity) } : null,
  }),
  detail: (r) => [
    ['Date', formatDate(r.protection_date)], ['Problem Type', r.problem_type], ['Problem', r.problem_name],
    ['Severity', r.severity], ['Treatment', r.treatment], ['Product', r.product_name],
    ['Quantity', r.quantity ? `${r.quantity} ${r.unit || 'L'}` : '—'], ['Cost', formatCurrency(r.cost, r.currency)],
    ['Farm', r.farms?.name], ['Field', r.fields?.name], ['Applied By', r.applied_by],
    ['Method', r.application_method], ['Notes', r.notes],
  ],
  initial: {
    currency: '',
    farm_id: '', field_id: '', crop_cycle_id: '', protection_date: '', problem_type: '',
    problem_name: '', severity: '', treatment: '', product_name: '', quantity: '',
    unit: 'litres', application_method: '', cost: 0, applied_by: '', notes: '',
  },
  fromRow: (r) => ({ farm_id: r.farm_id || '', field_id: r.field_id || '', crop_cycle_id: r.crop_cycle_id || '' }),
  toPayload: (v) => ({
    ...v, farm_id: v.farm_id || null, field_id: v.field_id || null, crop_cycle_id: v.crop_cycle_id || null,
    quantity: numOrNull(v.quantity), cost: n0(v.cost),
  }),
  Form: (f) => (
    <>
      <FarmFieldRow form={f} />
      <CycleSelect form={f} />
      <SelectField label="Problem Type" required {...f.bind('problem_type')} placeholder="Select Type" options={PROBLEM_TYPES} />
      <TextField label="Problem Name" required {...f.bind('problem_name')} placeholder="e.g. Fall armyworm" />
      <DateField label="Date" required {...f.bind('protection_date')} />
      <SelectField label="Severity" {...f.bind('severity')} placeholder="Select Severity" options={SEVERITIES} />
      <TextField label="Treatment" {...f.bind('treatment')} />
      <TextField label="Product Name" {...f.bind('product_name')} />
      <SelectField label="Application Method" {...f.bind('application_method')} placeholder="Select Method" options={PROTECTION_METHODS} />
      <NumberField label="Quantity" {...f.bind('quantity')} />
      <TextField label="Unit" {...f.bind('unit')} />
      <MoneyField label="Cost" form={f} name="cost" />
      <TextField label="Applied By" {...f.bind('applied_by')} />
      <TextAreaField label="Notes" {...f.bind('notes')} />
    </>
  ),
};

const scouting: ModuleConfig = {
  key: 'scouting', resource: 'crop-scouting-records', section: 'Production',
  title: 'Crop Scouting', subtitle: 'Monitor crop health with field observations.',
  icon: 'magnify-scan', addLabel: 'Add Scouting Record', formTitle: 'Scouting Record',
  searchPlaceholder: 'Search scout or observation...', defaultSort: { sort: 'scouting_date', order: 'desc' },
  emptyIcon: 'magnify-scan', emptyTitle: 'No Scouting Records',
  emptyDescription: 'Record field scouting observations to monitor crop health.',
  useFilters: () => {
    const { items: fm } = useAll('farms');
    return [
      { key: 'farm_id', placeholder: 'All Farms', options: fm.map((f: any) => ({ value: f.id, label: f.name })) },
      { key: 'plant_health', placeholder: 'All Health', options: PLANT_HEALTH.map((s) => ({ value: s, label: s })) },
    ];
  },
  row: (r) => ({
    title: `${r.crops?.name || 'Scouting'}${r.growth_stage ? ` · ${r.growth_stage}` : ''}`,
    subtitle: farmField(r), right: formatDate(r.scouting_date),
    badge: r.plant_health ? { label: r.plant_health, tone: tone(r.plant_health) } : null,
  }),
  detail: (r) => [
    ['Date', formatDate(r.scouting_date)], ['Scout', r.scout_name], ['Farm', r.farms?.name], ['Field', r.fields?.name],
    ['Crop', r.crops?.name], ['Growth Stage', r.growth_stage], ['Plant Health', r.plant_health],
    ['Moisture', r.moisture_observation], ['Pest Observation', r.pest_observation || 'None observed'],
    ['Disease Observation', r.disease_observation || 'None observed'],
    ['Weed Observation', r.weed_observation || 'None observed'], ['Soil Observation', r.soil_observation],
    ['Recommendation', r.recommendation],
    ['Photo', r.photo_url ? <Image key="p" source={{ uri: mediaUrl(r.photo_url) }} style={{ width: '100%', height: 200, borderRadius: 8 }} resizeMode="cover" /> : '—'],
    ['Notes', r.notes],
  ],
  initial: {
    farm_id: '', field_id: '', crop_id: '', crop_cycle_id: '', scouting_date: '', scout_name: '',
    growth_stage: '', plant_health: 'Healthy', pest_observation: '', disease_observation: '',
    weed_observation: '', soil_observation: '', moisture_observation: '', recommendation: '',
    photo_url: null, notes: '',
  },
  fromRow: (r) => ({
    farm_id: r.farm_id || '', field_id: r.field_id || '', crop_id: r.crop_id || '',
    crop_cycle_id: r.crop_cycle_id || '', photo_url: r.photo_url || null,
  }),
  toPayload: (v) => ({
    ...v, farm_id: v.farm_id || null, field_id: v.field_id || null, crop_id: v.crop_id || null,
    crop_cycle_id: v.crop_cycle_id || null,
  }),
  Form: (f) => {
    const { items: cr } = useAll('crops');
    return (
      <>
        <FarmFieldRow form={f} />
        <SelectField label="Crop" {...f.bind('crop_id')} placeholder="Select Crop" options={cr.map((c: any) => ({ value: c.id, label: c.name }))} />
        <CycleSelect form={f} />
        <DateField label="Scouting Date" required {...f.bind('scouting_date')} />
        <TextField label="Scout Name" {...f.bind('scout_name')} />
        <TextField label="Growth Stage" {...f.bind('growth_stage')} />
        <SelectField label="Plant Health" {...f.bind('plant_health')} options={PLANT_HEALTH} placeholder="" />
        <TextAreaField label="Pest Observation" {...f.bind('pest_observation')} />
        <TextAreaField label="Disease Observation" {...f.bind('disease_observation')} />
        <TextAreaField label="Weed Observation" {...f.bind('weed_observation')} />
        <TextField label="Soil Observation" {...f.bind('soil_observation')} />
        <TextField label="Moisture Observation" {...f.bind('moisture_observation')} />
        <TextAreaField label="Recommendation" {...f.bind('recommendation')} />
        <PhotoField value={f.values.photo_url} onChange={(url) => f.set('photo_url', url)} />
        <TextAreaField label="Notes" {...f.bind('notes')} />
      </>
    );
  },
};

const harvest: ModuleConfig = {
  key: 'harvest', resource: 'harvest-records', section: 'Production',
  title: 'Harvest', subtitle: 'Track your production output.',
  icon: 'barley', addLabel: 'Add Harvest', formTitle: 'Harvest Record',
  searchPlaceholder: 'Search storage or grade...', defaultSort: { sort: 'harvest_date', order: 'desc' },
  emptyIcon: 'barley', emptyTitle: 'No Harvest Records',
  emptyDescription: 'Record harvest data to track your production output.',
  useFilters: () => {
    const { items: fm } = useAll('farms');
    const { items: cr } = useAll('crops');
    return [
      { key: 'farm_id', placeholder: 'All Farms', options: fm.map((f: any) => ({ value: f.id, label: f.name })) },
      { key: 'crop_id', placeholder: 'All Crops', options: cr.map((c: any) => ({ value: c.id, label: c.name })) },
    ];
  },
  row: (r) => ({
    title: `${r.crops?.name || '—'} — ${formatNumber(r.quantity)} ${r.unit || 'kg'}`,
    subtitle: farmField(r), right: formatDate(r.harvest_date),
    badge: r.quality ? { label: r.quality, tone: tone(r.quality) } : null,
  }),
  detail: (r) => {
    const total = (r.labor_cost || 0) + (r.transport_cost || 0) + (r.other_costs || 0);
    return [
      ['Harvest Date', formatDate(r.harvest_date)], ['Crop', r.crops?.name], ['Farm', r.farms?.name], ['Field', r.fields?.name],
      ['Quantity', `${formatNumber(r.quantity)} ${r.unit || 'kg'}`],
      ['Harvested Area', r.harvested_area ? `${formatNumber(r.harvested_area)} ${r.area_unit || 'ha'}` : '—'],
      ['Grade', r.grade], ['Quality', r.quality], ['Storage', r.storage_location],
      ['Total Cost', formatCurrency(total, r.currency)], ['Labor Cost', formatCurrency(r.labor_cost, r.currency)],
      ['Transport Cost', formatCurrency(r.transport_cost, r.currency)], ['Other Costs', formatCurrency(r.other_costs, r.currency)],
      ['Notes', r.notes],
    ];
  },
  initial: {
    currency: '',
    farm_id: '', field_id: '', crop_id: '', crop_cycle_id: '', harvest_date: '',
    harvested_area: '', area_unit: 'hectares', quantity: '', unit: 'kg', grade: '',
    quality: 'Good', storage_location: '', labor_cost: 0, transport_cost: 0, other_costs: 0, notes: '',
  },
  validate: (v) => (v.quantity === '' ? 'Quantity is required' : v.crop_id ? null : 'Crop is required'),
  fromRow: (r) => ({ farm_id: r.farm_id || '', field_id: r.field_id || '', crop_id: r.crop_id || '', crop_cycle_id: r.crop_cycle_id || '' }),
  toPayload: (v) => ({
    ...v, farm_id: v.farm_id || null, field_id: v.field_id || null, crop_cycle_id: v.crop_cycle_id || null,
    harvested_area: numOrNull(v.harvested_area), quantity: Number(v.quantity),
    labor_cost: n0(v.labor_cost), transport_cost: n0(v.transport_cost), other_costs: n0(v.other_costs),
  }),
  Form: (f) => {
    const { items: cr } = useAll('crops');
    return (
      <>
        <FarmFieldRow form={f} />
        <SelectField label="Crop" required {...f.bind('crop_id')} placeholder="Select Crop" options={cr.map((c: any) => ({ value: c.id, label: c.name }))} />
        <CycleSelect form={f} />
        <DateField label="Harvest Date" required {...f.bind('harvest_date')} />
        <SelectField label="Quality" {...f.bind('quality')} options={HARVEST_QUALITY} placeholder="" />
        <NumberField label="Quantity" required {...f.bind('quantity')} />
        <TextField label="Unit" {...f.bind('unit')} />
        <NumberField label="Harvested Area" {...f.bind('harvested_area')} />
        <SelectField label="Area Unit" {...f.bind('area_unit')} options={AREA_UNITS} placeholder="" />
        <TextField label="Grade" {...f.bind('grade')} />
        <TextField label="Storage Location" {...f.bind('storage_location')} />
        <MoneyField label="Labor Cost" form={f} name="labor_cost" />
        <MoneyField label="Transport Cost" form={f} name="transport_cost" />
        <MoneyField label="Other Costs" form={f} name="other_costs" />
        <TextAreaField label="Notes" {...f.bind('notes')} />
      </>
    );
  },
};

/* ============================================================ RESOURCES */
const inventory: ModuleConfig = {
  key: 'inventory', resource: 'inventory-items', section: 'Resources',
  title: 'Inventory', subtitle: 'Track your stock levels.',
  icon: 'package-variant-closed', addLabel: 'Add Item', formTitle: 'Item',
  searchPlaceholder: 'Search item or supplier...', defaultSort: { sort: 'name', order: 'asc' },
  emptyIcon: 'package-variant-closed', emptyTitle: 'No Inventory Items',
  emptyDescription: 'Add items to track your stock levels.',
  rowActions: 'inventory-stock',
  useFilters: () => [{ key: 'category', placeholder: 'All Categories', options: INVENTORY_CATEGORIES.map((s) => ({ value: s, label: s })) }],
  row: (r) => {
    const status = r.current_quantity <= 0 ? 'Out of Stock' : r.current_quantity <= r.minimum_stock * 1.5 ? 'Low Stock' : 'In Stock';
    return {
      title: r.name, subtitle: `${r.category} · min ${formatNumber(r.minimum_stock)}`,
      right: `${formatNumber(r.current_quantity)} ${r.unit || ''}`,
      badge: { label: status, tone: tone(status) },
    };
  },
  detail: (r) => {
    const status = r.current_quantity <= 0 ? 'Out of Stock' : r.current_quantity <= r.minimum_stock * 1.5 ? 'Low Stock' : 'In Stock';
    return [
      ['Item', r.name], ['Category', r.category], ['Current Stock', `${formatNumber(r.current_quantity)} ${r.unit}`],
      ['Minimum Stock', formatNumber(r.minimum_stock)], ['Status', status], ['Unit Cost', formatCurrency(r.unit_cost, r.currency)],
      ['Supplier', r.supplier], ['Expiry Date', r.expiry_date ? formatDate(r.expiry_date) : '—'],
      ['Storage Location', r.storage_location], ['Notes', r.notes],
    ];
  },
  initial: {
    currency: '',
    name: '', category: '', unit: 'kg', current_quantity: 0, minimum_stock: 0, unit_cost: 0,
    supplier: '', expiry_date: '', storage_location: '', notes: '',
  },
  toPayload: (v) => ({
    ...v, current_quantity: n0(v.current_quantity), minimum_stock: n0(v.minimum_stock),
    unit_cost: n0(v.unit_cost), expiry_date: v.expiry_date || null,
  }),
  Form: (f) => (
    <>
      <TextField label="Item Name" required {...f.bind('name')} />
      <SelectField label="Category" required {...f.bind('category')} placeholder="Select Category" options={INVENTORY_CATEGORIES} />
      <SelectField label="Unit" {...f.bind('unit')} options={INVENTORY_UNITS} placeholder="" />
      <MoneyField label="Unit Cost" form={f} name="unit_cost" />
      <NumberField label="Current Quantity" {...f.bind('current_quantity')} />
      <NumberField label="Minimum Stock" {...f.bind('minimum_stock')} />
      <TextField label="Supplier" {...f.bind('supplier')} />
      <DateField label="Expiry Date" {...f.bind('expiry_date')} />
      <TextField label="Storage Location" {...f.bind('storage_location')} />
      <TextAreaField label="Notes" {...f.bind('notes')} />
    </>
  ),
};

const equipment: ModuleConfig = {
  key: 'equipment', resource: 'equipment', section: 'Resources',
  title: 'Equipment', subtitle: 'Register your farm equipment.',
  icon: 'cog', addLabel: 'Add Equipment', formTitle: 'Equipment',
  searchPlaceholder: 'Search name, model, serial...',
  emptyIcon: 'cog', emptyTitle: 'No Equipment',
  emptyDescription: 'Register your farm equipment.',
  useFilters: () => [{ key: 'status', placeholder: 'All Statuses', options: EQUIPMENT_STATUS.map((s) => ({ value: s, label: s })) }],
  row: (r) => ({
    title: r.name, subtitle: [r.equipment_type, r.model].filter(Boolean).join(' · ') || '—',
    badge: r.status ? { label: r.status, tone: tone(r.status) } : null, right: r.location || '',
  }),
  detail: (r) => [
    ['Equipment', r.name], ['Type', r.equipment_type], ['Model', r.model], ['Serial Number', r.serial_number],
    ['Status', r.status], ['Condition', r.condition], ['Location', r.location],
    ['Purchase Date', r.purchase_date ? formatDate(r.purchase_date) : '—'],
    ['Purchase Cost', formatCurrency(r.purchase_cost, r.currency)], ['Notes', r.notes],
  ],
  initial: {
    currency: '',
    name: '', equipment_type: '', model: '', serial_number: '', purchase_date: '',
    purchase_cost: 0, condition: '', location: '', status: 'Available', notes: '',
  },
  toPayload: (v) => ({ ...v, purchase_cost: n0(v.purchase_cost), purchase_date: v.purchase_date || null }),
  Form: (f) => (
    <>
      <TextField label="Equipment Name" required {...f.bind('name')} />
      <TextField label="Type" {...f.bind('equipment_type')} placeholder="e.g. Tractor" />
      <TextField label="Model" {...f.bind('model')} />
      <TextField label="Serial Number" {...f.bind('serial_number')} />
      <DateField label="Purchase Date" {...f.bind('purchase_date')} />
      <MoneyField label="Purchase Cost" form={f} name="purchase_cost" />
      <TextField label="Condition" {...f.bind('condition')} placeholder="e.g. Good" />
      <TextField label="Location" {...f.bind('location')} />
      <SelectField label="Status" {...f.bind('status')} options={EQUIPMENT_STATUS} placeholder="" />
      <TextAreaField label="Notes" {...f.bind('notes')} />
    </>
  ),
};

const maintenance: ModuleConfig = {
  key: 'maintenance', resource: 'equipment-maintenance', section: 'Resources',
  title: 'Equipment Maintenance', subtitle: 'Track equipment servicing and repairs.',
  icon: 'wrench', addLabel: 'Add Record', formTitle: 'Maintenance',
  searchPlaceholder: 'Search description or person...', defaultSort: { sort: 'maintenance_date', order: 'desc' },
  emptyIcon: 'wrench', emptyTitle: 'No Maintenance Records',
  emptyDescription: 'Track equipment servicing and repairs.',
  useFilters: () => {
    const { items: eq } = useAll('equipment');
    return [{ key: 'equipment_id', placeholder: 'All Equipment', options: eq.map((e: any) => ({ value: e.id, label: e.name })) }];
  },
  row: (r) => ({
    title: r.equipment?.name || 'Maintenance', subtitle: [r.type, r.description].filter(Boolean).join(' — ') || '—',
    right: formatDate(r.maintenance_date), badge: r.cost ? { label: formatCurrency(r.cost, r.currency), tone: 'neutral' } : null,
  }),
  detail: (r) => [
    ['Date', formatDate(r.maintenance_date)], ['Equipment', r.equipment?.name], ['Type', r.type],
    ['Cost', formatCurrency(r.cost, r.currency)], ['Performed By', r.performed_by],
    ['Next Maintenance', r.next_maintenance ? formatDate(r.next_maintenance) : '—'],
    ['Description', r.description], ['Notes', r.notes],
  ],
  initial: {
    currency: '',
    equipment_id: '', maintenance_date: '', type: '', description: '', cost: 0,
    performed_by: '', next_maintenance: '', notes: '',
  },
  fromRow: (r) => ({ equipment_id: r.equipment_id || '' }),
  toPayload: (v) => ({ ...v, equipment_id: v.equipment_id || null, cost: n0(v.cost), next_maintenance: v.next_maintenance || null }),
  Form: (f) => {
    const { items: eq } = useAll('equipment');
    return (
      <>
        <SelectField label="Equipment" {...f.bind('equipment_id')} placeholder="Select Equipment" options={eq.map((e: any) => ({ value: e.id, label: e.name }))} />
        <DateField label="Maintenance Date" required {...f.bind('maintenance_date')} />
        <TextField label="Type" {...f.bind('type')} placeholder="e.g. Service / Repair" />
        <MoneyField label="Cost" form={f} name="cost" />
        <TextAreaField label="Description" {...f.bind('description')} />
        <TextField label="Performed By" {...f.bind('performed_by')} />
        <DateField label="Next Maintenance" {...f.bind('next_maintenance')} />
        <TextAreaField label="Notes" {...f.bind('notes')} />
      </>
    );
  },
};

/* ============================================================ FINANCE */
const expenses: ModuleConfig = {
  key: 'expenses', resource: 'expenses', section: 'Finance',
  title: 'Expenses', subtitle: 'Track all farm-related expenditures.',
  icon: 'receipt', addLabel: 'Add Expense', formTitle: 'Expense',
  searchPlaceholder: 'Search description or supplier...', defaultSort: { sort: 'expense_date', order: 'desc' },
  emptyIcon: 'receipt', emptyTitle: 'No Expenses',
  emptyDescription: 'Track all farm-related expenditures.',
  useFilters: () => {
    const { items: fm } = useAll('farms');
    return [
      { key: 'farm_id', placeholder: 'All Farms', options: fm.map((f: any) => ({ value: f.id, label: f.name })) },
      { key: 'category', placeholder: 'All Categories', options: EXPENSE_CATEGORIES.map((s) => ({ value: s, label: s })) },
    ];
  },
  row: (r) => ({
    title: r.category || 'Other', subtitle: [r.description, r.farms?.name].filter(Boolean).join(' · ') || '—',
    right: formatCurrency(r.amount, r.currency), badge: r.supplier ? { label: r.supplier, tone: 'neutral' } : null,
  }),
  detail: (r) => [
    ['Date', formatDate(r.expense_date)], ['Category', r.category], ['Amount', formatCurrency(r.amount, r.currency)],
    ['Farm', r.farms?.name], ['Payment Method', r.payment_method], ['Supplier', r.supplier],
    ['Description', r.description], ['Notes', r.notes],
  ],
  initial: {
    currency: '',
    farm_id: '', crop_cycle_id: '', category: '', description: '', amount: 0,
    expense_date: '', payment_method: '', supplier: '', notes: '',
  },
  fromRow: (r) => ({ farm_id: r.farm_id || '', crop_cycle_id: r.crop_cycle_id || '' }),
  toPayload: (v) => ({ ...v, farm_id: v.farm_id || null, crop_cycle_id: v.crop_cycle_id || null, amount: n0(v.amount) }),
  Form: (f) => {
    const { items: fm } = useAll('farms');
    return (
      <>
        <SelectField label="Farm" {...f.bind('farm_id')} placeholder="Select Farm" options={fm.map((x: any) => ({ value: x.id, label: x.name }))} />
        <SelectField label="Category" required {...f.bind('category')} placeholder="Select Category" options={EXPENSE_CATEGORIES} />
        <CycleSelect form={f} />
        <MoneyField label="Amount" required form={f} name="amount" />
        <DateField label="Expense Date" required {...f.bind('expense_date')} />
        <TextField label="Description" {...f.bind('description')} />
        <TextField label="Payment Method" {...f.bind('payment_method')} />
        <TextField label="Supplier" {...f.bind('supplier')} />
        <TextAreaField label="Notes" {...f.bind('notes')} />
      </>
    );
  },
};

const sales: ModuleConfig = {
  key: 'sales', resource: 'sales', section: 'Finance',
  title: 'Sales', subtitle: 'Record crop sales and track payment status.',
  icon: 'cash-multiple', addLabel: 'Add Sale', formTitle: 'Sale',
  searchPlaceholder: 'Search buyer or market...', defaultSort: { sort: 'sale_date', order: 'desc' },
  emptyIcon: 'cash-multiple', emptyTitle: 'No Sales',
  emptyDescription: 'Record crop sales and track payment status.',
  useFilters: () => {
    const { items: fm } = useAll('farms');
    const { items: cr } = useAll('crops');
    return [
      { key: 'farm_id', placeholder: 'All Farms', options: fm.map((f: any) => ({ value: f.id, label: f.name })) },
      { key: 'crop_id', placeholder: 'All Crops', options: cr.map((c: any) => ({ value: c.id, label: c.name })) },
      { key: 'payment_status', placeholder: 'All Statuses', options: PAYMENT_STATUS.map((s) => ({ value: s, label: s })) },
    ];
  },
  row: (r) => ({
    title: `${r.crops?.name || '—'} — ${formatCurrency(r.total_amount, r.currency)}`,
    subtitle: [r.buyer, r.market].filter(Boolean).join(' · ') || `${formatNumber(r.quantity)} ${r.unit || 'kg'}`,
    right: formatDate(r.sale_date), badge: r.payment_status ? { label: r.payment_status, tone: tone(r.payment_status) } : null,
  }),
  detail: (r) => [
    ['Date', formatDate(r.sale_date)], ['Crop', r.crops?.name], ['Farm', r.farms?.name], ['Buyer', r.buyer],
    ['Market', r.market], ['Quantity', `${formatNumber(r.quantity)} ${r.unit || 'kg'}`],
    ['Unit Price', formatCurrency(r.unit_price, r.currency)], ['Total Amount', formatCurrency(r.total_amount, r.currency)],
    ['Payment Status', r.payment_status], ['Notes', r.notes],
  ],
  initial: {
    currency: '',
    farm_id: '', crop_id: '', crop_cycle_id: '', buyer: '', quantity: 0, unit: 'kg',
    unit_price: 0, sale_date: '', market: '', payment_status: 'Pending', notes: '',
  },
  validate: (v) => (v.crop_id ? null : 'Crop is required'),
  fromRow: (r) => ({ farm_id: r.farm_id || '', crop_id: r.crop_id || '', crop_cycle_id: r.crop_cycle_id || '' }),
  toPayload: (v) => ({
    ...v, farm_id: v.farm_id || null, crop_cycle_id: v.crop_cycle_id || null,
    quantity: n0(v.quantity), unit_price: n0(v.unit_price),
  }),
  Form: (f) => {
    const { items: fm } = useAll('farms');
    const { items: cr } = useAll('crops');
    return (
      <>
        <SelectField label="Farm" {...f.bind('farm_id')} placeholder="Select Farm" options={fm.map((x: any) => ({ value: x.id, label: x.name }))} />
        <SelectField label="Crop" required {...f.bind('crop_id')} placeholder="Select Crop" options={cr.map((x: any) => ({ value: x.id, label: x.name }))} />
        <CycleSelect form={f} placeholder="Select Cycle" />
        <TextField label="Buyer" {...f.bind('buyer')} />
        <TextField label="Market" {...f.bind('market')} />
        <NumberField label="Quantity" {...f.bind('quantity')} />
        <TextField label="Unit" {...f.bind('unit')} />
        <MoneyField label="Unit Price" form={f} name="unit_price" />
        <DateField label="Sale Date" required {...f.bind('sale_date')} />
        <SelectField label="Payment Status" {...f.bind('payment_status')} options={PAYMENT_STATUS} placeholder="" />
        <TextAreaField label="Notes" {...f.bind('notes')} />
      </>
    );
  },
};

export const MODULES: ModuleConfig[] = [
  farms, fields, crops, varieties, seasons,
  cropCycles, planting, activities, irrigation, fertilizers, cropProtection, scouting, harvest,
  inventory, equipment, maintenance,
  expenses, sales,
];

export const MODULE_BY_KEY: Record<string, ModuleConfig> = Object.fromEntries(MODULES.map((m) => [m.key, m]));
