// Dashboard aggregation — exact port of client/src/pages/Dashboard.jsx:computeAggregates
// so the mobile dashboard shows the same figures, labels and colours as the web app.
import { formatCurrency, formatNumber } from '../../lib/format';

const monthLabel = (key: string) => {
  const [y, m] = key.split('-');
  return new Date(Number(y), Number(m) - 1).toLocaleString('en', { month: 'short', year: '2-digit' });
};
const n = (v: any) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const pairs = (map: Record<string, number>) => Object.entries(map).map(([label, value]) => ({ label, value }));

export type DashFilters = { farm: string; season: string; from: string; to: string };
export type KpiTone = 'green' | 'blue' | 'orange' | 'red' | 'purple';

export const CYCLE_STATUSES = ['Planned', 'Planted', 'Growing', 'Ready for Harvest', 'Harvested', 'Completed', 'Cancelled'];
export const STATUS_COLORS = ['#1976D2', '#2E7D32', '#66BB6A', '#F9A825', '#FF8F00', '#43A047', '#9E9E9E'];

export function computeDashboard(d: any, filters: DashFilters) {
  const inRange = (date?: string) => {
    if (!date) return true;
    if (filters.from && date < filters.from) return false;
    if (filters.to && date > filters.to) return false;
    return true;
  };

  const cycles = (d.cycles || []).filter((c: any) => {
    if (filters.farm && c.farm_id !== filters.farm) return false;
    if (filters.season && c.season_id !== filters.season) return false;
    if (!inRange(c.planting_date)) return false;
    return true;
  });
  const filteredHarvests = (d.harvests || []).filter((h: any) => (!filters.farm || h.farm_id === filters.farm) && inRange(h.harvest_date));
  const filteredExpenses = (d.expenses || []).filter((e: any) => (!filters.farm || e.farm_id === filters.farm) && inRange(e.expense_date));
  const filteredSales = (d.sales || []).filter((s: any) => (!filters.farm || s.farm_id === filters.farm) && inRange(s.sale_date));

  const activeCycles = cycles.filter((c: any) => ['Planted', 'Growing', 'Ready for Harvest'].includes(c.status));
  const totalPlanted = cycles.filter((c: any) => !['Planned', 'Cancelled'].includes(c.status)).reduce((s: number, c: any) => s + n(c.area_planted), 0);
  const expectedProd = cycles.reduce((s: number, c: any) => s + n(c.expected_production), 0);
  const totalExpenses = filteredExpenses.reduce((s: number, e: any) => s + n(e.amount), 0);
  const totalSales = filteredSales.reduce((s: number, x: any) => s + n(x.total_amount), 0);
  const inv = d.inventory || [];
  const lowStock = inv.filter((i: any) => i.current_quantity <= i.minimum_stock).length;

  const kpis: { icon: string; tone: KpiTone; label: string; value: string; link: string }[] = [
    { icon: 'tractor', tone: 'green', label: 'Total Farms', value: String((d.farms || []).length), link: 'farms' },
    { icon: 'map', tone: 'blue', label: 'Total Fields', value: String((d.fields || []).length), link: 'fields' },
    { icon: 'rotate', tone: 'green', label: 'Active Cycles', value: String(activeCycles.length), link: 'crop-cycles' },
    { icon: 'expand', tone: 'blue', label: 'Planted Area', value: `${totalPlanted.toFixed(1)} ha`, link: 'crop-cycles' },
    { icon: 'chart-line', tone: 'purple', label: 'Expected Harvest', value: `${formatNumber(Math.round(expectedProd))} kg`, link: 'crop-cycles' },
    { icon: 'wheat-awn', tone: 'green', label: 'Harvest Records', value: String(filteredHarvests.length), link: 'harvest' },
    { icon: 'receipt', tone: 'red', label: 'Total Expenses', value: formatCurrency(totalExpenses), link: 'expenses' },
    { icon: 'hand-holding-dollar', tone: 'green', label: 'Total Sales', value: formatCurrency(totalSales), link: 'sales' },
    { icon: 'boxes-stacked', tone: 'blue', label: 'Inventory Items', value: String(inv.length), link: 'inventory' },
    { icon: 'triangle-exclamation', tone: lowStock > 0 ? 'red' : 'green', label: 'Low Stock Items', value: String(lowStock), link: 'inventory' },
  ];

  // land
  const totalArea = (d.farms || []).reduce((s: number, f: any) => s + n(f.total_area), 0);
  const plantedArea = (d.fields || []).filter((f: any) => f.status === 'Active').reduce((s: number, f: any) => s + n(f.area), 0);
  const fallowArea = (d.fields || []).filter((f: any) => f.status === 'Fallow').reduce((s: number, f: any) => s + n(f.area), 0);

  // crop distribution
  const cropMap: Record<string, number> = {};
  cycles.filter((c: any) => !['Planned', 'Cancelled'].includes(c.status)).forEach((c: any) => {
    const nm = c.crops?.name || 'Unknown';
    cropMap[nm] = (cropMap[nm] || 0) + n(c.area_planted);
  });

  // cycle status (all statuses, in the web's order and colours)
  const cycleStatus = CYCLE_STATUSES
    .map((s, i) => ({ label: s, value: cycles.filter((c: any) => c.status === s).length, color: STATUS_COLORS[i] }))
    .filter((x) => x.value > 0);

  // harvest by crop
  const hCropMap: Record<string, number> = {};
  filteredHarvests.forEach((h: any) => {
    const nm = h.crops?.name || 'Unknown';
    hCropMap[nm] = (hCropMap[nm] || 0) + n(h.quantity);
  });

  // production trend
  const monthMap: Record<string, number> = {};
  filteredHarvests.forEach((h: any) => {
    if (!h.harvest_date) return;
    const key = h.harvest_date.substring(0, 7);
    monthMap[key] = (monthMap[key] || 0) + n(h.quantity);
  });
  const trendKeys = Object.keys(monthMap).sort();

  // crop performance
  const perfMap: Record<string, number> = {};
  cycles.forEach((c: any) => {
    const nm = c.crops?.name || 'Unknown';
    perfMap[nm] = (perfMap[nm] || 0) + n(c.area_planted);
  });

  // harvest analytics
  const totalQty = filteredHarvests.reduce((s: number, h: any) => s + n(h.quantity), 0);
  const totalArea2 = filteredHarvests.reduce((s: number, h: any) => s + n(h.harvested_area), 0);
  const totalHarvestCost = filteredHarvests.reduce((s: number, h: any) => s + n(h.labor_cost) + n(h.transport_cost) + n(h.other_costs), 0);

  // finance by month
  const expByMonth: Record<string, number> = {};
  filteredExpenses.forEach((e: any) => { const k = e.expense_date?.substring(0, 7); if (k) expByMonth[k] = (expByMonth[k] || 0) + n(e.amount); });
  const salByMonth: Record<string, number> = {};
  filteredSales.forEach((s: any) => { const k = s.sale_date?.substring(0, 7); if (k) salByMonth[k] = (salByMonth[k] || 0) + n(s.total_amount); });
  const finKeys = [...new Set([...Object.keys(expByMonth), ...Object.keys(salByMonth)])].sort();

  // expense breakdown
  const catMap: Record<string, number> = {};
  filteredExpenses.forEach((e: any) => { catMap[e.category || 'Other'] = (catMap[e.category || 'Other'] || 0) + n(e.amount); });

  // sales by status
  const salesByStatus: Record<string, number> = { Paid: 0, Pending: 0, 'Partially Paid': 0 };
  filteredSales.forEach((s: any) => { salesByStatus[s.payment_status] = (salesByStatus[s.payment_status] || 0) + n(s.total_amount); });

  // inventory health
  const now = Date.now();
  const invHealth = {
    healthy: inv.filter((i: any) => i.current_quantity > i.minimum_stock * 1.5).length,
    low: inv.filter((i: any) => i.current_quantity > 0 && i.current_quantity <= i.minimum_stock * 1.5).length,
    out: inv.filter((i: any) => i.current_quantity <= 0).length,
    expiring: inv.filter((i: any) => i.expiry_date && new Date(i.expiry_date) <= new Date(now + 30 * 86400000) && new Date(i.expiry_date) >= new Date(now)).length,
  };

  // crop health
  const scouting = d.scouting || [];
  const health = {
    healthy: scouting.filter((s: any) => s.plant_health === 'Healthy').length,
    observed: scouting.filter((s: any) => s.plant_health === 'Under Observation').length,
    atRisk: scouting.filter((s: any) => s.plant_health === 'At Risk').length,
  };

  // upcoming
  const upcoming = (d.cycles || [])
    .filter((c: any) => ['Planned', 'Planted', 'Growing', 'Ready for Harvest'].includes(c.status) && c.expected_harvest_date && new Date(c.expected_harvest_date) >= new Date())
    .sort((a: any, b: any) => new Date(a.expected_harvest_date).getTime() - new Date(b.expected_harvest_date).getTime())
    .slice(0, 5);

  // alerts
  const alerts: { tone: 'warning' | 'danger' | 'info'; icon: string; title: string; msg: string }[] = [];
  inv.filter((i: any) => i.current_quantity <= i.minimum_stock && i.current_quantity > 0).forEach((i: any) =>
    alerts.push({ tone: 'warning', icon: 'boxes-stacked', title: 'LOW STOCK', msg: `${i.name} is below minimum stock level.` }));
  inv.filter((i: any) => i.current_quantity <= 0).forEach((i: any) =>
    alerts.push({ tone: 'danger', icon: 'boxes-stacked', title: 'OUT OF STOCK', msg: `${i.name} has zero stock.` }));
  (d.cycles || []).filter((c: any) => c.status === 'Ready for Harvest').forEach((c: any) =>
    alerts.push({ tone: 'info', icon: 'wheat-awn', title: 'HARVEST READY', msg: `${c.crops?.name || ''} is ready for harvest.` }));
  scouting.filter((s: any) => s.plant_health === 'At Risk').slice(-3).forEach((s: any) =>
    alerts.push({ tone: 'danger', icon: 'triangle-exclamation', title: 'CROP HEALTH', msg: `At-risk observation on ${s.crops?.name || ''} at ${s.farms?.name || ''}.` }));

  return {
    kpis,
    cycles,
    filteredSales,
    land: {
      planted: plantedArea,
      fallow: fallowArea,
      total: totalArea,
      pct: totalArea > 0 ? Math.round((plantedArea / totalArea) * 100) : 0,
    },
    cropDist: pairs(cropMap),
    cycleStatus,
    harvestByCrop: { labels: Object.keys(hCropMap), values: Object.values(hCropMap).map((v) => Math.round(v)) },
    trend: { labels: trendKeys.map(monthLabel), values: trendKeys.map((k) => Math.round(monthMap[k])) },
    cropPerf: { labels: Object.keys(perfMap), values: Object.values(perfMap).map((v) => Math.round(v * 10) / 10) },
    harvest: {
      totalQty,
      avgYield: totalArea2 > 0 ? totalQty / totalArea2 : 0,
      count: filteredHarvests.length,
      totalCost: totalHarvestCost,
    },
    finance: {
      labels: finKeys.map(monthLabel),
      sales: finKeys.map((k) => Math.round(salByMonth[k] || 0)),
      expenses: finKeys.map((k) => Math.round(expByMonth[k] || 0)),
      balance: finKeys.map((k) => Math.round((salByMonth[k] || 0) - (expByMonth[k] || 0))),
      totalSales,
      totalExpenses,
    },
    expenseBreakdown: pairs(catMap),
    salesByStatus,
    inv: invHealth,
    health,
    upcoming,
    alerts,
  };
}
