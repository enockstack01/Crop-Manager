import React, { useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius } from '../theme/theme';
import { AppText, Badge, ChartCard, EmptyState, Grid, Loading, PageHeader, Screen, StatTile, useLayout } from '../components/ui';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { Bars, HBars } from '../components/charts';
import { DateField, NumberField, SelectField, TextAreaField, TextField, useForm } from '../components/fields';
import { PhotoField } from '../components/PhotoField';
import { useConfirm } from '../components/Confirm';
import { useToast } from '../components/Toast';
import { mediaUrl } from '../env';
import { formatDate, formatNumber } from '../lib/format';
import { COLOR_HEX, VERDICTS, countProblem, useGhCatalog, useGhCounts, useGhCrops, useGhDashboard, useGhMutations } from '../lib/greenhouse';
import { t } from '../i18n';

const TABS = [
  { id: 'dashboard', icon: 'chart-column', label: 'Dashboard' },
  { id: 'counts', icon: 'camera', label: 'Fruit counts' },
  { id: 'crops', icon: 'seedling', label: 'My crops' },
] as const;
type TabId = (typeof TABS)[number]['id'];
const today = () => new Date().toISOString().slice(0, 10);

function Verdict({ v }: { v?: any }) {
  const m = VERDICTS[v?.status || 'not_checked'];
  return <Badge label={t(m.label)} tone={m.tone} />;
}

