import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Path, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { CHART_PALETTE } from '../theme/theme';
import { AppText } from './ui';

const polar = (cx: number, cy: number, r: number, angle: number) => ({
  x: cx + r * Math.cos(angle - Math.PI / 2),
  y: cy + r * Math.sin(angle - Math.PI / 2),
});

/* ------------------------------------------------------------- Donut */
export function Donut({
  data,
  size = 200,
  thickness = 26,
}: {
  data: { label: string; value: number }[];
  size?: number;
  thickness?: number;
}) {
  const { colors } = useTheme();
  const total = data.reduce((s, d) => s + Math.max(0, d.value), 0);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - thickness / 2 - 2;

  if (total <= 0) return <ChartEmpty />;

  let acc = 0;
  const arcs = data
    .filter((d) => d.value > 0)
    .map((d, i) => {
      const frac = d.value / total;
      const start = acc * 2 * Math.PI;
      const end = (acc + frac) * 2 * Math.PI;
      acc += frac;
      const p1 = polar(cx, cy, r, start);
      const p2 = polar(cx, cy, r, end);
      const large = end - start > Math.PI ? 1 : 0;
      return {
        d: `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 1 ${p2.x} ${p2.y}`,
        color: CHART_PALETTE[i % CHART_PALETTE.length],
        label: d.label,
        value: d.value,
      };
    });

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={r} stroke={colors.border} strokeWidth={thickness} fill="none" />
        {arcs.map((a, i) => (
          <Path key={i} d={a.d} stroke={a.color} strokeWidth={thickness} fill="none" strokeLinecap="butt" />
        ))}
      </Svg>
      <View style={{ gap: 4, flexShrink: 1 }}>
        {arcs.map((a, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: a.color }} />
            <AppText variant="caption" style={{ flexShrink: 1 }}>
              {a.label} · {Math.round((a.value / total) * 100)}%
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------- Bars */
export function Bars({
  labels,
  datasets,
  height = 220,
}: {
  labels: string[];
  datasets: { label: string; data: number[]; color?: string }[];
  height?: number;
}) {
  const { colors } = useTheme();
  const width = Math.max(300, labels.length * 56 * Math.max(1, datasets.length * 0.6));
  const pad = { l: 8, r: 8, t: 10, b: 40 };
  const max = Math.max(1, ...datasets.flatMap((d) => d.data));
  const chartH = height - pad.t - pad.b;
  const groupW = (width - pad.l - pad.r) / Math.max(1, labels.length);
  const barW = Math.min(28, (groupW * 0.7) / datasets.length);

  if (!labels.length) return <ChartEmpty />;

  return (
    <View>
      <Svg width={width} height={height}>
        {[0, 0.5, 1].map((t) => (
          <Line
            key={t}
            x1={pad.l}
            x2={width - pad.r}
            y1={pad.t + chartH * (1 - t)}
            y2={pad.t + chartH * (1 - t)}
            stroke={colors.border}
            strokeWidth={1}
          />
        ))}
        {labels.map((lab, i) => {
          const gx = pad.l + groupW * i + groupW / 2;
          return (
            <G key={i}>
              {datasets.map((ds, di) => {
                const v = ds.data[i] ?? 0;
                const h = (v / max) * chartH;
                const x = gx - (barW * datasets.length) / 2 + di * barW;
                return (
                  <Rect
                    key={di}
                    x={x}
                    y={pad.t + chartH - h}
                    width={barW - 2}
                    height={Math.max(0, h)}
                    rx={3}
                    fill={ds.color ?? CHART_PALETTE[di % CHART_PALETTE.length]}
                  />
                );
              })}
              <SvgText x={gx} y={height - pad.b + 16} fontSize={10} fill={colors.textLight} textAnchor="middle">
                {truncate(lab, 8)}
              </SvgText>
            </G>
          );
        })}
      </Svg>
      {datasets.length > 1 ? <Legend datasets={datasets} /> : null}
    </View>
  );
}

/* ------------------------------------------------------------- LineChart */
export function LineChart({
  labels,
  data,
  height = 220,
  color,
}: {
  labels: string[];
  data: number[];
  height?: number;
  color?: string;
}) {
  const { colors } = useTheme();
  const stroke = color ?? colors.primary;
  const width = Math.max(300, labels.length * 60);
  const pad = { l: 8, r: 8, t: 12, b: 36 };
  const max = Math.max(1, ...data);
  const chartH = height - pad.t - pad.b;
  const step = (width - pad.l - pad.r) / Math.max(1, labels.length - 1);

  if (!labels.length) return <ChartEmpty />;

  const pts = data.map((v, i) => `${pad.l + step * i},${pad.t + chartH - (v / max) * chartH}`).join(' ');

  return (
    <Svg width={width} height={height}>
      {[0, 0.5, 1].map((t) => (
        <Line
          key={t}
          x1={pad.l}
          x2={width - pad.r}
          y1={pad.t + chartH * (1 - t)}
          y2={pad.t + chartH * (1 - t)}
          stroke={colors.border}
          strokeWidth={1}
        />
      ))}
      <Polyline points={pts} fill="none" stroke={stroke} strokeWidth={2.5} strokeLinejoin="round" />
      {data.map((v, i) => (
        <Circle key={i} cx={pad.l + step * i} cy={pad.t + chartH - (v / max) * chartH} r={3} fill={stroke} />
      ))}
      {labels.map((lab, i) => (
        <SvgText
          key={i}
          x={pad.l + step * i}
          y={height - pad.b + 16}
          fontSize={10}
          fill={colors.textLight}
          textAnchor="middle"
        >
          {truncate(lab, 7)}
        </SvgText>
      ))}
    </Svg>
  );
}

function Legend({ datasets }: { datasets: { label: string; color?: string }[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 }}>
      {datasets.map((d, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: d.color ?? CHART_PALETTE[i % CHART_PALETTE.length] }} />
          <AppText variant="caption">{d.label}</AppText>
        </View>
      ))}
    </View>
  );
}

function ChartEmpty() {
  return (
    <View style={{ height: 120, alignItems: 'center', justifyContent: 'center' }}>
      <AppText variant="caption">No data to display</AppText>
    </View>
  );
}

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
