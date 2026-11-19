import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Bar } from 'react-chartjs-2';
import { DataTable, EmptyState, FilterSelect, Loading, PageHeader, Pagination } from '../components/ui.jsx';
import { Modal } from '../components/Modal.jsx';
import { FormRow, NumberField, SelectField, TextArea, TextField, DateField, useForm } from '../components/form.jsx';
import { MultiPhotoUpload } from '../components/MultiPhotoUpload.jsx';
import { api, setFarmOwner } from '../lib/api.js';
import { useConfirm } from '../components/Confirm.jsx';
import { useToast } from '../components/Toast.jsx';
import { baseOptions, breakdownOptions, LEAF, useIsDark } from '../features/dashboard/charts.jsx';
import { formatDate, formatNumber } from '../lib/format.js';
import { FRUIT_SIZES, useGhAccess, useGhCatalog, useGhCounts, useGhCrops, useGhDashboard, useGhHealth, useGhHouses, useGhMutations, useGhTeam, VERDICTS } from '../lib/greenhouse.js';
import { t } from '../i18n/index.js';
import LayoutTab from './GreenhouseLayout.jsx';
import { HealthCard } from '../components/HealthCard.jsx';

/** What each role sees: the owner everything; the farm manager records and disease details, no plan or 3D; the data collector the plan view and recording. */
const TABS_BY_ROLE = {
  owner: [
    { id: 'dashboard', icon: 'fa-chart-column', label: 'Dashboard' },
    { id: 'layout', icon: 'fa-cube', label: 'Layout and 3D' },
    { id: 'counts', icon: 'fa-camera', label: 'Fruit counts' },
    { id: 'disease', icon: 'fa-virus', label: 'Disease report' },
    { id: 'crops', icon: 'fa-seedling', label: 'My crops' },
    { id: 'team', icon: 'fa-user-group', label: 'Team' },
  ],
  manager: [
    { id: 'dashboard', icon: 'fa-chart-column', label: 'Dashboard' },
    { id: 'disease', icon: 'fa-virus', label: 'Disease report' },
    { id: 'counts', icon: 'fa-camera', label: 'Fruit counts' },
  ],
  collector: [
    { id: 'layout', icon: 'fa-table-cells', label: 'Plan and recording' },
    { id: 'counts', icon: 'fa-camera', label: 'My records' },
  ],
};
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
      {v.collage?.overlap_warnings?.length > 0 && (
        <div className="alert-item alert-warning" style={{ marginBottom: 12 }}>
          <i className="fas fa-clone" />
          <div className="alert-content">{t('Some photos seem to show the same part of the plant:')} {v.collage.overlap_warnings.map((w) => `${w.a} ${t('and')} ${w.b}`).join(', ')}. {t('A fruit that is in two photos is counted twice. Retake one of each pair so every fruit is in one photo only.')}</div>
        </div>
      )}
      {v.fruit_size && v.fruit_size !== 'all' && <p className="org-muted" style={{ marginTop: 0 }}>{t('Counting')} {t(FRUIT_SIZES.find((x) => x.value === v.fruit_size)?.label || v.fruit_size).toLowerCase()} {t('fruit only')}{v.detected_all_sizes != null ? ` (${v.detected_all_sizes} ${t('fruit of all sizes in the photo')})` : ''}.</p>}
      {v.health !== undefined && <HealthCard health={v.health} />}
      {(photoUrl || annotatedUrl) && (
        <div className="gh-photos">
          {photoUrl && <figure><img src={photoUrl} alt={t('Your photo')} /><figcaption>{v.collage ? t('Your {{n}} photos joined into one picture', { n: v.collage.photos }) : t('Your photo')}</figcaption></figure>}
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
    recorded_count: String(editing.recorded_count), photo_urls: editing.photo_urls?.length ? editing.photo_urls : [editing.photo_url], notes: editing.notes || '', label: editing.label || '', fruit_size: editing.fruit_size || 'all',
  } : { crop_id: preset?.crop_id && crops.some((c) => c.id === preset.crop_id) ? preset.crop_id : crops[0]?.id || '', greenhouse: preset?.greenhouse || '', row_id: preset?.row_id || '', plant_label: preset?.plant_label || '', count_date: today(), recorded_count: '', photo_urls: [], notes: '', label: '', fruit_size: 'all' });
  const [err, setErr] = useState('');
  const [result, setResult] = useState(null); // { verification, annotated_url, photo_url }
  const v = form.values;
  const saving = createCount.isPending || updateCount.isPending;

  const problem = () => {
    if (!v.crop_id) return t('Choose the crop.');
    if (!v.row_id.trim()) return t('Enter the row ID (for example R3 or Row 12).');
    if (v.recorded_count === '' || !Number.isInteger(Number(v.recorded_count)) || Number(v.recorded_count) < 0) return t('Enter the number of fruit as a whole number, 0 or more.');
    if (!v.photo_urls.length) return t('Add a photo that shows the fruit on the plant.');
    return '';
  };
  const body = () => ({ ...v, recorded_count: Number(v.recorded_count) });

  const runCheck = async () => {
    const p = problem();
    if (p) { setErr(p); return; }
    setErr('');
    try {
      const out = await check.mutateAsync({ crop_id: v.crop_id, photo_urls: v.photo_urls, recorded_count: Number(v.recorded_count), fruit_size: v.fruit_size });
      setResult({ ...out, preview: true });
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
        <FormRow>
          <SelectField label="Size of the fruit you are counting" {...form.bind('fruit_size')} options={FRUIT_SIZES.map((x) => ({ value: x.value, label: x.label }))} hint="Choose small, medium or large to record one size, or all sizes for every fruit" />
          <TextField label="Label (optional)" {...form.bind('label')} placeholder="e.g. first flush" maxLength={60} />
        </FormRow>
        <MultiPhotoUpload label="Photos of the fruit on the plant" value={v.photo_urls} onChange={(urls) => { form.set('photo_urls', urls); setResult(null); }} />
        <p className="form-hint" style={{ marginTop: -4 }}>{t('Take the photos in daylight with the fruit facing the camera. The photos are joined into one picture, counted by the fruit counter and compared with your number.')}</p>
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

function CountDetail({ row, onClose, onEdit, role = 'owner' }) {
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
          {role === 'owner' && <button type="button" className="btn btn-danger" onClick={remove}><i className="fas fa-trash" /> {t('Delete')}</button>}
          {role === 'owner' && <button type="button" className="btn btn-secondary" onClick={again} disabled={reverify.isPending}><i className={`fas ${reverify.isPending ? 'fa-spinner fa-spin' : 'fa-rotate'}`} /> {t('Check the photo again')}</button>}
          {role !== 'manager' && <button type="button" className="btn btn-primary" onClick={() => onEdit(shown)}><i className="fas fa-pen" /> {t('Edit')}</button>}
        </>
      )}
    >
      <p className="org-muted" style={{ marginTop: 0 }}>{formatDate(shown.count_date)}{shown.greenhouse ? ` · ${shown.greenhouse}` : ''}{shown.label ? ` · ${shown.label}` : ''}{shown.entered_by_name ? ` · ${t('recorded by')} ${shown.entered_by_name}` : ''}</p>
      <CheckResult verification={shown.verification} annotatedUrl={shown.annotated_url} photoUrl={shown.photo_url} />
      {shown.notes ? <p style={{ marginTop: 12 }}><strong>{t('Notes')}:</strong> {shown.notes}</p> : null}
    </Modal>
  );
}

