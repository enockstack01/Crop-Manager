/*
 * Every chart shows the numbers it draws (same approach as LivestockPro):
 *  - bars: the value at the end of each bar (turned upright when wider than the bar)
 *  - lines: the value above each point
 *  - doughnuts: the value on each slice that fits, and "label: value (pct%)" in the legend
 * Values are shortened (12.4K) so they fit; tooltips still show the exact figure.
 * Per chart: options.plugins.valueLabels = { display, lines, color, surface }.
 */
const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
export const formatCompact = (v) => {
  const n = Number(v) || 0;
  if (Math.abs(n) < 1000) return Number.isInteger(n) ? String(n) : n.toFixed(1);
  return compact.format(n);
};

const FONT = (px) => `600 ${px}px Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

function drawText(ctx, text, x, y, { color, align = 'center', baseline = 'middle', rotate = false, halo = null }) {
  ctx.save();
  if (halo) {
    ctx.strokeStyle = halo;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
  }
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  if (rotate) {
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 2);
    if (halo) ctx.strokeText(text, 0, 0);
    ctx.fillText(text, 0, 0);
  } else {
    if (halo) ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
  }
  ctx.restore();
}

const isDark = () => document.documentElement.classList.contains('dark-mode');

export const valueLabelsPlugin = {
  id: 'valueLabels',
  defaults: { display: true, lines: true, color: null, surface: null },
  afterDatasetsDraw(chart, _args, opts) {
    if (opts.display === false) return;
    const { ctx } = chart;
    const ink = opts.color || (isDark() ? '#E0E0E0' : '#37474F');
    const surface = opts.surface || (isDark() ? '#1E1E1E' : '#FFFFFF');
    ctx.save();
    ctx.font = FONT(chart.width < 440 ? 9.5 : 11);

    if (chart.config.type === 'doughnut' || chart.config.type === 'pie') {
      chart.data.datasets.forEach((ds, di) => {
        if (!chart.isDatasetVisible(di)) return;
        chart.getDatasetMeta(di).data.forEach((arc, i) => {
          const v = Number(ds.data[i]) || 0;
          if (!v || chart.getDataVisibility?.(i) === false) return;
          const { startAngle, endAngle, innerRadius, outerRadius, x, y } = arc.getProps(['startAngle', 'endAngle', 'innerRadius', 'outerRadius', 'x', 'y']);
          const text = formatCompact(v);
          const r = (innerRadius + outerRadius) / 2;
          // too thin to hold the number: the legend lists it
          if ((endAngle - startAngle) * r < ctx.measureText(text).width + 6 || outerRadius - innerRadius < 14) return;
          const mid = (startAngle + endAngle) / 2;
          drawText(ctx, text, x + Math.cos(mid) * r, y + Math.sin(mid) * r, { color: '#FFFFFF', halo: 'rgba(0,0,0,0.25)' });
        });
      });
      ctx.restore();
      return;
    }

    const horizontal = chart.options.indexAxis === 'y';
    chart.data.datasets.forEach((ds, di) => {
      if (!chart.isDatasetVisible(di)) return;
      const meta = chart.getDatasetMeta(di);
      if (meta.type === 'line' && opts.lines === false) return;
      meta.data.forEach((el, i) => {
        const raw = ds.data[i];
        const v = Number(raw && typeof raw === 'object' ? (horizontal ? raw.x : raw.y) : raw) || 0;
        // an empty month in a long bar series has no bar to label; its 0 would crowd the axis
        if (meta.type !== 'line' && v === 0 && meta.data.length > 8) return;
        const text = formatCompact(v);
        const w = ctx.measureText(text).width;

        if (meta.type === 'line') {
          const { x, y } = el.getProps(['x', 'y']);
          drawText(ctx, text, x, y - 8, { color: ink, baseline: 'bottom', halo: surface });
          return;
        }

        const { x, y, width } = el.getProps(['x', 'y', 'width']);
        const neg = v < 0;
        if (horizontal) {
          drawText(ctx, text, neg ? x - 5 : x + 5, y, { color: ink, align: neg ? 'right' : 'left', halo: surface });
        } else if (w > width + 6) {
          drawText(ctx, text, x, neg ? y + 5 : y - 5, { color: ink, align: neg ? 'right' : 'left', rotate: true, halo: surface });
        } else {
          drawText(ctx, text, x, neg ? y + 5 : y - 5, { color: ink, baseline: neg ? 'top' : 'bottom', halo: surface });
        }
      });
    });
    ctx.restore();
  },
};

/** Doughnut / pie legend items read "Label: value (pct%)". */
export function legendWithValues(chart, baseGenerate) {
  const items = baseGenerate(chart);
  const data = chart.data.datasets?.[0]?.data || [];
  const total = data.reduce((s, v) => s + (Number(v) || 0), 0);
  return items.map((it) => {
    const v = Number(data[it.index]) || 0;
    return { ...it, text: `${it.text}: ${formatCompact(v)} (${total ? Math.round((v / total) * 100) : 0}%)` };
  });
}
