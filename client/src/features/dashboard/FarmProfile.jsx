import { useMemo } from 'react';
import { FitValue } from '../../components/ui.jsx';
import { t } from '../../i18n/index.js';

/*
 * Farm Profile — the first section of the dashboard, identical to the mobile app's
 * (mobile/src/features/dashboard/FarmProfileCard.tsx): branded farm header, farm
 * chips (drive the dashboard's farm filter), land-utilization ring by field status,
 * "Farm at a glance" KPI tiles, and land-by-field bars. Styles: styles/index.css
 * (.farm-profile*).
 */
const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const ha = (v) => `${(Math.round(v * 10) / 10).toLocaleString('en-US')} ha`;

const STATUS_COLOR = {
  Active: '#2E7D32',
  Preparing: '#1976D2',
  Maintenance: '#7B1FA2',
  Fallow: '#F9A825',
};

/** Ring gauge: one arc per segment, utilization % in the middle. */
function LandRing({ segments, total, pct, size = 170 }) {
  const stroke = Math.round(size * 0.11);
  const r = (size - stroke) / 2 - 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const visible = segments.filter((s) => s.value > 0 && total > 0);
  const gap = visible.length > 1 ? 3 : 0;
  let offset = 0;
  const arcs = visible.map((s) => {
    const len = Math.max(0, (s.value / total) * circ - gap);
    const arc = { ...s, dash: `${len} ${circ - len}`, offset: -offset };
    offset += (s.value / total) * circ;
    return arc;
  });
  return (
    <div className="farm-profile-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={c} cy={c} r={r} stroke="var(--bg)" strokeWidth={stroke} fill="none" />
        {arcs.map((a) => (
          <circle
            key={a.key}
            cx={c}
            cy={c}
            r={r}
            stroke={a.color}
            strokeWidth={stroke}
            strokeDasharray={a.dash}
            strokeDashoffset={a.offset}
            strokeLinecap={gap ? 'butt' : 'round'}
            fill="none"
          />
        ))}
      </svg>
      <div className="farm-profile-ring-label">
        <span className="farm-profile-ring-pct" style={{ fontSize: Math.round(size * 0.2) }}>{pct}%</span>
        <span className="farm-profile-ring-sub">{t('utilised')}</span>
      </div>
    </div>
  );
}