function CountsTab({ start, role = 'owner' }) {
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
        {role !== 'manager' && <button type="button" className="btn btn-primary" onClick={() => setForm({ editing: null })}><i className="fas fa-plus" /> {t('Add a fruit count')}</button>}
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
            { key: 'place', label: 'Row', render: (r) => [r.greenhouse, r.row_id, r.plant_label].filter(Boolean).join(' · ') + (r.label ? ` (${r.label})` : '') },
            { key: 'size', label: 'Size', render: (r) => t(FRUIT_SIZES.find((x) => x.value === (r.fruit_size || 'all'))?.label || 'All sizes') },
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
      {view && !form && <CountDetail key={view.id} row={view} role={role} onClose={() => setView(null)} onEdit={(r) => { setView(null); setForm({ editing: r }); }} />}
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

/* ------------------------------------------------------- disease report */
/** For the farm manager and the owner: how many plants are diseased, and every detail of each. */
function DiseaseTab() {
  const { data: houses = [], isLoading } = useGhHouses();
  const [houseId, setHouseId] = useState('');
  const house = houses.find((h) => h.id === houseId) || houses[0];
  const { data: rep, isLoading: loading } = useGhHealth(house?.id);
  if (isLoading) return <Loading />;
  if (!houses.length) return <EmptyState icon="fa-virus" title="No greenhouse yet" description="The disease report appears once a greenhouse is set up and plants are counted." />;
  return (
    <>
      <div className="gh-toolbar">
        <select className="form-control" value={house.id} onChange={(e) => setHouseId(e.target.value)} aria-label={t('Greenhouse')}>
          {houses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </div>
      {loading || !rep ? <Loading /> : (
        <>
          <div className="org-tiles">
            <Tile label="Diseased plants" value={formatNumber(rep.summary.sick_plants)} sub={`${t('of')} ${formatNumber(rep.summary.counted)} ${t('plants counted')}`} />
            <Tile label="Share of counted plants" value={`${rep.summary.share_of_counted}%`} />
            <Tile label="Diseased fruit found" value={formatNumber(rep.summary.sick_fruit)} />
            <Tile label="Plant positions" value={formatNumber(rep.summary.plants)} />
          </div>
          {rep.plants.length === 0 ? (
            <EmptyState icon="fa-leaf" title="No diseased plants found" description="None of the counted plants shows signs of disease in its latest photo." />
          ) : (
            <Card title="Diseased plants" icon="fa-virus">
              <DataTable
                rows={rep.plants}
                rowKey={(r) => r.count_id}
                columns={[
                  { key: 'place', label: 'Plant', render: (r) => <strong>{r.row_id} {r.plant_label}{r.label ? ` (${r.label})` : ''}</strong> },
                  { key: 'crop_name', label: 'Crop' },
                  { key: 'disease', label: 'Possible disease', render: (r) => <span className="badge badge-danger"><i className="fas fa-virus" /> {r.disease || t('Possible disease')}</span> },
                  { key: 'conf', label: 'Confidence', render: (r) => (r.disease_confidence != null ? `${Math.round(r.disease_confidence * 100)}%` : '—') },
                  { key: 'fruit', label: 'Sick fruit', render: (r) => (r.checked_fruit ? `${r.sick_fruit} / ${r.checked_fruit}${r.sick_fruit_numbers.length ? ` (${t('numbers')} ${r.sick_fruit_numbers.join(', ')})` : ''}` : '—') },
                  { key: 'count_date', label: 'Date', render: (r) => formatDate(r.count_date) },
                  { key: 'state', label: 'Position', render: (r) => (r.state === 'frozen' ? <span className="badge badge-info" title={r.state_reason}>{t('Frozen')}</span> : t('Active')) },
                  { key: 'photo', label: 'Photo', render: (r) => <a href={r.annotated_url || r.photo_url} target="_blank" rel="noreferrer"><img className="gh-thumb" src={r.annotated_url || r.photo_url} alt="" /></a> },
                ]}
              />
              <ul className="gh-health-hist" style={{ marginTop: 14 }}>
                {rep.plants.filter((r) => r.message).map((r) => <li key={`m${r.count_id}`}><strong>{r.row_id} {r.plant_label}</strong><span>{r.message}</span></li>)}
              </ul>
            </Card>
          )}
        </>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ team */
const ROLE_TEXT = {
  manager: 'Farm manager: reads all the records, the dashboard and the disease report with the number of diseased plants. No 3D map, no recording, no changes.',
  collector: 'Data collector: sees the plan view and records fruit counts with photos, and can freeze a plant with a reason. No disease details, dashboard or settings.',
};
function TeamTab() {
  const toast = useToast();
  const confirm = useConfirm();
  const { data: team = [], isLoading } = useGhTeam();
  const { invite, changeMember, removeMember } = useGhMutations();
  const form = useForm({ email: '', name: '', role: 'collector' });
  const [err, setErr] = useState('');
  const add = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      await invite.mutateAsync(form.values);
      form.setValues({ email: '', name: '', role: form.values.role });
      toast(t('Invitation saved. They get access when they sign in with that email address.'));
    } catch (e2) { setErr(e2.message); }
  };
  const remove = async (m) => {
    if (!(await confirm(t('Remove {{name}} from your team? They lose access at once.', { name: m.name || m.email }), { confirmLabel: 'Remove' }))) return;
    try { await removeMember.mutateAsync(m.id); } catch (e) { toast(e.message, 'error'); }
  };
  return (
    <>
      <Card title="Invite someone to your greenhouse" icon="fa-user-plus">
        <p className="ai-lead" style={{ marginTop: 0 }}>{t('Give a farm manager or a data collector their own account. They sign in with the email address you enter here, and then choose your farm.')}</p>
        <form onSubmit={add}>
          {err && <div className="alert-item alert-danger" style={{ marginBottom: 12 }}><i className="fas fa-exclamation-circle" /><div className="alert-content">{err}</div></div>}
          <FormRow>
            <TextField label="Email address" required type="email" {...form.bind('email')} placeholder="name@example.com" />
            <TextField label="Name (optional)" {...form.bind('name')} />
          </FormRow>
          <SelectField label="Role" {...form.bind('role')} options={[{ value: 'collector', label: 'Data collector' }, { value: 'manager', label: 'Farm manager' }]} />
          <p className="form-hint">{t(ROLE_TEXT[form.values.role])}</p>
          <button type="submit" className="btn btn-primary" disabled={invite.isPending}><i className="fas fa-plus" /> {t('Invite')}</button>
        </form>
      </Card>
      <Card title="Your team" icon="fa-user-group">
        {isLoading ? <Loading /> : team.length === 0 ? <p className="org-muted">{t('Nobody yet.')}</p> : (
          <DataTable
            rows={team}
            rowKey={(m) => m.id}
            columns={[
              { key: 'who', label: 'Person', render: (m) => <><strong>{m.name || m.email}</strong>{m.name ? <div className="org-muted">{m.email}</div> : null}</> },
              { key: 'role', label: 'Role', render: (m) => (
                <select className="form-control" value={m.role} onChange={(e) => changeMember.mutate({ id: m.id, role: e.target.value })} aria-label={t('Role')}>
                  <option value="collector">{t('Data collector')}</option>
                  <option value="manager">{t('Farm manager')}</option>
                </select>
              ) },
              { key: 'status', label: 'Status', render: (m) => <span className={`badge badge-${m.status === 'active' ? 'success' : 'warning'}`}>{m.status === 'active' ? t('Signed in') : t('Waiting for them to sign in')}</span> },
            ]}
            actions={(m) => <button type="button" className="btn btn-secondary btn-sm" onClick={() => remove(m)}>{t('Remove')}</button>}
          />
        )}
      </Card>
    </>
  );
}

/* ------------------------------------------------------------------ page */
export default function Greenhouse() {
  const qc = useQueryClient();
  const { data: access } = useGhAccess();
  const [farm, setFarm] = useState(() => { try { return localStorage.getItem('gh-farm') || ''; } catch { return ''; } }); // '' = my own farm
  const farms = access?.farms || [];
  const current = farms.find((f) => f.owner_id === farm) || null;
  const role = current ? current.role : 'owner';
  // a person who only works on someone else's farm lands there; the farm they stored may also have been taken away
  useEffect(() => {
    if (!access) return;
    if (farm && !farms.some((f) => f.owner_id === farm)) { setFarmOwner(null); setFarm(''); return; }
    let chosen = true;
    try { chosen = localStorage.getItem('gh-farm') !== null; } catch { /* private window */ }
    if (!chosen && farms.length) {
      // never picked a farm: someone with no crops of their own who was invited to a farm starts on that farm
      api.get('/greenhouse/crops', { headers: { 'X-Farm-Owner': '' } }).then((r) => { if (!r.data.data.length) switchFarm(farms[0].owner_id); }).catch(() => {});
    }
  }, [access]); // eslint-disable-line react-hooks/exhaustive-deps
  setFarmOwner(current ? current.owner_id : null); // before any request of this render goes out
  const switchFarm = (id) => {
    setFarmOwner(id || null);
    try { localStorage.setItem('gh-farm', id || ''); } catch { /* private window */ }
    qc.removeQueries({ queryKey: ['greenhouse'] });
    setFarm(id);
    setTab(null);
  };
  const tabs = TABS_BY_ROLE[role];
  const [tab, setTab] = useState(null);
  const [start, setStart] = useState(null);
  const active = tab && tabs.some((x) => x.id === tab) ? tab : tabs[0].id;
  const go = (id, opts = null) => { setStart(opts); setTab(id); };
  const subtitle = role === 'collector' ? 'Pick a plant on the plan and record its fruit with photos.' : role === 'manager' ? 'Read the records and see which plants are diseased.' : 'Count the fruit on your plants with a photo, and check each photo with the fruit counter.';
  return (
    <>
      <PageHeader title="Greenhouse" subtitle={subtitle} />
      {farms.length > 0 && (
        <div className="gh-toolbar" style={{ marginBottom: 10 }}>
          <label className="org-muted" htmlFor="gh-farm">{t('Farm')}</label>
          <select id="gh-farm" className="form-control" value={current ? current.owner_id : ''} onChange={(e) => switchFarm(e.target.value)}>
            <option value="">{t('My own farm')}</option>
            {farms.map((f) => <option key={f.owner_id} value={f.owner_id}>{f.farm_name} ({t(f.role === 'manager' ? 'Farm manager' : 'Data collector')})</option>)}
          </select>
        </div>
      )}
      <div className="gh-tabs" role="tablist">
        {tabs.map((x) => (
          <button key={x.id} type="button" role="tab" aria-selected={active === x.id} className={`gh-tab ${active === x.id ? 'active' : ''}`} onClick={() => go(x.id)}>
            <i className={`fas ${x.icon}`} /> {t(x.label)}
          </button>
        ))}
      </div>
      {active === 'dashboard' && <DashboardTab go={go} />}
      {active === 'layout' && <LayoutTab role={role} />}
      {active === 'counts' && <CountsTab key={`${farm}${JSON.stringify(start)}`} start={start} role={role} />}
      {active === 'disease' && <DiseaseTab key={farm} />}
      {active === 'crops' && <CropsTab />}
      {active === 'team' && <TeamTab />}
    </>
  );
}
