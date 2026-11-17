import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { markerColor, webglAvailable } from '../lib/greenhouseColors.js';

/*
 * The 3D greenhouse: the house, a bed for every row, and a plant on every place of the layout. A plant's fruit marker is coloured by the
 * result of the last photo check (or by how much fruit it has) and is a little bigger the more fruit was counted. Click a plant to pick it.
 * Drag to turn, scroll to zoom, right-drag to move. One InstancedMesh per part keeps big houses (thousands of plants) smooth.
 */
export default function GreenhouseScene({ layout, colorBy = 'status', selected, onPick, view = 'default', focusKey = '', height = 460 }) {
  const mount = useRef(null);
  const api = useRef({});
  const [failed, setFailed] = useState(false);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  // build the scene when the layout changes
  useEffect(() => {
    const el = mount.current;
    if (!el || !layout) return undefined;
    if (!webglAvailable()) { setFailed(true); return undefined; }
    const { house, plants } = layout;
    const L = house.length_m;
    const W = house.width_m;
    const spanX = Math.max(L, 1);
    const spanZ = Math.max(W, 1);
    const unit = Math.min(spanX / house.plants_per_row, spanZ / house.rows); // room one plant has

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch { setFailed(true); return undefined; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    el.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#ffffff', '#8d9b7a', 1.15));
    const sun = new THREE.DirectionalLight('#ffffff', 1.1);
    sun.position.set(spanX * 0.6, Math.max(spanX, spanZ), spanZ * 0.4);
    scene.add(sun);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 4000);
    const reach = Math.max(spanX, spanZ);
    camera.position.set(spanX / 2, reach * 0.42, spanZ / 2 + reach * 0.6);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(spanX / 2, 0, spanZ / 2);
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.minDistance = Math.max(2, unit * 2);
    controls.maxDistance = reach * 4;
    controls.enableDamping = true;

    const disposables = [];
    const own = (o) => { disposables.push(o); return o; };

    // floor and the house (walls and a gable roof, see-through so the plants stay visible)
    const floor = new THREE.Mesh(own(new THREE.PlaneGeometry(spanX, spanZ)), own(new THREE.MeshStandardMaterial({ color: '#8d7457', roughness: 1 })));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(spanX / 2, 0, spanZ / 2);
    scene.add(floor);
    const wallH = Math.min(3.2, Math.max(2, spanZ * 0.35));
    const ridge = wallH + Math.min(1.8, spanZ * 0.2);
    const pts = (a) => a.map(([x, y, z]) => new THREE.Vector3(x, y, z));
    const edge = (a) => {
      const g = own(new THREE.BufferGeometry().setFromPoints(pts(a)));
      return new THREE.LineSegments(g, own(new THREE.LineBasicMaterial({ color: '#4E6E58' })));
    };
    const mx = spanZ / 2;
    scene.add(edge([
      [0, 0, 0], [0, wallH, 0], [0, wallH, 0], [0, ridge, mx], [0, ridge, mx], [0, wallH, spanZ], [0, wallH, spanZ], [0, 0, spanZ],
      [spanX, 0, 0], [spanX, wallH, 0], [spanX, wallH, 0], [spanX, ridge, mx], [spanX, ridge, mx], [spanX, wallH, spanZ], [spanX, wallH, spanZ], [spanX, 0, spanZ],
      [0, wallH, 0], [spanX, wallH, 0], [0, wallH, spanZ], [spanX, wallH, spanZ], [0, ridge, mx], [spanX, ridge, mx],
    ]));
    const roofMat = own(new THREE.MeshStandardMaterial({ color: '#B3E5FC', transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }));
    for (const z0 of [0, spanZ]) {
      const g = own(new THREE.BufferGeometry());
      g.setAttribute('position', new THREE.Float32BufferAttribute([0, wallH, z0, spanX, wallH, z0, spanX, ridge, mx, 0, wallH, z0, spanX, ridge, mx, 0, ridge, mx], 3));
      g.computeVertexNormals();
      scene.add(new THREE.Mesh(g, roofMat));
    }

    // a bed for each row
    const rowSpacing = spanZ / house.rows;
    const bedMat = own(new THREE.MeshStandardMaterial({ color: '#5D4037', roughness: 1 }));
    const bedGeo = own(new THREE.BoxGeometry(spanX * 0.98, 0.18, Math.min(rowSpacing * 0.45, 0.9)));
    for (let r = 0; r < house.rows; r += 1) {
      const bed = new THREE.Mesh(bedGeo, bedMat);
      bed.position.set(spanX / 2, 0.09, (r + 0.5) * rowSpacing);
      scene.add(bed);
      const cv = document.createElement('canvas');
      cv.width = 128;
      cv.height = 64;
      const cx = cv.getContext('2d');
      cx.fillStyle = 'rgba(255,255,255,0.9)';
      cx.beginPath();
      cx.roundRect(4, 8, 120, 48, 14);
      cx.fill();
      cx.fillStyle = '#1B5E20';
      cx.font = 'bold 34px sans-serif';
      cx.textAlign = 'center';
      cx.textBaseline = 'middle';
      cx.fillText(`R${r + 1}`, 64, 33);
      const tex = own(new THREE.CanvasTexture(cv));
      const label = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: tex, depthTest: false })));
      const ls = Math.max(0.5, Math.min(rowSpacing * 0.9, 1.6));
      label.scale.set(ls * 2, ls, 1);
      label.position.set(-ls * 1.1, 0.4, (r + 0.5) * rowSpacing);
      label.renderOrder = 5;
      scene.add(label);
    }

    // the plants: foliage (green), and a fruit marker above it
    const n = plants.length;
    const size = Math.max(0.12, Math.min(unit * 0.38, 0.55));
    const leafGeo = own(new THREE.IcosahedronGeometry(size, 1));
    const leaf = new THREE.InstancedMesh(leafGeo, own(new THREE.MeshStandardMaterial({ color: '#43A047', roughness: 0.9, flatShading: true })), n);
    const fruitGeo = own(new THREE.SphereGeometry(size * 0.7, 14, 10));
    const fruit = new THREE.InstancedMesh(fruitGeo, own(new THREE.MeshStandardMaterial({ roughness: 0.45 })), n);
    const stemGeo = own(new THREE.CylinderGeometry(size * 0.08, size * 0.08, size * 2.2, 6));
    const stem = new THREE.InstancedMesh(stemGeo, own(new THREE.MeshStandardMaterial({ color: '#33691E' })), n);
    const m4 = new THREE.Matrix4();
    const max = Math.max(1, ...plants.map((p) => p.latest?.recorded_count || 0));
    plants.forEach((p, i) => {
      const grow = 0.75 + Math.min(0.6, (p.latest?.recorded_count || 0) / Math.max(1, max) * 0.6);
      m4.compose(new THREE.Vector3(p.x, 0.18 + size * 1.1, p.z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
      stem.setMatrixAt(i, m4);
      m4.compose(new THREE.Vector3(p.x, 0.18 + size * 2.3, p.z), new THREE.Quaternion(), new THREE.Vector3(grow, grow * 0.9, grow));
      leaf.setMatrixAt(i, m4);
    });
    scene.add(stem, leaf, fruit);

    // selection ring
    const ring = new THREE.Mesh(own(new THREE.TorusGeometry(size * 1.6, size * 0.12, 8, 28)), own(new THREE.MeshBasicMaterial({ color: '#1565C0' })));
    ring.rotation.x = Math.PI / 2;
    ring.visible = false;
    scene.add(ring);

    const ray = new THREE.Raycaster();
    const ptr = new THREE.Vector2();
    let down = null;
    const pick = (ev) => {
      const r = renderer.domElement.getBoundingClientRect();
      ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -(((ev.clientY - r.top) / r.height) * 2 - 1));
      ray.setFromCamera(ptr, camera);
      const hit = ray.intersectObjects([fruit, leaf], false)[0];
      return hit && hit.instanceId !== undefined ? plants[hit.instanceId] : null;
    };
    const onDown = (e) => { down = { x: e.clientX, y: e.clientY }; };
    const onUp = (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) { down = null; return; } // a drag turns the view, it does not pick
      down = null;
      const p = pick(e);
      if (p) pickRef.current?.(p);
    };
    const tip = document.createElement('div');
    tip.className = 'gh-tip';
    tip.style.display = 'none';
    el.appendChild(tip);
    const onMove = (e) => {
      const p = pick(e);
      renderer.domElement.style.cursor = p ? 'pointer' : 'grab';
      if (!p) { tip.style.display = 'none'; return; }
      const r = el.getBoundingClientRect();
      tip.textContent = `${p.row_id} ${p.plant_label}${p.crop_name ? ` \u00b7 ${p.crop_name}` : ''} \u00b7 ${p.latest ? `${p.latest.recorded_count} fruit` : 'not counted yet'}`;
      tip.style.left = `${Math.min(e.clientX - r.left + 14, r.width - 220)}px`;
      tip.style.top = `${Math.max(4, e.clientY - r.top - 34)}px`;
      tip.style.display = 'block';
    };
    const onLeave = () => { tip.style.display = 'none'; };
    renderer.domElement.addEventListener('pointerleave', onLeave);
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);
    renderer.domElement.addEventListener('pointermove', onMove);

    const resize = () => {
      const w = el.clientWidth || 600;
      const h = el.clientHeight || height;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    let raf = 0;
    let visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 });
    io.observe(el);
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!visible) return;
      api.current.step?.();
      controls.update();
      renderer.render(scene, camera);
    };
    loop();

    let tween = null;
    const flyTo = (pos, target) => { tween = { t: 0, fp: camera.position.clone(), ft: controls.target.clone(), tp: new THREE.Vector3(...pos), tt: new THREE.Vector3(...target) }; };
    api.current = { plants, fruit, ring, size, max, scene, camera, renderer, controls, el };
    api.current.setView = (name) => {
      if (name === 'top') flyTo([spanX / 2, reach * 1.25, spanZ / 2 + 0.01], [spanX / 2, 0, spanZ / 2]);
      else if (name === 'side') flyTo([spanX / 2, reach * 0.18, spanZ / 2 + reach * 0.9], [spanX / 2, 0.5, spanZ / 2]);
      else flyTo([spanX / 2, reach * 0.42, spanZ / 2 + reach * 0.6], [spanX / 2, 0, spanZ / 2]);
    };
    api.current.focus = (p) => flyTo([p.x, Math.max(1.6, size * 7), p.z + Math.max(2.4, size * 9)], [p.x, 0.6, p.z]);
    api.current.step = () => {
      if (!tween) return;
      tween.t = Math.min(1, tween.t + 0.045);
      const k = 1 - (1 - tween.t) ** 3;
      camera.position.lerpVectors(tween.fp, tween.tp, k);
      controls.target.lerpVectors(tween.ft, tween.tt, k);
      if (tween.t >= 1) tween = null;
    };
    api.current.paint = (by, sel) => {
      const c = new THREE.Color();
      plants.forEach((p, i) => {
        c.set(markerColor(p, by, max));
        fruit.setColorAt(i, c);
        const s = p.latest ? 0.8 + Math.min(1, Math.sqrt(p.latest.recorded_count / Math.max(1, max))) * 1.1 : 0.6;
        m4.compose(new THREE.Vector3(p.x + size * 0.45, 0.18 + size * 3.1, p.z), new THREE.Quaternion(), new THREE.Vector3(s, s, s));
        fruit.setMatrixAt(i, m4);
      });
      fruit.instanceMatrix.needsUpdate = true;
      if (fruit.instanceColor) fruit.instanceColor.needsUpdate = true;
      const p = sel && plants.find((x) => x.row === sel.row && x.plant === sel.plant);
      ring.visible = !!p;
      if (p) ring.position.set(p.x, 0.22, p.z);
    };
    api.current.paint(colorBy, selected);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerleave', onLeave);
      tip.remove();
      controls.dispose();
      [leaf, fruit, stem].forEach((m) => m.dispose());
      disposables.forEach((d) => d.dispose?.());
      renderer.dispose();
      renderer.domElement.remove();
      api.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  // recolour and move the selection ring without rebuilding
  useEffect(() => { api.current.paint?.(colorBy, selected); }, [colorBy, selected, layout]);

  useEffect(() => { api.current.setView?.(view); }, [view, layout]);
  useEffect(() => {
    const p = selected && layout?.plants.find((x) => x.row === selected.row && x.plant === selected.plant);
    if (p && focusKey) api.current.focus?.(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  if (failed) return null;
  return <div ref={mount} className="gh-scene" style={{ height }} role="img" aria-label="3D view of the greenhouse. Use the plan view for a list you can use with the keyboard." />;
}
