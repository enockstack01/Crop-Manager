import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, TextInput, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { ff, radius } from '../theme/theme';
import { AppText, Badge, EmptyState, Loading } from '../components/ui';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { NumberField, SelectField, TextAreaField, TextField, useForm } from '../components/fields';
import { PlanMap } from '../components/PlanMap';
import { useConfirm } from '../components/Confirm';
import { useToast } from '../components/Toast';
import { mediaUrl } from '../env';
import { formatDate, formatNumber } from '../lib/format';
import { HealthCard } from '../components/HealthCard';
import {
  HEALTH, HEALTH_COLOR, PATTERNS, STATUS_COLOR, VERDICTS, WALLS, houseProblem, positionsOf, rowDefsOf, totalPositions, useGhCrops, useGhHouses, useGhLayout, useGhMutations, useGhPlant, useGhPositionLog,
} from '../lib/greenhouse';
import type { GhRole } from '../lib/greenhouse';
import { CountSheet } from './GreenhouseScreen';
import { t } from '../i18n';

const LEGEND: [string, string][] = [['match', 'Matches'], ['close', 'Close'], ['mismatch', 'Does not match'], ['inconclusive', 'Not sure'], ['not_checked', 'Not checked'], ['none', 'Not counted yet'], ['frozen', 'Frozen'], ['inactive', 'Deactivated']];
const COMPASS: [string, number][] = [['N', 0], ['E', 90], ['S', 180], ['W', 270]];

function Seg({ value, options, onChange }: { value: string; options: { id: string; label: string }[]; onChange: (v: string) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.card }}>
      {options.map((o) => (
        <Pressable key={o.id} onPress={() => onChange(o.id)} accessibilityRole="button" accessibilityState={{ selected: value === o.id }} style={{ minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', backgroundColor: value === o.id ? colors.primaryDark : 'transparent' }}>
          <AppText weight="600" style={{ fontSize: 13, color: value === o.id ? '#FFFFFF' : colors.text }}>{t(o.label)}</AppText>
        </Pressable>
      ))}
    </View>
  );
}

