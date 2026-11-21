import { markerColor } from '../lib/greenhouseColors.js';
import { northOnPlan } from '../lib/greenhouseLayout.js';
import { t } from '../i18n/index.js';

/**
 * The greenhouse seen from above, drawn to scale from the plant positions: rows of different lengths, sub rows, the planting pattern,
 * the door and the compass. Frozen plants have a dashed ring, deactivated positions a cross. Works without WebGL and with the keyboard.
 */
export function PlanMap({ layout, colorBy = 'status', selected, onPick, showLabels = true }) {
  const { house, plants } = layout;
  const L = house.length_m;
  const W = house.width_m;
  const pad = Math.max(L, W) * 0.12 + 0.6;
  const maxCount = Math.max(1, ...plants.map((p) => p.latest?.recorded_count || 0));
  const rowSp = house.row_spacing_m || W / house.rows;
  const slots = Math.max(house.plants_per_row, ...plants.map((p) => p.plant));
  const plantSp = house.plant_spacing_m || L / slots;
  const r = Math.max(0.12, Math.min(plantSp, rowSp * (plants.some((p) => p.sub) ? 0.4 : 0.9)) * 0.36);
  const door = house.door;
  const doorLen = door ? (door.wall === 'top' || door.wall === 'bottom' ? L : W) : 0;
  const dc = door ? Math.min(Math.max(door.position, 0), 1) * doorLen : 0;
  const dw = door ? door.width_m : 0;
  const [nx, nz] = northOnPlan(house.orientation_deg);
  const rose = { x: L + pad * 0.5, z: -pad * 0.5, r: pad * 0.34 }; // the compass sits in the top right corner, outside the house
  const stroke = Math.max(0.08, r * 0.35);
  const wall = (x1, z1, x2, z2, key) => <line key={key} x1={x1} y1={z1} x2={x2} y2={z2} stroke="#4E6E58" strokeWidth={stroke} strokeLinecap="round" />;
  const walls = [];
  [['top', 0, 0, L, 0], ['bottom', 0, W, L, W], ['left', 0, 0, 0, W], ['right', L, 0, L, W]].forEach(([name, x1, z1, x2, z2]) => {
    if (door && door.wall === name) {
      const a = Math.max(0, dc - dw / 2);
      const b = Math.min(doorLen, dc + dw / 2);
      if (name === 'top' || name === 'bottom') walls.push(wall(x1, z1, a, z2, `${name}1`), wall(b, z1, x2, z2, `${name}2`));
      else walls.push(wall(x1, z1, x2, a, `${name}1`), wall(x1, b, x2, z2, `${name}2`));
    } else walls.push(wall(x1, z1, x2, z2, name));
  });
  const rowLabels = [];
  const seen = new Set();
  plants.forEach((p) => {
    if (seen.has(p.row)) return;
    seen.add(p.row);
    const same = plants.filter((q) => q.row === p.row);
    const x0 = Math.min(...same.map((q) => q.x));
    const zc = same.reduce((s, q) => s + q.z, 0) / same.length;
    rowLabels.push(<text key={p.row} x={x0 - r * 1.8} y={zc + r * 0.45} textAnchor="end" fontSize={Math.max(0.28, r * 0.95)} fill="#1B5E20" fontWeight="700">R{p.row}</text>);
  });
  const fontSize = r * 0.95;
  const horiz = door && (door.wall === 'top' || door.wall === 'bottom');
  return (
    <div className="gh-planmap" role="group" aria-label={t('Plan of the greenhouse')}>
      <svg viewBox={`${-pad} ${-pad} ${L + pad * 2} ${W + pad * 2}`} preserveAspectRatio="xMidYMid meet" style={{ width: '100%', maxHeight: 560 }}>
        <defs><marker id="gh-arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#C62828" /></marker></defs>
        <rect x={0} y={0} width={L} height={W} fill="#EFEBE0" />
        {walls}
        {door && (
          <g>
            <rect
              x={door.wall === 'left' ? -0.12 : door.wall === 'right' ? L - 0.12 : dc - dw / 2} y={door.wall === 'top' ? -0.12 : door.wall === 'bottom' ? W - 0.12 : dc - dw / 2}
              width={horiz ? dw : 0.24} height={horiz ? 0.24 : dw} fill="#8D6E63"
            />
            <text
              x={door.wall === 'left' ? -0.5 : door.wall === 'right' ? L + 0.5 : dc} y={door.wall === 'top' ? -0.5 : door.wall === 'bottom' ? W + 0.9 : dc + 0.25}
              textAnchor={door.wall === 'left' ? 'end' : door.wall === 'right' ? 'start' : 'middle'} fontSize={Math.max(0.35, r * 1.1)} fill="#6D4C41" fontWeight="700"
            >{t('Door')}</text>
          </g>
        )}
        <g aria-hidden="true">
          <circle cx={rose.x} cy={rose.z} r={rose.r * 1.08} fill="#fff" stroke="#E0C4C4" strokeWidth={rose.r * 0.06} />
          <line x1={rose.x - nx * rose.r * 0.7} y1={rose.z - nz * rose.r * 0.7} x2={rose.x + nx * rose.r * 0.7} y2={rose.z + nz * rose.r * 0.7} stroke="#C62828" strokeWidth={rose.r * 0.12} markerEnd="url(#gh-arrow)" />
          <text x={rose.x + nx * rose.r * 1.5} y={rose.z + nz * rose.r * 1.5 + rose.r * 0.3} textAnchor="middle" fontSize={rose.r * 0.9} fill="#C62828" fontWeight="800">N</text>
        </g>
        {showLabels && rowLabels}
        {plants.map((p) => {
          const sel = selected && selected.row_id === p.row_id && selected.plant_label === p.plant_label;
          const n = p.latest?.recorded_count;
          const label = `${p.row_id} ${p.plant_label}${p.label ? ` (${p.label})` : ''}${p.state !== 'active' ? `, ${p.state === 'frozen' ? t('frozen') : t('deactivated')}` : ''}${p.latest ? `, ${n} ${t('fruit')}` : `, ${t('not counted yet')}`}`;
          return (
            <g key={`${p.row_id}${p.plant_label}`} role="button" tabIndex={0} aria-label={label} onClick={() => onPick?.(p)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick?.(p); } }} style={{ cursor: onPick ? 'pointer' : 'default' }}>
              <title>{label}</title>
              <circle cx={p.x} cy={p.z} r={r} fill={markerColor(p, colorBy, maxCount)} stroke={sel ? '#1C2B1E' : '#fff'} strokeWidth={sel ? r * 0.28 : r * 0.1} strokeDasharray={p.state === 'frozen' ? `${r * 0.35} ${r * 0.25}` : undefined} />
              {p.state === 'inactive' && <path d={`M${p.x - r * 0.5} ${p.z - r * 0.5} L${p.x + r * 0.5} ${p.z + r * 0.5} M${p.x + r * 0.5} ${p.z - r * 0.5} L${p.x - r * 0.5} ${p.z + r * 0.5}`} stroke="#fff" strokeWidth={r * 0.18} strokeLinecap="round" />}
              {p.state !== 'inactive' && p.latest && r > 0.2 && <text x={p.x} y={p.z + fontSize * 0.34} textAnchor="middle" fontSize={fontSize} fill="#fff" fontWeight="700" pointerEvents="none">{n}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
