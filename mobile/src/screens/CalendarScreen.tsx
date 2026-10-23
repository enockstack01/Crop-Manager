import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import i18n, { t } from '../i18n';
import { useTheme } from '../theme/ThemeProvider';
import { ff, radius, spacing } from '../theme/theme';
import { AppText, EmptyState, Loading, PageHeader, Screen } from '../components/ui';
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { haptics } from '../lib/haptics';

/** Event kinds: colour (Google-style) and legend label, the same as on the web. */
const KINDS: Record<string, { color: string; label: string }> = {
  planting: { color: '#2E7D32', label: 'Planting' },
  harvest: { color: '#F9A825', label: 'Harvest' },
  activity: { color: '#5B6B5D', label: 'Field work' },
  irrigation: { color: '#1976D2', label: 'Irrigation' },
  fertilizer: { color: '#8E24AA', label: 'Fertilizer' },
  protection: { color: '#EF6C00', label: 'Crop protection' },
  scouting: { color: '#00897B', label: 'Scouting' },
  maintenance: { color: '#6D4C41', label: 'Equipment service' },
  alert: { color: '#C62828', label: 'Alerts' },
  weather: { color: '#0277BD', label: 'Weather' },
};

type Ev = { id: string; date: string; type: string; label: string; name: string; subtitle?: string; route: string; status: string; details?: [string, any][] };

const pad = (n: number) => String(n).padStart(2, '0');
const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (k: string) => new Date(`${k}T12:00:00`);
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfWeek = (d: Date) => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }; // weeks start on Monday
const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString(i18n.language || 'en', o);
const text = (e: Ev) => `${t(e.label)}${e.name ? `: ${e.name}` : ''}`;