/** The result of a photo check: what was found, what was recorded, the sentence, and the photo with every counted fruit marked. */
function CheckResult({ verification: v, annotatedUrl, photoUrl }: { verification: any; annotatedUrl?: string | null; photoUrl?: string | null }) {
  const { colors } = useTheme();
  if (!v) return null;
  const m = VERDICTS[v.status];
  const tint = m.tone === 'danger' ? colors.red : m.tone === 'warning' ? colors.orange : colors.primary;
  return (
    <View style={{ gap: 12 }}>
      <View accessibilityRole="alert" style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: tint, backgroundColor: colors.card }}>
        <Icon name={m.icon} size={18} color={tint} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText weight="700" style={{ fontSize: 14 }}>{t(m.label)}</AppText>
          <AppText style={{ fontSize: 13, lineHeight: 19 }}>{v.message}</AppText>
        </View>
      </View>
      {v.detected != null ? (
        <Grid columns={2} gap={10}>
          <StatTile label="You recorded" value={formatNumber(v.recorded)} />
          <StatTile label="The photo shows" value={formatNumber(v.detected)} sub={v.confidence ? `${t('Confidence')}: ${t(v.confidence)}` : undefined} />
        </Grid>
      ) : null}
      {photoUrl ? <Image source={{ uri: mediaUrl(photoUrl) }} resizeMode="contain" style={{ width: '100%', height: 220, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border }} accessibilityLabel={t('Your photo')} /> : null}
      {annotatedUrl ? (
        <View style={{ gap: 4 }}>
          <Image source={{ uri: mediaUrl(annotatedUrl) }} resizeMode="contain" style={{ width: '100%', height: 220, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border }} accessibilityLabel={t('Fruit counted')} />
          <AppText variant="caption">{t('Every counted fruit is marked with a ring and a number')}</AppText>
        </View>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------ dashboard */
function DashboardTab({ go }: { go: (id: TabId, opts?: any) => void }) {
  const { colors } = useTheme();
  const { isTablet } = useLayout();
  const [days, setDays] = useState('30');
  const { data: d, isLoading, isError, refetch } = useGhDashboard(Number(days));
  if (isLoading) return <Loading />;
  if (isError || !d) return <EmptyState icon="triangle-exclamation" title="Could not load the dashboard" actionLabel="Retry" onAction={() => refetch()} />;
  if (!d.crops) return <EmptyState icon="seedling" title="Choose the crops you grow" description="Pick your greenhouse crops, such as cherry tomatoes or peppers, then record the fruit on your plants with a photo." actionLabel="Choose crops" onAction={() => go('crops')} />;
  const v = d.verdicts;
  return (
    <View style={{ gap: 16 }}>
      {!d.counter_connected ? (
        <View style={{ padding: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.orange, backgroundColor: colors.card }}>
          <AppText style={{ fontSize: 13, lineHeight: 19 }}>{t('The fruit counter is not connected, so photos are saved but not checked yet. Ask your administrator to connect it.')}</AppText>
        </View>
      ) : null}
      <SelectField value={days} onChangeValue={setDays} placeholder="" options={[{ value: '7', label: t('Last 7 days') }, { value: '30', label: t('Last 30 days') }, { value: '90', label: t('Last 90 days') }]} />
      <Grid columns={isTablet ? 4 : 2} gap={12}>
        <StatTile label="Fruit counted" value={formatNumber(d.totals.fruit)} sub={t('on the latest count of each plant')} />
        <StatTile label="Plants counted" value={formatNumber(d.totals.plants)} sub={`${formatNumber(d.totals.counts)} ${t('counts')}`} />
        <StatTile label="Average fruit per plant" value={formatNumber(d.totals.avg_per_plant)} />
        <StatTile label="Photos that agree" value={d.totals.verified_rate == null ? '-' : `${d.totals.verified_rate}%`} sub={t('match or close, of the photos that could be checked')} />
      </Grid>

      {d.totals.counts === 0 ? (
        <EmptyState icon="camera" title="No fruit counts in this period" description="Record the fruit on a plant with a photo and a row ID." actionLabel="Add a fruit count" onAction={() => go('counts', { add: true })} />
      ) : (
        <>
          <ChartCard title="Fruit by crop" icon="seedling">
            <HBars data={d.by_crop.map((c: any) => ({ label: c.name, value: c.fruit }))} />
          </ChartCard>
          <ChartCard title="Average fruit per plant, week by week" icon="chart-line">
            <Bars labels={d.weekly.map((w: any) => formatDate(w.week).slice(0, 5))} datasets={[{ label: 'Average per plant', data: d.weekly.map((w: any) => w.avg_per_plant) }]} height={200} />
          </ChartCard>
          <ChartCard title="Does the photo agree with the count?" icon="camera">
            {['match', 'close', 'mismatch', 'inconclusive', 'not_checked', 'failed'].map((k) => (
              <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Verdict v={{ status: k }} />
                <AppText weight="700">{formatNumber(v[k] || 0)}</AppText>
              </View>
            ))}
            <AppText variant="caption" style={{ marginTop: 8 }}>{t(d.tolerance_note)} {t('"Not sure" means the photo could not be counted reliably, for example green fruit among green leaves or a blurry photo.')}</AppText>
          </ChartCard>
          <ChartCard title="Needs your attention" icon="bell">
            {d.alerts.mismatches.length === 0 && d.alerts.stale_rows.length === 0 ? <AppText variant="subtitle" style={{ fontSize: 13 }}>{t('Nothing needs attention.')}</AppText> : null}
            {d.alerts.mismatches.length > 0 ? (
              <View style={{ gap: 6 }}>
                <AppText weight="700" style={{ fontSize: 11, color: colors.textLight, textTransform: 'uppercase' }}>{t('Photos that do not match')}</AppText>
                {d.alerts.mismatches.map((m: any) => (
                  <AppText key={m.id} style={{ fontSize: 13 }}>{m.crop_name} · {m.row_id}{m.plant_label ? ` · ${m.plant_label}` : ''} <AppText style={{ fontSize: 12, color: colors.textLight }}>{formatDate(m.count_date)} · {m.recorded} / {m.detected ?? '-'}</AppText></AppText>
                ))}
                <View style={{ alignSelf: 'flex-start' }}><Button title="See them" size="sm" kind="secondary" onPress={() => go('counts', { status: 'mismatch' })} /></View>
              </View>
            ) : null}
            {d.alerts.stale_rows.length > 0 ? (
              <View style={{ gap: 6, marginTop: 12 }}>
                <AppText weight="700" style={{ fontSize: 11, color: colors.textLight, textTransform: 'uppercase' }}>{t('Rows not counted for over a week')}</AppText>
                {d.alerts.stale_rows.map((r: any) => (
                  <AppText key={`${r.crop_name}${r.greenhouse}${r.row_id}`} style={{ fontSize: 13 }}>{r.crop_name} · {r.row_id}{r.greenhouse ? ` · ${r.greenhouse}` : ''} <AppText style={{ fontSize: 12, color: colors.textLight }}>{formatDate(r.last_count)}</AppText></AppText>
                ))}
              </View>
            ) : null}
          </ChartCard>
          <ChartCard title="Rows" icon="table-list">
            {d.by_row.map((r: any, i: number) => (
              <View key={`${r.crop_name}${r.greenhouse}${r.row_id}`} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
                <View style={{ flex: 1 }}>
                  <AppText weight="700" style={{ fontSize: 14 }}>{r.row_id}{r.greenhouse ? ` · ${r.greenhouse}` : ''}</AppText>
                  <AppText style={{ fontSize: 12, color: colors.textLight }}>{r.crop_name} · {r.plants} {t('plants counted')}</AppText>
                </View>
                <AppText weight="700" style={{ fontSize: 16 }}>{r.avg_per_plant}</AppText>
              </View>
            ))}
            <AppText variant="caption" style={{ marginTop: 6 }}>{t('Average fruit per plant')}</AppText>
          </ChartCard>
        </>
      )}
    </View>
  );
}

/* --------------------------------------------------------------- counts */
function CountSheet({ crops, editing, onClose }: { crops: any[]; editing: any | null; onClose: () => void }) {
  const toast = useToast();
  const { colors } = useTheme();
  const { createCount, updateCount, check } = useGhMutations();
  const form = useForm(editing ? {
    crop_id: editing.crop_id, greenhouse: editing.greenhouse || '', row_id: editing.row_id, plant_label: editing.plant_label || '', count_date: editing.count_date,
    recorded_count: String(editing.recorded_count), photo_url: editing.photo_url as string | null, notes: editing.notes || '',
  } : { crop_id: crops[0]?.id || '', greenhouse: '', row_id: '', plant_label: '', count_date: today(), recorded_count: '', photo_url: null as string | null, notes: '' });
  const [err, setErr] = useState('');
  const [result, setResult] = useState<any>(null);
  const v = form.values;
  const saving = createCount.isPending || updateCount.isPending;

  const runCheck = async () => {
    const p = countProblem(v);
    if (p) { setErr(t(p)); return; }
    setErr('');
    try {
      const out = await check.mutateAsync({ crop_id: v.crop_id, photo_url: v.photo_url, recorded_count: Number(v.recorded_count) });
      setResult({ ...out, photo_url: v.photo_url, preview: true });
    } catch (e: any) { setErr(e?.message || t('The photo could not be checked.')); }
  };
  const save = async () => {
    const p = countProblem(v);
    if (p) { setErr(t(p)); return; }
    setErr('');
    try {
      const body = { ...v, recorded_count: Number(v.recorded_count) };
      const saved = editing ? await updateCount.mutateAsync({ id: editing.id, ...body }) : await createCount.mutateAsync(body);
      toast(t('Fruit count saved'));
      setResult({ verification: saved.verification, annotated_url: saved.annotated_url, photo_url: saved.photo_url, saved: true });
    } catch (e: any) { setErr(e?.message || t('Could not save')); }
  };

  if (result?.saved) {
    return (
      <Sheet visible onClose={onClose} title={t('Fruit count saved')} footer={<Button title="Done" onPress={onClose} />}>
        <CheckResult verification={result.verification} annotatedUrl={result.annotated_url} photoUrl={result.photo_url} />
      </Sheet>
    );
  }
  return (
    <Sheet
      visible onClose={onClose} title={t(editing ? 'Edit fruit count' : 'Add a fruit count')}
      footer={(
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Button title={check.isPending ? 'Checking...' : 'Check the photo'} icon="magnifying-glass" kind="secondary" loading={check.isPending} onPress={runCheck} />
          <Button title={saving ? 'Saving and checking the photo...' : 'Save fruit count'} icon="floppy-disk" loading={saving} onPress={save} />
        </View>
      )}
    >
      {err ? <View style={{ borderWidth: 1, borderColor: colors.red, borderRadius: radius.md, padding: 12, marginBottom: 12 }}><AppText style={{ fontSize: 13, color: colors.red }}>{err}</AppText></View> : null}
      <SelectField label="Crop" required {...form.bind('crop_id')} placeholder="Choose a crop" options={crops.map((c) => ({ value: c.id, label: c.name }))} />
      <DateField label="Date" {...form.bind('count_date')} />
      <TextField label="Greenhouse" {...form.bind('greenhouse')} placeholder="e.g. House 1" />
      <TextField label="Row ID" required {...form.bind('row_id')} placeholder="e.g. R3" autoCapitalize="characters" />
      <TextField label="Plant" {...form.bind('plant_label')} placeholder="e.g. P7 or tree number" hint="Fill this in to follow the same plant over time" />
      <NumberField label="Number of fruit on the plant" required {...form.bind('recorded_count')} placeholder="e.g. 24" />
      <PhotoField label="Photo of the fruit on the plant" value={v.photo_url} onChange={(url) => { form.set('photo_url', url); setResult(null); }} />
      <AppText variant="caption" style={{ marginBottom: 12 }}>{t('Take the photo in daylight with the fruit facing the camera and the whole plant in view. The photo is counted by the fruit counter and compared with your number.')}</AppText>
      <TextAreaField label="Notes" {...form.bind('notes')} />
      {result?.preview ? (
        <View style={{ marginTop: 8, gap: 8 }}>
          <AppText weight="700" style={{ fontSize: 12, color: colors.textLight, textTransform: 'uppercase' }}>{t('Result of the check (not saved yet)')}</AppText>
          <CheckResult verification={result.verification} annotatedUrl={result.annotated_url} photoUrl={result.photo_url} />
        </View>
      ) : null}
    </Sheet>
  );
}

function CountDetail({ row, onClose, onEdit }: { row: any; onClose: () => void; onEdit: (r: any) => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { reverify, removeCount } = useGhMutations();
  const [shown, setShown] = useState(row);
  const again = async () => {
    try { setShown(await reverify.mutateAsync(row.id)); toast(t('Checked again')); } catch (e: any) { toast(e?.message || '', 'error'); }
  };
  const remove = async () => {
    if (!(await confirm(t('Delete this fruit count and its photo check?')))) return;
    try { await removeCount.mutateAsync(row.id); toast(t('Deleted')); onClose(); } catch (e: any) { toast(e?.message || '', 'error'); }
  };
  return (
    <Sheet
      visible onClose={onClose} title={`${shown.crop_name} · ${shown.row_id}${shown.plant_label ? ` · ${shown.plant_label}` : ''}`}
      footer={(
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Button title="Delete" icon="trash" kind="secondary" onPress={remove} />
          <Button title="Check the photo again" icon="rotate" kind="secondary" loading={reverify.isPending} onPress={again} />
          <Button title="Edit" icon="pen" onPress={() => onEdit(shown)} />
        </View>
      )}
    >
      <AppText variant="caption" style={{ marginBottom: 10 }}>{formatDate(shown.count_date)}{shown.greenhouse ? ` · ${shown.greenhouse}` : ''}</AppText>
      <CheckResult verification={shown.verification} annotatedUrl={shown.annotated_url} photoUrl={shown.photo_url} />
      {shown.notes ? <AppText style={{ marginTop: 12, fontSize: 13 }}><AppText weight="700" style={{ fontSize: 13 }}>{t('Notes')}: </AppText>{shown.notes}</AppText> : null}
    </Sheet>
  );
}

function CountsTab({ start }: { start: any }) {
  const { colors } = useTheme();
  const { data: crops = [] } = useGhCrops();
  const [filters, setFilters] = useState({ crop_id: '', status: start?.status || '' });
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<{ editing: any | null } | null>(start?.add ? { editing: null } : null);
  const [view, setView] = useState<any | null>(null);
  const params: Record<string, any> = { page, perPage: 15, ...Object.fromEntries(Object.entries(filters).filter(([, x]) => x)) };
  const { data, isLoading, isError, refetch } = useGhCounts(params);

  if (!crops.length && !isLoading) return <EmptyState icon="seedling" title="Choose the crops you grow first" description="Then you can record the fruit on your plants with a photo." />;
  return (
    <View style={{ gap: 12 }}>
      <View style={{ alignSelf: 'flex-start' }}><Button title="Add a fruit count" icon="plus" onPress={() => setForm({ editing: null })} /></View>
      <SelectField value={filters.crop_id} onChangeValue={(x) => { setFilters((f) => ({ ...f, crop_id: x })); setPage(1); }} placeholder="All crops" options={[{ value: '', label: t('All crops') }, ...crops.map((c: any) => ({ value: c.id, label: c.name }))]} />
      <SelectField value={filters.status} onChangeValue={(x) => { setFilters((f) => ({ ...f, status: x })); setPage(1); }} placeholder="All results" options={[{ value: '', label: t('All results') }, ...Object.entries(VERDICTS).map(([value, m]) => ({ value, label: t(m.label) }))]} />
      {isLoading ? <Loading /> : isError ? (
        <EmptyState icon="triangle-exclamation" title="Could not load the fruit counts" actionLabel="Retry" onAction={() => refetch()} />
      ) : !data?.data?.length ? (
        <EmptyState icon="camera" title="No fruit counts yet" description="Record the fruit on a plant with a photo and a row ID." actionLabel="Add a fruit count" onAction={() => setForm({ editing: null })} />
      ) : (
        <>
          {data.data.map((r: any) => (
            <Pressable key={r.id} onPress={() => setView(r)} accessibilityRole="button" accessibilityLabel={`${r.crop_name}, ${r.row_id}`} style={({ pressed }) => ({ flexDirection: 'row', gap: 12, padding: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: pressed ? colors.primaryLight : colors.card })}>
              <Image source={{ uri: mediaUrl(r.photo_url) }} style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: colors.border }} />
              <View style={{ flex: 1, gap: 3 }}>
                <AppText weight="700" style={{ fontSize: 15 }}>{r.crop_name}</AppText>
                <AppText style={{ fontSize: 12, color: colors.textLight }}>{[r.greenhouse, r.row_id, r.plant_label].filter(Boolean).join(' · ')} · {formatDate(r.count_date)}</AppText>
                <AppText style={{ fontSize: 13 }}>{t('Recorded')}: <AppText weight="700" style={{ fontSize: 13 }}>{r.recorded_count}</AppText>{'   '}{t('Photo shows')}: <AppText weight="700" style={{ fontSize: 13 }}>{r.verification?.detected ?? '—'}</AppText></AppText>
                <View style={{ alignSelf: 'flex-start' }}><Verdict v={r.verification} /></View>
              </View>
            </Pressable>
          ))}
          {data.totalPages > 1 ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Button title="Previous" kind="secondary" size="sm" disabled={page <= 1} onPress={() => setPage((p) => p - 1)} />
              <AppText style={{ fontSize: 12 }}>{page} / {data.totalPages}</AppText>
              <Button title="Next" kind="secondary" size="sm" disabled={page >= data.totalPages} onPress={() => setPage((p) => p + 1)} />
            </View>
          ) : null}
        </>
      )}
      {form ? <CountSheet crops={crops} editing={form.editing} onClose={() => setForm(null)} /> : null}
      {view && !form ? <CountDetail key={view.id} row={view} onClose={() => setView(null)} onEdit={(r) => { setView(null); setForm({ editing: r }); }} /> : null}
    </View>
  );
}

