import { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
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
import { legendWithValues, valueLabelsPlugin } from './valueLabels.js';

const NARROW = 440; // px of chart width below which charts switch to their compact layout

/**
 * Adapts every chart to its own width on each update (including resizes and option
 * changes from React re-renders): doughnut legends move below the ring and legend
 * text tightens when the card is narrow. Registered before Legend so the legend
 * lays itself out with these values in the same update.
 */
const responsiveLayout = {
  id: 'responsiveLayout',
  beforeUpdate(chart) {
    const legend = chart.options.plugins?.legend;
    if (!legend) return;
    const narrow = chart.width < NARROW;
    const doughnut = chart.config.type === 'doughnut' || chart.config.type === 'pie';
    if (doughnut) legend.position = narrow ? 'bottom' : 'right';
    legend.labels = {
      ...legend.labels,
      font: { ...(legend.labels?.font || {}), size: narrow ? 10 : doughnut ? 11 : 12 },
      padding: narrow ? 8 : doughnut ? 10 : 16,
      boxWidth: narrow ? 8 : 12,
    };
  },
};

ChartJS.register(
  responsiveLayout,
  valueLabelsPlugin,
  ArcElement, BarElement, LineElement, PointElement,
  CategoryScale, LinearScale, Filler, Legend, Tooltip
);

/* House style for every chart (as in LivestockPro): headroom above the highest
   value so its printed number fits, thin bars rounded at the data end, smooth
   lines with a dot per (labelled) value, and doughnut legends with value + share. */
ChartJS.defaults.scales.linear.grace = '15%';
ChartJS.defaults.layout.padding = { top: 6, right: 20, left: 0, bottom: 0 };
Object.assign(ChartJS.defaults.datasets.bar, { maxBarThickness: 34, borderRadius: 4, borderSkipped: 'start' });
Object.assign(ChartJS.defaults.datasets.line, { cubicInterpolationMode: 'monotone', pointRadius: 3, pointHoverRadius: 5 });
for (const type of ['doughnut', 'pie']) {
  const base = ChartJS.overrides[type].plugins.legend.labels.generateLabels;
  ChartJS.overrides[type].plugins.legend.labels.generateLabels = (chart) => legendWithValues(chart, base);
}

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const tickFont = (ctx) => ({ family: 'Inter', size: ctx.chart.width < NARROW ? 9 : 11 });

export const PALETTE = [
  '#2E7D32', '#1976D2', '#F9A825', '#D32F2F', '#7B1FA2',
  '#00897B', '#E65100', '#5D4037', '#37474F', '#C2185B',
];

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
const textColor = () => (isDark() ? '#BDBDBD' : '#546E7A');
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
        labels: { color: textColor(), font: { family: 'Inter', size: 12 }, padding: 16, usePointStyle: true, pointStyleWidth: 10 },
      },
      tooltip: {
        backgroundColor: isDark() ? '#2A2A2A' : '#fff',
        titleColor: isDark() ? '#E0E0E0' : '#263238',
        bodyColor: isDark() ? '#BDBDBD' : '#546E7A',
        borderColor: isDark() ? '#444' : '#E0E0E0',
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

export function doughnutOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '58%',
    plugins: {
      legend: {
        position: 'right',
        labels: { color: textColor(), font: { family: 'Inter', size: 11 }, padding: 10, usePointStyle: true, pointStyleWidth: 8 },
      },
    },
  };
}
