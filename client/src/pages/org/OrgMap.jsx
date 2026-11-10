import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { t } from '../../i18n/index.js';

/** Where the farmers' fields are: one Leaf Green circle per field with coordinates (OpenStreetMap tiles). */
const valid = (p) => p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)) && Math.abs(Number(p.lat)) <= 90 && Math.abs(Number(p.lng)) <= 180;
const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function OrgMap({ points }) {
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const [failed, setFailed] = useState(false);
  const good = (Array.isArray(points) ? points : []).filter(valid);

  useEffect(() => {
    if (!el.current || map.current) return undefined;
    try {
      map.current = L.map(el.current, { scrollWheelZoom: false }).setView([-1.95, 29.9], 7);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap contributors' }).addTo(map.current);
      layer.current = L.layerGroup().addTo(map.current);
    } catch {
      setFailed(true);
      return undefined;
    }
    // the box can change size after the first paint (cards opening, window resizing): tell the map so it never shows grey patches
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { try { map.current?.invalidateSize(); } catch { /* map already removed */ } }) : null;
    ro?.observe(el.current);
    return () => { ro?.disconnect(); try { map.current?.remove(); } catch { /* already gone */ } map.current = null; layer.current = null; };
  }, []);

  useEffect(() => {
    if (!map.current || !layer.current) return;
    try {
      layer.current.clearLayers();
      const bounds = [];
      for (const p of good) {
        const lat = Number(p.lat);
        const lng = Number(p.lng);
        L.circleMarker([lat, lng], { radius: 6, color: '#14532D', weight: 1, fillColor: '#2E7D32', fillOpacity: 0.85 })
          .bindPopup(`<b>${esc(p.name)}</b><br/>${esc(p.farm)}<br/>${Math.round((Number(p.ha) || 0) * 10) / 10} ha`)
          .addTo(layer.current);
        bounds.push([lat, lng]);
      }
      if (bounds.length) map.current.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
    } catch {
      setFailed(true);
    }
  }, [points]); // eslint-disable-line react-hooks/exhaustive-deps

  if (failed) {
    return (
      <div>
        <p className="org-muted">{t('The map could not be shown on this device. The field locations are listed below.')}</p>
        <ul className="org-muted" style={{ marginTop: 8 }}>
          {good.slice(0, 40).map((p, i) => <li key={i}>{p.name} · {p.farm} · {Number(p.lat).toFixed(4)}, {Number(p.lng).toFixed(4)}</li>)}
        </ul>
      </div>
    );
  }
  return (
    <div>
      <div ref={el} className="org-map" role="img" aria-label={t('Map of field locations')} />
      {!good.length && <p className="org-muted" style={{ marginTop: 8 }}>{t('No field locations recorded yet. Fields with latitude and longitude appear here.')}</p>}
    </div>
  );
}
