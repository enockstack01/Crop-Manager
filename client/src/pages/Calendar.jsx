import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { PageHeader, Loading } from '../components/ui.jsx';
import { Modal } from '../components/Modal.jsx';
import i18n, { t } from '../i18n/index.js';

/** Event kinds: colour (Google-style), legend label. */
export const KINDS = {
  planting: { color: '#2E7D32', label: 'Planting' },
  harvest: { color: '#F9A825', label: 'Harvest' },
  activity: { color: '#5B6B5D', label: 'Field work' },
  irrigation: { color: '#1976D2', label: 'Irrigation' },
  fertilizer: { color: '#8E24AA', label: 'Fertilizer' },
  protection: { color: '#EF6C00', label: 'Crop protection' },
  scouting: { color: '#00897B', label: 'Scouting' },
  maintenance: { color: '#6D4C41', label: 'Equipment service' },
  alert: { color: '#C62828', label: 'Alerts' },
  weather: { color: '#0277BD', label: 'Weather' },
};

const pad = (n) => String(n).padStart(2, '0');
const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (k) => new Date(`${k}T12:00:00`);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfWeek = (d) => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }; // weeks start on Monday
const lang = () => i18n.language || 'en';
const fmt = (d, o) => d.toLocaleDateString(lang(), o);

const eventText = (e) => `${t(e.label)}${e.name ? `: ${e.name}` : ''}`;

