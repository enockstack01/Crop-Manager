import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { EmptyState, Loading } from '../components/ui.jsx';
import { Modal } from '../components/Modal.jsx';
import { FormRow, NumberField, SelectField, TextArea, TextField, useForm } from '../components/form.jsx';
import { useConfirm } from '../components/Confirm.jsx';
import { useToast } from '../components/Toast.jsx';
import { PlanMap } from '../components/PlanMap.jsx';
import { HEALTH_COLOR, STATUS_COLOR, webglAvailable } from '../lib/greenhouseColors.js';
import { PATTERN_LABELS, positionsOf, rowDefsOf, totalPositions } from '../lib/greenhouseLayout.js';
import { formatDate, formatNumber } from '../lib/format.js';
import { useGhCrops, useGhHouses, useGhLayout, useGhMutations, useGhPlant, useGhPositionLog, VERDICTS } from '../lib/greenhouse.js';
import { CountForm } from './Greenhouse.jsx';
import { HealthCard, HEALTH } from '../components/HealthCard.jsx';
import { t } from '../i18n/index.js';

const Scene = lazy(() => import('../components/GreenhouseScene.jsx'));
const HEALTH_LEGEND = [['healthy', 'Healthy'], ['sick', 'Possible disease'], ['unsure', 'Not sure'], ['not_checked', 'Disease not checked'], ['none', 'Not counted yet']];
const LEGEND = [['match', 'Matches'], ['close', 'Close'], ['mismatch', 'Does not match'], ['inconclusive', 'Not sure'], ['not_checked', 'Not checked'], ['none', 'Not counted yet']];
const STATE_LEGEND = [['frozen', 'Frozen'], ['inactive', 'Deactivated']];
const WALLS = [{ value: 'bottom', label: 'Bottom wall' }, { value: 'top', label: 'Top wall' }, { value: 'left', label: 'Left wall' }, { value: 'right', label: 'Right wall' }];
const COMPASS = [['N', 0], ['E', 90], ['S', 180], ['W', 270]];

