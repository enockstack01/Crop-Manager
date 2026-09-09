// Dashboard aggregation — a focused port of client/src/pages/Dashboard.jsx:computeAggregates
import { formatCurrency, formatNumber } from '../../lib/format';

const monthLabel = (key: string) => {
  const [y, m] = key.split('-');
  return new Date(Number(y), Number(m) - 1).toLocaleString('en', { month: 'short', year: '2-digit' });
};
const n = (v: any) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export type DashFilters = { farm: string; season: string; from: string; to: string };

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
  const harvests = (d.harvests || []).filter((h: any) => (!filters.farm || h.farm_id === filters.farm) && inRange(h.harvest_date));
  const expenses = (d.expenses || []).filter((e: any) => (!filters.farm || e.farm_id === filters.farm) && inRange(e.expense_date));
  const sales = (d.sales || []).filter((s: any) => (!filters.farm || s.farm_id === filters.farm) && inRange(s.sale_date));

  const activeCycles = cycles.filter((c: any) => ['Planted', 'Growing', 'Ready for Harvest'].includes(c.status));
  const totalPlanted = cycles
    .filter((c: any) => !['Planned', 'Cancelled'].includes(c.status))
    .reduce((s: number, c: any) => s + n(c.area_planted), 0);
  const expectedProd = cycles.reduce((s: number, c: any) => s + n(c.expected_production), 0);
  const totalExpenses = expenses.reduce((s: number, e: any) => s + n(e.amount), 0);
  const totalSales = sales.reduce((s: number, x: any) => s + n(x.total_amount), 0);
  const inv = d.inventory || [];
  const lowStock = inv.filter((i: any) => i.current_quantity <= i.minimum_stock).length;

  const kpis = [
    { icon: 'tractor', label: 'Farms', value: String((d.farms || []).length), link: 'farms' },
    { icon: 'map-outline', label: 'Fields', value: String((d.fields || []).length), link: 'fields' },
    { icon: 'sync', label: 'Active Cycles', value: String(activeCycles.length), link: 'crop-cycles' },
    { icon: 'arrow-expand-all', label: 'Planted Area', value: `${totalPlanted.toFixed(1)} ha`, link: 'crop-cycles' },
    { icon: 'chart-line', label: 'Expected Harvest', value: `${formatNumber(Math.round(expectedProd))} kg`, link: 'crop-cycles' },
    { icon: 'barley', label: 'Harvest Records', value: String(harvests.length), link: 'harvest' },
    { icon: 'receipt', label: 'Expenses', value: formatCurrency(totalExpenses), link: 'expenses' },
    { icon: 'cash-multiple', label: 'Sales', value: formatCurrency(totalSales), link: 'sales' },
    { icon: 'package-variant-closed', label: 'Inventory', value: String(inv.length), link: 'inventory' },
    { icon: 'alert', label: 'Low Stock', value: String(lowStock), link: 'inventory' },
  ];

  // land
  const totalArea = (d.farms || []).reduce((s: number, f: any) => s + n(f.total_area), 0);
  const plantedArea = (d.fields || []).filter((f: any) => f.status === 'Active').reduce((s: number, f: any) => s + n(f.area), 0);
  const landPct = totalArea > 0 ? Math.round((plantedArea / totalArea) * 100) : 0;

  // crop distribution
  const cropMap: Record<string, number> = {};
  cycles
    .filter((c: any) => !['Planned', 'Cancelled'].includes(c.status))
    .forEach((c: any) => {
      const nm = c.crops?.name || 'Unknown';
      cropMap[nm] = (cropMap[nm] || 0) + n(c.area_planted);
    });

  // cycle status
  const CYCLE_STATUSES = ['Planned', 'Planted', 'Growing', 'Ready for Harvest', 'Harvested', 'Completed', 'Cancelled'];
  const cycleStatus = CYCLE_STATUSES
    .map((s) => ({ label: s, value: cycles.filter((c: any) => c.status === s).length }))
    .filter((x) => x.value > 0);

  // harvest by crop
  const hCropMap: Record<string, number> = {};
  harvests.forEach((h: any) => {
    const nm = h.crops?.name || h.crop_cycles?.crops?.name || 'Unknown';
    hCropMap[nm] = (hCropMap[nm] || 0) + n(h.quantity);
  });

  // production trend
  const monthMap: Record<string, number> = {};
  harvests.forEach((h: any) => {
    if (!h.harvest_date) return;
    const key = h.harvest_date.substring(0, 7);
    monthMap[key] = (monthMap[key] || 0) + n(h.quantity);
  });
  const trendKeys = Object.keys(monthMap).sort();

  // finance by month
  const expByMonth: Record<string, number> = {};
  expenses.forEach((e: any) => { const k = e.expense_date?.substring(0, 7); if (k) expByMonth[k] = (expByMonth[k] || 0) + n(e.amount); });
  const salByMonth: Record<string, number> = {};
  sales.forEach((s: any) => { const k = s.sale_date?.substring(0, 7); if (k) salByMonth[k] = (salByMonth[k] || 0) + n(s.total_amount); });
  const finKeys = [...new Set([...Object.keys(expByMonth), ...Object.keys(salByMonth)])].sort();

  // expense breakdown
  const catMap: Record<string, number> = {};
  expenses.forEach((e: any) => { catMap[e.category || 'Other'] = (catMap[e.category || 'Other'] || 0) + n(e.amount); });

  // harvest analytics
  const totalQty = harvests.reduce((s: number, h: any) => s + n(h.quantity), 0);
  const totalHarvestArea = harvests.reduce((s: number, h: any) => s + n(h.harvested_area), 0);

  // scouting / inventory health
  const scouting = d.scouting || [];
  const now = Date.now();
  const invHealth = {
    healthy: inv.filter((i: any) => i.current_quantity > i.minimum_stock * 1.5).length,
    low: inv.filter((i: any) => i.current_quantity > 0 && i.current_quantity <= i.minimum_stock * 1.5).length,
    out: inv.filter((i: any) => i.current_quantity <= 0).length,
    expiring: inv.filter((i: any) => i.expiry_date && new Date(i.expiry_date) <= new Date(now + 30 * 86400000) && new Date(i.expiry_date) >= new Date(now)).length,
  };

  // alerts
  const alerts: { tone: 'warning' | 'danger' | 'info'; icon: string; title: string; msg: string }[] = [];
  inv.filter((i: any) => i.current_quantity <= i.minimum_stock && i.current_quantity > 0).forEach((i: any) =>
    alerts.push({ tone: 'warning', icon: 'package-variant', title: 'LOW STOCK', msg: `${i.name} is below minimum stock level.` }));
  inv.filter((i: any) => i.current_quantity <= 0).forEach((i: any) =>
    alerts.push({ tone: 'danger', icon: 'package-variant-closed-remove', title: 'OUT OF STOCK', msg: `${i.name} has zero stock.` }));
  (d.cycles || []).filter((c: any) => c.status === 'Ready for Harvest').forEach((c: any) =>
    alerts.push({ tone: 'info', icon: 'barley', title: 'HARVEST READY', msg: `${c.crops?.name || ''} is ready for harvest.` }));
  scouting.filter((s: any) => s.plant_health === 'At Risk').slice(-3).forEach((s: any) =>
    alerts.push({ tone: 'danger', icon: 'alert', title: 'CROP HEALTH', msg: `At-risk observation on ${s.crops?.name || ''} at ${s.farms?.name || ''}.` }));

  // upcoming
  const upcoming = (d.cycles || [])
    .filter((c: any) => ['Planned', 'Planted', 'Growing', 'Ready for Harvest'].includes(c.status) && c.expected_harvest_date && new Date(c.expected_harvest_date) >= new Date())
    .sort((a: any, b: any) => new Date(a.expected_harvest_date).getTime() - new Date(b.expected_harvest_date).getTime())
    .slice(0, 6);

  return {
    kpis,
    land: { planted: plantedArea, total: totalArea, pct: landPct },
    cropDist: Object.entries(cropMap).map(([label, value]) => ({ label, value })),
    cycleStatus,
    harvestByCrop: { labels: Object.keys(hCropMap), values: Object.values(hCropMap).map((v) => Math.round(v)) },
    trend: { labels: trendKeys.map(monthLabel), values: trendKeys.map((k) => Math.round(monthMap[k])) },
    finance: {
      labels: finKeys.map(monthLabel),
      sales: finKeys.map((k) => Math.round(salByMonth[k] || 0)),
      expenses: finKeys.map((k) => Math.round(expByMonth[k] || 0)),
      totalSales, totalExpenses,
    },
    expenseBreakdown: Object.entries(catMap).map(([label, value]) => ({ label, value })),
    harvest: { totalQty, avgYield: totalHarvestArea > 0 ? totalQty / totalHarvestArea : 0, count: harvests.length },
    invHealth,
    alerts,
    upcoming,
  };
}
