import React, { useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, G, Line, Marker, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { radius } from '../theme/theme';
import { Button } from './Button';
import { markerColor } from '../lib/greenhouseRules';
import { northOnPlan } from '../lib/greenhouseLayout';
import { t } from '../i18n';

/**
 * The greenhouse seen from above, drawn to scale from the plant positions: rows of different lengths, sub rows, the planting pattern, the door
 * and a compass. Frozen plants have a dashed ring, deactivated positions a cross. Pinch-free: zoom with the + and - buttons, scroll to move.
 */
export function PlanMap({ layout, colorBy, selected, onPick }: { layout: any; colorBy: 'status' | 'fruit' | 'health'; selected?: { row_id: string; plant_label: string } | null; onPick: (p: any) => void }) {
  const { colors } = useTheme();
  const { width: screenW } = useWindowDimensions();
  const [zoom, setZoom] = useState(1);
  const { house, plants } = layout;
  const L: number = house.length_m;
  const W: number = house.width_m;
  const pad = Math.max(L, W) * 0.12 + 0.6;
  const maxCount = Math.max(1, ...plants.map((p: any) => p.latest?.recorded_count || 0));
  const rowSp: number = house.row_spacing_m || W / house.rows;
  const slots = Math.max(house.plants_per_row, ...plants.map((p: any) => p.plant));
  const plantSp: number = house.plant_spacing_m || L / slots;
  const hasSub = plants.some((p: any) => p.sub);
  const r = Math.max(0.12, Math.min(plantSp, rowSp * (hasSub ? 0.4 : 0.9)) * 0.36);
  // a plant is at least about 15 pixels wide, so it can be touched; a big house scrolls sideways
  const ppm = Math.max((screenW - 32) / (L + pad * 2), 15 / r) * zoom;
  const vbW = L + pad * 2;
  const vbH = W + pad * 2;
  const door = house.door;
  const doorLen = door ? (door.wall === 'top' || door.wall === 'bottom' ? L : W) : 0;
  const dc = door ? Math.min(Math.max(door.position, 0), 1) * doorLen : 0;
  const dw = door ? door.width_m : 0;
  const [nx, nz] = northOnPlan(house.orientation_deg);
  const rose = { x: L + pad * 0.5, z: -pad * 0.5, r: pad * 0.34 };
  const stroke = Math.max(0.08, r * 0.35);
  const horiz = door && (door.wall === 'top' || door.wall === 'bottom');
  const wallLine = (x1: number, z1: number, x2: number, z2: number, key: string) => <Line key={key} x1={x1} y1={z1} x2={x2} y2={z2} stroke="#4E6E58" strokeWidth={stroke} strokeLinecap="round" />;
  const walls: React.ReactNode[] = [];
  ([['top', 0, 0, L, 0], ['bottom', 0, W, L, W], ['left', 0, 0, 0, W], ['right', L, 0, L, W]] as [string, number, number, number, number][]).forEach(([name, x1, z1, x2, z2]) => {
    if (door && door.wall === name) {
      const a = Math.max(0, dc - dw / 2);
      const b = Math.min(doorLen, dc + dw / 2);
      if (name === 'top' || name === 'bottom') walls.push(wallLine(x1, z1, a, z2, `${name}1`), wallLine(b, z1, x2, z2, `${name}2`));
      else walls.push(wallLine(x1, z1, x2, a, `${name}1`), wallLine(x1, b, x2, z2, `${name}2`));
    } else walls.push(wallLine(x1, z1, x2, z2, name));
  });
  const labels: React.ReactNode[] = [];
  const seen = new Set<number>();
  plants.forEach((p: any) => {
    if (seen.has(p.row)) return;
    seen.add(p.row);
    const same = plants.filter((q: any) => q.row === p.row);
    const x0 = Math.min(...same.map((q: any) => q.x));
    const zc = same.reduce((s: number, q: any) => s + q.z, 0) / same.length;
    labels.push(<SvgText key={p.row} x={x0 - r * 1.8} y={zc + r * 0.45} textAnchor="end" fontSize={Math.max(0.28, r * 0.95)} fill="#1B5E20" fontWeight="700">{`R${p.row}`}</SvgText>);
  });
  const fontSize = r * 0.95;
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
        <Button title="Zoom out" icon="magnifying-glass-minus" kind="secondary" size="sm" disabled={zoom <= 1} onPress={() => setZoom((z) => Math.max(1, z / 1.5))} />
        <Button title="Zoom in" icon="magnifying-glass-plus" kind="secondary" size="sm" disabled={zoom >= 4} onPress={() => setZoom((z) => Math.min(4, z * 1.5))} />
      </View>
      <ScrollView horizontal style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.card }} contentContainerStyle={{ padding: 8 }}>
        <Svg width={vbW * ppm} height={vbH * ppm} viewBox={`${-pad} ${-pad} ${vbW} ${vbH}`}>
          <Defs>
            <Marker id="gh-arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><Path d="M0,0 L6,3 L0,6 z" fill="#C62828" /></Marker>
          </Defs>
          <Rect x={0} y={0} width={L} height={W} fill="#EFEBE0" />
          {walls}
          {door ? (
            <G>
              <Rect x={door.wall === 'left' ? -0.12 : door.wall === 'right' ? L - 0.12 : dc - dw / 2} y={door.wall === 'top' ? -0.12 : door.wall === 'bottom' ? W - 0.12 : dc - dw / 2} width={horiz ? dw : 0.24} height={horiz ? 0.24 : dw} fill="#8D6E63" />
              <SvgText x={door.wall === 'left' ? -0.5 : door.wall === 'right' ? L + 0.5 : dc} y={door.wall === 'top' ? -0.5 : door.wall === 'bottom' ? W + 0.9 : dc + 0.25} textAnchor={door.wall === 'left' ? 'end' : door.wall === 'right' ? 'start' : 'middle'} fontSize={Math.max(0.35, r * 1.1)} fill="#6D4C41" fontWeight="700">{t('Door')}</SvgText>
            </G>
          ) : null}
          <G>
            <Circle cx={rose.x} cy={rose.z} r={rose.r * 1.08} fill="#FFFFFF" stroke="#E0C4C4" strokeWidth={rose.r * 0.06} />
            <Line x1={rose.x - nx * rose.r * 0.7} y1={rose.z - nz * rose.r * 0.7} x2={rose.x + nx * rose.r * 0.7} y2={rose.z + nz * rose.r * 0.7} stroke="#C62828" strokeWidth={rose.r * 0.12} markerEnd="url(#gh-arrow)" />
            <SvgText x={rose.x + nx * rose.r * 1.5} y={rose.z + nz * rose.r * 1.5 + rose.r * 0.3} textAnchor="middle" fontSize={rose.r * 0.9} fill="#C62828" fontWeight="800">N</SvgText>
          </G>
          {labels}
          {plants.map((p: any) => {
            const sel = !!selected && selected.row_id === p.row_id && selected.plant_label === p.plant_label;
            const n = p.latest?.recorded_count;
            return (
              <G key={`${p.row_id}${p.plant_label}`} onPress={() => onPick(p)}>
                <Circle cx={p.x} cy={p.z} r={r * 1.15} fill="transparent" />
                <Circle cx={p.x} cy={p.z} r={r} fill={markerColor(p, colorBy, maxCount)} stroke={sel ? '#1C2B1E' : '#FFFFFF'} strokeWidth={sel ? r * 0.28 : r * 0.1} strokeDasharray={p.state === 'frozen' ? [r * 0.35, r * 0.25] : undefined} />
                {p.state === 'inactive' ? <Path d={`M${p.x - r * 0.5} ${p.z - r * 0.5} L${p.x + r * 0.5} ${p.z + r * 0.5} M${p.x + r * 0.5} ${p.z - r * 0.5} L${p.x - r * 0.5} ${p.z + r * 0.5}`} stroke="#FFFFFF" strokeWidth={r * 0.18} strokeLinecap="round" /> : null}
                {p.state !== 'inactive' && p.latest ? <SvgText x={p.x} y={p.z + fontSize * 0.34} textAnchor="middle" fontSize={fontSize} fill="#FFFFFF" fontWeight="700">{String(n)}</SvgText> : null}
              </G>
            );
          })}
        </Svg>
      </ScrollView>
    </View>
  );
}
