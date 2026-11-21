import { useState } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import { DataTable, EmptyState, Loading } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';
import { baseOptions, breakdownOptions, LEAF, useIsDark } from '../features/dashboard/charts.jsx';
import { formatCurrency, formatDate, formatNumber } from '../lib/format.js';
import { useGhAlerts, useGhMutations, useGhOverview, useGhRevenueHistory, VERDICTS } from '../lib/greenhouse.js';
import { t } from '../i18n/index.js';

/*
 * The first page of each role, the alerts, and the harvest value over the weeks.
 *   ManagerDashboard    the farm manager (and the owner's overview): totals, trend, each greenhouse, diseased plants, alerts, who is recording
 *   CollectorDashboard  the data collector: what is left to record today, what they did, which counts to redo. No totals, alerts or disease details.
 *   AlertsTab           plants whose numbers do not add up, with a way to explain each one
 *   HistoryCard         the expected value and the loss to disease, week by week
 */
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

function Tile({ label, value, sub, tone }) {
  return (
    <div className="org-tile" style={tone === 'danger' ? { borderColor: 'var(--danger, #C62828)' } : undefined}>
      <span className="org-tile-label">{t(label)}</span>
      <span className="org-tile-value" style={tone === 'danger' ? { color: 'var(--danger, #C62828)' } : undefined}>{value}</span>
      {sub ? <span className="org-tile-sub">{sub}</span> : null}
    </div>
  );
}

const SEVERITY = { high: { tone: 'danger', label: 'High' }, medium: { tone: 'warning', label: 'Medium' } };
const KIND = { under_recorded: 'Recorded below the photo', fall: 'Count fell' };

/* ------------------------------------------------------- value over time */
export function HistoryCard({ greenhouse = '', risk = 20 }) {
  const dark = useIsDark();
  const { data, isLoading } = useGhRevenueHistory({ greenhouse, risk, weeks: 12 });
  if (isLoading || !data) return <Card title="Over the weeks" icon="fa-chart-line"><Loading /></Card>;
  const w = data.weeks;
  const labels = w.map((x) => formatDate(x.week));
  const cur = w.map((x) => x.money[0]?.currency).find(Boolean);
  const priced = w.some((x) => x.money[0]?.net > 0);
  const last = w[w.length - 1];
  const prev = [...w].reverse().find((x, i) => i > 0 && x.fruit > 0);
  const trend = last && prev ? Math.round((last.loss_share_pct - prev.loss_share_pct) * 10) / 10 : null;
  return (
    <Card title="Over the weeks" icon="fa-chart-line">
      {trend !== null && (
        <p className="ai-lead" style={{ marginTop: 0 }}>
          {trend > 0.5 ? t('Disease loss is growing: {{n}} points higher than in the earlier week shown.', { n: trend })
            : trend < -0.5 ? t('Disease loss is falling: {{n}} points lower than in the earlier week shown.', { n: Math.abs(trend) })
              : t('Disease loss is steady.')}
        </p>
      )}
      <div className="gh-two">
        <div>
          <div className="org-muted" style={{ marginBottom: 6 }}>{priced ? `${t('Expected value')} (${cur})` : t('Fruit counted')}</div>
          <div style={{ height: 220 }}>
            <Bar key={`hv-${dark}`} data={{ labels, datasets: [{ data: w.map((x) => (priced ? x.money[0]?.net ?? 0 : x.fruit)), backgroundColor: LEAF, borderRadius: 4 }] }} options={breakdownOptions((x) => formatNumber(x))} />
          </div>
        </div>
        <div>
          <div className="org-muted" style={{ marginBottom: 6 }}>{t('Lost to disease')} (%)</div>
          <div style={{ height: 220 }}>
            <Line key={`hl-${dark}`} data={{ labels, datasets: [{ data: w.map((x) => x.loss_share_pct), borderColor: '#C62828', backgroundColor: 'rgba(198,40,40,0.12)', fill: true, tension: 0.3, pointRadius: 3 }] }} options={{ ...baseOptions(), plugins: { ...baseOptions().plugins, legend: { display: false } } }} />
          </div>
        </div>
      </div>
      <p className="org-muted" style={{ marginBottom: 0 }}>{t(data.note)}</p>
    </Card>
  );
}

