import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { EmptyState, Loading } from '../components/ui.jsx';
import { Modal } from '../components/Modal.jsx';
import { FormRow, NumberField, SelectField, TextField, useForm } from '../components/form.jsx';
import { useConfirm } from '../components/Confirm.jsx';
import { useToast } from '../components/Toast.jsx';
import { markerColor, STATUS_COLOR, webglAvailable } from '../lib/greenhouseColors.js';
import { formatDate, formatNumber } from '../lib/format.js';
import { useGhCrops, useGhHouses, useGhLayout, useGhMutations, useGhPlant, VERDICTS } from '../lib/greenhouse.js';
import { CountForm } from './Greenhouse.jsx';
import { t } from '../i18n/index.js';

const Scene = lazy(() => import('../components/GreenhouseScene.jsx'));
const LEGEND = [['match', 'Matches'], ['close', 'Close'], ['mismatch', 'Does not match'], ['inconclusive', 'Not sure'], ['not_checked', 'Not checked'], ['none', 'Not counted yet']];

/** The same greenhouse as a flat plan: rows down, plants across. Always works, and is the keyboard and small-screen way to pick a plant. */
function Plan({ layout, colorBy, selected, onPick }) {
  const { house, plants } = layout;
  const max = Math.max(1, ...plants.map((p) => p.latest?.recorded_count || 0));
  return (
    <div className="gh-plan" role="grid" aria-label={t('Plan of the greenhouse')}>
      <div className="gh-plan-grid" style={{ gridTemplateColumns: `34px repeat(${house.plants_per_row}, 30px)` }}>
        {Array.from({ length: house.rows }, (_, r) => (
          <PlanRow key={r} r={r + 1} layout={layout} max={max} colorBy={colorBy} selected={selected} onPick={onPick} />
        ))}
      </div>
    </div>
  );
}
function PlanRow({ r, layout, max, colorBy, selected, onPick }) {
  const per = layout.house.plants_per_row;
  const row = layout.plants.slice((r - 1) * per, r * per);
  return (
    <>
      <span className="gh-plan-row">R{r}</span>
      {row.map((p) => (
        <button
          key={p.plant} type="button" role="gridcell" className={`gh-plan-cell ${selected?.row === p.row && selected?.plant === p.plant ? 'sel' : ''}`}
          style={{ background: markerColor(p, colorBy, max) }} onClick={() => onPick(p)}
          title={`${p.row_id} ${p.plant_label}${p.latest ? `: ${p.latest.recorded_count}` : ''}`} aria-label={`${p.row_id} ${p.plant_label}${p.latest ? `, ${p.latest.recorded_count} fruit` : `, ${t('not counted yet')}`}`}
        >{p.latest ? p.latest.recorded_count : ''}</button>
      ))}
    </>
  );
}

