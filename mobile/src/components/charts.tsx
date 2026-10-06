import React, { useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Polygon, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { CHART_PALETTE } from '../theme/theme';
import { AppText } from './ui';
import { t } from '../i18n';

/*
 * Lightweight SVG charts styled after the web app's Chart.js setup
 * (client/src/features/dashboard/charts.jsx): same palette, 58% doughnut cutout with
 * the legend below on narrow screens, rounded bars, compact axis numbers (1.2M), and
 * charts that size themselves to their card instead of scrolling sideways.
 * Every chart prints the numbers it draws (as on the web and in LivestockPro): values on
 * top of bars, above line points and on doughnut slices, and "label: value (pct%)" in
 * doughnut legends. Values are shortened (12.4K) so they fit.
 */

const compact = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1e9) return `${+(v / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${+(v / 1e6).toFixed(1)}M`;
  if (a >= 1e4) return `${+(v / 1e3).toFixed(1)}K`;
  return Math.round(v).toLocaleString('en-US');
};
/** value labels: 950 · 12.4K · 2.6M */
const short = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1e9) return `${+(v / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${+(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${+(v / 1e3).toFixed(1)}K`;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
};
/** rough text width of an SVG label in Inter at fontSize px */
const textW = (t: string, fontSize: number) => t.length * fontSize * 0.58;
/** headroom above the highest value so its printed number fits (web: grace 15%), rounded
 * up to a tidy axis top (1, 1.2, 1.6, 2, 2.4, 3.2, 4, 6, 8 or 10 × 10ⁿ) whose quarter ticks are round numbers */
const axisTop = (max: number) => {
  const v = Math.max(1, max) * 1.15;
  const p = 10 ** Math.floor(Math.log10(v));
  const step = [1, 1.2, 1.6, 2, 2.4, 3.2, 4, 6, 8, 10].find((m) => m * p >= v) ?? 10;
  return step * p;
};
/** a chart value label with a halo underneath so lines and grid don't cross it */
function ValueText({ halo, children, ...props }: React.ComponentProps<typeof SvgText> & { halo: string; children: string }) {
  return (
    <G>
      <SvgText {...props} fill={halo} stroke={halo} strokeWidth={3} strokeLinejoin="round">{children}</SvgText>
      <SvgText {...props}>{children}</SvgText>
    </G>
  );
}
const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const polar = (cx: number, cy: number, r: number, angle: number) => ({
  x: cx + r * Math.cos(angle - Math.PI / 2),
  y: cy + r * Math.sin(angle - Math.PI / 2),
});

/** measures the available width so charts fill their card */
function useWidth(fallback = 300) {
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const nw = Math.round(e.nativeEvent.layout.width);
    if (nw && Math.abs(nw - w) > 1) setW(nw);
  };
  return { width: w || fallback, ready: w > 0, onLayout };
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: color }} />
      <AppText variant="caption" style={{ fontSize: 11 }}>{label}</AppText>
    </View>
  );
}

function ChartEmpty({ label = 'No data to display' }: { label?: string }) {
  return (
    <View style={{ height: 140, alignItems: 'center', justifyContent: 'center' }}>
      <AppText variant="subtitle" style={{ fontSize: 13 }}>{label}</AppText>
    </View>
  );
}

