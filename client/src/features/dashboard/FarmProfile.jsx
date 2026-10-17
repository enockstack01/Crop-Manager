import { useMemo } from 'react';
import { FitValue } from '../../components/ui.jsx';
import { buildProfile, STATUS_COLOR } from './farmModel.js';
import { t } from '../../i18n/index.js';

/*
 * Farm Profile: the first section of the dashboard, the same as the mobile app's
 * (mobile/src/features/dashboard/FarmProfileCard.tsx). It shows what is happening on the farm:
 * land by field status, what is growing now (open crop cycles by crop), the crop cycle pipeline,
 * the headline figures, and how much of each field is under crop. The numbers come from
 * farmModel.js. Styles: styles/farm-profile.css.
 */
const ha = (v) => `${(Math.round(v * 10) / 10).toLocaleString('en-US')} ha`;

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

export function FarmProfile({ farms, fields, cycles = [], selected, onSelect, kpis = [], onKpiClick, dark }) {
  const p = useMemo(() => buildProfile({ farms, fields, cycles, selected, dark }), [farms, fields, cycles, selected, dark]);

  const place = p.farm
    ? [p.farm.location, p.farm.district, p.farm.province].filter(Boolean).join(', ')
    : t(p.scopeFarms.length === 1 ? '{{count}} farm in your portfolio' : '{{count}} farms in your portfolio', { count: p.scopeFarms.length });
  const hasLand = p.total > 0 || p.scopeFields.length > 0;
  const shown = p.fieldRows.slice(0, 8);
  const cropTotal = p.crops.reduce((s, c) => s + c.ha, 0);

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
          <div className="fp-grid">
            <div className="fp-panel">
              <div className="farm-profile-section">{t('Land use')}</div>
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
            </div>

            <div className="fp-panel">
              <div className="farm-profile-section">{t('What is growing now')}</div>
              {p.crops.length ? (
                <>
                  <div className="fp-headline">
                    <b>{ha(p.underCrop)}</b> {t('under crop')} · {p.underCropPct}% {t('of the farm')} ·{' '}
                    {t(p.openCount === 1 ? '{{count}} open crop cycle' : '{{count}} open crop cycles', { count: p.openCount })}
                  </div>
                  <div className="fp-stack" role="img" aria-label={t('Area under each crop')}>
                    {p.crops.filter((c) => c.ha > 0).map((c) => (
                      <span key={c.name} style={{ width: `${(c.ha / (cropTotal || 1)) * 100}%`, background: c.color }} title={`${c.name}: ${ha(c.ha)}`} />
                    ))}
                  </div>
                  <ul className="fp-crops">
                    {p.crops.map((c) => (
                      <li key={c.name}>
                        <span className="dot" style={{ background: c.color }} />
                        <span className="label">{c.name === 'Other crops' ? t(c.name) : c.name}</span>
                        <span className="muted">{t(c.cycles === 1 ? '{{count}} cycle' : '{{count}} cycles', { count: c.cycles })}</span>
                        <b>{ha(c.ha)}</b>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="farm-profile-empty">{t('No crop cycle is open. Add a crop cycle to see what is growing.')}</p>
              )}
            </div>
          </div>
        ) : (
          <p className="farm-profile-empty">{t('Add a farm with its total area and fields to see land utilization.')}</p>
        )}

        {p.openCount > 0 ? (
          <div>
            <div className="farm-profile-section">{t('Crop cycle pipeline')}</div>
            <div className="fp-pipeline">
              {p.pipeline.map((st, i) => (
                <div key={st.key} className={`fp-stage ${st.count ? '' : 'empty'}`}>
                  <span className="fp-stage-dot" style={{ background: st.color, color: st.key === 'Ready for Harvest' ? '#1C2B1E' : '#fff' }}>{i + 1}</span>
                  <span className="fp-stage-count">{st.count}</span>
                  <span className="fp-stage-label">{t(st.label)}</span>
                  <span className="fp-stage-ha">{ha(st.ha)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

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
            <div className="farm-profile-section">{t('Fields: land and crop')}</div>
            <div className="farm-profile-fields">
              {shown.map((f) => {
                const color = STATUS_COLOR[f.status] ?? STATUS_COLOR.Active;
                return (
                  <div key={f.id} className="farm-profile-field">
                    <div className="farm-profile-field-row">
                      <span className="name">
                        {f.name}
                        {!selected && f.farm ? <span className="farm"> · {f.farm}</span> : null}
                      </span>
                      <span className="status" style={{ color: f.status === 'Fallow' ? 'var(--text-light)' : color }}>{t(f.status)}</span>
                      <b>{ha(f.area)}</b>
                    </div>
                    <div className="fp-meter" title={`${ha(f.planted)} / ${ha(f.area)}`}>
                      <span style={{ width: `${f.pct}%`, background: color }} />
                    </div>
                    <div className="fp-field-crop">
                      {f.crops.length ? (
                        <>
                          <b>{f.crops.join(', ')}</b> · {t(f.stage === 'Ready for Harvest' ? 'Ready to harvest' : f.stage)} · {f.pct}% {t('planted')}
                        </>
                      ) : (
                        <span className="muted">{t('Nothing planted')}</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {p.fieldRows.length > shown.length ? (
                <div className="farm-profile-more">
                  + {t(p.fieldRows.length - shown.length === 1 ? '{{count}} more field' : '{{count}} more fields', { count: p.fieldRows.length - shown.length })}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