/** Set up or change a greenhouse: its size, rows, plants per row, and the crop. */
function HouseForm({ crops, editing, onClose, onSaved }) {
  const toast = useToast();
  const { addHouse, updateHouse } = useGhMutations();
  const form = useForm(editing ? {
    name: editing.name, length_m: String(editing.length_m), width_m: String(editing.width_m), rows: String(editing.rows), plants_per_row: String(editing.plants_per_row),
    crop_id: editing.crop_id || '', row_crops: editing.row_crops || [],
  } : { name: '', length_m: '', width_m: '', rows: '', plants_per_row: '', crop_id: crops[0]?.id || '', row_crops: [] });
  const [err, setErr] = useState('');
  const [mixed, setMixed] = useState((editing?.row_crops || []).some(Boolean));
  const v = form.values;
  const rows = Number(v.rows) || 0;
  const plants = rows * (Number(v.plants_per_row) || 0);
  const saving = addHouse.isPending || updateHouse.isPending;
  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    const body = {
      name: v.name, length_m: Number(v.length_m), width_m: Number(v.width_m), rows: Number(v.rows), plants_per_row: Number(v.plants_per_row),
      crop_id: v.crop_id || null, row_crops: mixed ? Array.from({ length: rows }, (_, i) => v.row_crops[i] || '') : [],
    };
    try {
      const saved = editing ? await updateHouse.mutateAsync({ id: editing.id, ...body }) : await addHouse.mutateAsync(body);
      toast(t('Greenhouse saved'));
      onSaved(saved);
    } catch (e2) { setErr(e2.message || t('Could not save')); }
  };
  const cropOptions = crops.map((c) => ({ value: c.id, label: c.name }));
  return (
    <Modal
      open onClose={onClose} title={editing ? 'Change the greenhouse layout' : 'Set up a greenhouse'} size="modal-lg"
      footer={(
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>{t('Cancel')}</button>
          <button type="submit" form="gh-house-form" className="btn btn-primary" disabled={saving}><i className="fas fa-save" /> {saving ? t('Saving...') : t('Save greenhouse')}</button>
        </>
      )}
    >
      <form id="gh-house-form" onSubmit={submit}>
        {err && <div className="alert-item alert-danger" style={{ marginBottom: 14 }}><i className="fas fa-exclamation-circle" /><div className="alert-content">{err}</div></div>}
        <FormRow>
          <TextField label="Greenhouse name" required {...form.bind('name')} placeholder="e.g. House 1" />
          <SelectField label="Main crop" {...form.bind('crop_id')} placeholder="Choose a crop" options={cropOptions} />
        </FormRow>
        <FormRow>
          <NumberField label="Length in metres" required {...form.bind('length_m')} min="1" max="500" placeholder="e.g. 30" />
          <NumberField label="Width in metres" required {...form.bind('width_m')} min="1" max="200" placeholder="e.g. 8" />
        </FormRow>
        <FormRow>
          <NumberField label="Number of rows" required {...form.bind('rows')} step="1" min="1" max="100" placeholder="e.g. 6" />
          <NumberField label="Plants in each row" required {...form.bind('plants_per_row')} step="1" min="1" max="300" placeholder="e.g. 40" />
        </FormRow>
        {plants > 0 && <p className="form-hint">{t('This greenhouse will have')} {formatNumber(plants)} {t('plants')}. {t('They are named R1 P1, R1 P2 and so on: row first, then the plant in the row, counted from the entrance end.')}</p>}
        {crops.length > 0 && rows > 0 && rows <= 100 && (
          <label className="gh-check"><input type="checkbox" checked={mixed} onChange={(e) => setMixed(e.target.checked)} /> {t('Some rows have a different crop')}</label>
        )}
        {mixed && rows > 0 && (
          <div className="gh-rowcrops">
            {Array.from({ length: rows }, (_, i) => (
              <label key={i} className="gh-rowcrop"><span>R{i + 1}</span>
                <select className="form-control" value={v.row_crops[i] || ''} onChange={(e) => { const next = [...v.row_crops]; next[i] = e.target.value; form.set('row_crops', next); }}>
                  <option value="">{t('Main crop')}</option>
                  {cropOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
            ))}
          </div>
        )}
      </form>
    </Modal>
  );
}