/** A small number box for the rows list. */
function Num({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  const { colors } = useTheme();
  return (
    <TextInput
      value={String(value)} onChangeText={(x) => onChange(x.replace(/[^0-9]/g, '') === '' ? 0 : Math.min(300, Number(x.replace(/[^0-9]/g, ''))))} keyboardType="number-pad" accessibilityLabel={label}
      style={{ width: 64, minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 8, textAlign: 'center', color: colors.text, fontFamily: ff('400'), backgroundColor: colors.card }}
    />
  );
}

/** Set up or change a greenhouse: size, direction, door, rows (each its own length, with optional sub rows A and B), planting pattern and spacing. */
function HouseSheet({ crops, editing, onClose, onSaved }: { crops: any[]; editing: any | null; onClose: () => void; onSaved: (h: any) => void }) {
  const { colors } = useTheme();
  const toast = useToast();
  const { addHouse, updateHouse } = useGhMutations();
  const form = useForm(editing ? {
    name: editing.name, length_m: String(editing.length_m), width_m: String(editing.width_m), rows: String(editing.rows), plants_per_row: String(editing.plants_per_row), crop_id: editing.crop_id || '',
    orientation_deg: String(editing.orientation_deg || 0), pattern: editing.pattern || 'grid', door_wall: editing.door?.wall || 'bottom', door_position: String(Math.round((editing.door?.position ?? 0.5) * 100)), door_width: String(editing.door?.width_m ?? 1.2),
    plant_spacing_m: editing.plant_spacing_m ? String(editing.plant_spacing_m) : '', row_spacing_m: editing.row_spacing_m ? String(editing.row_spacing_m) : '',
  } : { name: '', length_m: '', width_m: '', rows: '', plants_per_row: '', crop_id: crops[0]?.id || '', orientation_deg: '0', pattern: 'grid', door_wall: 'bottom', door_position: '50', door_width: '1.2', plant_spacing_m: '', row_spacing_m: '' });
  const [err, setErr] = useState('');
  const [hasDoor, setHasDoor] = useState(editing ? !!editing.door : true);
  const [customSpacing, setCustomSpacing] = useState(!!(editing?.plant_spacing_m || editing?.row_spacing_m));
  const [defs, setDefs] = useState<any[]>(() => (editing ? rowDefsOf(editing) : []));
  const v = form.values;
  const rows = Math.min(100, Number(v.rows) || 0);
  const per = Number(v.plants_per_row) || 0;
  const saving = addHouse.isPending || updateHouse.isPending;
  const shaped = useMemo(() => Array.from({ length: rows }, (_x, i) => defs[i] || { plants: per, start: 0, sub_rows: 1 }), [defs, rows, per]);
  const setRow = (i: number, patch: any) => setDefs(shaped.map((d, k) => (k === i ? { ...d, ...patch } : d)));
  const door = hasDoor ? { wall: v.door_wall, position: Math.min(100, Math.max(0, Number(v.door_position) || 0)) / 100, width_m: Number(v.door_width) || 1.2 } : null;
  const preview = useMemo(() => {
    const L = Number(v.length_m);
    const W = Number(v.width_m);
    if (!(L > 0) || !(W > 0) || rows < 1) return null;
    const house: any = { length_m: L, width_m: W, rows, plants_per_row: Math.max(1, ...shaped.map((d) => d.plants)), row_defs: shaped, orientation_deg: Number(v.orientation_deg) || 0, door, pattern: v.pattern, plant_spacing_m: customSpacing && Number(v.plant_spacing_m) > 0 ? Number(v.plant_spacing_m) : null, row_spacing_m: customSpacing && Number(v.row_spacing_m) > 0 ? Number(v.row_spacing_m) : null };
    return totalPositions(house) > 6000 ? { house, plants: [], tooMany: true } : { house, plants: positionsOf(house).map((p) => ({ ...p, state: 'active', latest: null })) };
  }, [v, rows, shaped, door, customSpacing]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    const p = houseProblem({ ...v, plants_per_row: v.plants_per_row });
    if (p) { setErr(t(p)); return; }
    setErr('');
    const body: any = {
      name: v.name, length_m: Number(v.length_m), width_m: Number(v.width_m), row_defs: shaped, crop_id: v.crop_id || null, orientation_deg: Number(v.orientation_deg) || 0, door, pattern: v.pattern,
      plant_spacing_m: customSpacing && v.plant_spacing_m ? Number(v.plant_spacing_m) : null, row_spacing_m: customSpacing && v.row_spacing_m ? Number(v.row_spacing_m) : null,
    };
    if (!editing) body.row_crops = [];
    try {
      const saved = editing ? await updateHouse.mutateAsync({ id: editing.id, ...body }) : await addHouse.mutateAsync(body);
      toast(t('Greenhouse saved'));
      onSaved(saved);
    } catch (e: any) { setErr(e?.message || t('Could not save')); }
  };
  const sec = (txt: string) => <AppText weight="700" style={{ fontSize: 11, color: colors.textLight, textTransform: 'uppercase', marginTop: 10, marginBottom: 6 }}>{t(txt)}</AppText>;
  return (
    <Sheet visible onClose={onClose} title={t(editing ? 'Change the greenhouse layout' : 'Set up a greenhouse')} footer={<Button title={saving ? 'Saving...' : 'Save greenhouse'} icon="floppy-disk" loading={saving} onPress={save} />}>
      {err ? <View style={{ borderWidth: 1, borderColor: colors.red, borderRadius: radius.md, padding: 12, marginBottom: 12 }}><AppText style={{ fontSize: 13, color: colors.red }}>{err}</AppText></View> : null}
      <TextField label="Greenhouse name" required {...form.bind('name')} placeholder="e.g. House 1" />
      <SelectField label="Main crop" {...form.bind('crop_id')} placeholder="Choose a crop" options={crops.map((c) => ({ value: c.id, label: c.name }))} />
      <NumberField label="Length in metres" required {...form.bind('length_m')} placeholder="e.g. 30" />
      <NumberField label="Width in metres" required {...form.bind('width_m')} placeholder="e.g. 8" />
      <NumberField label="Number of rows" required {...form.bind('rows')} placeholder="e.g. 6" />
      <NumberField label="Plants in each row" required {...form.bind('plants_per_row')} placeholder="e.g. 40" />

      {sec('Direction and door')}
      <AppText variant="caption" style={{ marginBottom: 6 }}>{t('Which way does the top wall of the plan face? 0 is north, 90 east, 180 south, 270 west.')}</AppText>
      <Seg value={COMPASS.find(([, d]) => String(d) === v.orientation_deg)?.[0] || ''} onChange={(k) => form.set('orientation_deg', String(COMPASS.find(([n]) => n === k)![1]))} options={COMPASS.map(([n]) => ({ id: n, label: n }))} />
      <NumberField label="Compass degrees" {...form.bind('orientation_deg')} placeholder="0 to 359" />
      <SelectField label="How the plants stand" {...form.bind('pattern')} placeholder="" options={PATTERNS.map((p) => ({ value: p.value, label: t(p.label) }))} />
      <Seg value={hasDoor ? 'yes' : 'no'} onChange={(x) => setHasDoor(x === 'yes')} options={[{ id: 'yes', label: 'The greenhouse has a door' }, { id: 'no', label: 'No door' }]} />
      {hasDoor ? (
        <View style={{ marginTop: 8 }}>
          <SelectField label="Wall of the door" {...form.bind('door_wall')} placeholder="" options={WALLS.map((w) => ({ value: w.value, label: t(w.label) }))} />
          <NumberField label="Where along the wall (%)" {...form.bind('door_position')} hint="0 is the start of the wall, 100 the end" />
          <NumberField label="Door width in metres" {...form.bind('door_width')} />
        </View>
      ) : null}

      {sec('Spacing')}
      <Seg value={customSpacing ? 'mine' : 'even'} onChange={(x) => setCustomSpacing(x === 'mine')} options={[{ id: 'even', label: 'Spread evenly' }, { id: 'mine', label: 'I set the distances' }]} />
      {customSpacing ? (
        <View style={{ marginTop: 8 }}>
          <NumberField label="Distance between plants in a row (m)" {...form.bind('plant_spacing_m')} />
          <NumberField label="Distance between rows (m)" {...form.bind('row_spacing_m')} />
        </View>
      ) : null}

      {rows > 0 ? (
        <>
          {sec('Rows')}
          <AppText variant="caption" style={{ marginBottom: 8 }}>{t('A row can be shorter or longer, can start further along the house, and can be a double row: two sub rows A and B side by side.')}</AppText>
          <View style={{ gap: 8 }}>
            {shaped.map((d, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <AppText weight="700" style={{ width: 34 }}>{`R${i + 1}`}</AppText>
                <View><AppText variant="caption">{t('Positions')}</AppText><Num value={d.plants} onChange={(n) => setRow(i, { plants: n })} label={`R${i + 1} ${t('plant positions')}`} /></View>
                <View><AppText variant="caption">{t('Starts after')}</AppText><Num value={d.start} onChange={(n) => setRow(i, { start: n })} label={`R${i + 1} ${t('starts after')}`} /></View>
                <Pressable onPress={() => setRow(i, { sub_rows: d.sub_rows === 2 ? 1 : 2 })} accessibilityRole="checkbox" accessibilityState={{ checked: d.sub_rows === 2 }} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, borderRadius: radius.md, borderWidth: 1, borderColor: d.sub_rows === 2 ? colors.primary : colors.border }}>
                  <AppText weight={d.sub_rows === 2 ? '700' : '500'} style={{ fontSize: 13 }}>{d.sub_rows === 2 ? t('Double row A and B') : t('Single row')}</AppText>
                </Pressable>
              </View>
            ))}
          </View>
          <View style={{ alignSelf: 'flex-start', marginTop: 8 }}><Button title={`${t('Give every row')} ${per} ${t('positions')}`} kind="secondary" size="sm" onPress={() => setDefs(shaped.map((d) => ({ ...d, plants: per })))} /></View>
        </>
      ) : null}
      {preview ? (
        <>
          {sec('Preview')}
          {(preview as any).tooMany ? <AppText style={{ color: colors.red, fontSize: 13 }}>{t('A greenhouse can hold at most 6000 plants in the layout. Split a very large house in two.')}</AppText> : (
            <>
              <AppText variant="caption" style={{ marginBottom: 6 }}>{t('This greenhouse will have')} {formatNumber(totalPositions(preview.house))} {t('plant positions')}.</AppText>
              <PlanMap layout={{ house: preview.house, plants: preview.plants }} colorBy="status" onPick={() => {}} />
            </>
          )}
        </>
      ) : null}
    </Sheet>
  );
}

