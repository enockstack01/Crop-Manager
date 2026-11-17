import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius } from '../theme/theme';
import { AppText, Badge, EmptyState, Loading } from '../components/ui';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { NumberField, SelectField, TextField, useForm } from '../components/fields';
import { useConfirm } from '../components/Confirm';
import { useToast } from '../components/Toast';
import { mediaUrl } from '../env';
import { formatDate, formatNumber } from '../lib/format';
import { HealthCard } from '../components/HealthCard';
import { HEALTH, HEALTH_COLOR, STATUS_COLOR, VERDICTS, houseProblem, markerColor, useGhCrops, useGhHouses, useGhLayout, useGhMutations, useGhPlant } from '../lib/greenhouse';
import { CountSheet } from './GreenhouseScreen';
import { t } from '../i18n';

const LEGEND: [string, string][] = [['match', 'Matches'], ['close', 'Close'], ['mismatch', 'Does not match'], ['inconclusive', 'Not sure'], ['not_checked', 'Not checked'], ['none', 'Not counted yet']];
const CELL = 38;

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

/** Set up or change a greenhouse: its size, rows, plants per row, and the crop. */
function HouseSheet({ crops, editing, onClose, onSaved }: { crops: any[]; editing: any | null; onClose: () => void; onSaved: (h: any) => void }) {
  const { colors } = useTheme();
  const toast = useToast();
  const { addHouse, updateHouse } = useGhMutations();
  const form = useForm(editing ? {
    name: editing.name, length_m: String(editing.length_m), width_m: String(editing.width_m), rows: String(editing.rows), plants_per_row: String(editing.plants_per_row), crop_id: editing.crop_id || '',
  } : { name: '', length_m: '', width_m: '', rows: '', plants_per_row: '', crop_id: crops[0]?.id || '' });
  const [err, setErr] = useState('');
  const v = form.values;
  const plants = (Number(v.rows) || 0) * (Number(v.plants_per_row) || 0);
  const saving = addHouse.isPending || updateHouse.isPending;
  const save = async () => {
    const p = houseProblem(v);
    if (p) { setErr(t(p)); return; }
    setErr('');
    const body = { name: v.name, length_m: Number(v.length_m), width_m: Number(v.width_m), rows: Number(v.rows), plants_per_row: Number(v.plants_per_row), crop_id: v.crop_id || null, ...(editing ? {} : { row_crops: [] }) };
    try {
      const saved = editing ? await updateHouse.mutateAsync({ id: editing.id, ...body }) : await addHouse.mutateAsync(body);
      toast(t('Greenhouse saved'));
      onSaved(saved);
    } catch (e: any) { setErr(e?.message || t('Could not save')); }
  };
  return (
    <Sheet visible onClose={onClose} title={t(editing ? 'Change the greenhouse layout' : 'Set up a greenhouse')} footer={<Button title={saving ? 'Saving...' : 'Save greenhouse'} icon="floppy-disk" loading={saving} onPress={save} />}>
      {err ? <View style={{ borderWidth: 1, borderColor: colors.red, borderRadius: radius.md, padding: 12, marginBottom: 12 }}><AppText style={{ fontSize: 13, color: colors.red }}>{err}</AppText></View> : null}
      <TextField label="Greenhouse name" required {...form.bind('name')} placeholder="e.g. House 1" />
      <SelectField label="Main crop" {...form.bind('crop_id')} placeholder="Choose a crop" options={crops.map((c) => ({ value: c.id, label: c.name }))} />
      <NumberField label="Length in metres" required {...form.bind('length_m')} placeholder="e.g. 30" />
      <NumberField label="Width in metres" required {...form.bind('width_m')} placeholder="e.g. 8" />
      <NumberField label="Number of rows" required {...form.bind('rows')} placeholder="e.g. 6" />
      <NumberField label="Plants in each row" required {...form.bind('plants_per_row')} placeholder="e.g. 40" />
      {plants > 0 ? <AppText variant="caption">{t('This greenhouse will have')} {formatNumber(plants)} {t('plants')}. {t('They are named R1 P1, R1 P2 and so on: row first, then the plant in the row, counted from the entrance end.')}</AppText> : null}
    </Sheet>
  );
}