/* ----------------------------------------------------------------- crops */
function CropsTab() {
  const { colors } = useTheme();
  const toast = useToast();
  const confirm = useConfirm();
  const { data: cat, isLoading, isError, refetch } = useGhCatalog();
  const { data: mine = [] } = useGhCrops();
  const { addCrop, removeCrop } = useGhMutations();
  const form = useForm({ name: '', shape: 'round' });
  const [colorsPicked, setColorsPicked] = useState<string[]>([]);
  const [err, setErr] = useState('');
  if (isLoading) return <Loading />;
  if (isError || !cat) return <EmptyState icon="triangle-exclamation" title="Could not load the crops" actionLabel="Retry" onAction={() => refetch()} />;

  const toggle = async (c: any) => {
    try {
      if (c.selected) {
        if (!(await confirm(t('Remove {{name}} from your crops?', { name: c.name }), { confirmLabel: 'Remove' }))) return;
        await removeCrop.mutateAsync(c.crop_id);
      } else {
        await addCrop.mutateAsync({ catalog_key: c.key });
      }
    } catch (e: any) { toast(e?.message || '', 'error'); }
  };
  const addOwn = async () => {
    setErr('');
    try {
      await addCrop.mutateAsync({ name: form.values.name, shape: form.values.shape, fruit_colors: colorsPicked });
      form.setValues({ name: '', shape: 'round' });
      setColorsPicked([]);
      toast(t('Crop added'));
    } catch (e: any) { setErr(e?.message || ''); }
  };
  const swatches = (list: string[]) => (
    <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
      {list.map((c) => (
        <View key={c} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: COLOR_HEX[c], borderWidth: 1, borderColor: 'rgba(0,0,0,0.2)' }} />
          <AppText style={{ fontSize: 12, color: colors.textLight }}>{t(c)}</AppText>
        </View>
      ))}
    </View>
  );
  const own = mine.filter((c: any) => c.catalog_key === 'custom');
  return (
    <View style={{ gap: 16 }}>
      <AppText style={{ fontSize: 13, lineHeight: 19, color: colors.textLight }}>{t('Tick the crops you grow in your greenhouse. The colours of the fruit tell the fruit counter what to look for in your photos.')}</AppText>
      {cat.crops.map((c: any) => (
        <View key={c.key} style={{ gap: 8, padding: 14, borderRadius: radius.lg, borderWidth: c.selected ? 2 : 1, borderColor: c.selected ? colors.primary : colors.border, backgroundColor: colors.card }}>
          <AppText weight="700" style={{ fontSize: 16 }}>{t(c.name)}</AppText>
          {swatches(c.fruit_colors)}
          <AppText style={{ fontSize: 13, lineHeight: 18, color: colors.textLight }}>{t(c.tip)}</AppText>
          <AppText style={{ fontSize: 12, color: colors.textLight }}>{t('Days to first harvest')}: {c.days_to_harvest}</AppText>
          {c.contrast === 'low' ? <View style={{ alignSelf: 'flex-start' }}><Badge label={t('Photo check not conclusive')} tone="warning" /></View> : null}
          <View style={{ alignSelf: 'flex-start' }}><Button title={c.selected ? 'I grow this' : 'Add'} icon={c.selected ? 'check' : 'plus'} kind={c.selected ? 'secondary' : 'primary'} size="sm" onPress={() => toggle(c)} /></View>
        </View>
      ))}

      <ChartCard title="Add a crop that is not in the list" icon="circle-plus">
        {err ? <AppText style={{ fontSize: 13, color: colors.red, marginBottom: 8 }}>{err}</AppText> : null}
        <TextField label="Crop name" required {...form.bind('name')} placeholder="e.g. Cape gooseberry" />
        <SelectField label="Shape of the fruit" {...form.bind('shape')} placeholder="" options={[{ value: 'round', label: t('Round (tomato, berry)') }, { value: 'elongated', label: t('Long (pepper, cucumber, bean)') }]} />
        <AppText weight="700" style={{ fontSize: 13, marginBottom: 6 }}>{t('Colour of the fruit')} <AppText style={{ color: colors.red }}>*</AppText></AppText>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
          {cat.colors.map((c: string) => {
            const on = colorsPicked.includes(c);
            return (
              <Pressable key={c} onPress={() => setColorsPicked((l) => (on ? l.filter((x) => x !== c) : [...l, c]))} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primaryLight : colors.card }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: COLOR_HEX[c] }} />
                <AppText weight={on ? '700' : '500'} style={{ fontSize: 13 }}>{t(c)}</AppText>
              </Pressable>
            );
          })}
        </View>
        <AppText variant="caption" style={{ marginBottom: 10 }}>{t('Choose every colour the fruit has while it ripens. Green fruit among green leaves cannot be counted reliably.')}</AppText>
        <View style={{ alignSelf: 'flex-start' }}><Button title="Add crop" icon="plus" loading={addCrop.isPending} onPress={addOwn} /></View>
        {own.length > 0 ? (
          <View style={{ marginTop: 14, gap: 8 }}>
            <AppText weight="700" style={{ fontSize: 11, color: colors.textLight, textTransform: 'uppercase' }}>{t('Your own crops')}</AppText>
            {own.map((c: any) => (
              <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <AppText weight="700" style={{ fontSize: 14 }}>{c.name}</AppText>
                  <AppText style={{ fontSize: 12, color: colors.textLight }}>{c.fruit_colors.map((x: string) => t(x)).join(', ')}</AppText>
                </View>
                <Button title="Remove" kind="secondary" size="sm" onPress={() => toggle({ ...c, selected: true, crop_id: c.id })} />
              </View>
            ))}
          </View>
        ) : null}
      </ChartCard>
    </View>
  );
}