/** Asks why before a plant is frozen or a position deactivated: the reason is kept with who did it and when. Also names a plant. */
function StateSheet({ house, plant, mode, onClose }: { house: any; plant: any; mode: 'frozen' | 'inactive' | 'active' | 'name'; onClose: () => void }) {
  const { colors } = useTheme();
  const toast = useToast();
  const { setPosition } = useGhMutations();
  const [text, setText] = useState(mode === 'name' ? plant.label || '' : '');
  const [err, setErr] = useState('');
  const copy: Record<string, { title: string; hint: string; ph: string }> = {
    frozen: { title: 'Freeze this plant', hint: 'Freeze a diseased plant that should be left alone. It stays on the plan and can still be recorded.', ph: 'e.g. Late blight, wait until the spray works' },
    inactive: { title: 'Deactivate this position', hint: 'Deactivate a position where the plant was uprooted. It is no longer expected to be counted, and takes no new counts.', ph: 'e.g. Uprooted after wilt' },
    active: { title: 'Reactivate this position', hint: 'The plant is back in use: it is expected to be counted again.', ph: 'e.g. Replanted (optional)' },
    name: { title: 'Name this plant', hint: 'A short name that appears next to the position on the plan.', ph: 'e.g. Mama Jane tomato' },
  };
  const c = copy[mode];
  const go = async () => {
    if ((mode === 'frozen' || mode === 'inactive') && !text.trim()) { setErr(t('Please say why. The reason is kept with the change.')); return; }
    try {
      await setPosition.mutateAsync({ id: house.id, row_id: plant.row_id, plant_label: plant.plant_label, ...(mode === 'name' ? { label: text.trim() } : { state: mode, reason: text.trim() }) });
      toast(t('Saved'));
      onClose();
    } catch (e: any) { setErr(e?.message || ''); }
  };
  return (
    <Sheet visible onClose={onClose} title={`${t(c.title)}: ${plant.row_id} ${plant.plant_label}`} footer={<Button title="Save" icon="floppy-disk" loading={setPosition.isPending} onPress={go} />}>
      {err ? <View style={{ borderWidth: 1, borderColor: colors.red, borderRadius: radius.md, padding: 12, marginBottom: 12 }}><AppText style={{ fontSize: 13, color: colors.red }}>{err}</AppText></View> : null}
      <AppText style={{ fontSize: 13, lineHeight: 19, marginBottom: 10 }}>{t(c.hint)}</AppText>
      {mode === 'name'
        ? <TextField label="Name" value={text} onChangeValue={setText} placeholder={c.ph} />
        : <TextAreaField label={mode === 'active' ? 'Reason (optional)' : 'Reason (required)'} value={text} onChangeValue={setText} placeholder={c.ph} />}
    </Sheet>
  );
}