export function FarmProfile({ farms, fields, selected, onSelect, kpis = [], onKpiClick, dark }) {
  const p = useMemo(() => {
    const scopeFarms = selected ? farms.filter((f) => f.id === selected) : farms;
    const ids = new Set(scopeFarms.map((f) => f.id));
    const scopeFields = fields.filter((f) => ids.has(f.farm_id));
    const total = scopeFarms.reduce((s, f) => s + n(f.total_area), 0);
    const byStatus = { Active: 0, Preparing: 0, Maintenance: 0, Fallow: 0 };
    scopeFields.forEach((f) => {
      const st = f.status in byStatus ? f.status : 'Active';
      byStatus[st] += n(f.area);
    });
    const allocated = Object.values(byStatus).reduce((a, b) => a + b, 0);
    const ringTotal = Math.max(total, allocated);
    const segments = [
      { key: 'Active', label: 'Planted', value: byStatus.Active, color: STATUS_COLOR.Active },
      { key: 'Preparing', label: 'Preparing', value: byStatus.Preparing, color: STATUS_COLOR.Preparing },
      { key: 'Maintenance', label: 'Maintenance', value: byStatus.Maintenance, color: STATUS_COLOR.Maintenance },
      { key: 'Fallow', label: 'Fallow', value: byStatus.Fallow, color: STATUS_COLOR.Fallow },
      { key: 'Unallocated', label: 'Unallocated', value: Math.max(0, total - allocated), color: dark ? '#455A64' : '#CFD8DC' },
    ];
    const topFields = [...scopeFields].sort((a, b) => n(b.area) - n(a.area));
    return {
      farm: selected ? scopeFarms[0] : null,
      scopeFarms,
      scopeFields,
      total,
      ringTotal,
      segments,
      pct: ringTotal > 0 ? Math.round((byStatus.Active / ringTotal) * 100) : 0,
      topFields,
      maxField: Math.max(1, ...topFields.map((f) => n(f.area))),
    };
  }, [farms, fields, selected, dark]);

  const place = p.farm
    ? [p.farm.location, p.farm.district, p.farm.province].filter(Boolean).join(', ')
    : t(p.scopeFarms.length === 1 ? '{{count}} farm in your portfolio' : '{{count}} farms in your portfolio', { count: p.scopeFarms.length });
  const hasLand = p.total > 0 || p.scopeFields.length > 0;
  const shown = p.topFields.slice(0, 8);

  return (
    <section className="farm-profile" aria-label={t('Farm profile')}>
      <div className="farm-profile-banner">
        <div className="farm-profile-eyebrow">
          <i className="fas fa-map-location-dot" /> {t('Farm Profile · Overview')}
        </div>
        <div className="farm-profile-head">
          <div className="farm-profile-title">
            <h2>{p.farm ? p.farm.name : t('All Farms')}</h2>
            <p>{place || '—'}</p>
          </div>
          <div className="farm-profile-area">
            <strong>{ha(p.total)}</strong>
            <span>{p.farm?.farm_type ? `${t(p.farm.farm_type)} · ${t('total area')}` : t('total area')}</span>
          </div>
        </div>
      </div>

      <div className="farm-profile-chips" role="tablist" aria-label={t('Choose farm')}>
        {[{ id: '', name: t('All Farms') }, ...farms].map((f) => (
          <button
            key={f.id || 'all'}
            type="button"
            role="tab"
            aria-selected={f.id === selected}
            className={`farm-profile-chip ${f.id === selected ? 'active' : ''}`}
            onClick={() => onSelect(f.id)}
          >
            {f.name}
          </button>
        ))}
      </div>

      <div className="farm-profile-body">
        {hasLand ? (
          <div className="farm-profile-land">
            <LandRing segments={p.segments} total={p.ringTotal} pct={p.pct} />
            <ul className="farm-profile-legend">
              {p.segments.map((s) => (
                <li key={s.key} className={s.value > 0 ? '' : 'muted'}>
                  <span className="dot" style={{ background: s.color }} />
                  <span className="label">{t(s.label)}</span>
                  <b>{ha(s.value)}</b>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="farm-profile-empty">{t('Add a farm with its total area and fields to see land utilization.')}</p>
        )}

        {kpis.length ? (
          <div>
            <div className="farm-profile-section">{t('Farm at a glance')}</div>
            <div className="farm-profile-kpis">
              {kpis.map((k) => (
                <button key={k.label} type="button" className="farm-profile-kpi" onClick={() => onKpiClick?.(k.link)}>
                  <span className={`kpi-icon ${k.color}`}>
                    <i className={`fas ${k.icon}`} />
                  </span>
                  <span className="farm-profile-kpi-info">
                    <span className="farm-profile-kpi-label">{t(k.label)}</span>
                    {/* money in several currencies: one line per currency */}
                    {String(k.value).split(' · ').map((part) => (
                      <FitValue key={part} className="farm-profile-kpi-value" value={part} />
                    ))}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {shown.length ? (
          <div>
            <div className="farm-profile-section">{t('Land by field')}</div>
            <div className="farm-profile-fields">
              {shown.map((f) => {
                const color = STATUS_COLOR[f.status] ?? STATUS_COLOR.Active;
                return (
                  <div key={f.id} className="farm-profile-field">
                    <div className="farm-profile-field-row">
                      <span className="name">
                        {f.name}
                        {!selected && f.farms?.name ? <span className="farm"> · {f.farms.name}</span> : null}
                      </span>
                      <span className="status" style={{ color }}>{t(f.status || 'Active')}</span>
                      <b>{ha(n(f.area))}</b>
                    </div>
                    <div className="farm-profile-bar">
                      <span style={{ width: `${Math.max(4, (n(f.area) / p.maxField) * 100)}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
              {p.topFields.length > shown.length ? (
                <div className="farm-profile-more">
                  + {t(p.topFields.length - shown.length === 1 ? '{{count}} more field' : '{{count}} more fields', { count: p.topFields.length - shown.length })}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
