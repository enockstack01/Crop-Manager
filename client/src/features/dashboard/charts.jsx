import { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Ticks,
  Tooltip,
} from 'chart.js';
import { valueLabelsPlugin } from './valueLabels.js';

const NARROW = 440; // px of chart width below which charts switch to their compact layout

/**
 * Adapts every chart to its own width on each update (including resizes and option
 * changes from React re-renders): legend text tightens when the card is narrow. Registered before Legend so the legend
 * lays itself out with these values in the same update.
 */
const responsiveLayout = {
  id: 'responsiveLayout',
  beforeUpdate(chart) {
    const legend = chart.options.plugins?.legend;
    if (!legend) return;
    const narrow = chart.width < NARROW;
    legend.labels = {
      ...legend.labels,
      font: { ...(legend.labels?.font || {}), size: narrow ? 10 : 12 },
      padding: narrow ? 8 : 16,
      boxWidth: narrow ? 8 : 12,
    };
  },
};

ChartJS.register(
  responsiveLayout,
  valueLabelsPlugin,
  BarElement, LineElement, PointElement,
  CategoryScale, LinearScale, Filler, Legend, Tooltip
);

/* House style for every chart (as in LivestockPro): headroom above the highest
   value so its printed number fits, thin bars rounded at the data end, smooth
   lines with a dot per (labelled) value. */
ChartJS.defaults.scales.linear.grace = '15%';
ChartJS.defaults.layout.padding = { top: 6, right: 20, left: 0, bottom: 0 };
Object.assign(ChartJS.defaults.datasets.bar, { maxBarThickness: 34, borderRadius: 4, borderSkipped: 'start' });
Object.assign(ChartJS.defaults.datasets.line, { cubicInterpolationMode: 'monotone', pointRadius: 3, pointHoverRadius: 5 });

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const tickFont = (ctx) => ({ family: 'Carlito, Calibri, Arial', size: ctx.chart.width < NARROW ? 9 : 11 });

export const PALETTE = [
  '#2E7D32', '#F9A825', '#1B5E20', '#5B6B5D', '#14532D', '#1C2B1E',
];
export const LEAF = '#2E7D32';
export const AMBER = '#F9A825';
export const INK = '#1C2B1E';

export const isDark = () => document.documentElement.classList.contains('dark-mode');

/** Re-render subscribers when the dark-mode class toggles (keeps charts themed). */
export function useIsDark() {
  const [dark, setDark] = useState(isDark());
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(isDark()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}
const textColor = () => (isDark() ? '#FFFFFF' : '#5B6B5D');
const gridColor = () => (isDark() ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)');
export const chartBg = () => (isDark() ? '#1E1E1E' : '#FFFFFF');

export function baseOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    // hovering anywhere in a column shows every series at that point
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        labels: { color: textColor(), font: { family: 'Carlito, Calibri, Arial', size: 12 }, padding: 16, usePointStyle: true, pointStyleWidth: 10 },
      },
      tooltip: {
        backgroundColor: isDark() ? '#1E1E1E' : '#fff',
        titleColor: isDark() ? '#FFFFFF' : '#1C2B1E',
        bodyColor: isDark() ? '#FFFFFF' : '#5B6B5D',
        borderColor: isDark() ? '#3A3A3A' : '#D5E3D6',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
      },
    },
    scales: {
      x: {
        ticks: { color: textColor(), font: tickFont, autoSkip: true, autoSkipPadding: 8, maxRotation: 45 },
        grid: { display: false },
        border: { color: gridColor() },
      },
      y: {
        ticks: {
          color: textColor(),
          font: tickFont,
          // 1,250,000 -> 1.3M so axis labels don't eat into narrow charts
          callback(v, i, ticks) {
            return Math.abs(v) >= 10000 ? compact.format(v) : Ticks.formatters.numeric.call(this, v, i, ticks);
          },
        },
        grid: { color: gridColor(), drawTicks: false },
        border: { display: false },
        beginAtZero: true,
      },
    },
  };
}

/** Horizontal bars in Leaf Green: the brand's answer to pies with many slices. */
export function breakdownOptions(format = (v) => v) {
  const base = baseOptions();
  return {
    ...base,
    indexAxis: 'y',
    interaction: { mode: 'nearest', intersect: true },
    plugins: {
      ...base.plugins,
      legend: { display: false },
      tooltip: { ...base.plugins.tooltip, callbacks: { label: (c) => ` ${c.label}: ${format(c.parsed.x)}` } },
    },
    scales: {
      x: { ...base.scales.y, beginAtZero: true },
      y: { ...base.scales.x, ticks: { ...base.scales.x.ticks, maxRotation: 0, autoSkip: false } },
    },
  };
}