/** Calendar grid like Google Calendar: month grid with coloured event dots, agenda list, alerts, search and filters. */
export function CalendarScreen() {
  const { colors } = useTheme();
  const nav = useNavigation<any>();
  const [view, setView] = useState<'month' | 'agenda'>('month');
  const [cursor, setCursor] = useState(() => new Date());
  const [picked, setPicked] = useState(() => key(new Date()));
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Ev | null>(null);

  const days = useMemo(() => {
    const start = startOfWeek(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [cursor]);
  const range = view === 'month' ? { from: key(days[0]), to: key(days[41]) } : { from: key(addDays(new Date(), -7)), to: key(addDays(new Date(), 90)) };

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['calendar', range.from, range.to],
    queryFn: () => api.get('/calendar', { params: range }).then((r) => r.data),
    placeholderData: (prev: any) => prev,
  });

  const needle = q.trim().toLowerCase();
  const events: Ev[] = useMemo(
    () => ((data?.events || []) as Ev[]).filter((e) => !hidden.has(e.type) && (!needle || `${e.label} ${e.name} ${e.subtitle || ''}`.toLowerCase().includes(needle))),
    [data, hidden, needle],
  );
  const byDay = useMemo(() => {
    const m = new Map<string, Ev[]>();
    for (const e of events) { if (!m.has(e.date)) m.set(e.date, []); m.get(e.date)!.push(e); }
    return m;
  }, [events]);
  const alerts = useMemo(
    () => ((data?.events || []) as Ev[]).filter((e) => (e.type === 'alert' || e.type === 'weather' || e.status === 'overdue') && e.date >= (data?.today || '')).slice(0, 5),
    [data],
  );
  const today = key(new Date());
  const weekdays = Array.from({ length: 7 }, (_, i) => fmt(addDays(startOfWeek(new Date()), i), { weekday: 'narrow' }));
  const toggle = (k: string) => setHidden((h) => { const n = new Set(h); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  const eventRow = (e: Ev) => (
    <Pressable
      key={e.id}
      onPress={() => { haptics.select(); setOpen(e); }}
      style={{
        flexDirection: 'row', gap: 10, padding: 10, borderRadius: 8, borderLeftWidth: 4, borderLeftColor: e.status === 'overdue' ? colors.red : KINDS[e.type]?.color,
        backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, opacity: e.status === 'done' ? 0.75 : 1,
      }}
    >
      <View style={{ flex: 1 }}>
        <AppText weight="700" style={{ fontSize: 13 }}>{text(e)}</AppText>
        {e.subtitle ? <AppText style={{ fontSize: 12, color: colors.textLight }}>{e.subtitle}</AppText> : null}
      </View>
      {e.status === 'overdue' ? <AppText weight="700" style={{ fontSize: 11, color: colors.red }}>{t('Overdue')}</AppText> : null}
    </Pressable>
  );

  if (isLoading && !data) return <Loading />;

  const dayEvents = byDay.get(picked) || [];
  const agendaDays = [...byDay.entries()];

  return (
    <Screen refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />}>
      <PageHeader title="Calendar" subtitle="Plantings, harvests, farm work, alerts and weather on one calendar." />
      {isError ? <EmptyState icon="calendar-check" title="The calendar could not be loaded." actionLabel="Try again" onAction={refetch} /> : null}

      {alerts.length ? (
        <View style={{ borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, borderLeftColor: colors.red, borderRadius: radius.md, backgroundColor: colors.card, padding: 10, marginBottom: 12, gap: 6 }}>
          <AppText weight="700" style={{ fontSize: 13, color: colors.red }}>{t('Needs attention')}</AppText>
          {alerts.map((e) => (
            <Pressable key={e.id} onPress={() => setOpen(e)} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: KINDS[e.type]?.color }} />
              <AppText style={{ fontSize: 12, flex: 1 }}>{text(e)}</AppText>
              <AppText style={{ fontSize: 11, color: colors.textLight }}>{fmt(fromKey(e.date), { day: 'numeric', month: 'short' })}</AppText>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Button title="Today" kind="secondary" size="sm" onPress={() => { setCursor(new Date()); setPicked(today); }} />
        <Pressable onPress={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))} hitSlop={8} accessibilityLabel={t('Previous')}><Icon name="chevron-left" size={16} color={colors.text} /></Pressable>
        <Pressable onPress={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))} hitSlop={8} accessibilityLabel={t('Next')}><Icon name="chevron-right" size={16} color={colors.text} /></Pressable>
        <AppText weight="700" style={{ fontSize: 17, flex: 1, color: colors.primaryDark }}>{view === 'month' ? fmt(cursor, { month: 'long', year: 'numeric' }) : t('Next 90 days')}</AppText>
        <Button title={view === 'month' ? 'Agenda' : 'Month'} kind="secondary" size="sm" onPress={() => setView(view === 'month' ? 'agenda' : 'month')} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, minHeight: 40, marginBottom: 10 }}>
        <Icon name="magnifying-glass" size={13} color={colors.placeholder} />
        <TextInput value={q} onChangeText={setQ} placeholder={t('Search the calendar...')} placeholderTextColor={colors.placeholder} style={{ flex: 1, paddingVertical: 8, color: colors.text, fontSize: 13, fontFamily: ff('400') }} />
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {Object.entries(KINDS).map(([k, v]) => (
          <Pressable key={k} onPress={() => toggle(k)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: colors.card, opacity: hidden.has(k) ? 0.4 : 1 }}>
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: v.color }} />
            <AppText style={{ fontSize: 11 }}>{t(v.label)}</AppText>
          </Pressable>
        ))}
      </View>

      {view === 'month' ? (
        <>
          <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.card }}>
            <View style={{ flexDirection: 'row', backgroundColor: colors.bg }}>
              {weekdays.map((w, i) => (
                <AppText key={i} weight="700" style={{ flex: 1, textAlign: 'center', fontSize: 11, color: colors.textLight, paddingVertical: 6 }}>{w}</AppText>
              ))}
            </View>
            {Array.from({ length: 6 }, (_, row) => (
              <View key={row} style={{ flexDirection: 'row' }}>
                {days.slice(row * 7, row * 7 + 7).map((d) => {
                  const k = key(d);
                  const list = byDay.get(k) || [];
                  const inMonth = d.getMonth() === cursor.getMonth();
                  const sel = k === picked;
                  return (
                    <Pressable
                      key={k}
                      onPress={() => { haptics.select(); setPicked(k); }}
                      style={{ flex: 1, minHeight: 58, alignItems: 'center', paddingTop: 4, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: sel ? colors.primaryLight : inMonth ? 'transparent' : colors.bg }}
                    >
                      <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: k === today ? colors.primaryDark : 'transparent' }}>
                        <AppText weight="600" style={{ fontSize: 12, color: k === today ? '#fff' : inMonth ? colors.text : colors.textLight }}>{d.getDate()}</AppText>
                      </View>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 2, marginTop: 3, paddingHorizontal: 2 }}>
                        {list.slice(0, 4).map((e) => (
                          <View key={e.id} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: e.status === 'overdue' ? colors.red : KINDS[e.type]?.color }} />
                        ))}
                      </View>
                      {list.length > 4 ? <AppText style={{ fontSize: 9, color: colors.textLight }}>+{list.length - 4}</AppText> : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>

          <AppText weight="700" style={{ fontSize: 14, marginTop: 16, marginBottom: 8, color: colors.primaryDark }}>
            {fmt(fromKey(picked), { weekday: 'long', day: 'numeric', month: 'long' })}
          </AppText>
          <View style={{ gap: spacing.sm }}>
            {dayEvents.length ? dayEvents.map(eventRow) : <AppText style={{ fontSize: 13, color: colors.textLight }}>{t('Nothing planned')}</AppText>}
          </View>
        </>
      ) : (
        <View style={{ gap: 14 }}>
          {agendaDays.length === 0 ? <AppText style={{ fontSize: 13, color: colors.textLight }}>{t('Nothing planned in this period.')}</AppText> : null}
          {agendaDays.map(([k, list]) => (
            <View key={k} style={{ gap: 6 }}>
              <AppText weight="700" style={{ fontSize: 13, color: k === today ? colors.primaryDark : colors.textLight }}>{fmt(fromKey(k), { weekday: 'short', day: 'numeric', month: 'short' })}</AppText>
              {list.map(eventRow)}
            </View>
          ))}
        </View>
      )}

      <Sheet visible={!!open} onClose={() => setOpen(null)} title={open ? text(open) : ''} size="sm"
        footer={open ? <Button title="Open" onPress={() => { const r = open.route.replace(/^\//, ''); setOpen(null); nav.navigate(r); }} /> : undefined}
      >
        {open ? (
          <View style={{ gap: 8 }}>
            <AppText style={{ fontSize: 12, color: colors.textLight }}>
              {t(KINDS[open.type]?.label)} · {fmt(fromKey(open.date), { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
              {open.status === 'overdue' ? ` · ${t('Overdue')}` : open.status === 'done' ? ` · ${t('Done')}` : ''}
            </AppText>
            {open.subtitle ? <AppText style={{ fontSize: 13 }}>{open.subtitle}</AppText> : null}
            {(open.details || []).map(([a, b]) => (
              <View key={a} style={{ flexDirection: 'row', gap: 10, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <AppText weight="700" style={{ fontSize: 12, width: '38%', color: colors.primaryDark }}>{t(a)}</AppText>
                <AppText style={{ fontSize: 12, flex: 1 }}>{String(b)}</AppText>
              </View>
            ))}
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}