/** Adds plant positions to the end of a row. */
function AddPositionsSheet({ house, layout, onClose }: { house: any; layout: any; onClose: () => void }) {
  const { colors } = useTheme();
  const toast = useToast();
  const { addPositions } = useGhMutations();
  const ids: string[] = [...new Set<string>(layout.plants.map((p: any) => (p.sub ? `R${p.row}` : p.row_id)))];
  const [row, setRow] = useState(ids[0] || 'R1');
  const [count, setCount] = useState('1');
  const [err, setErr] = useState('');
  const doubles = layout.plants.some((p: any) => p.row === Number(row.slice(1)) && p.sub);
  const go = async () => {
    try {
      await addPositions.mutateAsync({ id: house.id, row_id: doubles ? `${row}A` : row, count: Number(count) });
      toast(t('Plant positions added'));
      onClose();
    } catch (e: any) { setErr(e?.message || ''); }
  };
  return (
    <Sheet visible onClose={onClose} title={t('Add plant positions')} footer={<Button title="Add" icon="plus" loading={addPositions.isPending} onPress={go} />}>
      {err ? <View style={{ borderWidth: 1, borderColor: colors.red, borderRadius: radius.md, padding: 12, marginBottom: 12 }}><AppText style={{ fontSize: 13, color: colors.red }}>{err}</AppText></View> : null}
      <SelectField label="Add to row" value={row} onChangeValue={setRow} placeholder="" options={ids.map((i) => ({ value: i, label: i }))} />
      <NumberField label="How many new positions" value={count} onChangeValue={setCount} />
      <AppText variant="caption">{t('The new positions are added at the end of the row and numbered after the last plant. In a double row both sub rows grow.')}</AppText>
    </Sheet>
  );
}

