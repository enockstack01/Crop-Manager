import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { t } from '../../i18n/index.js';

/** Where the farmers' fields are: one Leaf Green circle per field with coordinates (OpenStreetMap tiles). */
export function OrgMap({ points }) {
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);

  useEffect(() => {
    if (!el.current || map.current) return undefined;
    map.current = L.map(el.current, { scrollWheelZoom: false }).setView([-1.95, 29.9], 7);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap contributors' }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => { map.current?.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    if (!map.current || !layer.current) return;
    layer.current.clearLayers();
    const bounds = [];
    for (const p of points) {
      L.circleMarker([p.lat, p.lng], { radius: 6, color: '#14532D', weight: 1, fillColor: '#2E7D32', fillOpacity: 0.85 })
        .bindPopup(`<b>${String(p.name).replace(/</g, '&lt;')}</b><br/>${String(p.farm || '').replace(/</g, '&lt;')}<br/>${Math.round(p.ha * 10) / 10} ha`)
        .addTo(layer.current);
      bounds.push([p.lat, p.lng]);
    }
    if (bounds.length) map.current.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
  }, [points]);

  return (
    <div>
      <div ref={el} className="org-map" role="img" aria-label={t('Map of field locations')} />
      {!points.length && <p className="org-muted" style={{ marginTop: 8 }}>{t('No field locations recorded yet. Fields with latitude and longitude appear here.')}</p>}
    </div>
  );
}