/* ----------------------------------------------------- farm manager page */
export function ManagerDashboard({ go }) {
  const dark = useIsDark();
  const { data: o, isLoading, isError, refetch } = useGhOverview();
  if (isLoading) return <Loading />;
  if (isError || !o || !o.headline) return <EmptyState icon="fa-exclamation-triangle" title="Could not load the overview" actionLabel="Retry" onAction={refetch} />;
  const H = o.headline;
  const money = H.money[0];
  const priced = H.money.some((m) => m.gross > 0);
  const trend = o.trend;
  const labels = trend.map((x) => formatDate(x.week));
  if (!o.houses.length) return <EmptyState icon="fa-warehouse" title="No greenhouse yet" description="The overview appears once a greenhouse is set up and plants are counted." />;
  return (
    <>
      {o.alerts.summary.open_high > 0 && (
        <div className="alert-item alert-danger" style={{ marginBottom: 14 }}>
          <i className="fas fa-triangle-exclamation" />
          <div className="alert-content">
            <strong>{t('{{n}} plants need a look', { n: o.alerts.summary.open_high })}</strong> {t('Their counts do not add up: fruit are missing or were not written down.')}
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => go('alerts')}>{t('See the alerts')}</button>
        </div>
      )}
      <div className="org-tiles">
        <Tile label="Fruit counted" value={formatNumber(H.fruit)} sub={`${formatNumber(H.counted_plants)} ${t('of')} ${formatNumber(H.active_plants)} ${t('plants')}`} />
        <Tile label="Healthy fruit" value={formatNumber(H.healthy_fruit)} sub={`${t('of')} ${formatNumber(H.fruit)}`} />
        <Tile label="Lost to disease" value={`${H.loss_share_pct}%`} sub={`${formatNumber(H.sick_plants)} ${t('diseased plants')}`} tone={H.loss_share_pct >= 15 ? 'danger' : undefined} />
        {priced && money ? <Tile label="Expected value" value={formatCurrency(money.net, money.currency)} sub={`${t('whole greenhouse')} ${formatCurrency(money.whole_net, money.currency)}`} /> : <Tile label="Whole greenhouse" value={formatNumber(H.whole_fruit_net)} sub={t('fruit expected')} />}
        <Tile label="Open alerts" value={formatNumber(o.alerts.summary.open)} sub={`${o.alerts.summary.open_high} ${t('high')}`} tone={o.alerts.summary.open_high ? 'danger' : undefined} />
      </div>

      <Card title="The last eight weeks" icon="fa-chart-line" right={<button type="button" className="btn btn-secondary btn-sm" onClick={() => go('harvest')}>{t('Harvest value')}</button>}>
        <div className="gh-two">
          <div>
            <div className="org-muted" style={{ marginBottom: 6 }}>{priced && money ? `${t('Expected value')} (${money.currency})` : t('Fruit counted')}</div>
            <div style={{ height: 200 }}>
              <Bar key={`mo-${dark}`} data={{ labels, datasets: [{ data: trend.map((x) => (priced ? x.net ?? 0 : x.fruit)), backgroundColor: LEAF, borderRadius: 4 }] }} options={breakdownOptions((x) => formatNumber(x))} />
            </div>
          </div>
          <div>
            <div className="org-muted" style={{ marginBottom: 6 }}>{t('Lost to disease')} (%)</div>
            <div style={{ height: 200 }}>
              <Line key={`ml-${dark}`} data={{ labels, datasets: [{ data: trend.map((x) => x.loss_share_pct), borderColor: '#C62828', backgroundColor: 'rgba(198,40,40,0.12)', fill: true, tension: 0.3, pointRadius: 3 }] }} options={{ ...baseOptions(), plugins: { ...baseOptions().plugins, legend: { display: false } } }} />
            </div>
          </div>
        </div>
      </Card>

      <Card title="Each greenhouse" icon="fa-warehouse">
        <DataTable
          rows={o.houses}
          rowKey={(r) => r.id}
          columns={[
            { key: 'name', label: 'Greenhouse', render: (r) => <strong>{r.name}</strong> },
            { key: 'counted', label: 'Plants counted', render: (r) => `${r.counted_plants} / ${r.active_positions}` },
            { key: 'stale', label: 'Not counted in 7 days', render: (r) => (r.stale_plants + r.uncounted_plants > 0 ? <span className="badge badge-warning">{r.stale_plants + r.uncounted_plants}</span> : <span className="badge badge-success">0</span>) },
            { key: 'sick', label: 'Diseased plants', render: (r) => (r.sick_plants ? <span className="badge badge-danger">{r.sick_plants}</span> : '0') },
            { key: 'fruit', label: 'Fruit', render: (r) => formatNumber(r.fruit) },
            { key: 'loss', label: 'Lost to disease', render: (r) => `${r.loss_share_pct}%` },
          ]}
        />
      </Card>

      <div className="gh-two" style={{ alignItems: 'start' }}>
        <Card title="Diseased plants" icon="fa-virus" right={<button type="button" className="btn btn-secondary btn-sm" onClick={() => go('disease')}>{t('Disease report')}</button>}>
          {o.diseased.length === 0 ? <p className="org-muted" style={{ margin: 0 }}>{t('No diseased plants in the latest counts.')}</p> : (
            <ul className="gh-health-hist">
              {o.diseased.map((p) => <li key={`${p.greenhouse}${p.row_id}${p.plant_label}`}><strong>{p.row_id} {p.plant_label}</strong><span>{p.crop} · {p.disease || t('Possible disease')} · {p.sick_fruit}/{p.fruit} {t('sick fruit')}</span></li>)}
            </ul>
          )}
        </Card>
        <Card title="Who is recording" icon="fa-user-group">
          {o.activity.people.length === 0 ? <p className="org-muted" style={{ margin: 0 }}>{t('Nothing was recorded in the last 7 days.')}</p> : (
            <ul className="gh-health-hist">
              {o.activity.people.map((p) => <li key={p.name}><strong>{p.name}</strong><span>{p.counts} {t('counts')} · {formatNumber(p.fruit)} {t('fruit')} {t('in 7 days')}</span></li>)}
            </ul>
          )}
        </Card>
      </div>

      {o.alerts.top.length > 0 && (
        <Card title="Needs a look" icon="fa-triangle-exclamation" right={<button type="button" className="btn btn-secondary btn-sm" onClick={() => go('alerts')}>{t('All alerts')}</button>}>
          <ul className="gh-health-hist">
            {o.alerts.top.map((a) => <li key={`${a.kind}${a.count_id}`}><strong>{a.greenhouse} {a.row_id} {a.plant_label}</strong><span>{a.message}</span></li>)}
          </ul>
        </Card>
      )}
      {o.notes.length > 0 && <ul className="gh-health-hist">{o.notes.map((n) => <li key={n}><i className="fas fa-circle-info" /><span>{n}</span></li>)}</ul>}
    </>
  );
}