/** The recent freezes, deactivations and additions of a greenhouse. */
function LogSheet({ house, onClose }: { house: any; onClose: () => void }) {
  const { colors } = useTheme();
  const { data = [], isLoading } = useGhPositionLog(house.id);
  const WORD: Record<string, string> = { frozen: 'froze', inactive: 'deactivated', reactivated: 'reactivated', added: 'added positions to' };
  return (
    <Sheet visible onClose={onClose} title={t('History of changes')} footer={<Button title="Done" onPress={onClose} />}>
      {isLoading ? <Loading /> : data.length === 0 ? <AppText style={{ color: colors.textLight }}>{t('Nothing has been frozen, deactivated or added yet.')}</AppText> : (
        <View style={{ gap: 10 }}>
          {data.map((e: any, i: number) => (
            <View key={i}>
              <AppText variant="caption">{formatDate(e.at)}</AppText>
              <AppText style={{ fontSize: 13 }}><AppText weight="700" style={{ fontSize: 13 }}>{e.by_name || t('Someone')}</AppText> {t(WORD[e.action] || e.action)} {e.row_id}{e.plant_label ? ` ${e.plant_label}` : ''}{e.count ? ` (+${e.count})` : ''}{e.reason ? `: ${e.reason}` : ''}</AppText>
            </View>
          ))}
        </View>
      )}
    </Sheet>
  );
}

