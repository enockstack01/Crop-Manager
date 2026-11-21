import { Link } from 'react-router-dom';
import { EmptyState, Loading, PageHeader } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';
import { formatDate, formatNumber } from '../lib/format.js';
import { ago, useCollectorDashboard, useTaskDone } from '../lib/team.js';
import { t } from '../i18n/index.js';

/*
 * The data collector's dashboard: today's entry count, a big button for each kind of field record, their open tasks, the fields that need a
 * check, and their own latest entries. Nothing about money, reports or the rest of the team.
 */
const PAGE = {
  'planting-records': { to: '/planting', icon: 'fa-seedling' },
  'field-activities': { to: '/activities', icon: 'fa-tasks' },
  'irrigation-records': { to: '/irrigation', icon: 'fa-tint' },
  'fertilizer-applications': { to: '/fertilizers', icon: 'fa-flask' },
  'crop-protection-records': { to: '/crop-protection', icon: 'fa-shield-alt' },
  'crop-scouting-records': { to: '/scouting', icon: 'fa-search' },
  'harvest-records': { to: '/harvest', icon: 'fa-wheat-awn' },
  greenhouse: { to: '/greenhouse', icon: 'fa-warehouse' },
};
const LABEL = { 'planting-records': 'Planting', 'field-activities': 'Field activity', 'irrigation-records': 'Irrigation', 'fertilizer-applications': 'Fertilizer', 'crop-protection-records': 'Crop protection', 'crop-scouting-records': 'Scouting', 'harvest-records': 'Harvest', greenhouse: 'Greenhouse count' };

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

export default function CollectorHome() {
  const toast = useToast();
  const { data: d, isLoading, isError, refetch } = useCollectorDashboard();
  const done = useTaskDone();
  if (isLoading) return <Loading />;
  if (isError || !d) return <EmptyState icon="fa-exclamation-triangle" title="Could not load your day" actionLabel="Retry" onAction={refetch} />;
  const markDone = async (task) => {
    try { await done.mutateAsync({ id: task.id, status: 'done' }); toast(t('Marked done')); } catch (e) { toast(e.message, 'error'); }
  };
  const when = (iso) => { const a = ago(iso); return a ? t(a.key, { n: a.n, date: a.date ? formatDate(a.date) : '' }) : ''; };

  return (
    <>
      <PageHeader title="Today" subtitle={d.farm_manager ? t('You are recording for {{name}}.', { name: d.farm_manager }) : 'Record what you do in the field.'} />
      <div className="org-tiles">
        <div className="org-tile"><span className="org-tile-label">{t('Entries today')}</span><span className="org-tile-value">{formatNumber(d.today.entries)}</span></div>
        <div className="org-tile"><span className="org-tile-label">{t('Entries this week')}</span><span className="org-tile-value">{formatNumber(d.week.entries)}</span></div>
        <div className="org-tile" style={d.tasks.overdue ? { borderColor: 'var(--danger, #C62828)' } : undefined}><span className="org-tile-label">{t('Open tasks')}</span><span className="org-tile-value">{formatNumber(d.tasks.open)}</span>{d.tasks.overdue ? <span className="org-tile-sub">{d.tasks.overdue} {t('late')}</span> : null}</div>
      </div>

      <Card title="Record" icon="fa-plus-circle">
        <div className="gh-big-buttons">
          {d.record.map((r) => {
            const p = PAGE[r.path];
            return p ? <Link key={r.path} className="gh-big-button" to={`${p.to}?add=1`}><i className={`fas ${p.icon}`} /><span>{t(LABEL[r.path] || r.label)}</span></Link> : null;
          })}
        </div>
      </Card>

      <div className="gh-two" style={{ alignItems: 'start' }}>
        <Card title="My open tasks" icon="fa-list-check" right={<Link className="btn btn-secondary btn-sm" to="/tasks">{t('All tasks')}</Link>}>
          {d.tasks.items.length === 0 ? <p className="org-muted" style={{ margin: 0 }}>{t('Nothing to do right now.')}</p> : (
            <ul className="gh-health-hist">
              {d.tasks.items.map((task) => (
                <li key={task.id}>
                  <strong>{task.title}</strong>
                  <span>
                    {task.due_date ? <span className={task.overdue ? 'text-danger' : ''}>{task.overdue ? t('Late') : t('Due')} {formatDate(task.due_date)} · </span> : null}
                    {task.mine ? t('for you') : t('for everyone')}
                    {' '}<button type="button" className="btn btn-secondary btn-sm" onClick={() => markDone(task)} disabled={done.isPending}><i className="fas fa-check" /> {t('Done')}</button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Fields that need a check" icon="fa-search">
          {d.needs_check.length === 0 ? <p className="org-muted" style={{ margin: 0 }}>{t('Every field was checked in the last week.')}</p> : (
            <ul className="gh-health-hist">
              {d.needs_check.map((f) => <li key={f.id}><strong>{f.name}</strong><span>{f.last_checked ? `${t('last checked')} ${formatDate(f.last_checked)}` : t('never checked')} · <Link to="/scouting?add=1">{t('Scout it')}</Link></span></li>)}
            </ul>
          )}
        </Card>
      </div>

      <Card title="My latest entries" icon="fa-clock-rotate-left">
        {d.recent.length === 0 ? <p className="org-muted" style={{ margin: 0 }}>{t('You have not recorded anything yet.')}</p> : (
          <ul className="gh-health-hist">
            {d.recent.map((r) => <li key={`${r.path}${r.id}`}><strong>{t(r.kind)}</strong><span>{r.hint ? `${r.hint} · ` : ''}{r.date ? formatDate(r.date) : ''} · {when(r.created_at)}</span></li>)}
          </ul>
        )}
      </Card>
    </>
  );
}