export default function Calendar() {
  const navigate = useNavigate();
  const [view, setView] = useState('month'); // month | week | agenda
  const [cursor, setCursor] = useState(() => new Date());
  const [hidden, setHidden] = useState(() => new Set());
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null); // an event, or { day, events }

  // the grid always shows 6 weeks around the cursor; one request covers it
  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = startOfWeek(first);
    return { start, days: Array.from({ length: 42 }, (_, i) => addDays(start, i)) };
  }, [cursor]);
  const range = view === 'month' ? { from: key(grid.days[0]), to: key(grid.days[41]) }
    : view === 'week' ? { from: key(startOfWeek(cursor)), to: key(addDays(startOfWeek(cursor), 6)) }
      : { from: key(addDays(new Date(), -7)), to: key(addDays(new Date(), 90)) };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['calendar', range.from, range.to],
    queryFn: () => api.get('/calendar', { params: range }).then((r) => r.data),
    keepPreviousData: true,
  });

  const needle = q.trim().toLowerCase();
  const events = useMemo(() => (data?.events || []).filter((e) => !hidden.has(e.type) && (!needle || `${e.label} ${e.name} ${e.subtitle || ''}`.toLowerCase().includes(needle))), [data, hidden, needle]);
  const byDay = useMemo(() => {
    const m = new Map();
    for (const e of events) { if (!m.has(e.date)) m.set(e.date, []); m.get(e.date).push(e); }
    return m;
  }, [events]);
  const alerts = useMemo(() => (data?.events || []).filter((e) => (e.type === 'alert' || e.type === 'weather' || e.status === 'overdue') && e.date >= data.today).slice(0, 6), [data]);
  const overdue = (data?.events || []).filter((e) => e.status === 'overdue');
  const today = key(new Date());

  const move = (dir) => {
    if (view === 'month') setCursor((c) => new Date(c.getFullYear(), c.getMonth() + dir, 1));
    else if (view === 'week') setCursor((c) => addDays(c, 7 * dir));
    else setCursor((c) => addDays(c, 30 * dir));
  };
  const title = view === 'month' ? fmt(cursor, { month: 'long', year: 'numeric' })
    : view === 'week' ? `${fmt(startOfWeek(cursor), { day: 'numeric', month: 'short' })} – ${fmt(addDays(startOfWeek(cursor), 6), { day: 'numeric', month: 'short', year: 'numeric' })}`
      : t('Next 90 days');
  const toggle = (k) => setHidden((h) => { const n = new Set(h); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const weekdays = Array.from({ length: 7 }, (_, i) => fmt(addDays(startOfWeek(new Date()), i), { weekday: 'short' }));

  const chip = (e) => (
    <button type="button" key={e.id} className={`cal-chip ${e.status}`} style={{ '--c': KINDS[e.type]?.color }} onClick={(ev) => { ev.stopPropagation(); setOpen(e); }} title={eventText(e)}>
      <span>{eventText(e)}</span>
    </button>
  );

  return (
    <>
      <PageHeader title="Calendar" subtitle="Plantings, harvests, farm work, alerts and weather on one calendar." />

      {alerts.length > 0 && (
        <div className="cal-alerts">
          <strong><i className="fas fa-bell" /> {t('Needs attention')}</strong>
          {alerts.map((e) => (
            <button type="button" key={e.id} onClick={() => setOpen(e)}>
              <i className="fas fa-circle" style={{ color: KINDS[e.type]?.color }} /> {eventText(e)} <small>{fmt(fromKey(e.date), { day: 'numeric', month: 'short' })}</small>
            </button>
          ))}
          {overdue.length > alerts.length && <small>{t('{{n}} items overdue in this view', { n: overdue.length })}</small>}
        </div>
      )}

      <div className="cal-bar">
        <div className="cal-nav">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCursor(new Date())}>{t('Today')}</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => move(-1)} aria-label={t('Previous')}><i className="fas fa-chevron-left" /></button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => move(1)} aria-label={t('Next')}><i className="fas fa-chevron-right" /></button>
          <h2 className="cal-title">{title}</h2>
        </div>
        <div className="cal-tools">
          <div className="table-search"><i className="fas fa-search" /><input type="text" value={q} placeholder={t('Search the calendar...')} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="cal-views" role="tablist">
            {['month', 'week', 'agenda'].map((v) => (
              <button type="button" key={v} role="tab" aria-selected={view === v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>{t(v === 'month' ? 'Month' : v === 'week' ? 'Week' : 'Agenda')}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="cal-legend">
        {Object.entries(KINDS).map(([k, v]) => (
          <button type="button" key={k} className={hidden.has(k) ? 'off' : ''} onClick={() => toggle(k)} aria-pressed={!hidden.has(k)}>
            <i style={{ background: v.color }} /> {t(v.label)}
          </button>
        ))}
      </div>

      {isError ? (
        <div className="empty-state"><p>{t('The calendar could not be loaded.')}</p><button type="button" className="btn btn-secondary" onClick={() => refetch()}>{t('Try again')}</button></div>
      ) : isLoading && !data ? <Loading /> : (
        <>
          {view === 'month' && (
            <div className="cal-month">
              <div className="cal-head">{weekdays.map((w) => <div key={w}>{w}</div>)}</div>
              <div className="cal-grid">
                {grid.days.map((d) => {
                  const k = key(d);
                  const list = byDay.get(k) || [];
                  const inMonth = d.getMonth() === cursor.getMonth();
                  return (
                    <div key={k} className={`cal-day ${inMonth ? '' : 'out'} ${k === today ? 'today' : ''}`} onClick={() => setOpen({ day: k, events: list })}>
                      <div className="cal-num"><span>{d.getDate()}</span></div>
                      {list.slice(0, 3).map(chip)}
                      {list.length > 3 && <button type="button" className="cal-more" onClick={(ev) => { ev.stopPropagation(); setOpen({ day: k, events: list }); }}>{t('+{{n}} more', { n: list.length - 3 })}</button>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {view === 'week' && (
            <div className="cal-week">
              {Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i)).map((d) => {
                const k = key(d);
                const list = byDay.get(k) || [];
                return (
                  <div key={k} className={`cal-wcol ${k === today ? 'today' : ''}`}>
                    <div className="cal-whead"><small>{fmt(d, { weekday: 'short' })}</small><span>{d.getDate()}</span></div>
                    {list.length === 0 ? <p className="cal-none">{t('Nothing planned')}</p> : list.map((e) => (
                      <button type="button" key={e.id} className={`cal-card ${e.status}`} style={{ '--c': KINDS[e.type]?.color }} onClick={() => setOpen(e)}>
                        <strong>{eventText(e)}</strong>
                        {e.subtitle && <span>{e.subtitle}</span>}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {view === 'agenda' && (
            <div className="cal-agenda">
              {[...byDay.entries()].length === 0 && <p className="cal-none">{t('Nothing planned in this period.')}</p>}
              {[...byDay.entries()].map(([k, list]) => (
                <div key={k} className={`cal-arow ${k === today ? 'today' : ''}`}>
                  <div className="cal-adate"><span>{fromKey(k).getDate()}</span><small>{fmt(fromKey(k), { month: 'short', weekday: 'short' })}</small></div>
                  <div className="cal-alist">
                    {list.map((e) => (
                      <button type="button" key={e.id} className={`cal-card ${e.status}`} style={{ '--c': KINDS[e.type]?.color }} onClick={() => setOpen(e)}>
                        <strong>{eventText(e)}</strong>
                        {e.subtitle && <span>{e.subtitle}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {data?.bands?.length > 0 && view === 'month' && (
        <p className="cal-bands">{data.bands.map((b) => `${b.name}: ${fmt(fromKey(b.start), { day: 'numeric', month: 'short' })} – ${fmt(fromKey(b.end), { day: 'numeric', month: 'short' })}`).join('  ·  ')}</p>
      )}

      {open && (
        <Modal open title={open.day ? fmt(fromKey(open.day), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : eventText(open)} onClose={() => setOpen(null)} size="md">
          {open.day ? (
            open.events.length === 0 ? <p className="cal-none">{t('Nothing planned')}</p> : (
              <div className="cal-alist">
                {open.events.map((e) => (
                  <button type="button" key={e.id} className={`cal-card ${e.status}`} style={{ '--c': KINDS[e.type]?.color }} onClick={() => setOpen(e)}>
                    <strong>{eventText(e)}</strong>
                    {e.subtitle && <span>{e.subtitle}</span>}
                  </button>
                ))}
              </div>
            )
          ) : (
            <div className="cal-detail">
              <p><span className="cal-dot" style={{ background: KINDS[open.type]?.color }} /> {t(KINDS[open.type]?.label)} · {fmt(fromKey(open.date), { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}{open.status === 'overdue' ? ` · ${t('Overdue')}` : open.status === 'done' ? ` · ${t('Done')}` : ''}</p>
              {open.subtitle && <p className="cal-sub">{open.subtitle}</p>}
              {open.details?.length > 0 && (
                <table className="calc-table"><tbody>{open.details.map(([a, b]) => (<tr key={a}><th>{t(a)}</th><td>{String(b)}</td></tr>))}</tbody></table>
              )}
              <div className="cal-actions"><button type="button" className="btn btn-primary" onClick={() => navigate(open.route)}>{t('Open')}</button></div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
