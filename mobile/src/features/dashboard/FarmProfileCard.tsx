import React, { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';
import { ff, KPI_TONES, radius, shadow } from '../../theme/theme';
import { AppText, useLayout } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { haptics } from '../../lib/haptics';
import { PressableScale } from '../../components/PressableScale';
import { t } from '../../i18n';
import { buildProfile, STATUS_COLOR } from './farmModel';

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
      accessibilityLabel={`${t(k.label)}: ${k.value}`}
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
        <Text style={{ fontFamily: ff('500'), fontSize: 11, color: colors.textLight }} numberOfLines={1}>{t(k.label)}</Text>
        {/* money in several currencies: one line per currency */}
        {String(k.value).split(' · ').map((part) => (
          <Text key={part} style={{ fontFamily: ff('700'), fontSize: 16, color: colors.text, marginTop: 1 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>
            {part}
          </Text>
        ))}
      </View>
    </PressableScale>
  );
}

/*
 * Farm Profile — the first thing on the dashboard. A branded header for the farm
 * (or all farms), a land-utilisation ring broken down by field status, a per-field
 * land bar chart and quick stats. The farm chips drive the dashboard's farm filter.
 */
const ha = (v: number) => `${(Math.round(v * 10) / 10).toLocaleString('en-US')} ha`;

type Segment = { key: string; label: string; value: number; color: string };


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
      <Text style={{ fontFamily: ff('500'), fontSize: 11, color: colors.textLight, marginTop: -2 }}>{t('utilised')}</Text>
    </View>
  );
}

