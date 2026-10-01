import React, { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme/ThemeProvider';
import { ff, KPI_TONES, radius, shadow } from '../../theme/theme';
import { AppText, useLayout } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { haptics } from '../../lib/haptics';
import { PressableScale } from '../../components/PressableScale';

export type ProfileKpi = { icon: string; tone: keyof typeof KPI_TONES; label: string; value: string; link: string };

/** One headline figure inside the profile (web .kpi-card, compact). */
function KpiTile({ k, onPress }: { k: ProfileKpi; onPress?: () => void }) {
  const { colors, isDark } = useTheme();
  const [bgLight, bgDark, fg] = KPI_TONES[k.tone];
  return (
    <PressableScale
      onPress={onPress}
      disabled={!onPress}
      scaleTo={0.97}
      accessibilityRole="button"
      accessibilityLabel={`${k.label}: ${k.value}`}
      style={({ pressed }) => ({
        flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingVertical: 12, paddingHorizontal: 12, borderRadius: radius.lg, borderWidth: 1,
        borderColor: pressed ? fg : colors.border, backgroundColor: colors.card,
      })}
    >
      <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: isDark ? bgDark : bgLight, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={k.icon} size={14} color={fg} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: ff('500'), fontSize: 11, color: colors.textLight }} numberOfLines={1}>{k.label}</Text>
        <Text style={{ fontFamily: ff('700'), fontSize: 16, color: colors.text, marginTop: 1 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>
          {k.value}
        </Text>
      </View>
    </PressableScale>
  );
}

/*
 * Farm Profile — the first thing on the dashboard. A branded header for the farm
 * (or all farms), a land-utilisation ring broken down by field status, a per-field
 * land bar chart and quick stats. The farm chips drive the dashboard's farm filter.
 */
const n = (v: any) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const ha = (v: number) => `${(Math.round(v * 10) / 10).toLocaleString('en-US')} ha`;

type Segment = { key: string; label: string; value: number; color: string };

const STATUS_COLOR: Record<string, string> = {
  Active: '#2E7D32',
  Preparing: '#1976D2',
  Maintenance: '#7B1FA2',
  Fallow: '#F9A825',
};

/** Ring gauge: one arc per segment with rounded ends, percentage in the middle. */
function LandRing({ segments, total, size, pct }: { segments: Segment[]; total: number; size: number; pct: number }) {
  const { colors } = useTheme();
  const stroke = Math.round(size * 0.11);
  const r = (size - stroke) / 2 - 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const gap = segments.filter((s) => s.value > 0).length > 1 ? 3 : 0; // px gap between arcs

  let offset = 0;
  const arcs = segments
    .filter((s) => s.value > 0 && total > 0)
    .map((s) => {
      const len = Math.max(0, (s.value / total) * circ - gap);
      const arc = { ...s, dash: `${len} ${circ - len}`, offset: -offset };
      offset += (s.value / total) * circ;
      return arc;
    });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <G rotation={-90} origin={`${c}, ${c}`}>
          <Circle cx={c} cy={c} r={r} stroke={colors.bg} strokeWidth={stroke} fill="none" />
          {arcs.map((a) => (
            <Circle
              key={a.key}
              cx={c}
              cy={c}
              r={r}
              stroke={a.color}
              strokeWidth={stroke}
              strokeDasharray={a.dash}
              strokeDashoffset={a.offset}
              strokeLinecap={gap ? 'butt' : 'round'}
              fill="none"
            />
          ))}
        </G>
      </Svg>
      <Text style={{ fontFamily: ff('800'), fontSize: Math.round(size * 0.2), color: colors.text }}>{pct}%</Text>
      <Text style={{ fontFamily: ff('500'), fontSize: 11, color: colors.textLight, marginTop: -2 }}>utilised</Text>
    </View>
  );
}

