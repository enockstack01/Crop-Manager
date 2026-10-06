import { Meter, MiniColumns, Ring, SplitBar } from './MicroViz.jsx';
import { formatCompact } from './valueLabels.js';
import { t } from '../../i18n/index.js';

/* Key insights as tiles — a figure, a short label and a small chart — instead of
   sentences; the sentence stays as the tile's hover text and accessible name.
   Same tiles as the mobile app (mobile/src/features/dashboard/InsightTiles.tsx). */

export const TONE = {
  good: { color: '#2E7D32', icon: 'circle-check' },
  warn: { color: '#F57F17', icon: 'triangle-exclamation' },
  bad: { color: '#D32F2F', icon: 'circle-exclamation' },
  info: { color: '#1976D2', icon: 'circle-info' },
};

function Viz({ viz: v, color }) {
  if (v.kind === 'ring') {
    return (
      <div className="insight-row">
        <Ring pct={v.pct} color={color}><b>{v.figure}</b></Ring>
        {v.sub && <span className="insight-sub">{v.sub}</span>}
      </div>
    );
  }
  if (v.kind === 'meter') {
    return (
      <>
        <div className="insight-figure">{v.figure}</div>
        <Meter value={v.value} max={v.max} color={color} />
        {v.sub && <div className="insight-sub">{v.sub}</div>}
      </>
    );
  }
  if (v.kind === 'split') {
    return (
      <>
        <div className="insight-figure">{v.figure}</div>
        <SplitBar parts={v.parts.map((p) => ({ ...p, color: TONE[p.tone].color }))} />
      </>
    );
  }
  if (v.kind === 'trend') {
    return (
      <>
        <div className="insight-figure">
          <i className={`fas fa-arrow-trend-${v.dir}`} style={{ color, marginRight: 6 }} />
          {v.figure}
        </div>
        <MiniColumns bars={v.bars} color={color} height={34} />
        {v.unit && <div className="insight-sub">{v.unit}</div>}
      </>
    );
  }
  if (v.kind === 'columns') {
    return (
      <>
        <div className="insight-figure">{v.figure}</div>
        {v.sub && <div className="insight-sub">{v.sub}</div>}
        <MiniColumns bars={v.bars} color={color} height={34} fmt={v.plain ? String : formatCompact} />
      </>
    );
  }
  return (
    <div className="insight-figure">
      {v.icon && <i className={`fas fa-${v.icon}`} style={{ color, marginRight: 8, fontSize: '0.8em' }} />}
      {v.figure} {v.sub && <small>{v.sub}</small>}
    </div>
  );
}

export function InsightTiles({ insights }) {
  if (!insights.length) return null;
  return (
    <div className="chart-card full-width insights-card">
      <div className="chart-card-header">
        <h3><i className="fas fa-lightbulb" style={{ color: 'var(--orange)', marginRight: 8 }} />{t('Key insights')}</h3>
      </div>
      <div className="insight-tiles">
        {insights.map((ins) => {
          const tone = TONE[ins.tone];
          return (
            <div key={ins.id} className="insight-tile" title={ins.sentence} aria-label={ins.sentence} role="group" style={{ '--tile-accent': tone.color }}>
              <div className="insight-label">
                <i className={`fas fa-${tone.icon}`} style={{ color: tone.color }} />
                <span>{ins.label}</span>
              </div>
              <div className="insight-body">
                <Viz viz={ins.viz} color={tone.color} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
