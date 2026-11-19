import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { markerColor, webglAvailable } from '../lib/greenhouseColors.js';
import { FLOWER_COLOR, flowerGeometry, fruitModel, habitOf, leafKind, leafKindOf, rng } from '../lib/fruitModels.js';

/*
 * The 3D greenhouse: the house, a bed for every row, and a plant on every place of the layout. A plant's fruit marker is coloured by the
 * result of the last photo check (or by how much fruit it has) and is a little bigger the more fruit was counted. Click a plant to pick it.
 * Drag to turn, scroll to zoom, right-drag to move. One InstancedMesh per part keeps big houses (thousands of plants) smooth.
 */
export default function GreenhouseScene({ layout, colorBy = 'status', selected, onPick, view = 'default', focusKey = '', resetKey = 0, height = 460 }) {
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
    const unit = Math.min(house.plant_spacing_m || spanX / house.plants_per_row, house.row_spacing_m || spanZ / house.rows); // room one plant has

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
    controls.screenSpacePanning = false;
    controls.autoRotateSpeed = 1.2;

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

    // a bed for each row (rows can differ in length, sit apart as set, and have two sub rows side by side)
    const rowSpacing = house.row_spacing_m || spanZ / house.rows;
    const bedMat = own(new THREE.MeshStandardMaterial({ color: '#5D4037', roughness: 1 }));
    const dripMat = own(new THREE.MeshStandardMaterial({ color: '#212121', roughness: 0.6 }));
    const unitBox = own(new THREE.BoxGeometry(1, 0.18, 1));
    const unitDrip = own(new THREE.CylinderGeometry(0.012, 0.012, 1, 6).rotateZ(Math.PI / 2));
    const byRow = new Map();
    plants.forEach((p) => { const e = byRow.get(p.row) || { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity }; e.x0 = Math.min(e.x0, p.x); e.x1 = Math.max(e.x1, p.x); e.z0 = Math.min(e.z0, p.z); e.z1 = Math.max(e.z1, p.z); byRow.set(p.row, e); });
    byRow.forEach((e, r) => {
      const pad = Math.max(0.3, unit * 0.5);
      const bedW = e.x1 - e.x0 + pad * 2;
      const bedD = Math.max(Math.min(rowSpacing * 0.45, 0.9), e.z1 - e.z0 + 0.5);
      const zc = (e.z0 + e.z1) / 2;
      const xc = (e.x0 + e.x1) / 2;
      const bed = new THREE.Mesh(unitBox, bedMat);
      bed.scale.set(bedW, 1, bedD);
      bed.position.set(xc, 0.09, zc);
      scene.add(bed);
      const drip = new THREE.Mesh(unitDrip, dripMat);
      drip.scale.set(bedW * 0.98, 1, 1);
      drip.position.set(xc, 0.2, zc + Math.min(bedD * 0.35, 0.35));
      scene.add(drip);
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
      cx.fillText(`R${r}`, 64, 33);
      const tex = own(new THREE.CanvasTexture(cv));
      const label = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: tex, depthTest: false })));
      const ls = Math.max(0.4, Math.min(rowSpacing * 0.55, 0.9));
      label.scale.set(ls * 2, ls, 1);
      label.position.set(e.x0 - pad - ls * 0.8, 0.4, zc);
      label.renderOrder = 5;
      scene.add(label);
    });

    // the door, in the wall the owner chose, and a compass arrow pointing north
    if (house.door) {
      const { wall, position, width_m: dw } = house.door;
      const along = wall === 'top' || wall === 'bottom' ? spanX : spanZ;
      const c = Math.min(Math.max(position, 0), 1) * along;
      const dh = Math.min(wallH * 0.85, 2.1);
      const frame = new THREE.Mesh(own(new THREE.BoxGeometry(wall === 'top' || wall === 'bottom' ? dw : 0.12, dh, wall === 'top' || wall === 'bottom' ? 0.12 : dw)), own(new THREE.MeshStandardMaterial({ color: '#8D6E63', roughness: 0.8, transparent: true, opacity: 0.85 })));
      frame.position.set(wall === 'left' ? 0 : wall === 'right' ? spanX : c, dh / 2, wall === 'top' ? 0 : wall === 'bottom' ? spanZ : c);
      scene.add(frame);
      const dc = document.createElement('canvas');
      dc.width = 160;
      dc.height = 64;
      const dx = dc.getContext('2d');
      dx.fillStyle = '#6D4C41';
      dx.beginPath();
      dx.roundRect(4, 8, 152, 48, 14);
      dx.fill();
      dx.fillStyle = '#fff';
      dx.font = 'bold 30px sans-serif';
      dx.textAlign = 'center';
      dx.textBaseline = 'middle';
      dx.fillText('DOOR', 80, 33);
      const dsp = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: own(new THREE.CanvasTexture(dc)), depthTest: false })));
      dsp.scale.set(1.5, 0.6, 1);
      dsp.position.set(wall === 'left' ? -1.1 : wall === 'right' ? spanX + 1.1 : c, dh + 0.5, wall === 'top' ? -1.1 : wall === 'bottom' ? spanZ + 1.1 : c);
      dsp.renderOrder = 6;
      scene.add(dsp);
    }
    {
      const a = ((house.orientation_deg || 0) * Math.PI) / 180;
      const nx = -Math.sin(a);
      const nz = -Math.cos(a);
      const R = Math.max(spanX, spanZ) * 0.5 + 2;
      const arrow = new THREE.ArrowHelper(new THREE.Vector3(nx, 0, nz), new THREE.Vector3(spanX / 2 + nx * R * 0.55, 0.3, spanZ / 2 + nz * R * 0.55), Math.max(1.4, R * 0.3), 0xc62828, 0.5, 0.3);
      scene.add(arrow);
      const nc = document.createElement('canvas');
      nc.width = 64;
      nc.height = 64;
      const nxt = nc.getContext('2d');
      nxt.fillStyle = '#C62828';
      nxt.font = 'bold 52px sans-serif';
      nxt.textAlign = 'center';
      nxt.textBaseline = 'middle';
      nxt.fillText('N', 32, 34);
      const nsp = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: own(new THREE.CanvasTexture(nc)), depthTest: false })));
      nsp.scale.set(1, 1, 1);
      nsp.position.set(spanX / 2 + nx * (R * 0.55 + Math.max(1.4, R * 0.3) + 0.6), 0.6, spanZ / 2 + nz * (R * 0.55 + Math.max(1.4, R * 0.3) + 0.6));
      scene.add(nsp);
    }

    // the plants: a stem, leaves, the fruit that were counted (shaped and coloured like the real crop) and a status ring on the bed
    const n = plants.length;
    const size = Math.max(0.12, Math.min(unit * 0.38, 0.55));
    const max = Math.max(1, ...plants.map((p) => p.latest?.recorded_count || 0));
    const dummy = new THREE.Object3D();
    const tmpColor = new THREE.Color();
    const fruitCap = n <= 150 ? 18 : n <= 600 ? 10 : n <= 1500 ? 6 : 3;
    const LEAF_GREENS = ['#2E7D32', '#388E3C', '#43A047', '#1B5E20', '#4CAF50'];

    const stem = new THREE.InstancedMesh(own(new THREE.CylinderGeometry(size * 0.07, size * 0.1, 1, 6).translate(0, 0.5, 0)), own(new THREE.MeshStandardMaterial({ color: '#4E7D2A', roughness: 0.9 })), n);
    const kindCount = {};
    plants.forEach((p) => { const k = leafKindOf(p.crop_key); kindCount[k] = (kindCount[k] || 0) + habitOf(p.crop_key).leaves; });
    const leafMat = own(new THREE.MeshStandardMaterial({ roughness: 0.7, side: THREE.DoubleSide }));
    const leafMeshes = Object.entries(kindCount).map(([k, c]) => { const m = new THREE.InstancedMesh(own(leafKind(k)), leafMat, c); m.userData.kind = k; m.userData.i = 0; return m; });
    const leafOf = (k) => leafMeshes.find((m) => m.userData.kind === k);
    const flowers = new THREE.InstancedMesh(own(flowerGeometry()), own(new THREE.MeshStandardMaterial({ roughness: 0.6 })), n * 2);
    const poles = new THREE.InstancedMesh(own(new THREE.CylinderGeometry(0.012, 0.012, 1, 5).translate(0, 0.5, 0)), own(new THREE.MeshStandardMaterial({ color: '#9E9E9E', metalness: 0.4, roughness: 0.5 })), n);
    let flowerN = 0;
    let poleN = 0;
    const proxy = new THREE.InstancedMesh(own(new THREE.CylinderGeometry(size * 1.15, size * 1.15, 1, 8).translate(0, 0.5, 0)), own(new THREE.MeshBasicMaterial({ visible: false })), n);
    const ringsMesh = new THREE.InstancedMesh(own(new THREE.TorusGeometry(size * 1.35, size * 0.12, 8, 24).rotateX(Math.PI / 2)), own(new THREE.MeshBasicMaterial({ color: '#ffffff' })), n);

    const byCrop = new Map(); // fruit model -> list of { m: matrix, color }
    plants.forEach((p, i) => {
      const h = habitOf(p.crop_key);
      const rnd = rng(i * 131 + p.row * 17 + p.plant);
      const H = h.tall * size * 0.85;
      if (p.state === 'inactive') { // uprooted: only a short stake is left, and the position can still be picked
        dummy.position.set(p.x, 0.18, p.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, size * 0.5, 1);
        dummy.updateMatrix();
        stem.setMatrixAt(i, dummy.matrix);
        proxy.setMatrixAt(i, dummy.matrix);
        return;
      }
      dummy.position.set(p.x, 0.18, p.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, H, 1);
      dummy.updateMatrix();
      stem.setMatrixAt(i, dummy.matrix);
      dummy.scale.set(1, Math.max(H, size * 1.4), 1);
      dummy.updateMatrix();
      proxy.setMatrixAt(i, dummy.matrix);
      // leaves spiral up the stem: the lower ones older, larger and drooping, the upper ones young and upright
      const reach = size * 1.05 * h.spread;
      const lk = leafOf(leafKindOf(p.crop_key));
      for (let l = 0; l < h.leaves; l += 1) {
        const f = 0.1 + (l / h.leaves) * 0.88;
        dummy.position.set(p.x, 0.18 + H * f, p.z);
        dummy.rotation.set(-(0.55 * f - 0.15 + rnd() * 0.25), l * 2.399 + rnd() * 0.6, 0, 'YXZ');
        const len = reach * (1.2 - 0.5 * f) * (0.85 + rnd() * 0.3);
        dummy.scale.set(len, len, len);
        dummy.updateMatrix();
        lk.setMatrixAt(lk.userData.i, dummy.matrix);
        lk.setColorAt(lk.userData.i, tmpColor.set(LEAF_GREENS[Math.floor(rnd() * LEAF_GREENS.length)]).multiplyScalar(0.8 + 0.3 * f + rnd() * 0.15));
        lk.userData.i += 1;
      }
      // flowers near the top
      for (let q = 0; q < 2; q += 1) {
        const a = rnd() * Math.PI * 2;
        dummy.position.set(p.x + Math.cos(a) * reach * 0.4, 0.18 + H * (0.7 + rnd() * 0.28), p.z + Math.sin(a) * reach * 0.4);
        dummy.rotation.set(-0.6, rnd() * 6.28, 0);
        const fsz = size * 0.2;
        dummy.scale.set(fsz, fsz, fsz);
        dummy.updateMatrix();
        flowers.setMatrixAt(flowerN, dummy.matrix);
        flowers.setColorAt(flowerN, tmpColor.set(FLOWER_COLOR[p.crop_key] || FLOWER_COLOR.custom));
        flowerN += 1;
      }
      // a support pole for the tall climbing crops
      if (h.tall >= 2.2) {
        dummy.position.set(p.x + size * 0.3, 0.18, p.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, H * 1.18, 1);
        dummy.updateMatrix();
        poles.setMatrixAt(poleN, dummy.matrix);
        poleN += 1;
      }
      // fruit: as many as were counted, up to what the scene can draw
      if (!p.latest) return;
      const shown = Math.min(p.latest.recorded_count, h.cluster === 1 ? Math.min(fruitCap, 8) : fruitCap, p.crop_key === 'melon' ? 3 : 99);
      if (!shown) return;
      const model = fruitModel(p.crop_key);
      if (!byCrop.has(model)) byCrop.set(model, []);
      const list = byCrop.get(model);
      const fs = size * h.fruitSize;
      let k = 0;
      while (k < shown) {
        // fruit come in trusses (tomato, strawberry, beans) or alone (pepper, cucumber...)
        const inGroup = Math.min(h.cluster, shown - k);
        const ang = rnd() * Math.PI * 2;
        const rad = reach * (0.35 + rnd() * 0.5);
        const yf = h.zone[0] + rnd() * (h.zone[1] - h.zone[0]);
        for (let c = 0; c < inGroup; c += 1) {
          const jitter = fs * 0.55;
          const x = p.x + Math.cos(ang) * rad + (rnd() - 0.5) * jitter * 2;
          const z = p.z + Math.sin(ang) * rad + (rnd() - 0.5) * jitter * 2;
          const s = fs * (0.85 + rnd() * 0.3);
          let y;
          if (model.hang) {
            y = 0.18 + H * yf - c * fs * 0.25 - s * 0.1;
            dummy.rotation.set((rnd() - 0.5) * 0.3, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.3);
          } else {
            // fruit that lie on the bed (zucchini, melon)
            y = 0.18 + s * (p.crop_key === 'melon' ? 0.5 : 0.17);
            dummy.rotation.set(p.crop_key === 'melon' ? 0 : Math.PI / 2, rnd() * Math.PI * 2, 0, 'YXZ');
          }
          dummy.position.set(x, y, z);
          dummy.scale.set(s, s, s);
          dummy.updateMatrix();
          list.push({ m: dummy.matrix.clone(), color: model.palette[Math.floor(rnd() * model.palette.length)] });
          k += 1;
        }
      }
    });
    leafMeshes.forEach((m) => { m.count = m.userData.i; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
    flowers.count = flowerN;
    flowers.instanceMatrix.needsUpdate = true;
    if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true;
    poles.count = poleN;
    poles.instanceMatrix.needsUpdate = true;
    stem.instanceMatrix.needsUpdate = true;
    proxy.instanceMatrix.needsUpdate = true;
    const fruitMeshes = [];
    byCrop.forEach((list, model) => {
      const cnt = list.length;
      const body = new THREE.InstancedMesh(model.body, own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.02 })), cnt);
      const cap = new THREE.InstancedMesh(model.cap, own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 })), cnt);
      list.forEach((f, j) => { body.setMatrixAt(j, f.m); cap.setMatrixAt(j, f.m); body.setColorAt(j, tmpColor.set(f.color)); });
      body.instanceMatrix.needsUpdate = true;
      cap.instanceMatrix.needsUpdate = true;
      if (body.instanceColor) body.instanceColor.needsUpdate = true;
      fruitMeshes.push(body, cap);
    });
    plants.forEach((p, i) => { dummy.position.set(p.x, 0.2, p.z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); ringsMesh.setMatrixAt(i, dummy.matrix); });
    ringsMesh.instanceMatrix.needsUpdate = true;
    scene.add(stem, ...leafMeshes, flowers, poles, proxy, ringsMesh, ...fruitMeshes);

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
      const hit = ray.intersectObject(proxy, false)[0];
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
    api.current = { plants, ring, size, max, scene, camera, renderer, controls, el };
    api.current.setView = (name) => {
      if (name === 'top') flyTo([spanX / 2, reach * 0.8, spanZ / 2 + 0.01], [spanX / 2, 0, spanZ / 2]);
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
    const sph = new THREE.Spherical();
    const off = new THREE.Vector3();
    const orbit = (dTheta, dPhi, zoom) => {
      off.copy(camera.position).sub(controls.target);
      sph.setFromVector3(off);
      sph.theta += dTheta;
      sph.phi = Math.min(controls.maxPolarAngle, Math.max(0.08, sph.phi + dPhi));
      sph.radius = Math.min(controls.maxDistance, Math.max(controls.minDistance, sph.radius * zoom));
      off.setFromSpherical(sph);
      camera.position.copy(controls.target).add(off);
    };
    const panBy = (right, forward) => {
      const f = new THREE.Vector3();
      camera.getWorldDirection(f);
      f.y = 0;
      f.normalize();
      const r = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0)).normalize();
      const d = new THREE.Vector3().addScaledVector(r, right).addScaledVector(f, forward);
      const nt = controls.target.clone().add(d);
      nt.x = Math.min(spanX, Math.max(0, nt.x));
      nt.z = Math.min(spanZ, Math.max(0, nt.z));
      d.copy(nt).sub(controls.target);
      controls.target.add(d);
      camera.position.add(d);
    };
    const step = Math.max(0.6, reach * 0.04);
    api.current.act = (name) => {
      tween = null;
      if (name === 'left') orbit(-0.12, 0, 1);
      else if (name === 'right') orbit(0.12, 0, 1);
      else if (name === 'up') orbit(0, -0.08, 1);
      else if (name === 'down') orbit(0, 0.08, 1);
      else if (name === 'in') orbit(0, 0, 0.9);
      else if (name === 'out') orbit(0, 0, 1.1);
      else if (name === 'pan-left') panBy(-step, 0);
      else if (name === 'pan-right') panBy(step, 0);
      else if (name === 'pan-forward') panBy(0, step);
      else if (name === 'pan-back') panBy(0, -step);
    };
    api.current.autoRotate = (on) => { controls.autoRotate = !!on; };
    api.current.paint = (by, sel) => {
      plants.forEach((p, i) => ringsMesh.setColorAt(i, tmpColor.set(markerColor(p, by, max))));
      if (ringsMesh.instanceColor) ringsMesh.instanceColor.needsUpdate = true;
      const p = sel && plants.find((x) => x.row_id === sel.row_id && x.plant_label === sel.plant_label);
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
      [...leafMeshes, flowers, poles, stem, proxy, ringsMesh, ...fruitMeshes].forEach((m) => m.dispose());
      disposables.forEach((d) => d.dispose?.());
      renderer.dispose();
      renderer.domElement.remove();
      api.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  // recolour and move the selection ring without rebuilding
  useEffect(() => { api.current.paint?.(colorBy, selected); }, [colorBy, selected, layout]);

  useEffect(() => { api.current.setView?.(view); }, [view, layout, resetKey]);
  useEffect(() => {
    const p = selected && layout?.plants.find((x) => x.row_id === selected.row_id && x.plant_label === selected.plant_label);
    if (p && focusKey) api.current.focus?.(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  const [spin, setSpin] = useState(false);
  useEffect(() => { api.current.autoRotate?.(spin); }, [spin, layout]);
  const hold = useRef(null);
  const fire = (name) => api.current.act?.(name);
  const press = (name) => (e) => { e.preventDefault(); fire(name); clearInterval(hold.current); hold.current = setInterval(() => fire(name), 60); };
  const release = () => clearInterval(hold.current);
  useEffect(() => release, []);
  const KEYS = { ArrowLeft: 'pan-left', ArrowRight: 'pan-right', ArrowUp: 'pan-forward', ArrowDown: 'pan-back', a: 'pan-left', d: 'pan-right', w: 'pan-forward', s: 'pan-back', q: 'left', e: 'right', r: 'up', f: 'down', '+': 'in', '=': 'in', '-': 'out' };
  const onKey = (e) => { const a = KEYS[e.key]; if (a) { e.preventDefault(); fire(a); } };
  const fullscreen = () => { const el = mount.current; if (!el) return; if (document.fullscreenElement) document.exitFullscreen(); else el.requestFullscreen?.(); };
  const Btn = ({ name, icon, label, cls = '' }) => (
    <button type="button" className={`gh-ctl-btn ${cls}`} aria-label={label} title={label} onPointerDown={press(name)} onPointerUp={release} onPointerLeave={release} onPointerCancel={release}><i className={`fas ${icon}`} /></button>
  );

  if (failed) return null;
  return (
    <div ref={mount} className="gh-scene" style={{ height }} tabIndex={0} onKeyDown={onKey} role="application" aria-label="3D view of the greenhouse. Arrow keys or W A S D move, Q and E turn, R and F tilt, plus and minus zoom. Use the plan view for a list.">
      <div className="gh-ctl" onPointerDown={(e) => e.stopPropagation()}>
        <div className="gh-ctl-group" aria-label="Move">
          <Btn name="pan-forward" icon="fa-chevron-up" label="Move forward" cls="n" />
          <Btn name="pan-left" icon="fa-chevron-left" label="Move left" cls="w" />
          <Btn name="pan-right" icon="fa-chevron-right" label="Move right" cls="e" />
          <Btn name="pan-back" icon="fa-chevron-down" label="Move back" cls="s" />
          <span className="gh-ctl-hub"><i className="fas fa-up-down-left-right" /></span>
        </div>
        <div className="gh-ctl-row">
          <Btn name="left" icon="fa-rotate-left" label="Turn left" />
          <Btn name="right" icon="fa-rotate-right" label="Turn right" />
          <Btn name="up" icon="fa-arrows-up-to-line" label="Look from higher" />
          <Btn name="down" icon="fa-arrows-down-to-line" label="Look from lower" />
        </div>
        <div className="gh-ctl-row">
          <Btn name="in" icon="fa-magnifying-glass-plus" label="Zoom in" />
          <Btn name="out" icon="fa-magnifying-glass-minus" label="Zoom out" />
          <button type="button" className={`gh-ctl-btn ${spin ? 'on' : ''}`} aria-pressed={spin} aria-label="Turn the greenhouse slowly" title="Turn slowly" onClick={() => setSpin((v) => !v)}><i className="fas fa-sync" /></button>
          <button type="button" className="gh-ctl-btn" aria-label="Full screen" title="Full screen" onClick={fullscreen}><i className="fas fa-expand" /></button>
        </div>
      </div>
    </div>
  );
}