/** What is known about the chosen plant, with the way to record a count on it. */
function PlantSheet({ house, plant, onClose, onRecord }: { house: any; plant: any; onClose: () => void; onRecord: (p: any) => void }) {
  const { colors } = useTheme();
  const { data, isLoading } = useGhPlant(house.id, plant.row, plant.plant);
  return (
    <Sheet visible onClose={onClose} title={`${plant.row_id} ${plant.plant_label}`} footer={<Button title="Record a count on this plant" icon="camera" onPress={() => onRecord(plant)} />}>
      <AppText variant="caption" style={{ marginBottom: 10 }}>{house.name}{plant.crop_name ? ` · ${plant.crop_name}` : ''}</AppText>
      {data?.data?.length ? (
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
          <AppText weight="700" style={{ fontSize: 11, color: colors.textLight, textTransform: 'uppercase', marginTop: 4 }}>{t('Counts')}</AppText>
        </View>
      ) : null}
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
                  <AppText style={{ fontSize: 14 }}><AppText weight="700">{c.recorded_count}</AppText> {t('fruit')}</AppText>
                  <AppText variant="caption">{formatDate(c.count_date)}{c.verification?.detected != null ? ` · ${t('photo shows')} ${c.verification.detected}` : ''}</AppText>
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

export function LayoutTab() {
  const { colors } = useTheme();
  const toast = useToast();
  const confirm = useConfirm();
  const { data: houses = [], isLoading } = useGhHouses();
  const { data: crops = [] } = useGhCrops();
  const { removeHouse } = useGhMutations();
  const [houseId, setHouseId] = useState('');
  const [colorBy, setColorBy] = useState<'status' | 'fruit' | 'health'>('status');
  const [mode, setMode] = useState<'look' | 'record'>('look');
  const [selected, setSelected] = useState<{ row: number; plant: number } | null>(null);
  const [form, setForm] = useState<'new' | any | null>(null);
  const [recording, setRecording] = useState<any | null>(null);
  const house = useMemo(() => houses.find((h: any) => h.id === houseId) || houses[0], [houses, houseId]);
  const { data: layout, isLoading: loadingLayout, refetch } = useGhLayout(house?.id);
  useEffect(() => { setSelected(null); }, [house?.id]);
  const max = useMemo(() => Math.max(1, ...(layout?.plants || []).map((p: any) => p.latest?.recorded_count || 0)), [layout]);

  if (isLoading) return <Loading />;
  if (!crops.length) return <EmptyState icon="seedling" title="Choose the crops you grow first" description="Pick your greenhouse crops under My crops, then set up the greenhouse layout." />;
  if (!houses.length) {
    return (
      <>
        <EmptyState icon="cube" title="Set up your first greenhouse" description="Say how big it is and how many rows and plants it has. You then get a plan where every plant has its place, and the same plan is used to record counts." actionLabel="Set up a greenhouse" onAction={() => setForm('new')} />
        {form ? <HouseSheet crops={crops} editing={null} onClose={() => setForm(null)} onSaved={(h) => { setForm(null); setHouseId(h.id); }} /> : null}
      </>
    );
  }
  const pick = (p: any) => {
    setSelected({ row: p.row, plant: p.plant });
    if (mode === 'record') setRecording(p);
  };
  const plant = selected && layout?.plants.find((p: any) => p.row === selected.row && p.plant === selected.plant);
  const s = layout?.summary;
  const remove = async () => {
    if (!(await confirm(t('Remove this greenhouse layout? Your fruit counts stay.')))) return;
    try { await removeHouse.mutateAsync(house.id); setHouseId(''); toast(t('Layout removed')); } catch (e: any) { toast(e?.message || '', 'error'); }
  };
  const per = house.plants_per_row;
  return (
    <View style={{ gap: 14 }}>
      <SelectField label="Greenhouse" value={house.id} onChangeValue={(v: string) => setHouseId(v)} placeholder="" options={houses.map((h: any) => ({ value: h.id, label: h.name }))} />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Button title="New greenhouse" icon="plus" size="sm" onPress={() => setForm('new')} />
        <Button title="Layout" icon="pen" kind="secondary" size="sm" onPress={() => setForm(house)} />
        <Button title="Remove" icon="trash" kind="secondary" size="sm" onPress={remove} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        <Seg value={colorBy} onChange={(v) => setColorBy(v as any)} options={[{ id: 'status', label: 'Photo check' }, { id: 'fruit', label: 'Fruit count' }, { id: 'health', label: 'Health' }]} />
        <Seg value={mode} onChange={(v) => setMode(v as any)} options={[{ id: 'look', label: 'Look' }, { id: 'record', label: 'Record' }]} />
      </View>
      <AppText variant="caption">{t(mode === 'record' ? 'Tap the plant you are standing at to record a count on it.' : 'Tap a plant to see its counts.')}</AppText>

      {s ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          {[[s.plants, 'plants'], [s.counted, 'counted'], [s.not_counted, 'not counted yet'], [s.fruit, 'fruit'], [s.average_per_counted_plant, 'per counted plant']].map(([n, l]: any) => (
            <AppText key={l} style={{ fontSize: 13 }}><AppText weight="700" style={{ fontSize: 13 }}>{formatNumber(n)}</AppText> {t(l)}</AppText>
          ))}
        </View>
      ) : null}

      {loadingLayout || !layout ? <Loading /> : (
        <ScrollView horizontal style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.card }} contentContainerStyle={{ padding: 10 }}>
          <View style={{ gap: 3 }}>
            {Array.from({ length: house.rows }, (_, r) => (
              <View key={r} style={{ flexDirection: 'row', gap: 3, alignItems: 'center' }}>
                <AppText style={{ width: 30, fontSize: 11, color: colors.textLight, textAlign: 'right' }}>R{r + 1}</AppText>
                {layout.plants.slice(r * per, (r + 1) * per).map((p: any) => {
                  const on = selected?.row === p.row && selected?.plant === p.plant;
                  return (
                    <Pressable
                      key={p.plant} onPress={() => pick(p)} accessibilityRole="button"
                      accessibilityLabel={`${p.row_id} ${p.plant_label}${p.latest ? `, ${p.latest.recorded_count} ${t('fruit')}` : `, ${t('not counted yet')}`}`}
                      style={{ width: CELL, height: CELL, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: markerColor(p, colorBy, max), borderWidth: 3, borderColor: on ? '#1565C0' : 'transparent' }}
                    >
                      {p.latest ? <AppText weight="700" style={{ fontSize: 11, color: '#FFFFFF' }}>{p.latest.recorded_count}</AppText> : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {colorBy === 'health' ? ([['healthy', 'Healthy'], ['sick', 'Possible disease'], ['unsure', 'Not sure'], ['not_checked', 'Disease not checked'], ['none', 'Not counted yet']] as [string, string][]).map(([k, label]) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: HEALTH_COLOR[k] }} />
            <AppText style={{ fontSize: 12, color: colors.textLight }}>{t(label)}</AppText>
          </View>
        )) : colorBy === 'status' ? LEGEND.map(([k, label]) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: STATUS_COLOR[k] }} />
            <AppText style={{ fontSize: 12, color: colors.textLight }}>{t(label)}</AppText>
          </View>
        )) : <AppText variant="caption">{t('Lighter is less fruit, red is the most fruit on one plant. Grey is not counted yet.')}</AppText>}
      </View>

      {plant && mode === 'look' ? <PlantSheet house={house} plant={plant} onClose={() => setSelected(null)} onRecord={(p) => { setRecording(p); }} /> : null}
      {form ? <HouseSheet crops={crops} editing={form === 'new' ? null : form} onClose={() => setForm(null)} onSaved={(h) => { setForm(null); setHouseId(h.id); refetch(); }} /> : null}
      {recording ? (
        <CountSheet crops={crops} editing={null} onSaved={() => refetch()} onClose={() => setRecording(null)} preset={{ greenhouse: house.name, row_id: recording.row_id, plant_label: recording.plant_label, crop_id: recording.crop_id }} />
      ) : null}
    </View>
  );
}