/* ------------------------------------------------------------------ page */
export function GreenhouseScreen() {
  const { colors } = useTheme();
  const [tab, setTab] = useState<TabId>('dashboard');
  const [start, setStart] = useState<any>(null);
  const go = (id: TabId, opts: any = null) => { setStart(opts); setTab(id); };
  return (
    <Screen>
      <PageHeader title="Greenhouse" subtitle="Count the fruit on your plants with a photo, and check each photo with the fruit counter." />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingBottom: 14 }}>
        {TABS.map((x) => (
          <Pressable key={x.id} onPress={() => go(x.id)} accessibilityRole="tab" accessibilityState={{ selected: tab === x.id }} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1, borderColor: tab === x.id ? colors.primaryDark : colors.border, backgroundColor: tab === x.id ? colors.primaryDark : colors.card }}>
            <Icon name={x.icon} size={13} color={tab === x.id ? '#FFFFFF' : colors.textLight} />
            <AppText weight="600" style={{ fontSize: 13, color: tab === x.id ? '#FFFFFF' : colors.text }}>{t(x.label)}</AppText>
          </Pressable>
        ))}
      </ScrollView>
      {tab === 'dashboard' ? <DashboardTab go={go} /> : null}
      {tab === 'counts' ? <CountsTab key={JSON.stringify(start)} start={start} /> : null}
      {tab === 'crops' ? <CropsTab /> : null}
    </Screen>
  );
}
