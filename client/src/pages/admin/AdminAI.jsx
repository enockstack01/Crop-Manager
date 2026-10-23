import { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { EmptyState, Loading, PageHeader } from '../../components/ui.jsx';
import { useToast } from '../../components/Toast.jsx';
import { baseOptions, LEAF, useIsDark } from '../../features/dashboard/charts.jsx';
import { formatNumber } from '../../lib/format.js';
import { useAiAdmin, useAiAdminMutations } from '../../lib/aiAdmin.js';
import { t } from '../../i18n/index.js';

const FEATURES = {
  chat: 'Farm chat', diagnose: 'Disease detection', insights: 'Farm insights', advice_inputs: 'Advice: inputs', advice_planting: 'Advice: planting',
  advice_fertiliser: 'Advice: fertiliser', advice_irrigation: 'Advice: irrigation', advice_protection: 'Advice: protection', advice_harvest: 'Advice: harvest',
  summary: 'Season summary', record: 'Quick record', calculator: 'Calculator help', weather: 'Weather advice', admin_test: 'Connection test', translate: 'Translation',
};
const compact = (n) => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n || 0);

function Card({ title, icon, children, right }) {
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3><i className={`fas ${icon}`} style={{ color: 'var(--primary)', marginRight: 8 }} />{t(title)}</h3>
        {right}
      </div>
      <div className="card-body">{children}</div>
    </div>
  );
}

