import { useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { DataTable, EmptyState, FilterSelect, Loading, PageHeader, Pagination } from '../components/ui.jsx';
import { Modal } from '../components/Modal.jsx';
import { FormRow, NumberField, SelectField, TextArea, TextField, DateField, useForm } from '../components/form.jsx';
import { PhotoUpload } from '../components/PhotoUpload.jsx';
import { useConfirm } from '../components/Confirm.jsx';
import { useToast } from '../components/Toast.jsx';
import { baseOptions, breakdownOptions, LEAF, useIsDark } from '../features/dashboard/charts.jsx';
import { formatDate, formatNumber } from '../lib/format.js';
import { useGhCatalog, useGhCounts, useGhCrops, useGhDashboard, useGhMutations, VERDICTS } from '../lib/greenhouse.js';
import { t } from '../i18n/index.js';
import LayoutTab from './GreenhouseLayout.jsx';
import { HealthCard } from '../components/HealthCard.jsx';

const TABS = [
  { id: 'dashboard', icon: 'fa-chart-column', label: 'Dashboard' },
  { id: 'layout', icon: 'fa-cube', label: 'Layout and 3D' },
  { id: 'counts', icon: 'fa-camera', label: 'Fruit counts' },
  { id: 'crops', icon: 'fa-seedling', label: 'My crops' },
];
const COLOR_HEX = { red: '#C62828', orange: '#EF6C00', yellow: '#F9A825', purple: '#5E35B1', green: '#7CB342' };
const today = () => new Date().toISOString().slice(0, 10);

function Verdict({ v }) {
  const m = VERDICTS[v?.status || 'not_checked'];
  return <span className={`badge badge-${m.tone}`}><i className={`fas ${m.icon}`} /> {t(m.label)}</span>;
}

function Card({ title, icon, children, right }) {
  return (
    <div className="chart-card" style={{ marginBottom: 20 }}>
      <div className="chart-card-header">
        <h3><i className={`fas ${icon}`} style={{ color: 'var(--primary)', marginRight: 8 }} />{t(title)}</h3>
        {right}
      </div>
      <div className="chart-card-body" style={{ minHeight: 0 }}>{children}</div>
    </div>
  );
}

function Tile({ label, value, sub }) {
  return (
    <div className="org-tile">
      <span className="org-tile-label">{t(label)}</span>
      <span className="org-tile-value">{value}</span>
      {sub ? <span className="org-tile-sub">{sub}</span> : null}
    </div>
  );
}

/** The result of a photo check: what was found, what was recorded, the sentence, and the photo with every counted fruit marked. */
function CheckResult({ verification: v, annotatedUrl, photoUrl }) {
  if (!v) return null;
  const m = VERDICTS[v.status];
  return (
    <div>
      <div className={`gh-verdict ${m.tone}`} role="status">
        <i className={`fas ${m.icon}`} />
        <div>
          <strong>{t(m.label)}</strong>
          <span>{v.message}</span>
        </div>
      </div>
      {v.detected != null && (
        <div className="org-tiles" style={{ marginBottom: 12 }}>
          <Tile label="You recorded" value={formatNumber(v.recorded)} />
          <Tile label="The photo shows" value={formatNumber(v.detected)} sub={v.confidence ? `${t('Confidence')}: ${t(v.confidence)}` : ''} />
        </div>
      )}
      <HealthCard health={v.health} />
      {(photoUrl || annotatedUrl) && (
        <div className="gh-photos">
          {photoUrl && <figure><img src={photoUrl} alt={t('Your photo')} /><figcaption>{t('Your photo')}</figcaption></figure>}
          {annotatedUrl && <figure><img src={annotatedUrl} alt={t('Fruit counted')} /><figcaption>{t('Every counted fruit is marked with a ring and a number')}</figcaption></figure>}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ dashboard */
function DashboardTab({ go }) {
  const dark = useIsDark();
  const [days, setDays] = useState(30);
  const { data: d, isLoading, isError, refetch } = useGhDashboard(days);
  if (isLoading) return <Loading label="Loading dashboard..." />;
  if (isError || !d) return <EmptyState icon="fa-exclamation-triangle" title="Could not load the dashboard" actionLabel="Retry" onAction={refetch} />;
  if (!d.crops) {
    return <EmptyState icon="fa-seedling" title="Choose the crops you grow" description="Pick your greenhouse crops, such as cherry tomatoes or peppers, then record the fruit on your plants with a photo." actionLabel="Choose crops" onAction={() => go('crops')} />;
  }
  const v = d.verdicts;
  return (
    <>
      {!d.counter_connected && (
        <div className="alert-item alert-warning" style={{ marginBottom: 16 }}>
          <i className="fas fa-plug-circle-xmark" />
          <div className="alert-content">{t('The fruit counter is not connected, so photos are saved but not checked yet. Ask your administrator to connect it.')}</div>
        </div>
      )}
      <div className="weather-tools" style={{ marginBottom: 16 }}>
        <select className="form-control" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label={t('Period')}>
          <option value={7}>{t('Last 7 days')}</option>
          <option value={30}>{t('Last 30 days')}</option>
          <option value={90}>{t('Last 90 days')}</option>
        </select>
      </div>
      <div className="org-tiles">
        <Tile label="Fruit counted" value={formatNumber(d.totals.fruit)} sub={t('on the latest count of each plant')} />
        <Tile label="Plants counted" value={formatNumber(d.totals.plants)} sub={`${formatNumber(d.totals.counts)} ${t('counts')}`} />
        <Tile label="Average fruit per plant" value={formatNumber(d.totals.avg_per_plant)} />
        <Tile label="Photos that agree" value={d.totals.verified_rate == null ? '-' : `${d.totals.verified_rate}%`} sub={t('match or close, of the photos that could be checked')} />
      </div>

      {d.totals.counts === 0 ? (
        <EmptyState icon="fa-camera" title="No fruit counts in this period" description="Record the fruit on a plant with a photo and a row ID." actionLabel="Add a fruit count" onAction={() => go('counts', { add: true })} />
      ) : (
        <>
          <div className="gh-grid">
            <Card title="Fruit by crop" icon="fa-seedling">
              <div style={{ height: Math.max(180, d.by_crop.length * 40 + 40) }}>
                <Bar key={`crop-${dark}`} data={{ labels: d.by_crop.map((c) => c.name), datasets: [{ data: d.by_crop.map((c) => c.fruit), backgroundColor: LEAF, borderRadius: 4 }] }} options={breakdownOptions((x) => `${x}`)} />
              </div>
            </Card>
            <Card title="Average fruit per plant, week by week" icon="fa-chart-line">
              <div style={{ height: 240 }}>
                <Bar key={`week-${dark}`} data={{ labels: d.weekly.map((w) => formatDate(w.week)), datasets: [{ label: t('Average per plant'), data: d.weekly.map((w) => w.avg_per_plant), backgroundColor: LEAF, borderRadius: 4 }] }} options={{ ...baseOptions(), plugins: { ...baseOptions().plugins, legend: { display: false } } }} />
              </div>
            </Card>
          </div>

          <div className="gh-grid">
            <Card title="Does the photo agree with the count?" icon="fa-camera">
              {['match', 'close', 'mismatch', 'inconclusive', 'not_checked', 'failed'].map((k) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                  <Verdict v={{ status: k }} />
                  <strong>{formatNumber(v[k] || 0)}</strong>
                </div>
              ))}
              <p className="ai-disclaimer" style={{ marginTop: 10 }}><i className="fas fa-info-circle" /> {t(d.tolerance_note)} {t('"Not sure" means the photo could not be counted reliably, for example green fruit among green leaves or a blurry photo.')}</p>
            </Card>
            <Card title="Needs your attention" icon="fa-bell">
              {d.alerts.mismatches.length === 0 && d.alerts.stale_rows.length === 0 ? <p className="org-muted">{t('Nothing needs attention.')}</p> : null}
              {d.alerts.mismatches.length > 0 && (
                <>
                  <div className="farm-profile-section">{t('Photos that do not match')}</div>
                  <ul className="fp-crops">
                    {d.alerts.mismatches.map((m) => (
                      <li key={m.id}>
                        <span className="label">{m.crop_name} · {m.row_id}{m.plant_label ? ` · ${m.plant_label}` : ''}</span>
                        <span className="muted">{formatDate(m.count_date)}</span>
                        <b>{m.recorded} / {m.detected ?? '-'}</b>
                      </li>
                    ))}
                  </ul>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => go('counts', { status: 'mismatch' })}>{t('See them')}</button>
                </>
              )}
              {d.alerts.stale_rows.length > 0 && (
                <>
                  <div className="farm-profile-section" style={{ marginTop: 14 }}>{t('Rows not counted for over a week')}</div>
                  <ul className="fp-crops">
                    {d.alerts.stale_rows.map((r) => (
                      <li key={`${r.crop_name}${r.greenhouse}${r.row_id}`}>
                        <span className="label">{r.crop_name} · {r.row_id}{r.greenhouse ? ` · ${r.greenhouse}` : ''}</span>
                        <b>{formatDate(r.last_count)}</b>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>
          </div>

          <Card title="Rows" icon="fa-table-list">
            <DataTable
              columns={[
                { key: 'row_id', label: 'Row', render: (r) => <strong>{r.row_id}</strong> },
                { key: 'greenhouse', label: 'Greenhouse', render: (r) => r.greenhouse || '—' },
                { key: 'crop_name', label: 'Crop' },
                { key: 'plants', label: 'Plants counted' },
                { key: 'avg_per_plant', label: 'Average fruit per plant' },
              ]}
              rows={d.by_row}
              rowKey={(r) => `${r.crop_name}${r.greenhouse}${r.row_id}`}
            />
          </Card>
        </>
      )}
    </>
  );
}

/* --------------------------------------------------------------- counts */
export function CountForm({ crops, editing, preset, onClose, onSaved }) {
  const toast = useToast();
  const { createCount, updateCount, check } = useGhMutations();
  const form = useForm(editing ? {
    crop_id: editing.crop_id, greenhouse: editing.greenhouse || '', row_id: editing.row_id, plant_label: editing.plant_label || '', count_date: editing.count_date,
    recorded_count: String(editing.recorded_count), photo_url: editing.photo_url, notes: editing.notes || '',
  } : { crop_id: preset?.crop_id && crops.some((c) => c.id === preset.crop_id) ? preset.crop_id : crops[0]?.id || '', greenhouse: preset?.greenhouse || '', row_id: preset?.row_id || '', plant_label: preset?.plant_label || '', count_date: today(), recorded_count: '', photo_url: '', notes: '' });
  const [err, setErr] = useState('');
  const [result, setResult] = useState(null); // { verification, annotated_url, photo_url }
  const v = form.values;
  const saving = createCount.isPending || updateCount.isPending;

  const problem = () => {
    if (!v.crop_id) return t('Choose the crop.');
    if (!v.row_id.trim()) return t('Enter the row ID (for example R3 or Row 12).');
    if (v.recorded_count === '' || !Number.isInteger(Number(v.recorded_count)) || Number(v.recorded_count) < 0) return t('Enter the number of fruit as a whole number, 0 or more.');
    if (!v.photo_url) return t('Add a photo that shows the fruit on the plant.');
    return '';
  };
  const body = () => ({ ...v, recorded_count: Number(v.recorded_count), photo_url: v.photo_url });

  const runCheck = async () => {
    const p = problem();
    if (p) { setErr(p); return; }
    setErr('');
    try {
      const out = await check.mutateAsync({ crop_id: v.crop_id, photo_url: v.photo_url, recorded_count: Number(v.recorded_count) });
      setResult({ ...out, photo_url: v.photo_url, preview: true });
    } catch (e) { setErr(e.message || t('The photo could not be checked.')); }
  };
  const submit = async (e) => {
    e.preventDefault();
    const p = problem();
    if (p) { setErr(p); return; }
    setErr('');
    try {
      const saved = editing ? await updateCount.mutateAsync({ id: editing.id, ...body() }) : await createCount.mutateAsync(body());
      toast(t('Fruit count saved'));
      setResult({ verification: saved.verification, annotated_url: saved.annotated_url, photo_url: saved.photo_url, saved: true });
      onSaved?.(saved);
    } catch (e2) { setErr(e2.message || t('Could not save')); }
  };

  if (result?.saved) {
    return (
      <Modal open onClose={onClose} title="Fruit count saved" size="modal-lg" footer={<button type="button" className="btn btn-primary" onClick={onClose}>{t('Done')}</button>}>
        <CheckResult verification={result.verification} annotatedUrl={result.annotated_url} photoUrl={result.photo_url} />
      </Modal>
    );
  }
  return (
    <Modal
      open onClose={onClose} title={editing ? 'Edit fruit count' : 'Add a fruit count'} size="modal-lg"
      footer={(
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>{t('Cancel')}</button>
          <button type="button" className="btn btn-secondary" onClick={runCheck} disabled={check.isPending || saving}><i className={`fas ${check.isPending ? 'fa-spinner fa-spin' : 'fa-magnifying-glass'}`} /> {check.isPending ? t('Checking...') : t('Check the photo')}</button>
          <button type="submit" form="gh-count-form" className="btn btn-primary" disabled={saving}><i className="fas fa-save" /> {saving ? t('Saving and checking the photo...') : t('Save fruit count')}</button>
        </>
      )}
    >
      <form id="gh-count-form" onSubmit={submit}>
        {err && <div className="alert-item alert-danger" style={{ marginBottom: 14 }}><i className="fas fa-exclamation-circle" /><div className="alert-content">{err}</div></div>}
        <FormRow>
          <SelectField label="Crop" required {...form.bind('crop_id')} placeholder="Choose a crop" options={crops.map((c) => ({ value: c.id, label: c.name }))} />
          <DateField label="Date" {...form.bind('count_date')} max={today()} />
        </FormRow>
        <FormRow>
          <TextField label="Greenhouse" {...form.bind('greenhouse')} placeholder="e.g. House 1" />
          <TextField label="Row ID" required {...form.bind('row_id')} placeholder="e.g. R3" />
        </FormRow>
        <FormRow>
          <TextField label="Plant" {...form.bind('plant_label')} placeholder="e.g. P7 or tree number" hint="Fill this in to follow the same plant over time" />
          <NumberField label="Number of fruit on the plant" required {...form.bind('recorded_count')} step="1" min="0" placeholder="e.g. 24" />
        </FormRow>
        <PhotoUpload label="Photo of the fruit on the plant" value={v.photo_url} onChange={(url) => { form.set('photo_url', url || ''); setResult(null); }} />
        <p className="form-hint" style={{ marginTop: -4 }}>{t('Take the photo in daylight with the fruit facing the camera and the whole plant in view. The photo is counted by the fruit counter and compared with your number.')}</p>
        <TextArea label="Notes" {...form.bind('notes')} rows={2} />
        {result?.preview && (
          <div style={{ marginTop: 12 }}>
            <div className="farm-profile-section">{t('Result of the check (not saved yet)')}</div>
            <CheckResult verification={result.verification} annotatedUrl={result.annotated_url} photoUrl={result.photo_url} />
          </div>
        )}
      </form>
    </Modal>
  );
}

function CountDetail({ row, onClose, onEdit }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { reverify, removeCount } = useGhMutations();
  const [shown, setShown] = useState(row);
  const again = async () => {
    try { setShown(await reverify.mutateAsync(row.id)); toast(t('Checked again')); } catch (e) { toast(e.message, 'error'); }
  };
  const remove = async () => {
    if (!(await confirm(t('Delete this fruit count and its photo check?')))) return;
    try { await removeCount.mutateAsync(row.id); toast(t('Deleted')); onClose(); } catch (e) { toast(e.message, 'error'); }
  };
  return (
    <Modal
      open onClose={onClose} title={`${shown.crop_name} · ${shown.row_id}${shown.plant_label ? ` · ${shown.plant_label}` : ''}`} size="modal-lg"
      footer={(
        <>
          <button type="button" className="btn btn-danger" onClick={remove}><i className="fas fa-trash" /> {t('Delete')}</button>
          <button type="button" className="btn btn-secondary" onClick={again} disabled={reverify.isPending}><i className={`fas ${reverify.isPending ? 'fa-spinner fa-spin' : 'fa-rotate'}`} /> {t('Check the photo again')}</button>
          <button type="button" className="btn btn-primary" onClick={() => onEdit(shown)}><i className="fas fa-pen" /> {t('Edit')}</button>
        </>
      )}
    >
      <p className="org-muted" style={{ marginTop: 0 }}>{formatDate(shown.count_date)}{shown.greenhouse ? ` · ${shown.greenhouse}` : ''}</p>
      <CheckResult verification={shown.verification} annotatedUrl={shown.annotated_url} photoUrl={shown.photo_url} />
      {shown.notes ? <p style={{ marginTop: 12 }}><strong>{t('Notes')}:</strong> {shown.notes}</p> : null}
    </Modal>
  );
}

function CountsTab({ start }) {
  const { data: crops = [] } = useGhCrops();
  const [filters, setFilters] = useState({ crop_id: '', status: start?.status || '' });
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(start?.add ? { editing: null } : null);
  const [view, setView] = useState(null);
  const params = { page, perPage: 15, ...Object.fromEntries(Object.entries(filters).filter(([, x]) => x)) };
  const { data, isLoading, isError, refetch } = useGhCounts(params);

  if (!crops.length && !isLoading) {
    return <EmptyState icon="fa-seedling" title="Choose the crops you grow first" description="Then you can record the fruit on your plants with a photo." />;
  }
  return (
    <>
      <div className="table-toolbar" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <FilterSelect value={filters.crop_id} onChange={(x) => { setFilters((f) => ({ ...f, crop_id: x })); setPage(1); }} placeholder="All crops" options={crops.map((c) => ({ value: c.id, label: c.name }))} />
        <FilterSelect value={filters.status} onChange={(x) => { setFilters((f) => ({ ...f, status: x })); setPage(1); }} placeholder="All results" options={Object.entries(VERDICTS).map(([value, m]) => ({ value, label: m.label }))} />
        <span style={{ flex: 1 }} />
        <button type="button" className="btn btn-primary" onClick={() => setForm({ editing: null })}><i className="fas fa-plus" /> {t('Add a fruit count')}</button>
      </div>
      {isError ? (
        <EmptyState icon="fa-exclamation-triangle" title="Could not load the fruit counts" actionLabel="Retry" onAction={refetch} />
      ) : (
        <DataTable
          loading={isLoading}
          rows={data?.data}
          columns={[
            { key: 'photo', label: 'Photo', render: (r) => <img className="gh-thumb" src={r.photo_url} alt="" /> },
            { key: 'count_date', label: 'Date', render: (r) => formatDate(r.count_date) },
            { key: 'crop_name', label: 'Crop', render: (r) => <strong>{r.crop_name}</strong> },
            { key: 'place', label: 'Row', render: (r) => [r.greenhouse, r.row_id, r.plant_label].filter(Boolean).join(' · ') },
            { key: 'recorded_count', label: 'Recorded' },
            { key: 'detected', label: 'Photo shows', render: (r) => (r.verification?.detected ?? '—') },
            { key: 'verdict', label: 'Result', render: (r) => <Verdict v={r.verification} /> },
          ]}
          actions={(r) => <button type="button" className="btn btn-secondary btn-sm" onClick={() => setView(r)}>{t('Open')}</button>}
          empty={<EmptyState icon="fa-camera" title="No fruit counts yet" description="Record the fruit on a plant with a photo and a row ID." actionLabel="Add a fruit count" onAction={() => setForm({ editing: null })} />}
        />
      )}
      {data && data.totalPages > 1 && <Pagination page={page} totalPages={data.totalPages} onChange={setPage} />}
      {form && <CountForm crops={crops} editing={form.editing} onClose={() => setForm(null)} />}
      {view && !form && <CountDetail key={view.id} row={view} onClose={() => setView(null)} onEdit={(r) => { setView(null); setForm({ editing: r }); }} />}
    </>
  );
}

/* ----------------------------------------------------------------- crops */
function CropsTab() {
  const toast = useToast();
  const confirm = useConfirm();
  const { data: cat, isLoading, isError, refetch } = useGhCatalog();
  const { data: mine = [] } = useGhCrops();
  const { addCrop, removeCrop } = useGhMutations();
  const form = useForm({ name: '', shape: 'round' });
  const [colors, setColors] = useState([]);
  const [err, setErr] = useState('');
  if (isLoading) return <Loading />;
  if (isError || !cat) return <EmptyState icon="fa-exclamation-triangle" title="Could not load the crops" actionLabel="Retry" onAction={refetch} />;

  const toggle = async (c) => {
    try {
      if (c.selected) {
        if (!(await confirm(t('Remove {{name}} from your crops?', { name: c.name }), { confirmLabel: 'Remove' }))) return;
        await removeCrop.mutateAsync(c.crop_id);
      } else {
        await addCrop.mutateAsync({ catalog_key: c.key });
      }
    } catch (e) { toast(e.message, 'error'); }
  };
  const addOwn = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      await addCrop.mutateAsync({ name: form.values.name, shape: form.values.shape, fruit_colors: colors });
      form.setValues({ name: '', shape: 'round' });
      setColors([]);
      toast(t('Crop added'));
    } catch (e2) { setErr(e2.message); }
  };
  const own = mine.filter((c) => c.catalog_key === 'custom');
  const swatches = (list) => <div className="gh-swatches">{list.map((c) => <span className="gh-swatch" key={c}><i style={{ background: COLOR_HEX[c] }} />{t(c)}</span>)}</div>;

  return (
    <>
      <Card title="Choose what you grow" icon="fa-seedling">
        <p className="ai-lead" style={{ marginTop: 0 }}>{t('Tick the crops you grow in your greenhouse. The colours of the fruit tell the fruit counter what to look for in your photos.')}</p>
        <div className="gh-crops">
          {cat.crops.map((c) => (
            <div key={c.key} className={`gh-crop ${c.selected ? 'selected' : ''}`}>
              <h4>{t(c.name)}</h4>
              {swatches(c.fruit_colors)}
              <p>{t(c.tip)}</p>
              <p>{t('Days to first harvest')}: {c.days_to_harvest}</p>
              {c.contrast === 'low' && <span className="badge badge-warning" style={{ alignSelf: 'flex-start' }}>{t('Photo check not conclusive')}</span>}
              <button type="button" className={`btn btn-sm ${c.selected ? 'btn-secondary' : 'btn-primary'}`} onClick={() => toggle(c)} style={{ alignSelf: 'flex-start' }}>
                <i className={`fas ${c.selected ? 'fa-check' : 'fa-plus'}`} /> {c.selected ? t('I grow this') : t('Add')}
              </button>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Add a crop that is not in the list" icon="fa-circle-plus">
        <form onSubmit={addOwn}>
          {err && <div className="alert-item alert-danger" style={{ marginBottom: 12 }}><i className="fas fa-exclamation-circle" /><div className="alert-content">{err}</div></div>}
          <FormRow>
            <TextField label="Crop name" required {...form.bind('name')} placeholder="e.g. Cape gooseberry" />
            <SelectField label="Shape of the fruit" {...form.bind('shape')} options={[{ value: 'round', label: 'Round (tomato, berry)' }, { value: 'elongated', label: 'Long (pepper, cucumber, bean)' }]} />
          </FormRow>
          <div className="form-group">
            <label className="form-label">{t('Colour of the fruit')}<span className="required">*</span></label>
            <div className="gh-colors">
              {cat.colors.map((c) => (
                <label key={c}><input type="checkbox" checked={colors.includes(c)} onChange={(e) => setColors((l) => (e.target.checked ? [...l, c] : l.filter((x) => x !== c)))} /><i className="gh-swatch" style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: COLOR_HEX[c] }} /> {t(c)}</label>
              ))}
            </div>
            <div className="form-hint">{t('Choose every colour the fruit has while it ripens. Green fruit among green leaves cannot be counted reliably.')}</div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={addCrop.isPending}><i className="fas fa-plus" /> {t('Add crop')}</button>
        </form>
        {own.length > 0 && (
          <>
            <div className="farm-profile-section" style={{ marginTop: 16 }}>{t('Your own crops')}</div>
            <ul className="fp-crops">
              {own.map((c) => (
                <li key={c.id}>
                  <span className="label">{c.name}</span>
                  <span className="muted">{c.fruit_colors.map((x) => t(x)).join(', ')}</span>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => toggle({ ...c, selected: true, crop_id: c.id })}>{t('Remove')}</button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </>
  );
}

/* ------------------------------------------------------------------ page */
export default function Greenhouse() {
  const [tab, setTab] = useState('dashboard');
  const [start, setStart] = useState(null);
  const go = (id, opts = null) => { setStart(opts); setTab(id); };
  return (
    <>
      <PageHeader title="Greenhouse" subtitle="Count the fruit on your plants with a photo, and check each photo with the fruit counter." />
      <div className="gh-tabs" role="tablist">
        {TABS.map((x) => (
          <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} className={`gh-tab ${tab === x.id ? 'active' : ''}`} onClick={() => go(x.id)}>
            <i className={`fas ${x.icon}`} /> {t(x.label)}
          </button>
        ))}
      </div>
      {tab === 'dashboard' && <DashboardTab go={go} />}
      {tab === 'layout' && <LayoutTab />}
      {tab === 'counts' && <CountsTab key={JSON.stringify(start)} start={start} />}
      {tab === 'crops' && <CropsTab />}
    </>
  );
}