/** Set up or change a greenhouse: size, direction, door, rows (each its own length, with optional sub rows A and B), planting pattern and spacing. */
function HouseForm({ crops, editing, onClose, onSaved }) {
  const toast = useToast();
  const { addHouse, updateHouse } = useGhMutations();
  const form = useForm(editing ? {
    name: editing.name, length_m: String(editing.length_m), width_m: String(editing.width_m), rows: String(editing.rows), plants_per_row: String(editing.plants_per_row),
    crop_id: editing.crop_id || '', orientation_deg: String(editing.orientation_deg || 0), pattern: editing.pattern || 'grid',
    door_wall: editing.door?.wall || 'bottom', door_position: String(Math.round((editing.door?.position ?? 0.5) * 100)), door_width: String(editing.door?.width_m ?? 1.2),
    plant_spacing_m: editing.plant_spacing_m ? String(editing.plant_spacing_m) : '', row_spacing_m: editing.row_spacing_m ? String(editing.row_spacing_m) : '',
  } : { name: '', length_m: '', width_m: '', rows: '', plants_per_row: '', crop_id: crops[0]?.id || '', orientation_deg: '0', pattern: 'grid', door_wall: 'bottom', door_position: '50', door_width: '1.2', plant_spacing_m: '', row_spacing_m: '' });
  const [err, setErr] = useState('');
  const [mixed, setMixed] = useState((editing?.row_crops || []).some(Boolean));
  const [rowCrops, setRowCrops] = useState(editing?.row_crops || []);
  const [hasDoor, setHasDoor] = useState(editing ? !!editing.door : true);
  const [customSpacing, setCustomSpacing] = useState(!!(editing?.plant_spacing_m || editing?.row_spacing_m));
  const [defs, setDefs] = useState(() => (editing ? rowDefsOf(editing) : []));
  const v = form.values;
  const rows = Number(v.rows) || 0;
  const per = Number(v.plants_per_row) || 0;
  const saving = addHouse.isPending || updateHouse.isPending;

  // the rows follow the "number of rows" and "plants in each row" boxes; each row can then be changed on its own
  const shaped = useMemo(() => Array.from({ length: Math.min(rows, 100) }, (_x, i) => defs[i] || { plants: per, start: 0, sub_rows: 1 }), [defs, rows, per]);
  const setRow = (i, patch) => setDefs(shaped.map((d, k) => (k === i ? { ...d, ...patch } : d)));
  const applyAll = () => setDefs(shaped.map((d) => ({ ...d, plants: per })));
  const door = hasDoor ? { wall: v.door_wall, position: Math.min(100, Math.max(0, Number(v.door_position) || 0)) / 100, width_m: Number(v.door_width) || 1.2 } : null;
  const preview = useMemo(() => {
    const L = Number(v.length_m);
    const W = Number(v.width_m);
    if (!(L > 0) || !(W > 0) || rows < 1 || rows > 100 || shaped.some((d) => !Number.isInteger(d.plants))) return null;
    const house = {
      length_m: L, width_m: W, rows, plants_per_row: Math.max(1, ...shaped.map((d) => d.plants)), row_defs: shaped, orientation_deg: Number(v.orientation_deg) || 0, door, pattern: v.pattern,
      plant_spacing_m: customSpacing && Number(v.plant_spacing_m) > 0 ? Number(v.plant_spacing_m) : null, row_spacing_m: customSpacing && Number(v.row_spacing_m) > 0 ? Number(v.row_spacing_m) : null,
    };
    if (totalPositions(house) > 6000) return { house, plants: [], tooMany: true };
    return { house, plants: positionsOf(house) };
  }, [v, rows, shaped, door, customSpacing]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    const body = {
      name: v.name, length_m: Number(v.length_m), width_m: Number(v.width_m), row_defs: shaped, crop_id: v.crop_id || null,
      row_crops: mixed ? Array.from({ length: rows }, (_x, i) => rowCrops[i] || '') : [],
      orientation_deg: Number(v.orientation_deg) || 0, door, pattern: v.pattern,
      plant_spacing_m: customSpacing && v.plant_spacing_m ? Number(v.plant_spacing_m) : null, row_spacing_m: customSpacing && v.row_spacing_m ? Number(v.row_spacing_m) : null,
    };
    try {
      const saved = editing ? await updateHouse.mutateAsync({ id: editing.id, ...body }) : await addHouse.mutateAsync(body);
      toast(t('Greenhouse saved'));
      onSaved(saved);
    } catch (e2) { setErr(e2.message || t('Could not save')); }
  };
  const cropOptions = crops.map((c) => ({ value: c.id, label: c.name }));
  const total = preview ? totalPositions(preview.house) : 0;
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
          <NumberField label="Plants in each row" required {...form.bind('plants_per_row')} step="1" min="0" max="300" placeholder="e.g. 40" />
        </FormRow>

        <div className="farm-profile-section">{t('Direction and door')}</div>
        <FormRow>
          <div className="form-group">
            <label className="form-label" htmlFor="gh-dir">{t('Which way does the top wall of the plan face? (compass degrees)')}</label>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <input id="gh-dir" className="form-control" style={{ width: 90 }} type="number" min="0" max="359" step="1" value={v.orientation_deg} onChange={(e) => form.set('orientation_deg', e.target.value)} />
              {COMPASS.map(([n, d]) => <button key={n} type="button" className={`btn btn-sm ${Number(v.orientation_deg) === d ? 'btn-primary' : 'btn-secondary'}`} onClick={() => form.set('orientation_deg', String(d))}>{n}</button>)}
            </div>
            <div className="form-hint">{t('0 is north, 90 east, 180 south, 270 west. The red N on the plan points north.')}</div>
          </div>
          <SelectField label="How the plants stand" {...form.bind('pattern')} options={Object.entries(PATTERN_LABELS).map(([value, label]) => ({ value, label }))} />
        </FormRow>
        <label className="gh-check"><input type="checkbox" checked={hasDoor} onChange={(e) => setHasDoor(e.target.checked)} /> {t('The greenhouse has a door')}</label>
        {hasDoor && (
          <FormRow>
            <SelectField label="Wall of the door" {...form.bind('door_wall')} options={WALLS} />
            <NumberField label="Where along the wall (%)" {...form.bind('door_position')} min="0" max="100" step="1" hint="0 is the start of the wall, 100 the end" />
            <NumberField label="Door width in metres" {...form.bind('door_width')} min="0.5" max="10" step="0.1" />
          </FormRow>
        )}

        <div className="farm-profile-section">{t('Spacing')}</div>
        <label className="gh-check"><input type="checkbox" checked={customSpacing} onChange={(e) => setCustomSpacing(e.target.checked)} /> {t('Set the distances myself (otherwise plants and rows are spread evenly over the greenhouse)')}</label>
        {customSpacing && (
          <FormRow>
            <NumberField label="Distance between plants in a row (m)" {...form.bind('plant_spacing_m')} min="0.05" max="20" step="0.05" />
            <NumberField label="Distance between rows (m)" {...form.bind('row_spacing_m')} min="0.1" max="20" step="0.05" />
          </FormRow>
        )}

        {rows > 0 && rows <= 100 && (
          <>
            <div className="farm-profile-section">{t('Rows')}</div>
            <p className="form-hint" style={{ marginTop: 0 }}>{t('A row can be shorter or longer, can start further along the house, and can be a double row: two sub rows A and B side by side on the same line.')}</p>
            <div className="gh-rowdefs">
              <div className="gh-rowdef head"><span>{t('Row')}</span><span>{t('Plant positions')}</span><span>{t('Starts after')}</span><span>{t('Double row (A and B)')}</span>{crops.length > 0 && mixed ? <span>{t('Crop')}</span> : null}</div>
              {shaped.map((d, i) => (
                <div className="gh-rowdef" key={i}>
                  <span><strong>R{i + 1}</strong></span>
                  <input className="form-control" type="number" min="0" max="300" step="1" value={d.plants} onChange={(e) => setRow(i, { plants: e.target.value === '' ? 0 : Number(e.target.value) })} aria-label={`R${i + 1} ${t('plant positions')}`} />
                  <input className="form-control" type="number" min="0" max="300" step="1" value={d.start} onChange={(e) => setRow(i, { start: e.target.value === '' ? 0 : Number(e.target.value) })} aria-label={`R${i + 1} ${t('starts after')}`} />
                  <input type="checkbox" checked={d.sub_rows === 2} onChange={(e) => setRow(i, { sub_rows: e.target.checked ? 2 : 1 })} aria-label={`R${i + 1} ${t('double row')}`} />
                  {crops.length > 0 && mixed ? (
                    <select className="form-control" value={rowCrops[i] || ''} onChange={(e) => { const next = [...rowCrops]; next[i] = e.target.value; setRowCrops(next); }}>
                      <option value="">{t('Main crop')}</option>
                      {cropOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : null}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', margin: '8px 0' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={applyAll}>{t('Give every row {{n}} positions', { n: per })}</button>
              {crops.length > 0 && <label className="gh-check" style={{ margin: 0 }}><input type="checkbox" checked={mixed} onChange={(e) => setMixed(e.target.checked)} /> {t('Some rows have a different crop')}</label>}
            </div>
          </>
        )}
        {preview && (
          <>
            <div className="farm-profile-section">{t('Preview')}</div>
            {preview.tooMany ? <div className="alert-item alert-danger"><i className="fas fa-exclamation-circle" /><div className="alert-content">{t('A greenhouse can hold at most 6000 plants in the layout. Split a very large house in two.')}</div></div> : (
              <>
                <p className="form-hint" style={{ marginTop: 0 }}>{t('This greenhouse will have')} {formatNumber(total)} {t('plant positions')}. {t('They are named R1 P1, R1 P2 and so on. In a double row they are R1A P1 and R1B P1.')}</p>
                <PlanMap layout={{ house: preview.house, plants: preview.plants }} colorBy="status" />
              </>
            )}
          </>
        )}
      </form>
    </Modal>
  );
}

/** Asks why before a plant is frozen or a position deactivated: the reason is kept with who did it and when. */
function StateDialog({ house, plant, state, onClose }) {
  const toast = useToast();
  const { setPosition } = useGhMutations();
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const text = {
    frozen: { title: 'Freeze this plant', hint: 'Freeze a diseased plant that should be left alone. It stays on the plan and can still be recorded.', ph: 'e.g. Late blight, wait until the spray works' },
    inactive: { title: 'Deactivate this position', hint: 'Deactivate a position where the plant was uprooted. It is no longer expected to be counted, and takes no new counts.', ph: 'e.g. Uprooted after wilt' },
    active: { title: 'Reactivate this position', hint: 'The plant is back in use: it is expected to be counted again.', ph: 'e.g. Replanted (optional)' },
  }[state];
  const go = async (e) => {
    e.preventDefault();
    if (state !== 'active' && !reason.trim()) { setErr(t('Please say why. The reason is kept with the change.')); return; }
    try {
      await setPosition.mutateAsync({ id: house.id, row_id: plant.row_id, plant_label: plant.plant_label, state, reason: reason.trim() });
      toast(t('Saved'));
      onClose(true);
    } catch (e2) { setErr(e2.message); }
  };
  return (
    <Modal
      open onClose={() => onClose(false)} title={`${t(text.title)}: ${plant.row_id} ${plant.plant_label}`}
      footer={(
        <>
          <button type="button" className="btn btn-secondary" onClick={() => onClose(false)}>{t('Cancel')}</button>
          <button type="submit" form="gh-state-form" className="btn btn-primary" disabled={setPosition.isPending}>{t('Save')}</button>
        </>
      )}
    >
      <form id="gh-state-form" onSubmit={go}>
        {err && <div className="alert-item alert-danger" style={{ marginBottom: 12 }}><i className="fas fa-exclamation-circle" /><div className="alert-content">{err}</div></div>}
        <p className="ai-lead" style={{ marginTop: 0 }}>{t(text.hint)}</p>
        <TextArea label={state === 'active' ? 'Reason (optional)' : 'Reason (required)'} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder={text.ph} maxLength={300} />
      </form>
    </Modal>
  );
}

/** Adds plant positions to the end of a row. */
function AddPositionsDialog({ house, layout, onClose }) {
  const toast = useToast();
  const { addPositions } = useGhMutations();
  const ids = [...new Set(layout.plants.map((p) => (p.sub ? `R${p.row}` : p.row_id)))];
  const [row, setRow] = useState(ids[0] || 'R1');
  const [count, setCount] = useState('1');
  const [err, setErr] = useState('');
  const doubles = layout.plants.some((p) => p.row === Number(row.slice(1)) && p.sub);
  const go = async (e) => {
    e.preventDefault();
    try {
      await addPositions.mutateAsync({ id: house.id, row_id: doubles ? `${row}A` : row, count: Number(count) });
      toast(t('Plant positions added'));
      onClose();
    } catch (e2) { setErr(e2.message); }
  };
  return (
    <Modal open onClose={onClose} title="Add plant positions" footer={<><button type="button" className="btn btn-secondary" onClick={onClose}>{t('Cancel')}</button><button type="submit" form="gh-add-form" className="btn btn-primary" disabled={addPositions.isPending}>{t('Add')}</button></>}>
      <form id="gh-add-form" onSubmit={go}>
        {err && <div className="alert-item alert-danger" style={{ marginBottom: 12 }}><i className="fas fa-exclamation-circle" /><div className="alert-content">{err}</div></div>}
        <FormRow>
          <SelectField label="Add to row" value={row} onChange={(e) => setRow(e.target.value)} options={ids.map((i) => ({ value: i, label: i }))} />
          <NumberField label="How many new positions" value={count} onChange={(e) => setCount(e.target.value)} min="1" max="50" step="1" />
        </FormRow>
        <p className="form-hint">{t('The new positions are added at the end of the row and numbered after the last plant. In a double row both sub rows grow.')}</p>
      </form>
    </Modal>
  );
}

/** The recent freezes, deactivations and additions of a greenhouse. */
function PositionLog({ house, onClose }) {
  const { data = [], isLoading } = useGhPositionLog(house.id);
  const WORD = { frozen: 'froze', inactive: 'deactivated', reactivated: 'reactivated', added: 'added positions to' };
  return (
    <Modal open onClose={onClose} title="History of changes" footer={<button type="button" className="btn btn-primary" onClick={onClose}>{t('Done')}</button>}>
      {isLoading ? <Loading /> : data.length === 0 ? <p className="org-muted">{t('Nothing has been frozen, deactivated or added yet.')}</p> : (
        <ul className="gh-health-hist">
          {data.map((e, i) => <li key={i}><span className="org-muted">{formatDate(e.at)}</span><span><strong>{e.by_name || t('Someone')}</strong> {t(WORD[e.action] || e.action)} {e.row_id}{e.plant_label ? ` ${e.plant_label}` : ''}{e.count ? ` (+${e.count})` : ''}{e.reason ? `: ${e.reason}` : ''}</span></li>)}
        </ul>
      )}
    </Modal>
  );
}

/** What is known about the chosen plant, and the way to record a count on it. */
function PlantPanel({ house, plant, role, onRecord, onClose, onState, onName }) {
  const { data, isLoading } = useGhPlant(house.id, plant.row, plant.plant, plant.sub || '');
  const showHealth = role !== 'collector';
  const inactive = plant.state === 'inactive';
  return (
    <aside className="gh-side" aria-live="polite">
      <div className="gh-side-head">
        <div>
          <h4>{plant.row_id} {plant.plant_label}{plant.label ? ` · ${plant.label}` : ''}</h4>
          <span className="org-muted">{house.name}{plant.crop_name ? ` · ${plant.crop_name}` : ''}</span>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} aria-label={t('Close')}><i className="fas fa-xmark" /></button>
      </div>
      {plant.state !== 'active' && (
        <div className={`alert-item ${inactive ? 'alert-warning' : 'alert-info'}`} style={{ marginBottom: 10 }}>
          <i className={`fas ${inactive ? 'fa-ban' : 'fa-snowflake'}`} />
          <div className="alert-content"><strong>{inactive ? t('Deactivated') : t('Frozen')}</strong>: {plant.state_reason}</div>
        </div>
      )}
      {!inactive && <button type="button" className="btn btn-primary" style={{ width: '100%', marginBottom: 8 }} onClick={() => onRecord(plant)}><i className="fas fa-camera" /> {t('Record a count on this plant')}</button>}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {plant.state === 'active' && <button type="button" className="btn btn-secondary btn-sm" onClick={() => onState('frozen')}><i className="fas fa-snowflake" /> {t('Freeze')}</button>}
        {plant.state !== 'inactive' && <button type="button" className="btn btn-secondary btn-sm" onClick={() => onState('inactive')}><i className="fas fa-ban" /> {t('Deactivate')}</button>}
        {plant.state !== 'active' && <button type="button" className="btn btn-secondary btn-sm" onClick={() => onState('active')}><i className="fas fa-rotate-left" /> {t('Reactivate')}</button>}
        <button type="button" className="btn btn-secondary btn-sm" onClick={onName}><i className="fas fa-tag" /> {t('Name it')}</button>
      </div>
      {showHealth && data?.data?.length > 0 && (<><div className="gh-side-title">{t('Health card')}</div><HealthCard health={data.data[0].verification?.health} /></>)}
      {showHealth && data?.data?.length > 1 && (
        <>
          <div className="gh-side-title">{t('Health history')}</div>
          <ul className="gh-health-hist">
            {data.data.filter((c) => c.verification?.health && c.verification.health.status !== 'not_checked').slice(0, 12).map((c) => {
              const hm = HEALTH[c.verification.health.status] || HEALTH.not_checked;
              return <li key={c.id}><span className="org-muted">{formatDate(c.count_date)}</span><span className={`badge badge-${hm.tone}`}>{t(hm.label)}</span><span>{c.verification.health.plant?.disease || ''}{c.verification.health.sick_fruit ? ` · ${c.verification.health.sick_fruit} ${t('fruit')}` : ''}</span></li>;
            })}
          </ul>
        </>
      )}
      <div className="gh-side-title">{role === 'collector' ? t('Your counts') : t('Counts')}</div>
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
                  <strong>{c.recorded_count}</strong> {t('fruit')}{c.fruit_size && c.fruit_size !== 'all' ? ` (${t(c.fruit_size)})` : ''}{c.label ? ` · ${c.label}` : ''}
                  <div className="org-muted">{formatDate(c.count_date)}{c.verification?.detected != null ? ` · ${t('photo shows')} ${c.verification.detected}` : ''}{(c.photo_urls || []).length > 1 ? ` · ${c.photo_urls.length} ${t('photos')}` : ''}</div>
                  <span className={`badge badge-${m.tone}`}><i className={`fas ${m.icon}`} /> {t(m.label)}</span>
                  {showHealth && c.verification?.health?.status === 'sick' && <span className="badge badge-danger" style={{ marginLeft: 4 }}><i className="fas fa-virus" /> {c.verification.health.plant?.disease || t('Possible disease')}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

export default function LayoutTab({ role = 'owner' }) {
  const toast = useToast();
  const confirm = useConfirm();
  const owner = role === 'owner';
  const collector = role === 'collector';
  const { data: houses = [], isLoading } = useGhHouses();
  const { data: crops = [] } = useGhCrops();
  const { removeHouse, setPosition } = useGhMutations();
  const [houseId, setHouseId] = useState('');
  const [view, setView] = useState(() => (!collector && webglAvailable() ? '3d' : 'plan'));
  const [colorBy, setColorBy] = useState('status');
  const [mode, setMode] = useState(collector ? 'record' : 'look'); // look: click a plant to see it. record: click a plant to record a count on it
  const [selected, setSelected] = useState(null);
  const [camera, setCamera] = useState('default'); // default | top | side
  const [focusKey, setFocusKey] = useState('');
  const [resetKey, setResetKey] = useState(0);
  const [form, setForm] = useState(null); // 'new' | house
  const [recording, setRecording] = useState(null);
  const [stateFor, setStateFor] = useState(null); // { plant, state }
  const [adding, setAdding] = useState(false);
  const [log, setLog] = useState(false);
  const house = useMemo(() => houses.find((h) => h.id === houseId) || houses[0], [houses, houseId]);
  const { data: layout, isLoading: loadingLayout, refetch } = useGhLayout(house?.id);
  useEffect(() => { setSelected(null); }, [house?.id]);

  if (isLoading) return <Loading />;
  if (!crops.length) return <EmptyState icon="fa-seedling" title={owner ? 'Choose the crops you grow first' : 'No crops yet'} description={owner ? 'Pick your greenhouse crops under My crops, then set up the greenhouse layout.' : 'The farm owner has not chosen the greenhouse crops yet.'} />;
  if (!houses.length) {
    return (
      <>
        <EmptyState icon="fa-cube" title="Set up your first greenhouse" description={owner ? 'Say how big it is, which way it faces, where the door is and how the rows run. You then get a 3D view where every plant has its place, and the same view is used to record counts.' : 'The farm owner has not set up a greenhouse yet.'} actionLabel={owner ? 'Set up a greenhouse' : undefined} onAction={owner ? () => setForm('new') : undefined} />
        {form && <HouseForm crops={crops} onClose={() => setForm(null)} onSaved={(h) => { setForm(null); setHouseId(h.id); }} />}
      </>
    );
  }
  const pick = (p) => {
    setSelected({ row_id: p.row_id, plant_label: p.plant_label, row: p.row, plant: p.plant });
    if (mode === 'record' && p.state !== 'inactive') setRecording(p);
  };
  const plant = selected && layout?.plants.find((p) => p.row_id === selected.row_id && p.plant_label === selected.plant_label);
  const s = layout?.summary;
  const remove = async () => {
    if (!(await confirm(t('Remove this greenhouse layout? Your fruit counts stay.')))) return;
    try { await removeHouse.mutateAsync(house.id); setHouseId(''); toast(t('Layout removed')); } catch (e) { toast(e.message, 'error'); }
  };
  const name = async () => {
    const label = window.prompt(t('Give this plant a name (leave empty to clear it)'), plant.label || '');
    if (label === null) return;
    try { await setPosition.mutateAsync({ id: house.id, row_id: plant.row_id, plant_label: plant.plant_label, label }); toast(t('Saved')); } catch (e) { toast(e.message, 'error'); }
  };
  const show3d = view === '3d' && webglAvailable() && !collector;
  return (
    <>
      <div className="gh-toolbar">
        <select className="form-control" value={house.id} onChange={(e) => setHouseId(e.target.value)} aria-label={t('Greenhouse')}>
          {houses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
        {!collector && (
          <div className="gh-seg" role="group" aria-label={t('View')}>
            <button type="button" className={view === '3d' ? 'on' : ''} onClick={() => setView('3d')} disabled={!webglAvailable()}><i className="fas fa-cube" /> 3D</button>
            <button type="button" className={view === 'plan' ? 'on' : ''} onClick={() => setView('plan')}><i className="fas fa-table-cells" /> {t('Plan')}</button>
          </div>
        )}
        <div className="gh-seg" role="group" aria-label={t('Colour by')}>
          <button type="button" className={colorBy === 'status' ? 'on' : ''} onClick={() => setColorBy('status')}>{t('Photo check')}</button>
          <button type="button" className={colorBy === 'fruit' ? 'on' : ''} onClick={() => setColorBy('fruit')}>{t('Fruit count')}</button>
          {!collector && <button type="button" className={colorBy === 'health' ? 'on' : ''} onClick={() => setColorBy('health')}>{t('Health')}</button>}
        </div>
        <div className="gh-seg" role="group" aria-label={t('Clicking a plant')}>
          <button type="button" className={mode === 'look' ? 'on' : ''} onClick={() => setMode('look')}><i className="fas fa-eye" /> {t('Look')}</button>
          <button type="button" className={mode === 'record' ? 'on' : ''} onClick={() => setMode('record')}><i className="fas fa-camera" /> {t('Record')}</button>
        </div>
        {show3d && (
          <div className="gh-seg" role="group" aria-label={t('Camera')}>
            <button type="button" className={camera === 'default' ? 'on' : ''} onClick={() => { setCamera('default'); setFocusKey(''); setResetKey((k) => k + 1); }}>{t('Reset')}</button>
            <button type="button" className={camera === 'top' ? 'on' : ''} onClick={() => setCamera('top')}>{t('From above')}</button>
            <button type="button" className={camera === 'side' ? 'on' : ''} onClick={() => setCamera('side')}>{t('Along a row')}</button>
            <button type="button" disabled={!selected} onClick={() => { setCamera('default'); setFocusKey(`${selected.row_id}-${selected.plant_label}-${Date.now()}`); }}>{t('Zoom to plant')}</button>
          </div>
        )}
        <span className="gh-toolbar-sp" />
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAdding(true)}><i className="fas fa-plus" /> {t('Add plant positions')}</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setLog(true)} title={t('History of changes')}><i className="fas fa-clock-rotate-left" /></button>
        {owner && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setForm(house)}><i className="fas fa-pen" /> {t('Layout')}</button>}
        {owner && <button type="button" className="btn btn-secondary btn-sm" onClick={remove}><i className="fas fa-trash" /></button>}
        {owner && <button type="button" className="btn btn-primary btn-sm" onClick={() => setForm('new')}><i className="fas fa-plus" /> {t('New greenhouse')}</button>}
      </div>

      {s && (
        <div className="gh-stats">
          <span><strong>{formatNumber(s.plants)}</strong> {t('plant positions')}</span>
          <span><strong>{formatNumber(s.counted)}</strong> {t('counted')}</span>
          <span><strong>{formatNumber(s.not_counted)}</strong> {t('not counted yet')}</span>
          {s.frozen > 0 && <span><strong>{formatNumber(s.frozen)}</strong> {t('frozen')}</span>}
          {s.inactive > 0 && <span><strong>{formatNumber(s.inactive)}</strong> {t('deactivated')}</span>}
          <span><strong>{formatNumber(s.fruit)}</strong> {t('fruit')}</span>
          {!collector && <span><strong>{formatNumber(s.sick_plants || 0)}</strong> {t('plants with possible disease')}</span>}
          <span><strong>{s.average_per_counted_plant}</strong> {t('per counted plant')}</span>
        </div>
      )}

      <div className="gh-stage">
        <div className="gh-stage-main">
          {loadingLayout || !layout ? <Loading /> : show3d ? (
            <Suspense fallback={<Loading />}><Scene layout={layout} colorBy={colorBy} selected={selected} onPick={pick} view={camera} focusKey={focusKey} resetKey={resetKey} /></Suspense>
          ) : (
            <PlanMap layout={layout} colorBy={colorBy} selected={selected} onPick={pick} />
          )}
          <div className="gh-legend">
            {colorBy === 'status' ? LEGEND.map(([k, label]) => <span key={k}><i style={{ background: STATUS_COLOR[k] }} />{t(label)}</span>)
              : colorBy === 'health' ? HEALTH_LEGEND.map(([k, label]) => <span key={k}><i style={{ background: HEALTH_COLOR[k] }} />{t(label)}</span>)
              : <span>{t('Lighter is less fruit, red is the most fruit on one plant. Grey is not counted yet.')}</span>}
            {STATE_LEGEND.map(([k, label]) => <span key={k}><i style={{ background: STATUS_COLOR[k] }} />{t(label)}</span>)}
            {show3d && <span className="gh-hint">{t('Drag to turn, scroll to zoom, click a plant.')}</span>}
          </div>
        </div>
        {plant && <PlantPanel house={house} plant={plant} role={role} onClose={() => setSelected(null)} onRecord={setRecording} onState={(state) => setStateFor({ plant, state })} onName={name} />}
      </div>

      {form && <HouseForm crops={crops} editing={form === 'new' ? null : form} onClose={() => setForm(null)} onSaved={(h) => { setForm(null); setHouseId(h.id); refetch(); }} />}
      {stateFor && <StateDialog house={house} plant={stateFor.plant} state={stateFor.state} onClose={() => { setStateFor(null); refetch(); }} />}
      {adding && layout && <AddPositionsDialog house={house} layout={layout} onClose={() => { setAdding(false); refetch(); }} />}
      {log && <PositionLog house={house} onClose={() => setLog(false)} />}
      {recording && (
        <CountForm
          crops={crops} onClose={() => setRecording(null)} onSaved={() => refetch()}
          preset={{ greenhouse: house.name, row_id: recording.row_id, plant_label: recording.plant_label, crop_id: recording.crop_id }}
        />
      )}
    </>
  );
}
