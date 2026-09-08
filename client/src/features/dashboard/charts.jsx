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
  Tooltip,
} from 'chart.js';

ChartJS.register(
  ArcElement, BarElement, LineElement, PointElement,
  CategoryScale, LinearScale, Filler, Legend, Tooltip
);

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
      x: { ticks: { color: textColor(), font: { family: 'Inter', size: 11 } }, grid: { color: gridColor() }, border: { color: gridColor() } },
      y: { ticks: { color: textColor(), font: { family: 'Inter', size: 11 } }, grid: { color: gridColor() }, border: { color: gridColor() }, beginAtZero: true },
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
