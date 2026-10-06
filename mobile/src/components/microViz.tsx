import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { ff } from '../theme/theme';
import { formatCompact } from '../lib/format';

/*
 * Small charts for dashboard tiles — mini columns, meter, ring gauge and split bar
 * (mirrors client/src/features/dashboard/MicroViz.jsx). Every chart prints its numbers.
 */

export type MiniBar = { label: string; value: number };

/** columns with their value on top and their label below; `ends` labels only the first and last */
export function MiniColumns({ bars, color, height = 36, fmt = formatCompact, ends = false }: {
  bars: MiniBar[]; color: string; height?: number; fmt?: (v: number) => string; ends?: boolean;
}) {
  const { colors } = useTheme();
  if (!bars.length) return null;
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <View>
      <View style={{ height: height + 14, flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 4 }}>
        {bars.map((b, i) => {
          const h = b.value ? Math.max(2, (b.value / max) * height) : 0;
          return (
            <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }} accessibilityLabel={`${b.label}: ${fmt(b.value)}`}>
              <Text style={{ fontSize: 9, fontFamily: ff('700'), color: colors.text, marginBottom: 2 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                {fmt(b.value)}
              </Text>
              <View style={{ alignSelf: 'stretch', height: h, backgroundColor: color, borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: ends ? 'space-between' : 'flex-start', gap: 4, marginTop: 4 }}>
        {(ends ? [bars[0], bars[bars.length - 1]] : bars).map((b, i) => (
          <Text key={i} style={{ flex: ends ? 0 : 1, fontSize: 9, fontFamily: ff('400'), color: colors.textLight, textAlign: 'center' }} numberOfLines={1}>
            {b.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

export function Meter({ value, max, color }: { value: number; max: number; color: string }) {
  const { colors } = useTheme();
  const p = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.bg, overflow: 'hidden', marginVertical: 6 }}>
      <View style={{ width: `${p}%`, height: '100%', borderRadius: 4, backgroundColor: color }} />
    </View>
  );
}

export function Ring({ pct, color, size = 60, stroke = 7, children }: { pct: number; color: string; size?: number; stroke?: number; children?: React.ReactNode }) {
  const { colors } = useTheme();
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const len = (Math.max(0, Math.min(100, pct)) / 100) * circ;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.bg} strokeWidth={stroke} fill="none" />
        {len > 0 ? (
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${len} ${circ}`} />
        ) : null}
      </Svg>
      {children}
    </View>
  );
}

/** segments with 2px gaps, and each part's count below */
export function SplitBar({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const { colors } = useTheme();
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 2, height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.bg, marginVertical: 6 }}>
        {parts.filter((p) => p.value > 0).map((p) => (
          <View key={p.label} style={{ flex: p.value, backgroundColor: p.color }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 2 }}>
        {parts.map((p) => (
          <View key={p.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: p.color }} />
            <Text style={{ fontSize: 10.5, fontFamily: ff('400'), color: colors.textLight }}>
              {p.label} <Text style={{ fontFamily: ff('700'), color: colors.text }}>{p.value}</Text>
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
