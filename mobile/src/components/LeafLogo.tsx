import React from 'react';
import Svg, { Defs, G, LinearGradient, Mask, Path, Rect, Stop } from 'react-native-svg';

/*
 * The CropManager leaf mark — same geometry as the app icon and splash
 * (assets/*.png are rendered from it). Drawn in a 1024 box; the midrib and veins
 * are cut out of the leaf with a mask so they show whatever is behind it.
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
// scale about the optical centre of leaf + stem (496,541) so the mark sits centred;
// baked into one matrix because chained transform strings render inconsistently
const centered = (s: number) => `matrix(${s} 0 0 ${s} ${512 - 496 * s} ${512 - 541 * s})`;

let uid = 0;

export function LeafLogo({
  size = 48,
  color = '#FFFFFF',
  tile = false,
  scale,
}: {
  size?: number;
  /** leaf colour */
  color?: string;
  /** draw the rounded green gradient tile behind the leaf (app-icon look) */
  tile?: boolean;
  /** leaf size within the box (defaults to the icon's proportions) */
  scale?: number;
}) {
  // unique ids so several logos on one screen don't share mask/gradient defs
  const id = React.useMemo(() => `leaf${++uid}`, []);
  const t = centered(scale ?? (tile ? 0.8 : 0.95));

  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024">
      <Defs>
        <LinearGradient id={`${id}bg`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#4CAF50" />
          <Stop offset="0.55" stopColor="#2E7D32" />
          <Stop offset="1" stopColor="#1B5E20" />
        </LinearGradient>
        <Mask id={`${id}cut`} maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">
          <Rect width="1024" height="1024" fill="#fff" />
          <G transform={t} stroke="#000" strokeLinecap="round" fill="none">
            <Path d={MIDRIB} strokeWidth={26} />
            {VEINS.map((d) => (
              <Path key={d} d={d} strokeWidth={19} />
            ))}
          </G>
        </Mask>
      </Defs>
      {tile ? <Rect width="1024" height="1024" rx="232" fill={`url(#${id}bg)`} /> : null}
      <G transform={t}>
        <Path d={STEM} stroke={color} strokeWidth={30} strokeLinecap="round" fill="none" />
      </G>
      <G mask={`url(#${id}cut)`}>
        <G transform={t}>
          <Path d={LEAF} fill={color} />
        </G>
      </G>
    </Svg>
  );
}