export function FarmProfileCard({
  farms,
  fields,
  selected,
  onSelect,
  kpis = [],
  onKpiPress,
}: {
  farms: any[];
  fields: any[];
  /** selected farm id ('' = all farms) */
  selected: string;
  onSelect: (farmId: string) => void;
  /** the dashboard's headline figures, shown as "Farm at a glance" */
  kpis?: ProfileKpi[];
  onKpiPress?: (link: string) => void;
}) {
  const { colors, isDark } = useTheme();
  const { isTablet, width } = useLayout();
  const kpiCols = width >= 1024 ? 4 : width >= 600 ? 3 : 2;

  const p = useMemo(() => {
    const scopeFarms = selected ? farms.filter((f) => f.id === selected) : farms;
    const ids = new Set(scopeFarms.map((f) => f.id));
    const scopeFields = fields.filter((f) => ids.has(f.farm_id));
    const total = scopeFarms.reduce((s, f) => s + n(f.total_area), 0);
    const byStatus: Record<string, number> = { Active: 0, Preparing: 0, Maintenance: 0, Fallow: 0 };
    scopeFields.forEach((f) => {
      const st = f.status in byStatus ? f.status : 'Active';
      byStatus[st] += n(f.area);
    });
    const allocated = Object.values(byStatus).reduce((a, b) => a + b, 0);
    const unallocated = Math.max(0, total - allocated);
    const ringTotal = Math.max(total, allocated);
    const segments: Segment[] = [
      { key: 'Active', label: 'Planted', value: byStatus.Active, color: STATUS_COLOR.Active },
      { key: 'Preparing', label: 'Preparing', value: byStatus.Preparing, color: STATUS_COLOR.Preparing },
      { key: 'Maintenance', label: 'Maintenance', value: byStatus.Maintenance, color: STATUS_COLOR.Maintenance },
      { key: 'Fallow', label: 'Fallow', value: byStatus.Fallow, color: STATUS_COLOR.Fallow },
      { key: 'Unallocated', label: 'Unallocated', value: unallocated, color: isDark ? '#455A64' : '#CFD8DC' },
    ];
    const pct = ringTotal > 0 ? Math.round((byStatus.Active / ringTotal) * 100) : 0;
    const soils = [...new Set(scopeFields.map((f) => f.soil_type).filter(Boolean))];
    const topFields = [...scopeFields].sort((a, b) => n(b.area) - n(a.area));
    const maxField = Math.max(1, ...topFields.map((f) => n(f.area)));
    const farm = selected ? scopeFarms[0] : null;
    return { farm, scopeFarms, scopeFields, total, ringTotal, segments, pct, soils, topFields, maxField, planted: byStatus.Active };
  }, [farms, fields, selected, isDark]);

  const place = p.farm ? [p.farm.location, p.farm.district, p.farm.province].filter(Boolean).join(', ') : `${p.scopeFarms.length} farm${p.scopeFarms.length === 1 ? '' : 's'} in your portfolio`;
  const ringSize = isTablet ? 190 : 150;
  const shown = p.topFields.slice(0, 6);
  const hasLand = p.total > 0 || p.scopeFields.length > 0;

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...shadow(2) }}>
      {/* profile banner */}
      <LinearGradient colors={['#1B5E20', '#2E7D32']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 16 }}>
        <View style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.06)', top: -70, right: -50 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Icon name="map-location-dot" size={13} color="rgba(255,255,255,0.85)" />
          <Text style={{ fontFamily: ff('700'), fontSize: 11, letterSpacing: 1, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase' }}>
            Farm Profile · Overview
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: ff('800'), fontSize: 20, lineHeight: 25, color: '#fff' }} numberOfLines={2}>
              {p.farm ? p.farm.name : 'All Farms'}
            </Text>
            <Text style={{ fontFamily: ff('400'), fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 }} numberOfLines={1}>
              {place || '—'}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: ff('800'), fontSize: 20, color: '#fff' }}>{ha(p.total)}</Text>
            <Text style={{ fontFamily: ff('500'), fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>
              {p.farm?.farm_type ? `${p.farm.farm_type} farm · total area` : 'total area'}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* farm switcher */}
      {p.scopeFarms.length > 0 || farms.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingTop: 14 }}>
          {[{ id: '', name: 'All Farms' }, ...farms].map((f) => {
            const on = f.id === selected;
            return (
              <Pressable
                key={f.id || 'all'}
                onPress={() => { haptics.select(); onSelect(f.id); }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={{
                  paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1,
                  backgroundColor: on ? colors.primary : colors.card, borderColor: on ? colors.primary : colors.border,
                }}
              >
                <Text style={{ fontFamily: ff('600'), fontSize: 12, color: on ? '#fff' : colors.text }}>{f.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <View style={{ padding: 20, gap: 22 }}>
          {!hasLand ? (
            <AppText variant="subtitle" style={{ fontSize: 13, textAlign: 'center', paddingVertical: 8 }}>
              Add a farm with its total area and fields to see land utilization.
            </AppText>
          ) : (
          /* ring + legend */
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
            <LandRing segments={p.segments} total={p.ringTotal} size={ringSize} pct={p.pct} />
            <View style={{ flex: 1, gap: 9 }}>
              {p.segments.map((s) => (
                <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, opacity: s.value > 0 ? 1 : 0.45 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: s.color }} />
                  <AppText style={{ fontSize: 12, flex: 1, color: colors.textLight }} numberOfLines={1}>{s.label}</AppText>
                  <AppText weight="700" style={{ fontSize: 12 }}>{ha(s.value)}</AppText>
                </View>
              ))}
            </View>
          </View>
          )}

          {/* farm at a glance — the dashboard's headline figures */}
          {kpis.length ? (
            <View>
              <AppText weight="700" style={{ fontSize: 11, color: colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                Farm at a glance
              </AppText>
              <View style={{ gap: 10 }}>
                {Array.from({ length: Math.ceil(kpis.length / kpiCols) }, (_, r) => (
                  <View key={r} style={{ flexDirection: 'row', gap: 10 }}>
                    {Array.from({ length: kpiCols }, (_, c) => {
                      const k = kpis[r * kpiCols + c];
                      return k ? (
                        // the wrapper takes the column share; PressableScale styles only its inner view
                        <View key={k.label} style={{ flex: 1, minWidth: 0 }}>
                          <KpiTile k={k} onPress={onKpiPress ? () => onKpiPress(k.link) : undefined} />
                        </View>
                      ) : (
                        <View key={`pad${c}`} style={{ flex: 1 }} />
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* land by field */}
          {shown.length ? (
            <View>
              <AppText weight="700" style={{ fontSize: 11, color: colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                Land by field
              </AppText>
              <View style={{ gap: 12 }}>
                {shown.map((f) => {
                  const color = STATUS_COLOR[f.status] ?? STATUS_COLOR.Active;
                  const w = Math.max(4, (n(f.area) / p.maxField) * 100);
                  return (
                    <View key={f.id}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5, gap: 8 }}>
                        <AppText weight="600" style={{ fontSize: 13, flex: 1 }} numberOfLines={1}>
                          {f.name}
                          {!selected && f.farms?.name ? <AppText style={{ fontSize: 12, color: colors.textLight }}>{`  ·  ${f.farms.name}`}</AppText> : null}
                        </AppText>
                        <AppText style={{ fontSize: 11, color }}>{f.status || 'Active'}</AppText>
                        <AppText weight="700" style={{ fontSize: 12, minWidth: 64, textAlign: 'right' }}>{ha(n(f.area))}</AppText>
                      </View>
                      <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.bg, overflow: 'hidden' }}>
                        <View style={{ width: `${w}%`, height: '100%', borderRadius: 4, backgroundColor: color }} />
                      </View>
                    </View>
                  );
                })}
                {p.topFields.length > shown.length ? (
                  <AppText variant="caption">+ {p.topFields.length - shown.length} more field{p.topFields.length - shown.length === 1 ? '' : 's'}</AppText>
                ) : null}
              </View>
            </View>
          ) : null}
      </View>
    </View>
  );
}
