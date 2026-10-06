import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { ff, radius } from '../../theme/theme';
import { formatCompact } from '../../lib/format';
import { Icon } from '../../components/Icon';
import { ChartCard, Grid, useLayout } from '../../components/ui';
import { Meter, MiniColumns, Ring, SplitBar } from '../../components/microViz';
import type { Insight } from './insights';

/* Key insights as tiles — a figure, a short label and a small chart (mirrors
   client/src/features/dashboard/InsightTiles.jsx). The full sentence is each
   tile's accessible name. */

export const TONE = {
  good: { color: '#2E7D32', icon: 'circle-check' },
  warn: { color: '#F57F17', icon: 'triangle-exclamation' },
  bad: { color: '#D32F2F', icon: 'circle-exclamation' },
  info: { color: '#1976D2', icon: 'circle-info' },
} as const;

function Viz({ viz: v, color }: { viz: any; color: string }) {
  const { colors } = useTheme();
  const figure = (t: string, size = 19) => (
    <Text style={{ fontSize: size, fontFamily: ff('800'), color: colors.text }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{t}</Text>
  );
  const sub = (t?: string) => (t ? <Text style={{ fontSize: 11, fontFamily: ff('400'), color: colors.textLight }} numberOfLines={1}>{t}</Text> : null);

  if (v.kind === 'ring') {
    return (
      <View style={{ gap: 6 }}>
        <Ring pct={v.pct} color={color}>
          <Text style={{ fontSize: 13, fontFamily: ff('800'), color: colors.text }}>{v.figure}</Text>
        </Ring>
        <Text style={{ fontSize: 12, fontFamily: ff('600'), color: colors.text }} numberOfLines={1}>{v.sub}</Text>
      </View>
    );
  }
  if (v.kind === 'meter') {
    return (
      <View>
        {figure(v.figure)}
        <Meter value={v.value} max={v.max} color={color} />
        {sub(v.sub)}
      </View>
    );
  }
  if (v.kind === 'split') {
    return (
      <View>
        {figure(v.figure, 17)}
        <SplitBar parts={v.parts.map((p: any) => ({ label: p.label, value: p.value, color: TONE[p.tone as keyof typeof TONE].color }))} />
      </View>
    );
  }
  if (v.kind === 'trend') {
    return (
      <View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name={`arrow-trend-${v.dir}`} size={14} color={color} />
          {figure(v.figure)}
        </View>
        <MiniColumns bars={v.bars} color={color} />
        {sub(v.unit)}
      </View>
    );
  }
  if (v.kind === 'columns') {
    return (
      <View>
        {figure(v.figure)}
        {sub(v.sub)}
        <MiniColumns bars={v.bars} color={color} fmt={v.plain ? String : formatCompact} />
      </View>
    );
  }
  return (
    <View>
      {figure(v.figure)}
      {sub(v.sub)}
    </View>
  );
}

export function InsightTiles({ insights }: { insights: Insight[] }) {
  const { colors } = useTheme();
  const { width } = useLayout();
  if (!insights.length) return null;
  const cols = width >= 1024 ? 4 : width >= 600 ? 3 : 2;
  return (
    <ChartCard title="Key insights" icon="lightbulb" iconColor={colors.orange} bodyStyle={{ padding: 12 }}>
      <Grid columns={cols} gap={8}>
        {insights.map((ins) => {
          const tone = TONE[ins.tone];
          return (
            <View
              key={ins.id}
              accessible
              accessibilityLabel={ins.sentence}
              style={{
                flex: 1, padding: 10, gap: 6,
                borderWidth: 1, borderColor: colors.border, borderTopWidth: 3, borderTopColor: tone.color,
                borderRadius: radius.md, backgroundColor: colors.card,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Icon name={tone.icon} size={11} color={tone.color} />
                <Text style={{ flex: 1, fontSize: 11, fontFamily: ff('600'), color: colors.textLight }} numberOfLines={1}>{ins.label}</Text>
              </View>
              <Viz viz={ins.viz} color={tone.color} />
            </View>
          );
        })}
      </Grid>
    </ChartCard>
  );
}