export function FarmProfileCard({
  farms,
  fields,
  cycles = [],
  selected,
  onSelect,
  kpis = [],
  onKpiPress,
}: {
  farms: any[];
  fields: any[];
  /** crop cycles: what is growing now and how much of each field is planted */
  cycles?: any[];
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

  const p = useMemo(() => buildProfile({ farms, fields, cycles, selected, dark: isDark }), [farms, fields, cycles, selected, isDark]);

  const place = p.farm ? [p.farm.location, p.farm.district, p.farm.province].filter(Boolean).join(', ') : t(p.scopeFarms.length === 1 ? '{{count}} farm in your portfolio' : '{{count}} farms in your portfolio', { count: p.scopeFarms.length });
  const ringSize = isTablet ? 190 : 150;
  const shown = p.fieldRows.slice(0, 6);
  const cropTotal = p.crops.reduce((sum: number, c: any) => sum + c.ha, 0);
  const hasLand = p.total > 0 || p.scopeFields.length > 0;

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...shadow(2) }}>
      {/* profile banner */}
      <View style={{ backgroundColor: '#1B5E20', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 16 }}>
        <View style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.06)', top: -70, right: -50 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Icon name="map-location-dot" size={13} color="rgba(255,255,255,0.85)" />
          <Text style={{ fontFamily: ff('700'), fontSize: 11, letterSpacing: 1, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase' }}>
            {t('Farm Profile · Overview')}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: ff('800'), fontSize: 20, lineHeight: 25, color: '#fff' }} numberOfLines={2}>
              {p.farm ? p.farm.name : t('All Farms')}
            </Text>
            <Text style={{ fontFamily: ff('400'), fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 }} numberOfLines={1}>
              {place || '—'}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: ff('800'), fontSize: 20, color: '#fff' }}>{ha(p.total)}</Text>
            <Text style={{ fontFamily: ff('500'), fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>
              {p.farm?.farm_type ? `${t(p.farm.farm_type)} · ${t('total area')}` : t('total area')}
            </Text>
          </View>
        </View>
      </View>

      {/* farm switcher */}
      {p.scopeFarms.length > 0 || farms.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingTop: 14 }}>
          {[{ id: '', name: t('All Farms') }, ...farms].map((f) => {
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
              {t('Add a farm with its total area and fields to see land utilization.')}
            </AppText>
          ) : (
          /* ring + legend */
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
            <LandRing segments={p.segments} total={p.ringTotal} size={ringSize} pct={p.pct} />
            <View style={{ flex: 1, gap: 9 }}>
              {p.segments.map((s) => (
                <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, opacity: s.value > 0 ? 1 : 0.45 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: s.color }} />
                  <AppText style={{ fontSize: 12, flex: 1, color: colors.textLight }} numberOfLines={1}>{t(s.label)}</AppText>
                  <AppText weight="700" style={{ fontSize: 12 }}>{ha(s.value)}</AppText>
                </View>
              ))}
            </View>
          </View>
          )}

          {/* what is growing now: area under each crop */}
          {hasLand ? (
            <View>
              <AppText weight="700" style={{ fontSize: 11, color: colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                {t('What is growing now')}
              </AppText>
              {p.crops.length ? (
                <View style={{ gap: 12 }}>
                  <AppText style={{ fontSize: 13, lineHeight: 19, color: colors.textLight }}>
                    <AppText weight="800" style={{ fontSize: 18, color: colors.primaryDark }}>{ha(p.underCrop)}</AppText>
                    {` ${t('under crop')} · ${p.underCropPct}% ${t('of the farm')} · `}
                    {t(p.openCount === 1 ? '{{count}} open crop cycle' : '{{count}} open crop cycles', { count: p.openCount })}
                  </AppText>
                  <View style={{ flexDirection: 'row', height: 16, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.bg, gap: 2 }}>
                    {p.crops.filter((c: any) => c.ha > 0).map((c: any) => (
                      <View key={c.name} style={{ width: `${(c.ha / (cropTotal || 1)) * 100}%`, minWidth: 4, backgroundColor: c.color }} />
                    ))}
                  </View>
                  <View style={{ gap: 8 }}>
                    {p.crops.map((c: any) => (
                      <View key={c.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.color }} />
                        <AppText weight="600" style={{ fontSize: 13, flex: 1 }} numberOfLines={1}>{c.name === 'Other crops' ? t(c.name) : c.name}</AppText>
                        <AppText style={{ fontSize: 11, color: colors.textLight }}>{t(c.cycles === 1 ? '{{count}} cycle' : '{{count}} cycles', { count: c.cycles })}</AppText>
                        <AppText weight="700" style={{ fontSize: 12, minWidth: 64, textAlign: 'right' }}>{ha(c.ha)}</AppText>
                      </View>
                    ))}
                  </View>
                </View>
              ) : (
                <AppText variant="subtitle" style={{ fontSize: 13 }}>{t('No crop cycle is open. Add a crop cycle to see what is growing.')}</AppText>
              )}
            </View>
          ) : null}

          {/* crop cycle pipeline */}
          {p.openCount > 0 ? (
            <View>
              <AppText weight="700" style={{ fontSize: 11, color: colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                {t('Crop cycle pipeline')}
              </AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {p.pipeline.map((st: any, i: number) => (
                  <View key={st.key} style={{ flexBasis: '47%', flexGrow: 1, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, opacity: st.count ? 1 : 0.55 }}>
                    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: st.color, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontFamily: ff('700'), fontSize: 11, color: st.key === 'Ready for Harvest' ? '#1C2B1E' : '#FFFFFF' }}>{i + 1}</Text>
                    </View>
                    <Text style={{ fontFamily: ff('800'), fontSize: 26, color: colors.text, marginTop: 6 }}>{st.count}</Text>
                    <Text style={{ fontFamily: ff('700'), fontSize: 12, color: colors.primaryDark }}>{t(st.label)}</Text>
                    <Text style={{ fontFamily: ff('400'), fontSize: 11, color: colors.textLight }}>{ha(st.ha)}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* farm at a glance — the dashboard's headline figures */}
          {kpis.length ? (
            <View>
              <AppText weight="700" style={{ fontSize: 11, color: colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                {t('Farm at a glance')}
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

          {/* fields: land and what is planted on each */}
          {shown.length ? (
            <View>
              <AppText weight="700" style={{ fontSize: 11, color: colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                {t('Fields: land and crop')}
              </AppText>
              <View style={{ gap: 14 }}>
                {shown.map((f: any) => {
                  const color = STATUS_COLOR[f.status] ?? STATUS_COLOR.Active;
                  return (
                    <View key={f.id}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5, gap: 8 }}>
                        <AppText weight="600" style={{ fontSize: 13, flex: 1 }} numberOfLines={1}>
                          {f.name}
                          {!selected && f.farm ? <AppText style={{ fontSize: 12, color: colors.textLight }}>{`  ·  ${f.farm}`}</AppText> : null}
                        </AppText>
                        <AppText style={{ fontSize: 11, color: f.status === 'Fallow' ? colors.textLight : color }}>{t(f.status)}</AppText>
                        <AppText weight="700" style={{ fontSize: 12, minWidth: 64, textAlign: 'right' }}>{ha(f.area)}</AppText>
                      </View>
                      <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.bg, overflow: 'hidden' }}>
                        <View style={{ width: `${f.pct}%`, height: '100%', borderRadius: 5, backgroundColor: color }} />
                      </View>
                      <AppText style={{ fontSize: 12, color: colors.textLight, marginTop: 5 }}>
                        {f.crops.length
                          ? `${f.crops.join(', ')} · ${t(f.stage === 'Ready for Harvest' ? 'Ready to harvest' : f.stage)} · ${f.pct}% ${t('planted')}`
                          : t('Nothing planted')}
                      </AppText>
                    </View>
                  );
                })}
                {p.fieldRows.length > shown.length ? (
                  <AppText variant="caption">+ {t(p.fieldRows.length - shown.length === 1 ? '{{count}} more field' : '{{count}} more fields', { count: p.fieldRows.length - shown.length })}</AppText>
                ) : null}
              </View>
            </View>
          ) : null}
      </View>
    </View>
  );
}
