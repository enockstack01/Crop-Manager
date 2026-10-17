/*
 * What is happening on the farm, worked out from the farm's own records: land by field status,
 * what is growing now (open crop cycles by crop), the crop-cycle pipeline, and how much of each
 * field is under crop. Areas are converted to hectares. Mirrored in
 * mobile/src/features/dashboard/farmModel.ts: keep the two in step.
 */
const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const AREA = { hectares: 1, acres: 0.404686, 'square metres': 0.0001 };
export const toHa = (v, unit) => n(v) * (AREA[unit] ?? 1);

export const OPEN_STATUSES = ['Planned', 'Planted', 'Growing', 'Ready for Harvest'];
/** crop-cycle pipeline: Ready to harvest is the one Amber highlight */
export const STAGES = [
  { key: 'Planned', label: 'Planned', color: '#5B6B5D' },
  { key: 'Planted', label: 'Planted', color: '#1B5E20' },
  { key: 'Growing', label: 'Growing', color: '#2E7D32' },
  { key: 'Ready for Harvest', label: 'Ready to harvest', color: '#F9A825' },
];
export const STATUS_COLOR = { Active: '#2E7D32', Preparing: '#1B5E20', Maintenance: '#5B6B5D', Fallow: '#F9A825' };
const CROP_COLORS = ['#2E7D32', '#14532D', '#5B6B5D', '#1C2B1E'];
const OTHER = '#D5E3D6';
const RANK = Object.fromEntries(OPEN_STATUSES.map((s, i) => [s, i]));

export function buildProfile({ farms, fields, cycles = [], selected, dark }) {
  const scopeFarms = selected ? farms.filter((f) => f.id === selected) : farms;
  const ids = new Set(scopeFarms.map((f) => f.id));
  const scopeFields = fields.filter((f) => ids.has(f.farm_id));
  const total = scopeFarms.reduce((s, f) => s + toHa(f.total_area, f.area_unit), 0);

  const byStatus = { Active: 0, Preparing: 0, Maintenance: 0, Fallow: 0 };
  scopeFields.forEach((f) => {
    byStatus[f.status in byStatus ? f.status : 'Active'] += toHa(f.area, f.area_unit);
  });
  const allocated = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const ringTotal = Math.max(total, allocated);
  const segments = [
    { key: 'Active', label: 'Planted', value: byStatus.Active, color: STATUS_COLOR.Active },
    { key: 'Preparing', label: 'Preparing', value: byStatus.Preparing, color: STATUS_COLOR.Preparing },
    { key: 'Maintenance', label: 'Maintenance', value: byStatus.Maintenance, color: STATUS_COLOR.Maintenance },
    { key: 'Fallow', label: 'Fallow', value: byStatus.Fallow, color: STATUS_COLOR.Fallow },
    { key: 'Unallocated', label: 'Unallocated', value: Math.max(0, total - allocated), color: dark ? '#3A3A3A' : OTHER },
  ];

  // open crop cycles on this farm (or all farms)
  const open = cycles.filter((c) => ids.has(c.farm_id) && OPEN_STATUSES.includes(c.status));
  const cycleHa = (c) => toHa(c.area_planted, c.area_unit);
  const underCrop = open.reduce((s, c) => s + cycleHa(c), 0);

  const byCrop = {};
  open.forEach((c) => {
    const name = c.crops?.name || '—';
    byCrop[name] = byCrop[name] || { name, ha: 0, cycles: 0 };
    byCrop[name].ha += cycleHa(c);
    byCrop[name].cycles += 1;
  });
  const ranked = Object.values(byCrop).sort((a, b) => b.ha - a.ha || b.cycles - a.cycles);
  const crops = ranked.slice(0, 4).map((c, i) => ({ ...c, color: CROP_COLORS[i] }));
  if (ranked.length > 4) {
    const rest = ranked.slice(4);
    crops.push({ name: 'Other crops', ha: rest.reduce((s, c) => s + c.ha, 0), cycles: rest.reduce((s, c) => s + c.cycles, 0), color: OTHER });
  }

  const pipeline = STAGES.map((st) => {
    const rows = open.filter((c) => c.status === st.key);
    return { ...st, count: rows.length, ha: rows.reduce((s, c) => s + cycleHa(c), 0) };
  });

  // each field: what is on it and how much of it is under crop
  const fieldRows = scopeFields
    .map((f) => {
      const here = open.filter((c) => c.field_id === f.id);
      const area = toHa(f.area, f.area_unit);
      const planted = here.reduce((s, c) => s + cycleHa(c), 0);
      const stage = here.length ? OPEN_STATUSES[Math.max(...here.map((c) => RANK[c.status]))] : null;
      return {
        id: f.id, name: f.name, farm: f.farms?.name, status: f.status || 'Active', area, planted,
        crops: [...new Set(here.map((c) => c.crops?.name).filter(Boolean))],
        stage, pct: area > 0 ? Math.min(100, Math.round((planted / area) * 100)) : 0,
      };
    })
    .sort((a, b) => b.area - a.area);

  return {
    farm: selected ? scopeFarms[0] : null,
    scopeFarms,
    scopeFields,
    total,
    ringTotal,
    segments,
    pct: ringTotal > 0 ? Math.round((byStatus.Active / ringTotal) * 100) : 0,
    openCount: open.length,
    underCrop,
    underCropPct: total > 0 ? Math.min(100, Math.round((underCrop / total) * 100)) : 0,
    crops,
    pipeline,
    fieldRows,
  };
}
