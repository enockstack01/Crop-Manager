import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { ff, KPI_TONES, radius } from '../../theme/theme';
import { Icon } from '../../components/Icon';
import { ChartCard } from '../../components/ui';
import { MiniColumns } from '../../components/microViz';
import { ALERT_KINDS, UPCOMING_DAYS, relativeDay } from './insights';
import { t } from '../../i18n';

/* The dashboard's activity cards, built to be scanned (mirrors
   client/src/features/dashboard/DashboardFeed.jsx): Recent Activity (12-week
   chart + compact rows), Upcoming Harvests (30-day timeline + date cards) and
   Alerts (count chips that filter the list). */

type Tone = keyof typeof KPI_TONES;

function Chip({ icon, tone }: { icon: string; tone: string }) {
  const { isDark } = useTheme();
  const [bgLight, bgDark, fg] = KPI_TONES[(tone in KPI_TONES ? tone : 'green') as Tone];
  return (
    <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: isDark ? bgDark : bgLight, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={13} color={fg} />
    </View>
  );
}

function Row({ icon, tone, name, sub, end, onPress, last }: { icon: string; tone: string; name: string; sub: string; end?: React.ReactNode; onPress: () => void; last?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${sub}`}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
        borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border, opacity: pressed ? 0.6 : 1,
      })}
    >
      <Chip icon={icon} tone={tone} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 13, fontFamily: ff('600'), color: colors.text }} numberOfLines={1}>{name}</Text>
        <Text style={{ fontSize: 12, fontFamily: ff('400'), color: colors.textLight }} numberOfLines={1}>{sub || '—'}</Text>
      </View>
      {end}
    </Pressable>
  );
}

function Count({ n, danger }: { n: number; danger?: boolean }) {
  const { colors, isDark } = useTheme();
  return (
    <View style={{ minWidth: 24, height: 22, paddingHorizontal: 7, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
      backgroundColor: danger ? (isDark ? '#3D1A1A' : '#FFEBEE') : colors.primaryLight }}>
      <Text style={{ fontSize: 12, fontFamily: ff('700'), color: danger ? colors.red : colors.primary }}>{n}</Text>
    </View>
  );
}

function Empty({ icon, text, color }: { icon: string; text: string; color?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 8, paddingVertical: 20 }}>
      <Icon name={icon} size={24} color={color ?? colors.textLight} />
      <Text style={{ fontSize: 13, fontFamily: ff('400'), color: colors.textLight }}>{t(text)}</Text>
    </View>
  );
}

export function RecentActivity({ activity, onOpen }: { activity: { items: any[]; weeks: { label: string; count: number }[] }; onOpen: (route: string) => void }) {
  const { colors } = useTheme();
  const total = activity.weeks.reduce((s, w) => s + w.count, 0);
  return (
    <ChartCard title="Recent Activity" icon="clock-rotate-left" iconColor={colors.purple}>
      {total > 0 ? (
        <View style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 12, fontFamily: ff('400'), color: colors.textLight }}>{t('Activities · last 12 weeks')}</Text>
            <Text style={{ fontSize: 14, fontFamily: ff('700'), color: colors.text }}>{total}</Text>
          </View>
          <MiniColumns bars={activity.weeks.map((w) => ({ label: w.label, value: w.count }))} color={colors.primary} height={40} fmt={String} ends />
        </View>
      ) : null}
      {activity.items.length === 0 ? <Empty icon="inbox" text="No recent activities" /> : (
        activity.items.map((a, i) => (
          <Row
            key={a.id}
            icon={a.icon}
            tone={a.color}
            name={a.name}
            sub={a.sub}
            last={i === activity.items.length - 1}
            onPress={() => onOpen('activities')}
            end={
              <View style={{ alignItems: 'flex-end', gap: 2 }}>
                {a.cost ? <Text style={{ fontSize: 12, fontFamily: ff('700'), color: colors.red }}>{a.cost}</Text> : null}
                <Text style={{ fontSize: 11, fontFamily: ff('400'), color: colors.textLight }}>{relativeDay(a.date)}</Text>
              </View>
            }
          />
        ))
      )}
    </ChartCard>
  );
}

export function UpcomingHarvests({ items, onOpen }: { items: any[]; onOpen: (route: string) => void }) {
  const { colors } = useTheme();
  const [trackW, setTrackW] = useState(0);
  // one timeline stop per day, with the number of harvests that day
  const stops = [...items.reduce((m: Map<number, any>, e: any) => {
    const s = m.get(e.daysLeft) || { ...e, count: 0 };
    s.count += 1;
    return m.set(e.daysLeft, s);
  }, new Map()).values()];
  const countdown = (n: number) => (n === 0 ? t('Today') : n === 1 ? t('Tomorrow') : t('in {{count}} days', { count: n }));
  return (
    <ChartCard title="Upcoming Harvests" icon="calendar-days" iconColor={colors.blue} right={items.length ? <Count n={items.length} /> : null}>
      {items.length === 0 ? <Empty icon="calendar" text={t('No harvests in the next {{count}} days', { count: UPCOMING_DAYS })} /> : (
        <View style={{ gap: 14 }}>
          <View>
            <View onLayout={(e) => setTrackW(e.nativeEvent.layout.width)} style={{ height: 34, marginHorizontal: 8, borderBottomWidth: 2, borderBottomColor: colors.border }}>
              {trackW > 0 && stops.map((s: any) => (
                <View key={s.daysLeft} style={{ position: 'absolute', bottom: -9, left: (s.daysLeft / UPCOMING_DAYS) * trackW - 10, width: 20, alignItems: 'center', gap: 2 }}>
                  <Text style={{ fontSize: 10, fontFamily: ff('700'), color: colors.textLight }}>{s.day}</Text>
                  <View style={{ minWidth: 16, height: 16, paddingHorizontal: 3, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: s.ready ? colors.primary : colors.blue, borderWidth: 3, borderColor: colors.card }}>
                    {s.count > 1 ? <Text style={{ fontSize: 9, fontFamily: ff('700'), color: '#fff' }}>{s.count}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
              {[t('Today'), '+15', `+${UPCOMING_DAYS}`].map((mark) => (
                <Text key={mark} style={{ fontSize: 10.5, fontFamily: ff('400'), color: colors.textLight }}>{mark}</Text>
              ))}
            </View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {items.slice(0, 6).map((e) => (
              <Pressable
                key={e.id}
                onPress={() => onOpen('crop-cycles')}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  flexGrow: 1, flexBasis: 140, padding: 10, gap: 3, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
                  borderLeftWidth: 3, borderLeftColor: e.ready ? colors.primary : colors.blue, backgroundColor: colors.card, opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ fontSize: 18, fontFamily: ff('800'), color: colors.text }}>
                  {e.day} <Text style={{ fontSize: 11, fontFamily: ff('700'), color: colors.textLight }}>{e.month.toUpperCase()}</Text>
                </Text>
                <Text style={{ fontSize: 13, fontFamily: ff('600'), color: colors.text }} numberOfLines={1}>{e.name}</Text>
                <Text style={{ fontSize: 11.5, fontFamily: ff('400'), color: colors.textLight }} numberOfLines={1}>{e.sub || '—'}</Text>
                <Text style={{ fontSize: 11.5, fontFamily: ff('700'), color: e.ready ? colors.primary : colors.blue }}>{e.ready ? t('Ready now') : countdown(e.daysLeft)}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </ChartCard>
  );
}

export function AlertsCard({ items, onOpen }: { items: any[]; onOpen: (route: string) => void }) {
  const { colors, isDark } = useTheme();
  const [kind, setKind] = useState('');
  const kinds = Object.entries(ALERT_KINDS)
    .map(([key, k]) => ({ key, ...k, count: items.filter((a) => a.kind === key).length }))
    .filter((k) => k.count > 0);
  const shown = (kind ? items.filter((a) => a.kind === kind) : items).slice(0, 8);
  const badge = (a: any) => {
    if (a.days == null) return null;
    const late = a.days < 0;
    return (
      <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: late ? 'rgba(211,47,47,0.12)' : 'rgba(25,118,210,0.12)' }}>
        <Text style={{ fontSize: 11, fontFamily: ff('700'), color: late ? colors.red : colors.blue }}>
          {late ? t('{{count}} days late', { count: -a.days }) : a.days === 0 ? t('Today') : t('in {{count}} days', { count: a.days })}
        </Text>
      </View>
    );
  };
  return (
    <ChartCard title="Alerts" icon="bell" iconColor={colors.orange} right={items.length ? <Count n={items.length} danger /> : null}>
      {items.length === 0 ? <Empty icon="circle-check" color={colors.primary} text="All clear — no alerts" /> : (
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
            {kinds.map((k) => {
              const [bgLight, bgDark, fg] = KPI_TONES[(k.color in KPI_TONES ? k.color : 'orange') as Tone];
              const active = kind === k.key;
              return (
                <Pressable
                  key={k.key}
                  onPress={() => setKind(active ? '' : k.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
                    backgroundColor: isDark ? bgDark : bgLight, borderWidth: 1, borderColor: active ? fg : 'transparent' }}
                >
                  <Icon name={k.icon} size={12} color={fg} />
                  <Text style={{ fontSize: 13, fontFamily: ff('700'), color: fg }}>{k.count}</Text>
                  <Text style={{ fontSize: 12, fontFamily: ff('500'), color: fg }}>{t(k.label)}</Text>
                </Pressable>
              );
            })}
          </View>
          {shown.map((a, i) => (
            <Row key={a.id} icon={a.icon} tone={a.tone} name={a.name} sub={a.sub} last={i === shown.length - 1} onPress={() => onOpen(a.link)} end={badge(a)} />
          ))}
        </View>
      )}
    </ChartCard>
  );
}
