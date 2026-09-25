import { useId } from 'react';

/*
 * The CropManager leaf mark — same geometry as the mobile app icon and splash.
 * Midrib and veins are cut out with a mask, so they show whatever is behind it.
 */
const LEAF = 'M292 732 C262 478 452 282 742 282 C766 560 560 760 292 732 Z';
const MIDRIB = 'M322 702 C452 572 572 452 700 324';
const VEINS = [
  'M420 604 C412 548 420 500 440 462',
  'M420 604 C476 612 524 604 562 584',
  'M520 504 C514 456 522 418 540 388',
  'M520 504 C568 510 606 502 636 486',
];
const STEM = 'M300 724 C276 752 252 778 226 800';
// scale about the optical centre of leaf + stem (496,541)
const centered = (s) => `matrix(${s} 0 0 ${s} ${512 - 496 * s} ${512 - 541 * s})`;

export function LeafMark({ size = 24, color = 'currentColor', scale = 1.1, className, title = 'CropManager' }) {
  const id = useId().replace(/:/g, '');
  const t = centered(scale);
  return (
    <svg width={size} height={size} viewBox="0 0 1024 1024" className={className} role="img" aria-label={title}>
      <defs>
        <mask id={`${id}cut`} maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">
          <rect width="1024" height="1024" fill="#fff" />
          <g transform={t} stroke="#000" strokeLinecap="round" fill="none">
            <path d={MIDRIB} strokeWidth={26} />
            {VEINS.map((d) => (
              <path key={d} d={d} strokeWidth={19} />
            ))}
          </g>
        </mask>
      </defs>
      <path d={STEM} transform={t} stroke={color} strokeWidth={30} strokeLinecap="round" fill="none" />
      <g mask={`url(#${id}cut)`}>
        <path d={LEAF} transform={t} fill={color} />
      </g>
    </svg>
  );
}
