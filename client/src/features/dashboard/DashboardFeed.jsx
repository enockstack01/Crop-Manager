import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MiniColumns } from './MicroViz.jsx';
import { ALERT_KINDS, UPCOMING_DAYS, relativeDay } from './insights.js';
import { t } from '../../i18n/index.js';

/* The dashboard's activity cards, built to be scanned rather than read (after
   LivestockPro's DashboardFeed): Recent Activity (12-week chart + compact rows),
   Upcoming Harvests (30-day timeline + date cards) and Alerts (count chips that
   filter the list). The mobile app shows the same. */

function FeedCard({ title, icon, iconColor, right, className = '', children }) {
  return (
    <div className={`chart-card feed-card ${className}`}>
      <div className="chart-card-header">
        <h3><i className={`fas fa-${icon}`} style={{ color: iconColor, marginRight: 8 }} />{t(title)}</h3>
        {right}
      </div>
      <div className="chart-card-body feed-body">{children}</div>
    </div>
  );
}

const Empty = ({ icon, text, color }) => (
  <div className="feed-empty"><i className={`fas fa-${icon}`} style={color ? { color } : undefined} />{t(text)}</div>
);

export function RecentActivity({ activity }) {
  const navigate = useNavigate();
  const { items, weeks } = activity;
  const total = weeks.reduce((s, w) => s + w.count, 0);
  return (
    <FeedCard title="Recent Activity" icon="clock-rotate-left" iconColor="var(--purple)">
      {total > 0 && (
        <div className="activity-chart">
          <div className="activity-chart-head"><span>{t('Activities · last 12 weeks')}</span><b>{total}</b></div>
          <MiniColumns bars={weeks.map((w) => ({ label: w.label, value: w.count }))} color="var(--primary)" height={44} fmt={String} ends />
        </div>
      )}
      {items.length === 0 ? <Empty icon="inbox" text="No recent activities" /> : (
        <div className="feed-rows">
          {items.map((a) => (
            <button key={a.id} type="button" className="feed-row" onClick={() => navigate('/activities')} title={`${a.name} · ${a.sub}`}>
              <span className={`feed-chip tone-${a.color}`}><i className={`fas fa-${a.icon}`} /></span>
              <span className="feed-row-main">
                <span className="feed-row-name">{a.name}</span>
                <span className="feed-row-sub">{a.sub || '—'}</span>
              </span>
              <span className="feed-row-end">
                {a.cost && <span className="feed-value">{a.cost}</span>}
                <span className="feed-row-time">{relativeDay(a.date)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </FeedCard>
  );
}

export function UpcomingHarvests({ items }) {
  const navigate = useNavigate();
  // one timeline stop per day, with the number of harvests that day
  const stops = [...items.reduce((m, e) => {
    const s = m.get(e.daysLeft) || { ...e, count: 0, names: [] };
    s.count += 1;
    s.names.push(e.name);
    return m.set(e.daysLeft, s);
  }, new Map()).values()];
  const countdown = (n) => (n === 0 ? t('Today') : n === 1 ? t('Tomorrow') : t('in {{count}} days', { count: n }));
  return (
    <FeedCard
      title="Upcoming Harvests"
      icon="calendar-days"
      iconColor="var(--blue)"
      right={items.length > 0 && <span className="feed-count">{items.length}</span>}
    >
      {items.length === 0 ? <Empty icon="calendar" text={t('No harvests in the next {{count}} days', { count: UPCOMING_DAYS })} /> : (
        <>
          <div className="timeline" aria-hidden="true">
            <div className="timeline-track">
              {stops.map((s) => (
                <span key={s.daysLeft} className={`timeline-stop${s.ready ? ' ready' : ''}`} style={{ left: `${(s.daysLeft / UPCOMING_DAYS) * 100}%` }} title={`${s.day} ${s.month}: ${s.names.join(', ')}`}>
                  <small>{s.day}</small>
                  <span className="timeline-dot">{s.count > 1 ? s.count : ''}</span>
                </span>
              ))}
            </div>
            <div className="timeline-scale"><span>{t('Today')}</span><span>+15</span><span>+{UPCOMING_DAYS}</span></div>
          </div>
          <div className="event-cards">
            {items.slice(0, 6).map((e) => (
              <button key={e.id} type="button" className={`event-card${e.ready ? ' ready' : ''}`} onClick={() => navigate('/crop-cycles')} title={`${e.name} · ${e.sub}`}>
                <span className="event-date"><b>{e.day}</b><small>{e.month}</small></span>
                <span className="event-name">{e.name}</span>
                <span className="event-kind">{e.sub || '—'}</span>
                <span className="event-countdown">{e.ready ? t('Ready now') : countdown(e.daysLeft)}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </FeedCard>
  );
}

export function AlertsCard({ items, className }) {
  const navigate = useNavigate();
  const [kind, setKind] = useState('');
  const kinds = Object.entries(ALERT_KINDS)
    .map(([key, k]) => ({ key, ...k, count: items.filter((a) => a.kind === key).length }))
    .filter((k) => k.count > 0);
  const shown = (kind ? items.filter((a) => a.kind === kind) : items).slice(0, 8);
  const badge = (a) => {
    if (a.days == null) return null;
    if (a.days < 0) return <span className="alert-badge late">{t('{{count}} days late', { count: -a.days })}</span>;
    return <span className="alert-badge soon">{a.days === 0 ? t('Today') : t('in {{count}} days', { count: a.days })}</span>;
  };
  return (
    <FeedCard
      title="Alerts"
      className={className}
      icon="bell"
      iconColor="var(--orange)"
      right={items.length > 0 && <span className="feed-count danger">{items.length}</span>}
    >
      {items.length === 0 ? <Empty icon="circle-check" color="var(--primary)" text="All clear — no alerts" /> : (
        <>
          <div className="alert-kinds" role="tablist">
            {kinds.map((k) => (
              <button
                key={k.key}
                type="button"
                role="tab"
                aria-selected={kind === k.key}
                className={`alert-kind tone-${k.color}${kind === k.key ? ' active' : ''}`}
                onClick={() => setKind(kind === k.key ? '' : k.key)}
              >
                <i className={`fas fa-${k.icon}`} /><b>{k.count}</b><span>{t(k.label)}</span>
              </button>
            ))}
          </div>
          <div className="feed-rows">
            {shown.map((a) => (
              <button key={a.id} type="button" className="feed-row" onClick={() => navigate(a.link)} title={`${a.name} — ${a.sub}`}>
                <span className={`feed-chip tone-${a.tone}`}><i className={`fas fa-${a.icon}`} /></span>
                <span className="feed-row-main">
                  <span className="feed-row-name">{a.name}</span>
                  <span className="feed-row-sub">{a.sub}</span>
                </span>
                <span className="feed-row-end">{badge(a)}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </FeedCard>
  );
}