/** What is known about the chosen plant, and the way to record a count on it. */
function PlantPanel({ house, plant, onRecord, onClose }) {
  const { data, isLoading } = useGhPlant(house.id, plant.row, plant.plant);
  return (
    <aside className="gh-side" aria-live="polite">
      <div className="gh-side-head">
        <div>
          <h4>{plant.row_id} {plant.plant_label}</h4>
          <span className="org-muted">{house.name}{plant.crop_name ? ` · ${plant.crop_name}` : ''}</span>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} aria-label={t('Close')}><i className="fas fa-xmark" /></button>
      </div>
      <button type="button" className="btn btn-primary" style={{ width: '100%', marginBottom: 12 }} onClick={() => onRecord(plant)}><i className="fas fa-camera" /> {t('Record a count on this plant')}</button>
      {isLoading ? <Loading /> : !data?.data?.length ? (
        <p className="org-muted">{t('No fruit counted on this plant yet.')}</p>
      ) : (
        <ul className="gh-hist">
          {data.data.map((c) => {
            const m = VERDICTS[c.verification?.status || 'not_checked'];
            return (
              <li key={c.id}>
                {c.photo_url && <a href={c.annotated_url || c.photo_url} target="_blank" rel="noreferrer"><img src={c.annotated_url || c.photo_url} alt="" /></a>}
                <div>
                  <strong>{c.recorded_count}</strong> {t('fruit')}
                  <div className="org-muted">{formatDate(c.count_date)}{c.verification?.detected != null ? ` · ${t('photo shows')} ${c.verification.detected}` : ''}</div>
                  <span className={`badge badge-${m.tone}`}><i className={`fas ${m.icon}`} /> {t(m.label)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

export default function LayoutTab() {
  const toast = useToast();
  const confirm = useConfirm();
  const { data: houses = [], isLoading } = useGhHouses();
  const { data: crops = [] } = useGhCrops();
  const { removeHouse } = useGhMutations();
  const [houseId, setHouseId] = useState('');
  const [view, setView] = useState(() => (webglAvailable() ? '3d' : 'plan'));
  const [colorBy, setColorBy] = useState('status');
  const [mode, setMode] = useState('look'); // look: click a plant to see it. record: click a plant to record a count on it
  const [selected, setSelected] = useState(null);
  const [camera, setCamera] = useState('default'); // default | top | side
  const [focusKey, setFocusKey] = useState('');
  const [form, setForm] = useState(null); // 'new' | house
  const [recording, setRecording] = useState(null);
  const house = useMemo(() => houses.find((h) => h.id === houseId) || houses[0], [houses, houseId]);
  const { data: layout, isLoading: loadingLayout, refetch } = useGhLayout(house?.id);
  useEffect(() => { setSelected(null); }, [house?.id]);

  if (isLoading) return <Loading />;
  if (!crops.length) return <EmptyState icon="fa-seedling" title="Choose the crops you grow first" description="Pick your greenhouse crops under My crops, then set up the greenhouse layout." />;
  if (!houses.length) {
    return (
      <>
        <EmptyState icon="fa-cube" title="Set up your first greenhouse" description="Say how big it is and how many rows and plants it has. You then get a 3D view where every plant has its place, and the same view is used to record counts." actionLabel="Set up a greenhouse" onAction={() => setForm('new')} />
        {form && <HouseForm crops={crops} onClose={() => setForm(null)} onSaved={(h) => { setForm(null); setHouseId(h.id); }} />}
      </>
    );
  }
  const pick = (p) => {
    setSelected({ row: p.row, plant: p.plant });
    if (mode === 'record') setRecording(p);
  };
  const plant = selected && layout?.plants.find((p) => p.row === selected.row && p.plant === selected.plant);
  const s = layout?.summary;
  const remove = async () => {
    if (!(await confirm(t('Remove this greenhouse layout? Your fruit counts stay.')))) return;
    try { await removeHouse.mutateAsync(house.id); setHouseId(''); toast(t('Layout removed')); } catch (e) { toast(e.message, 'error'); }
  };
  return (
    <>
      <div className="gh-toolbar">
        <select className="form-control" value={house.id} onChange={(e) => setHouseId(e.target.value)} aria-label={t('Greenhouse')}>
          {houses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
        <div className="gh-seg" role="group" aria-label={t('View')}>
          <button type="button" className={view === '3d' ? 'on' : ''} onClick={() => setView('3d')} disabled={!webglAvailable()}><i className="fas fa-cube" /> 3D</button>
          <button type="button" className={view === 'plan' ? 'on' : ''} onClick={() => setView('plan')}><i className="fas fa-table-cells" /> {t('Plan')}</button>
        </div>
        <div className="gh-seg" role="group" aria-label={t('Colour by')}>
          <button type="button" className={colorBy === 'status' ? 'on' : ''} onClick={() => setColorBy('status')}>{t('Photo check')}</button>
          <button type="button" className={colorBy === 'fruit' ? 'on' : ''} onClick={() => setColorBy('fruit')}>{t('Fruit count')}</button>
        </div>
        <div className="gh-seg" role="group" aria-label={t('Clicking a plant')}>
          <button type="button" className={mode === 'look' ? 'on' : ''} onClick={() => setMode('look')}><i className="fas fa-eye" /> {t('Look')}</button>
          <button type="button" className={mode === 'record' ? 'on' : ''} onClick={() => setMode('record')}><i className="fas fa-camera" /> {t('Record')}</button>
        </div>
        {view === '3d' && (
          <div className="gh-seg" role="group" aria-label={t('Camera')}>
            <button type="button" className={camera === 'default' ? 'on' : ''} onClick={() => { setCamera('default'); setFocusKey(''); }}>{t('Reset')}</button>
            <button type="button" className={camera === 'top' ? 'on' : ''} onClick={() => setCamera('top')}>{t('From above')}</button>
            <button type="button" className={camera === 'side' ? 'on' : ''} onClick={() => setCamera('side')}>{t('Along a row')}</button>
            <button type="button" disabled={!selected} onClick={() => { setCamera('default'); setFocusKey(`${selected.row}-${selected.plant}-${Date.now()}`); }}>{t('Zoom to plant')}</button>
          </div>
        )}
        <span className="gh-toolbar-sp" />
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setForm(house)}><i className="fas fa-pen" /> {t('Layout')}</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={remove}><i className="fas fa-trash" /></button>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setForm('new')}><i className="fas fa-plus" /> {t('New greenhouse')}</button>
      </div>

      {s && (
        <div className="gh-stats">
          <span><strong>{formatNumber(s.plants)}</strong> {t('plants')}</span>
          <span><strong>{formatNumber(s.counted)}</strong> {t('counted')}</span>
          <span><strong>{formatNumber(s.not_counted)}</strong> {t('not counted yet')}</span>
          <span><strong>{formatNumber(s.fruit)}</strong> {t('fruit')}</span>
          <span><strong>{s.average_per_counted_plant}</strong> {t('per counted plant')}</span>
        </div>
      )}

      <div className="gh-stage">
        <div className="gh-stage-main">
          {loadingLayout || !layout ? <Loading /> : view === '3d' && webglAvailable() ? (
            <Suspense fallback={<Loading />}><Scene layout={layout} colorBy={colorBy} selected={selected} onPick={pick} view={camera} focusKey={focusKey} /></Suspense>
          ) : (
            <Plan layout={layout} colorBy={colorBy} selected={selected} onPick={pick} />
          )}
          <div className="gh-legend">
            {colorBy === 'status' ? LEGEND.map(([k, label]) => <span key={k}><i style={{ background: STATUS_COLOR[k] }} />{t(label)}</span>)
              : <span>{t('Lighter is less fruit, red is the most fruit on one plant. Grey is not counted yet.')}</span>}
            {view === '3d' && <span className="gh-hint">{t('Drag to turn, scroll to zoom, click a plant.')}</span>}
          </div>
        </div>
        {plant && <PlantPanel house={house} plant={plant} onClose={() => setSelected(null)} onRecord={setRecording} />}
      </div>

      {form && <HouseForm crops={crops} editing={form === 'new' ? null : form} onClose={() => setForm(null)} onSaved={(h) => { setForm(null); setHouseId(h.id); refetch(); }} />}
      {recording && (
        <CountForm
          crops={crops} onClose={() => setRecording(null)} onSaved={() => refetch()}
          preset={{ greenhouse: house.name, row_id: recording.row_id, plant_label: recording.plant_label, crop_id: recording.crop_id }}
        />
      )}
    </>
  );
}