/* ------------------------------------------------------------- Donut */
export function Donut({
  data,
  size = 190,
  emptyLabel,
}: {
  data: { label: string; value: number; color?: string }[];
  size?: number;
  emptyLabel?: string;
}) {
  const { colors } = useTheme();
  const total = data.reduce((s, d) => s + Math.max(0, d.value), 0);
  if (total <= 0) return <ChartEmpty label={emptyLabel} />;

  const cx = size / 2;
  const cy = size / 2;
  const outer = size / 2 - 2;
  const inner = outer * 0.58; // Chart.js cutout: '58%'
  const r = (outer + inner) / 2;
  const thickness = outer - inner;

  let acc = 0;
  const arcs = data
    .filter((d) => d.value > 0)
    .map((d, i) => {
      const frac = d.value / total;
      const start = acc * 2 * Math.PI;
      // a full circle can't be drawn as one arc; stop just short of 360°
      const end = Math.min((acc + frac) * 2 * Math.PI, start + 2 * Math.PI - 0.0001);
      acc += frac;
      const p1 = polar(cx, cy, r, start);
      const p2 = polar(cx, cy, r, end);
      const large = end - start > Math.PI ? 1 : 0;
      return {
        d: `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 1 ${p2.x} ${p2.y}`,
        color: d.color ?? CHART_PALETTE[i % CHART_PALETTE.length],
        label: d.label,
        value: d.value,
        mid: (start + end) / 2,
        sweep: end - start,
      };
    });

  return (
    <View style={{ alignItems: 'center', gap: 14 }}>
      <Svg width={size} height={size}>
        {arcs.map((a, i) => (
          <Path key={i} d={a.d} stroke={a.color} strokeWidth={thickness} fill="none" />
        ))}
        {/* 2px separators like Chart.js borderColor = card background */}
        {arcs.length > 1
          ? arcs.map((_, i) => {
              let s = 0;
              for (let k = 0; k < i; k++) s += arcs[k].value / total;
              const a = s * 2 * Math.PI;
              const p1 = polar(cx, cy, inner, a);
              const p2 = polar(cx, cy, outer, a);
              return <Line key={`sep${i}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={colors.card} strokeWidth={2} />;
            })
          : null}
        {/* the value on each slice that has room for it; the legend lists every one */}
        {arcs.map((a, i) => {
          const text = short(a.value);
          if (a.sweep * r < textW(text, 10) + 6 || thickness < 14) return null;
          const p = polar(cx, cy, r, a.mid);
          return (
            <SvgText key={`v${i}`} x={p.x} y={p.y + 3.5} fontSize={10} fontFamily="Inter_600SemiBold" textAnchor="middle"
              fill="#FFFFFF">
              {text}
            </SvgText>
          );
        })}
      </Svg>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 12, rowGap: 6 }}>
        {arcs.map((a, i) => (
          <LegendDot key={i} color={a.color} label={`${t(a.label)}: ${short(a.value)} (${Math.round((a.value / total) * 100)}%)`} />
        ))}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------- Bars */
export function Bars({
  labels,
  datasets,
  height = 240,
  colorEach,
  emptyLabel,
}: {
  labels: string[];
  datasets: { label: string; data: number[]; color?: string }[];
  height?: number;
  /** one palette colour per bar (web: single-dataset bars use PALETTE) */
  colorEach?: boolean;
  emptyLabel?: string;
}) {
  const { colors } = useTheme();
  const { width, onLayout } = useWidth();
  if (!labels.length) return <ChartEmpty label={emptyLabel} />;

  const pad = { l: 44, r: 6, t: 14, b: 34 };
  const max = axisTop(Math.max(...datasets.flatMap((d) => d.data)));
  const chartH = height - pad.t - pad.b;
  const groupW = (width - pad.l - pad.r) / labels.length;
  const barW = Math.max(4, Math.min(26, (groupW * 0.7) / datasets.length));
  const labelEvery = Math.max(1, Math.ceil((labels.length * 46) / (width - pad.l)));
  const single = datasets.length === 1;

  return (
    <View onLayout={onLayout}>
      <Svg width={width} height={height}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = pad.t + chartH * (1 - t);
          return (
            <G key={t}>
              <Line x1={pad.l} x2={width - pad.r} y1={y} y2={y} stroke={colors.border} strokeWidth={1} />
              <SvgText x={pad.l - 6} y={y + 3} fontSize={9} fill={colors.textLight} fontFamily="Inter_400Regular" textAnchor="end">
                {compact(max * t)}
              </SvgText>
            </G>
          );
        })}
        {labels.map((lab, i) => {
          const gx = pad.l + groupW * i + groupW / 2;
          return (
            <G key={i}>
              {datasets.map((ds, di) => {
                const v = Math.max(0, ds.data[i] ?? 0);
                const h = (v / max) * chartH;
                const x = gx - (barW * datasets.length) / 2 + di * barW;
                const fill = single && colorEach ? CHART_PALETTE[i % CHART_PALETTE.length] : ds.color ?? CHART_PALETTE[di % CHART_PALETTE.length];
                const text = short(v);
                const top = pad.t + chartH - h;
                // an empty month in a long series has no bar to label
                const showValue = !(v === 0 && labels.length > 8);
                // turn the number upright when it is wider than the bar
                const upright = textW(text, 9) > barW + 4;
                return (
                  <G key={di}>
                    <Rect x={x + 1} y={top} width={barW - 2} height={Math.max(0, h)} rx={4} fill={fill} />
                    {showValue ? (
                      upright ? (
                        <ValueText halo={colors.card} x={x + barW / 2 + 3} y={top - 4} fontSize={9} fontFamily="Inter_600SemiBold" fill={colors.text}
                          transform={`rotate(-90 ${x + barW / 2 + 3} ${top - 4})`}>
                          {text}
                        </ValueText>
                      ) : (
                        <ValueText halo={colors.card} x={x + barW / 2} y={top - 4} fontSize={9} fontFamily="Inter_600SemiBold" fill={colors.text} textAnchor="middle">
                          {text}
                        </ValueText>
                      )
                    ) : null}
                  </G>
                );
              })}
              {i % labelEvery === 0 ? (
                <SvgText x={gx} y={height - pad.b + 16} fontSize={9.5} fill={colors.textLight} fontFamily="Inter_400Regular" textAnchor="middle">
                  {truncate(lab, 9)}
                </SvgText>
              ) : null}
            </G>
          );
        })}
      </Svg>
      {datasets.length > 1 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 12, rowGap: 6, marginTop: 6 }}>
          {datasets.map((d, i) => <LegendDot key={i} color={d.color ?? CHART_PALETTE[i % CHART_PALETTE.length]} label={t(d.label)} />)}
        </View>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------- LineChart */
export function LineChart({
  labels,
  data,
  height = 240,
  color,
  label,
  emptyLabel,
}: {
  labels: string[];
  data: number[];
  height?: number;
  color?: string;
  label?: string;
  emptyLabel?: string;
}) {
  const { colors } = useTheme();
  const { width, onLayout } = useWidth();
  if (!labels.length) return <ChartEmpty label={emptyLabel} />;

  const stroke = color ?? '#2E7D32';
  const pad = { l: 44, r: 18, t: 16, b: 34 };
  const max = axisTop(Math.max(...data));
  const chartH = height - pad.t - pad.b;
  const step = labels.length > 1 ? (width - pad.l - pad.r) / (labels.length - 1) : 0;
  const x = (i: number) => (labels.length > 1 ? pad.l + step * i : (pad.l + width - pad.r) / 2);
  const y = (v: number) => pad.t + chartH - (Math.max(0, v) / max) * chartH;
  const pts = data.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const area = `${x(0)},${pad.t + chartH} ${pts} ${x(data.length - 1)},${pad.t + chartH}`;
  const labelEvery = Math.max(1, Math.ceil((labels.length * 48) / (width - pad.l)));

  return (
    <View onLayout={onLayout}>
      {label ? (
        <View style={{ alignItems: 'center', marginBottom: 4 }}>
          <LegendDot color={stroke} label={t(label)} />
        </View>
      ) : null}
      <Svg width={width} height={height}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const yy = pad.t + chartH * (1 - t);
          return (
            <G key={t}>
              <Line x1={pad.l} x2={width - pad.r} y1={yy} y2={yy} stroke={colors.border} strokeWidth={1} />
              <SvgText x={pad.l - 6} y={yy + 3} fontSize={9} fill={colors.textLight} fontFamily="Inter_400Regular" textAnchor="end">
                {compact(max * t)}
              </SvgText>
            </G>
          );
        })}
        {/* web: fill: true, backgroundColor rgba(46,125,50,0.1) */}
        <Polygon points={area} fill={stroke} fillOpacity={0.1} />
        <Polyline points={pts} fill="none" stroke={stroke} strokeWidth={3} strokeLinejoin="round" />
        {data.map((v, i) => (
          <Circle key={i} cx={x(i)} cy={y(v)} r={4} fill={stroke} stroke={colors.card} strokeWidth={1.5} />
        ))}
        {/* the value above each point (with a halo so the line doesn't cross it) */}
        {data.map((v, i) => (
          <ValueText halo={colors.card} key={`v${i}`} x={x(i)} y={y(v) - 8} fontSize={9} fontFamily="Inter_600SemiBold" fill={colors.text} textAnchor="middle">
            {short(v)}
          </ValueText>
        ))}
        {labels.map((lab, i) =>
          i % labelEvery === 0 ? (
            <SvgText key={i} x={x(i)} y={height - pad.b + 16} fontSize={9.5} fill={colors.textLight} fontFamily="Inter_400Regular" textAnchor="middle">
              {truncate(lab, 8)}
            </SvgText>
          ) : null,
        )}
      </Svg>
    </View>
  );
}
