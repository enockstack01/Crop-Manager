import { formatCompact } from './valueLabels.js';

/*
 * Small charts for dashboard tiles (after LivestockPro's MicroViz): mini columns,
 * meter, ring gauge and a split bar. Every chart prints its numbers, and every mark
 * has a title so hovering shows its value.
 */

/** HTML columns (rounded ends stay round at any width), each with its value on top.
 * `ends` labels only the first and last column (for long series). */
export function MiniColumns({ bars, color, height = 40, fmt = formatCompact, ends = false }) {
  if (!bars?.length) return null;
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div className="micro-wrap">
      <div className="micro-cols" style={{ height }} role="img" aria-label={bars.map((b) => `${b.label}: ${fmt(b.value)}`).join(', ')}>
        {bars.map((b, i) => {
          const h = (b.value / max) * 100;
          return (
            <span key={i} className="micro-col" title={`${b.label}: ${fmt(b.value)}`}>
              <span className="micro-col-bar" style={{ height: b.value ? `max(2px, ${h}%)` : 0, background: color }} />
              <em className="micro-col-val" style={{ bottom: `calc(${h}% + 2px)` }}>{fmt(b.value)}</em>
            </span>
          );
        })}
      </div>
      <div className={`micro-axis${ends ? ' ends' : ''}`}>
        {ends ? (
          <>
            <span>{bars[0].label}</span>
            <span>{bars[bars.length - 1].label}</span>
          </>
        ) : (
          bars.map((b, i) => <span key={i}>{b.label}</span>)
        )}
      </div>
    </div>
  );
}

export function Meter({ value, max, color, title }) {
  const p = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className="micro-meter" title={title} role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <span style={{ width: `${p}%`, background: color }} />
    </div>
  );
}

export function Ring({ pct, color, size = 64, stroke = 7, children, title }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const len = (Math.max(0, Math.min(100, pct)) / 100) * circ;
  return (
    <div className="micro-ring" style={{ width: size, height: size }} title={title}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--bg)" strokeWidth={stroke} fill="none" />
        {len > 0 && (
          <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${len} ${circ}`} />
        )}
      </svg>
      <div className="micro-ring-label">{children}</div>
    </div>
  );
}

/** parts: [{ label, value, color }] with a 2px gap between segments, and the counts below. */
export function SplitBar({ parts }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <>
      <div className="micro-split">
        {parts.filter((p) => p.value > 0).map((p) => (
          <span key={p.label} style={{ flexGrow: p.value / total, background: p.color }} title={`${p.label}: ${p.value}`} />
        ))}
      </div>
      <div className="micro-parts">
        {parts.map((p) => (
          <span key={p.label} title={p.label}>
            <i style={{ background: p.color }} /> {p.label} <b>{p.value}</b>
          </span>
        ))}
      </div>
    </>
  );
}