/* -------------------------------------------------- data collector's page */
export function CollectorDashboard({ go }) {
  const { data: o, isLoading, isError, refetch } = useGhOverview();
  if (isLoading) return <Loading />;
  if (isError || !o || o.role !== 'collector') return <EmptyState icon="fa-exclamation-triangle" title="Could not load your day" actionLabel="Retry" onAction={refetch} />;
  const left = o.todo.reduce((s, h) => s + h.remaining, 0);
  const verdict = (s) => VERDICTS[s] || VERDICTS.not_checked;
  return (
    <>
      <div className="org-tiles">
        <Tile label="Recorded today" value={formatNumber(o.today.counts)} sub={`${formatNumber(o.today.fruit)} ${t('fruit')}`} />
        <Tile label="Recorded this week" value={formatNumber(o.week.counts)} sub={`${formatNumber(o.week.fruit)} ${t('fruit')}`} />
        <Tile label="Plants left this week" value={formatNumber(left)} sub={left === 0 ? t('All done') : t('not counted in 7 days')} />
      </div>
      <div style={{ margin: '4px 0 16px' }}><button type="button" className="btn btn-primary" onClick={() => go('layout')}><i className="fas fa-table-cells" /> {t('Open the plan and record')}</button></div>

      {o.recount.length > 0 && (
        <div className="alert-item alert-warning" style={{ marginBottom: 14 }}>
          <i className="fas fa-rotate" />
          <div className="alert-content">
            <strong>{t('Count again')}</strong> {t('The photo did not match these. Count the fruit again and take a clear photo of each part of the plant.')}
            <ul className="gh-health-hist" style={{ marginTop: 6 }}>{o.recount.map((r) => <li key={r.id}><strong>{r.greenhouse} {r.row_id} {r.plant_label}</strong><span>{t('you recorded')} {r.recorded_count} · {formatDate(r.count_date)}</span></li>)}</ul>
          </div>
        </div>
      )}

      {o.todo.map((h) => (
        <Card key={h.id} title={h.name} icon="fa-warehouse">
          <div className="gh-progress-label"><span>{h.counted_this_week} / {h.active_positions} {t('plants counted this week')}</span><span>{h.remaining} {t('left')}</span></div>
          <div className="gh-progress" role="progressbar" aria-valuenow={h.counted_this_week} aria-valuemin={0} aria-valuemax={h.active_positions}><i style={{ width: `${h.active_positions ? Math.round((h.counted_this_week / h.active_positions) * 100) : 0}%` }} /></div>
          {h.next.length > 0 && (
            <>
              <div className="org-muted" style={{ margin: '10px 0 6px' }}>{t('Next to record')}</div>
              <div className="gh-chips">
                {h.next.map((p) => <span className="gh-chip" key={`${p.row_id}${p.plant_label}`} title={p.last ? `${t('last counted')} ${formatDate(p.last)}` : t('never counted')}>{p.row_id} {p.plant_label}{p.last ? '' : ' •'}</span>)}
                {h.remaining > h.next.length && <span className="gh-chip gh-chip-more">+{h.remaining - h.next.length}</span>}
              </div>
            </>
          )}
        </Card>
      ))}

      <Card title="Your latest counts" icon="fa-clock-rotate-left">
        {o.recent.length === 0 ? <p className="org-muted" style={{ margin: 0 }}>{t('You have not recorded anything yet.')}</p> : (
          <ul className="gh-health-hist">
            {o.recent.map((r) => (
              <li key={r.id}>
                <strong>{r.greenhouse} {r.row_id} {r.plant_label}</strong>
                <span>{r.recorded_count} {t('fruit')} · {formatDate(r.count_date)} · <span className={`badge badge-${verdict(r.status).tone}`}><i className={`fas ${verdict(r.status).icon}`} /> {t(verdict(r.status).label)}</span></span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {o.frozen.length > 0 && (
        <Card title="Plants to leave alone" icon="fa-snowflake">
          <ul className="gh-health-hist">{o.frozen.map((f) => <li key={`${f.greenhouse}${f.row_id}${f.plant_label}`}><strong>{f.row_id} {f.plant_label}</strong><span>{f.reason || t('Frozen')}</span></li>)}</ul>
        </Card>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ alerts */
function AlertCard({ a }) {
  const toast = useToast();
  const { ackAlert } = useGhMutations();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const sev = SEVERITY[a.severity];
  const save = async (state) => {
    try {
      await ackAlert.mutateAsync({ id: a.count_id, kind: a.kind, ...(state === 'open' ? { state: 'open' } : { reason }) });
      setOpen(false);
      setReason('');
    } catch (e) { toast(e.message, 'error'); }
  };
  return (
    <div className={`gh-alert gh-alert-${a.severity} ${a.ack ? 'explained' : ''}`}>
      <div className="gh-alert-head">
        <strong>{a.greenhouse} {a.row_id} {a.plant_label}</strong>
        <span className="org-muted">{a.crop_name}</span>
        <span className={`badge badge-${sev.tone}`}>{t(sev.label)}</span>
        <span className="badge badge-info">{t(KIND[a.kind])}</span>
        <span className="org-muted" style={{ marginLeft: 'auto' }}>{formatDate(a.date)}</span>
      </div>
      <p style={{ margin: '6px 0' }}>{a.message}</p>
      <div className="org-muted">
        {a.kind === 'fall' && a.from ? `${formatDate(a.from.date)}: ${a.from.recorded}${a.from.photo != null ? ` (${t('photo')} ${a.from.photo})` : ''} → ${formatDate(a.to.date)}: ${a.to.recorded}${a.to.photo != null ? ` (${t('photo')} ${a.to.photo})` : ''}` : `${t('Recorded')} ${a.to.recorded} · ${t('photo')} ${a.to.photo}`}
        {a.to.entered_by_name ? ` · ${t('recorded by')} ${a.to.entered_by_name}` : ''}
      </div>
      {a.ack ? (
        <div className="gh-alert-ack"><i className="fas fa-check" /> {t('Explained')}: {a.ack.reason} <span className="org-muted">({a.ack.by_name || t('someone')}, {formatDate(String(a.ack.at).slice(0, 10))})</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => save('open')} disabled={ackAlert.isPending}>{t('Open again')}</button>
        </div>
      ) : open ? (
        <div className="gh-alert-form">
          <input className="form-control" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('What explains it? For example harvested on Tuesday, pruned, wind damage')} maxLength={300} aria-label={t('Explanation')} />
          <button type="button" className="btn btn-primary btn-sm" onClick={() => save()} disabled={reason.trim().length < 3 || ackAlert.isPending}>{t('Save')}</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(false)}>{t('Cancel')}</button>
        </div>
      ) : (
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}><i className="fas fa-comment" /> {t('Explain this')}</button>
      )}
    </div>
  );
}

export function AlertsTab() {
  const [days, setDays] = useState(30);
  const [show, setShow] = useState('open');
  const { data, isLoading, isError, refetch } = useGhAlerts({ days });
  if (isLoading) return <Loading />;
  if (isError || !data) return <EmptyState icon="fa-exclamation-triangle" title="Could not load the alerts" actionLabel="Retry" onAction={refetch} />;
  const S = data.summary;
  const list = data.alerts.filter((a) => (show === 'open' ? !a.ack : show === 'explained' ? !!a.ack : true));
  const flagged = data.people.filter((p) => p.flagged);
  return (
    <>
      <p className="ai-lead" style={{ marginTop: 0 }}>{t('These are signs to look into, not proof of theft: fruit also drops after a harvest, pruning, wind, pests and disease. Explain each one so only the unexplained stay open.')}</p>
      <div className="gh-toolbar">
        <select className="form-control" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label={t('Period')}>
          {[14, 30, 60, 90].map((d) => <option key={d} value={d}>{t('Last {{n}} days', { n: d })}</option>)}
        </select>
        <select className="form-control" value={show} onChange={(e) => setShow(e.target.value)} aria-label={t('Show')}>
          <option value="open">{t('Open')}</option><option value="explained">{t('Explained')}</option><option value="all">{t('All')}</option>
        </select>
      </div>
      <div className="org-tiles">
        <Tile label="Open alerts" value={formatNumber(S.open)} tone={S.open_high ? 'danger' : undefined} sub={`${S.open_high} ${t('high')}`} />
        <Tile label="Explained" value={formatNumber(S.explained)} />
        <Tile label="People to talk to" value={formatNumber(S.people_flagged)} sub={t('often record below the photo')} tone={S.people_flagged ? 'danger' : undefined} />
      </div>
      {flagged.length > 0 && (
        <div className="alert-item alert-warning" style={{ marginBottom: 14 }}>
          <i className="fas fa-user-clock" />
          <div className="alert-content">
            {flagged.map((p) => <div key={p.entered_by}><strong>{p.name || t('Someone')}</strong>: {p.under} {t('of')} {p.decided} {t('checked counts were below the photo')} ({p.under_share}%).</div>)}
          </div>
        </div>
      )}
      {list.length === 0 ? <EmptyState icon="fa-shield-halved" title={show === 'open' ? 'No open alerts' : 'Nothing here'} description="Every count agrees with its photo and no plant lost fruit without an explanation." /> : list.map((a) => <AlertCard key={`${a.kind}${a.count_id}`} a={a} />)}
    </>
  );
}