/** What is known about the chosen plant, with the way to record a count on it and to freeze or deactivate it. */
function PlantSheet({ house, plant, role, onClose, onRecord, onState }: { house: any; plant: any; role: GhRole; onClose: () => void; onRecord: (p: any) => void; onState: (mode: 'frozen' | 'inactive' | 'active' | 'name') => void }) {
  const { colors } = useTheme();
  const { data, isLoading } = useGhPlant(house.id, plant.row, plant.plant, plant.sub || '');
  const showHealth = role !== 'collector';
  const inactive = plant.state === 'inactive';
  return (
    <Sheet visible onClose={onClose} title={`${plant.row_id} ${plant.plant_label}${plant.label ? ` · ${plant.label}` : ''}`} footer={inactive ? undefined : <Button title="Record a count on this plant" icon="camera" onPress={() => onRecord(plant)} />}>
      <AppText variant="caption" style={{ marginBottom: 10 }}>{house.name}{plant.crop_name ? ` · ${plant.crop_name}` : ''}</AppText>
      {plant.state !== 'active' ? (
        <View style={{ borderWidth: 1, borderColor: inactive ? colors.orange : colors.primary, borderRadius: radius.md, padding: 10, marginBottom: 10 }}>
          <AppText style={{ fontSize: 13 }}><AppText weight="700" style={{ fontSize: 13 }}>{t(inactive ? 'Deactivated' : 'Frozen')}</AppText>: {plant.state_reason}</AppText>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {plant.state === 'active' ? <Button title="Freeze" icon="snowflake" kind="secondary" size="sm" onPress={() => onState('frozen')} /> : null}
        {plant.state !== 'inactive' ? <Button title="Deactivate" icon="ban" kind="secondary" size="sm" onPress={() => onState('inactive')} /> : null}
        {plant.state !== 'active' ? <Button title="Reactivate" icon="rotate-left" kind="secondary" size="sm" onPress={() => onState('active')} /> : null}
        <Button title="Name it" icon="tag" kind="secondary" size="sm" onPress={() => onState('name')} />
      </View>
      {showHealth && data?.data?.length ? (
        <View style={{ gap: 8, marginBottom: 12 }}>
          <AppText weight="700" style={{ fontSize: 11, color: colors.textLight, textTransform: 'uppercase' }}>{t('Health card')}</AppText>
          <HealthCard health={data.data[0].verification?.health} />
          {data.data.filter((c: any) => c.verification?.health && c.verification.health.status !== 'not_checked').length > 1 ? (
            <View style={{ gap: 6 }}>
              <AppText weight="700" style={{ fontSize: 11, color: colors.textLight, textTransform: 'uppercase' }}>{t('Health history')}</AppText>
              {data.data.filter((c: any) => c.verification?.health && c.verification.health.status !== 'not_checked').slice(0, 12).map((c: any) => {
                const hm = HEALTH[c.verification.health.status] || HEALTH.not_checked;
                return (
                  <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <AppText style={{ fontSize: 12, color: colors.textLight }}>{formatDate(c.count_date)}</AppText>
                    <Badge label={t(hm.label)} tone={hm.tone} />
                    <AppText style={{ fontSize: 12 }}>{c.verification.health.plant?.disease || ''}{c.verification.health.sick_fruit ? ` · ${c.verification.health.sick_fruit} ${t('fruit')}` : ''}</AppText>
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : null}
      <AppText weight="700" style={{ fontSize: 11, color: colors.textLight, textTransform: 'uppercase', marginBottom: 6 }}>{t(role === 'collector' ? 'Your counts' : 'Counts')}</AppText>
      {isLoading ? <Loading /> : !data?.data?.length ? (
        <AppText style={{ color: colors.textLight }}>{t('No fruit counted on this plant yet.')}</AppText>
      ) : (
        <View style={{ gap: 12 }}>
          {data.data.map((c: any) => {
            const m = VERDICTS[c.verification?.status || 'not_checked'];
            const img = c.annotated_url || c.photo_url;
            return (
              <View key={c.id} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                {img ? <Image source={{ uri: mediaUrl(img) }} style={{ width: 64, height: 64, borderRadius: 8 }} /> : null}
                <View style={{ flex: 1, gap: 4 }}>
                  <AppText style={{ fontSize: 14 }}><AppText weight="700">{c.recorded_count}</AppText> {t('fruit')}{c.fruit_size && c.fruit_size !== 'all' ? ` (${t(c.fruit_size)})` : ''}{c.label ? ` · ${c.label}` : ''}</AppText>
                  <AppText variant="caption">{formatDate(c.count_date)}{c.verification?.detected != null ? ` · ${t('photo shows')} ${c.verification.detected}` : ''}{(c.photo_urls || []).length > 1 ? ` · ${c.photo_urls.length} ${t('photos')}` : ''}</AppText>
                  <View style={{ alignSelf: 'flex-start' }}><Badge label={t(m.label)} tone={m.tone} /></View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Sheet>
  );
}

export function LayoutTab({ role = 'owner' }: { role?: GhRole }) {
  const { colors } = useTheme();
  const toast = useToast();
  const confirm = useConfirm();
  const owner = role === 'owner';
  const collector = role === 'collector';
  const { data: houses = [], isLoading } = useGhHouses();
  const { data: crops = [] } = useGhCrops();
  const { removeHouse } = useGhMutations();
  const [houseId, setHouseId] = useState('');
  const [colorBy, setColorBy] = useState<'status' | 'fruit' | 'health'>('status');
  const [mode, setMode] = useState<'look' | 'record'>(collector ? 'record' : 'look');
  const [selected, setSelected] = useState<{ row_id: string; plant_label: string } | null>(null);
  const [form, setForm] = useState<'new' | any | null>(null);
  const [recording, setRecording] = useState<any | null>(null);
  const [stateFor, setStateFor] = useState<{ plant: any; mode: 'frozen' | 'inactive' | 'active' | 'name' } | null>(null);
  const [adding, setAdding] = useState(false);
  const [log, setLog] = useState(false);
  const house = useMemo(() => houses.find((h: any) => h.id === houseId) || houses[0], [houses, houseId]);
  const { data: layout, isLoading: loadingLayout, refetch } = useGhLayout(house?.id);
  useEffect(() => { setSelected(null); }, [house?.id]);

  if (isLoading) return <Loading />;
  if (!crops.length) return <EmptyState icon="seedling" title={owner ? 'Choose the crops you grow first' : 'No crops yet'} description={owner ? 'Pick your greenhouse crops under My crops, then set up the greenhouse layout.' : 'The farm owner has not chosen the greenhouse crops yet.'} />;
  if (!houses.length) {
    return (
      <>
        <EmptyState icon="cube" title="Set up your first greenhouse" description={owner ? 'Say how big it is, which way it faces, where the door is and how the rows run. You then get a plan where every plant has its place, and the same plan is used to record counts.' : 'The farm owner has not set up a greenhouse yet.'} actionLabel={owner ? 'Set up a greenhouse' : undefined} onAction={owner ? () => setForm('new') : undefined} />
        {form ? <HouseSheet crops={crops} editing={null} onClose={() => setForm(null)} onSaved={(h) => { setForm(null); setHouseId(h.id); }} /> : null}
      </>
    );
  }
  const pick = (p: any) => {
    setSelected({ row_id: p.row_id, plant_label: p.plant_label });
    if (mode === 'record' && p.state !== 'inactive') setRecording(p);
  };
  const plant = selected && layout?.plants.find((p: any) => p.row_id === selected.row_id && p.plant_label === selected.plant_label);
  const s = layout?.summary;
  const remove = async () => {
    if (!(await confirm(t('Remove this greenhouse layout? Your fruit counts stay.')))) return;
    try { await removeHouse.mutateAsync(house.id); setHouseId(''); toast(t('Layout removed')); } catch (e: any) { toast(e?.message || '', 'error'); }
  };
  const legend: [string, string, string][] = colorBy === 'health'
    ? ([['healthy', 'Healthy'], ['sick', 'Possible disease'], ['unsure', 'Not sure'], ['not_checked', 'Disease not checked'], ['none', 'Not counted yet']] as [string, string][]).map(([k, l]) => [k, l, HEALTH_COLOR[k]])
    : colorBy === 'status' ? LEGEND.map(([k, l]) => [k, l, STATUS_COLOR[k]]) : [['frozen', 'Frozen', STATUS_COLOR.frozen], ['inactive', 'Deactivated', STATUS_COLOR.inactive]];
  return (
    <View style={{ gap: 14 }}>
      <SelectField label="Greenhouse" value={house.id} onChangeValue={(v: string) => setHouseId(v)} placeholder="" options={houses.map((h: any) => ({ value: h.id, label: h.name }))} />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Button title="Add plant positions" icon="plus" kind="secondary" size="sm" onPress={() => setAdding(true)} />
        <Button title="History" icon="clock-rotate-left" kind="secondary" size="sm" onPress={() => setLog(true)} />
        {owner ? <Button title="New greenhouse" icon="plus" size="sm" onPress={() => setForm('new')} /> : null}
        {owner ? <Button title="Layout" icon="pen" kind="secondary" size="sm" onPress={() => setForm(house)} /> : null}
        {owner ? <Button title="Remove" icon="trash" kind="secondary" size="sm" onPress={remove} /> : null}
      </View>
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        <Seg value={colorBy} onChange={(v) => setColorBy(v as any)} options={[{ id: 'status', label: 'Photo check' }, { id: 'fruit', label: 'Fruit count' }, ...(collector ? [] : [{ id: 'health', label: 'Health' }])]} />
        <Seg value={mode} onChange={(v) => setMode(v as any)} options={[{ id: 'look', label: 'Look' }, { id: 'record', label: 'Record' }]} />
      </View>
      <AppText variant="caption">{t(mode === 'record' ? 'Tap the plant you are standing at to record a count on it.' : 'Tap a plant to see its counts.')}</AppText>

      {s ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          {([[s.plants, 'plant positions'], [s.counted, 'counted'], [s.not_counted, 'not counted yet'], ...(s.frozen ? [[s.frozen, 'frozen']] : []), ...(s.inactive ? [[s.inactive, 'deactivated']] : []), [s.fruit, 'fruit'], ...(collector ? [] : [[s.sick_plants || 0, 'plants with possible disease']]), [s.average_per_counted_plant, 'per counted plant']] as any[]).map(([n, l]) => (
            <AppText key={l} style={{ fontSize: 13 }}><AppText weight="700" style={{ fontSize: 13 }}>{formatNumber(n)}</AppText> {t(l)}</AppText>
          ))}
        </View>
      ) : null}

      {loadingLayout || !layout ? <Loading /> : <PlanMap layout={layout} colorBy={colorBy} selected={selected} onPick={pick} />}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {legend.map(([k, label, color]) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: color }} />
            <AppText style={{ fontSize: 12, color: colors.textLight }}>{t(label)}</AppText>
          </View>
        ))}
        {colorBy === 'fruit' ? <AppText variant="caption">{t('Lighter is less fruit, red is the most fruit on one plant. Grey is not counted yet.')}</AppText> : null}
      </View>

      {plant && mode === 'look' ? <PlantSheet house={house} plant={plant} role={role} onClose={() => setSelected(null)} onRecord={(p) => setRecording(p)} onState={(m) => setStateFor({ plant, mode: m })} /> : null}
      {form ? <HouseSheet crops={crops} editing={form === 'new' ? null : form} onClose={() => setForm(null)} onSaved={(h) => { setForm(null); setHouseId(h.id); refetch(); }} /> : null}
      {stateFor ? <StateSheet house={house} plant={stateFor.plant} mode={stateFor.mode} onClose={() => { setStateFor(null); refetch(); }} /> : null}
      {adding && layout ? <AddPositionsSheet house={house} layout={layout} onClose={() => { setAdding(false); refetch(); }} /> : null}
      {log ? <LogSheet house={house} onClose={() => setLog(false)} /> : null}
      {recording ? (
        <CountSheet crops={crops} editing={null} onSaved={() => refetch()} onClose={() => setRecording(null)} preset={{ greenhouse: house.name, row_id: recording.row_id, plant_label: recording.plant_label, crop_id: recording.crop_id }} />
      ) : null}
    </View>
  );
}