export default function AdminAI() {
  const toast = useToast();
  const dark = useIsDark();
  const [days, setDays] = useState(30);
  const { data, isLoading, isError } = useAiAdmin(days);
  const { saveModels, saveLimits, test } = useAiAdminMutations();
  const [enabled, setEnabled] = useState(null);
  const [tasks, setTasks] = useState(null);
  const [limits, setLimits] = useState(null);
  const [result, setResult] = useState({});

  useEffect(() => {
    if (data && enabled === null) {
      setEnabled(data.tiers.filter((x) => x.enabled).map((x) => x.id));
      setTasks(Object.fromEntries(data.tasks.map((x) => [x.id, x.tier])));
    }
  }, [data, enabled]);

  if (isLoading) return <Loading label="Loading AI settings..." />;
  if (isError || !data) return <EmptyState icon="fa-exclamation-triangle" title="Could not load the AI settings" />;

  const on = enabled || [];
  const toggle = (id) => {
    const next = on.includes(id) ? on.filter((x) => x !== id) : [...on, id];
    if (!next.length) return toast(t('Keep at least one model turned on'), 'error');
    setEnabled(next);
    setTasks((cur) => Object.fromEntries(Object.entries(cur).map(([k, v]) => [k, next.includes(v) ? v : next[0]])));
  };
  const saveM = async () => {
    try { await saveModels.mutateAsync({ enabled: on, tasks }); toast(t('Models saved')); } catch (err) { toast(err.message, 'error'); }
  };
  const lim = limits || { daily: data.limits.daily, hourly: data.limits.hourly };
  const saveL = async (e) => {
    e.preventDefault();
    try { await saveLimits.mutateAsync({ daily: Number(lim.daily), hourly: Number(lim.hourly) }); toast(t('AI limits saved')); setLimits(null); } catch (err) { toast(err.message, 'error'); }
  };
  const runTest = async (task) => {
    setResult((r) => ({ ...r, [task]: { busy: true } }));
    try {
      const out = await test.mutateAsync(task);
      setResult((r) => ({ ...r, [task]: { ok: true, ms: out.ms, tier: out.tier } }));
    } catch (err) {
      setResult((r) => ({ ...r, [task]: { ok: false, message: err.message } }));
    }
  };

  const u = data.usage;
  const labelOf = Object.fromEntries(data.tiers.map((x) => [x.id, x.label]));
  const dirty = JSON.stringify(on.slice().sort()) !== JSON.stringify(data.tiers.filter((x) => x.enabled).map((x) => x.id).sort())
    || data.tasks.some((x) => tasks && tasks[x.id] !== x.tier);

  return (
    <>
      <PageHeader title="AI assistant" subtitle="Choose the models the platform may use, set the limits per user and watch the usage." />

      <div className={`ai-status ${data.configured ? '' : 'ai-status-off'}`} style={{ marginBottom: 16 }}>
        <i className={`fas ${data.configured ? 'fa-circle-check' : 'fa-plug-circle-xmark'}`} />{' '}
        {data.configured ? t('The AI assistant is switched on.') : t('The AI assistant is not set up yet. Add the service key on the server to switch it on.')}
        {data.mock && <b> · {t('Sample answers (testing mode)')}</b>}
      </div>

      <Card title="Models" icon="fa-microchip" right={<button className="btn btn-primary btn-sm" onClick={saveM} disabled={!dirty || saveModels.isPending}>{t('Save models')}</button>}>
        <p className="org-muted" style={{ marginBottom: 12 }}>{t('Turn models on or off, then choose which one handles each kind of work. Faster models cost less; advanced models reason better but are slower.')}</p>
        <div className="org-tiles" style={{ marginBottom: 20 }}>
          {data.tiers.map((x) => (
            <label key={x.id} className="org-tile" style={{ cursor: 'pointer', borderColor: on.includes(x.id) ? 'var(--leaf)' : undefined }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={on.includes(x.id)} onChange={() => toggle(x.id)} style={{ accentColor: '#2E7D32', width: 18, height: 18 }} />
                <b>{t(x.label)}</b>
              </span>
              <span className="org-tile-sub">{t(x.description)}</span>
            </label>
          ))}
        </div>
        <div className="table-responsive">
          <table className="data-table">
            <thead><tr><th>{t('Work')}</th><th>{t('Model')}</th><th>{t('Check')}</th></tr></thead>
            <tbody>
              {data.tasks.map((x) => {
                const r = result[x.id];
                return (
                  <tr key={x.id}>
                    <td><b>{t(x.label)}</b></td>
                    <td>
                      <select className="form-control" style={{ maxWidth: 220 }} value={tasks?.[x.id] || x.tier} onChange={(e) => setTasks({ ...tasks, [x.id]: e.target.value })}>
                        {data.tiers.filter((m) => on.includes(m.id)).map((m) => <option key={m.id} value={m.id}>{t(m.label)}</option>)}
                      </select>
                    </td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => runTest(x.id)} disabled={r?.busy || dirty}>{r?.busy ? t('Testing…') : t('Test')}</button>
                      {r?.ok === true && <span className="badge badge-success" style={{ marginLeft: 8 }}>{t('Working')} · {r.ms} ms</span>}
                      {r?.ok === false && <span className="badge badge-danger" style={{ marginLeft: 8 }} title={r.message}>{t('Failed')}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {dirty && <p className="org-muted" style={{ marginTop: 8 }}>{t('Save the models before testing them.')}</p>}
      </Card>

      <Card title="Rate limits" icon="fa-gauge">
        <p className="org-muted" style={{ marginBottom: 12 }}>{t("Each user can make this many AI requests. Administrators are not limited. A different daily limit can be set on a user's page.")}</p>
        <form onSubmit={saveL} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{t('Requests per day')}</label>
            <input className="form-control" type="number" min="0" max="10000" value={lim.daily} onChange={(e) => setLimits({ ...lim, daily: e.target.value })} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{t('Requests per hour')}</label>
            <input className="form-control" type="number" min="0" max="10000" value={lim.hourly} onChange={(e) => setLimits({ ...lim, hourly: e.target.value })} />
          </div>
          <button className="btn btn-primary" disabled={saveLimits.isPending}>{t('Save')}</button>
        </form>
      </Card>

      <Card
        title="Usage"
        icon="fa-chart-column"
        right={
          <select className="dashboard-filter-select" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label={t('Period')}>
            {[7, 30, 90].map((d) => <option key={d} value={d}>{t('Last {{days}} days', { days: d })}</option>)}
          </select>
        }
      >
        <div className="org-tiles">
          <div className="org-tile"><span className="org-tile-label">{t('Requests')}</span><span className="org-tile-value">{formatNumber(u.totals.requests)}</span><span className="org-tile-sub">{u.totals.errors} {t('errors')}</span></div>
          <div className="org-tile"><span className="org-tile-label">{t('Users')}</span><span className="org-tile-value">{formatNumber(u.totals.users)}</span><span className="org-tile-sub">{u.totals.users_today} {t('today')}</span></div>
          <div className="org-tile"><span className="org-tile-label">{t('Words read')}</span><span className="org-tile-value">{compact(u.totals.input_tokens)}</span><span className="org-tile-sub">{compact(u.totals.cached_tokens)} {t('reused')}</span></div>
          <div className="org-tile"><span className="org-tile-label">{t('Words written')}</span><span className="org-tile-value">{compact(u.totals.output_tokens)}</span></div>
        </div>
        {u.by_day.length ? (
          <div style={{ height: 220, marginBottom: 20 }}>
            <Bar
              key={`ai-${dark}`}
              data={{ labels: u.by_day.map((d) => d.day.slice(5)), datasets: [{ label: t('Requests'), data: u.by_day.map((d) => d.requests), backgroundColor: LEAF, borderRadius: 4 }] }}
              options={{ ...baseOptions(), plugins: { ...baseOptions().plugins, legend: { display: false } } }}
            />
          </div>
        ) : <p className="org-muted">{t('No AI requests in this period yet.')}</p>}
        <div className="org-three">
          <div>
            <div className="farm-profile-section">{t('By model')}</div>
            <ul className="org-list">{u.by_model.map((m) => <li key={m.model}><b>{labelOf[m.model] ? t(labelOf[m.model]) : m.model}</b> · {m.requests} {t('requests')} · {compact(m.input_tokens + m.output_tokens)} {t('words')}{m.errors ? ` · ${m.errors} ${t('errors')}` : ''}</li>)}</ul>
          </div>
          <div>
            <div className="farm-profile-section">{t('By feature')}</div>
            <ul className="org-list">{u.by_feature.map((f) => <li key={f.feature}><b>{t(FEATURES[f.feature] || f.feature)}</b> · {f.requests}{f.errors ? ` · ${f.errors} ${t('errors')}` : ''}</li>)}</ul>
          </div>
          <div>
            <div className="farm-profile-section">{t('Heaviest users')}</div>
            <ul className="org-list">{u.top_users.map((x) => <li key={x.user_id}><b>{x.name}</b> · {x.count} {t('requests')}</li>)}</ul>
          </div>
        </div>
      </Card>
    </>
  );
}
