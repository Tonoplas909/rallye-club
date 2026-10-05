// Construction procédurale des voitures (carrosserie extrudée + accessoires).
// Repère du modèle : +x avant, +y haut, +z côté droit. Origine au sol, centre de l'empattement.
import * as THREE from 'three';
import { colorHex, PARTS } from './data.js';
import { paintLivery, projectLiveryUV } from './livery.js';

// Profils latéraux : x normalisé (-1 arrière → 1 avant), y en mètres.
// top = ligne supérieure de la caisse (arrière → avant), cabin = vitrage.
const SHAPES = {
  hatch: {
    top: [[-1, 0.36], [-1, 0.9], [-0.97, 0.98], [0.36, 0.98], [0.93, 0.8], [1, 0.7], [1, 0.36]],
    cabin: [[-0.95, 0.96], [-0.87, 1.42], [0.02, 1.45], [0.38, 0.97]],
    spoiler: { x: -0.9, y: 1.43, roof: true },
    floor: 0.27,
  },
  coupe: {
    top: [[-1, 0.36], [-1, 0.72], [-0.92, 0.84], [0.3, 0.86], [0.9, 0.66], [1, 0.56], [1, 0.34]],
    cabin: [[-0.78, 0.84], [-0.32, 1.2], [0.06, 1.22], [0.33, 0.85]],
    spoiler: { x: -0.95, y: 0.86, roof: false },
    floor: 0.26,
  },
  sedan: {
    top: [[-1, 0.4], [-1, 0.92], [-0.95, 1.0], [-0.62, 1.01], [0.4, 0.99], [0.93, 0.82], [1, 0.72], [1, 0.38]],
    cabin: [[-0.64, 0.99], [-0.4, 1.43], [0.12, 1.45], [0.42, 0.98]],
    spoiler: { x: -0.9, y: 1.02, roof: false },
    floor: 0.28,
  },
  wedge: {
    top: [[-1, 0.38], [-1, 0.86], [-0.95, 0.92], [-0.38, 0.98], [0.45, 0.88], [0.95, 0.6], [1, 0.52], [1, 0.32]],
    cabin: [[-0.4, 0.96], [-0.12, 1.22], [0.22, 1.23], [0.5, 0.88]],
    spoiler: { x: -0.94, y: 0.92, roof: false },
    floor: 0.24,
  },
  suv: {
    blackFlares: true,
    top: [[-1, 0.5], [-1, 1.15], [-0.97, 1.2], [0.4, 1.18], [0.95, 1.06], [1, 0.98], [1, 0.48]],
    cabin: [[-0.96, 1.18], [-0.93, 1.86], [0.2, 1.88], [0.44, 1.17]],
    spoiler: { x: -0.92, y: 1.88, roof: true },
    floor: 0.42,
  },
  classic: {
    top: [[-1, 0.42], [-1, 0.88], [-0.97, 0.94], [-0.6, 0.95], [0.42, 0.93], [0.97, 0.88], [1, 0.82], [1, 0.42]],
    cabin: [[-0.6, 0.93], [-0.48, 1.4], [0.16, 1.41], [0.4, 0.92]],
    spoiler: { x: -0.92, y: 0.96, roof: false },
    floor: 0.3,
  },
  pickup: {
    top: [[-1, 0.62], [-1, 1.12], [-0.97, 1.15], [0.38, 1.15], [0.95, 1.05], [1, 0.95], [1, 0.6]],
    cabin: [[-0.12, 1.13], [-0.09, 1.82], [0.2, 1.84], [0.42, 1.13]],
    spoiler: { x: -0.1, y: 1.84, roof: true },
    floor: 0.5,
    blackFlares: true,
  },
  wrc: {
    top: [[-1, 0.34], [-1, 0.9], [-0.97, 0.98], [0.36, 0.98], [0.93, 0.78], [1, 0.66], [1, 0.32]],
    cabin: [[-0.94, 0.96], [-0.85, 1.4], [0.02, 1.43], [0.38, 0.97]],
    spoiler: { x: -0.9, y: 1.41, roof: true },
    floor: 0.25,
    flares: true,
  },
};

const HEIGHT_OFFSET = { low: -0.05, stock: 0, raised: 0.1 };

const shared = {};
function sharedMat(key, make) { return shared[key] || (shared[key] = make()); }
const blackPlastic = () => sharedMat('plastic', () => new THREE.MeshStandardMaterial({ color: 0x151517, roughness: 0.8 }));
const tireMat = () => sharedMat('tire', () => new THREE.MeshStandardMaterial({ color: 0x1b1b1d, roughness: 0.95 }));
const chromeMat = () => sharedMat('chrome', () => new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 1, roughness: 0.2 }));
const lampMat = () => sharedMat('lamp', () => new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4d0, emissiveIntensity: 1.6, roughness: 0.2 }));
const podLampMat = () => sharedMat('podlamp', () => new THREE.MeshStandardMaterial({ color: 0xfff6c8, emissive: 0xffe9a0, emissiveIntensity: 2.2, roughness: 0.2 }));
const tailMat = () => sharedMat('tail', () => new THREE.MeshStandardMaterial({ color: 0x8a0000, emissive: 0xff1010, emissiveIntensity: 0.9, roughness: 0.3 }));

function profileY(pts, xn) {
  // Hauteur de la ligne supérieure à l'abscisse xn (parcourt les segments montants).
  let best = null;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    if (x1 === x0) continue;
    if ((xn >= x0 && xn <= x1) || (xn <= x0 && xn >= x1)) {
      const y = y0 + ((xn - x0) / (x1 - x0)) * (y1 - y0);
      best = best === null ? y : Math.max(best, y);
    }
  }
  return best ?? pts[0][1];
}

function paintMaterial(cfg, texture) {
  const f = cfg.finish;
  const m = new THREE.MeshPhysicalMaterial({ map: texture, roughness: 0.35, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.08 });
  if (f === 'matte') { m.roughness = 0.75; m.clearcoat = 0; }
  if (f === 'metal') { m.metalness = 0.65; m.roughness = 0.32; }
  if (f === 'pearl') { m.metalness = 0.3; m.roughness = 0.25; m.iridescence = 0.9; m.iridescenceIOR = 1.6; }
  if (f === 'chrome') { m.metalness = 1; m.roughness = 0.06; m.clearcoat = 0.4; }
  return m;
}

function glassMaterial(tint) {
  const col = tint === 'black' ? 0x050506 : tint === 'dark' ? 0x111a24 : 0x2c4152;
  return new THREE.MeshPhysicalMaterial({ color: col, metalness: 0.2, roughness: 0.05, clearcoat: 1 });
}

function extrudeProfile(pts, depth, bevel, curveFn) {
  const shape = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  if (curveFn) curveFn(shape);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 14,
  });
  geo.translate(0, 0, -depth / 2);
  return geo.toNonIndexed();
}

// --- Jantes ------------------------------------------------------------------
function buildRim(style, color, R, width) {
  const g = new THREE.Group();
  const rimR = R * 0.68;
  const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.75, roughness: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.7 });
  const face = width / 2 + 0.005;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(rimR, 0.022, 8, 28), mat);
  ring.position.z = face;
  g.add(ring);
  const back = new THREE.Mesh(new THREE.CircleGeometry(rimR, 24), dark);
  back.position.z = face - 0.05;
  g.add(back);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(rimR * 0.2, rimR * 0.22, 0.05, 16), mat);
  hub.rotation.x = Math.PI / 2;
  hub.position.z = face;
  g.add(hub);

  const spoke = (count, w, angle0 = 0, twist = 0, len = rimR * 0.95) => {
    for (let i = 0; i < count; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.03), mat);
      const a = angle0 + (i / count) * Math.PI * 2;
      s.position.set(Math.cos(a + Math.PI / 2) * len / 2, Math.sin(a + Math.PI / 2) * len / 2, face - 0.01);
      s.rotation.z = a + twist;
      g.add(s);
    }
  };
  const disc = (r, z = face - 0.01) => {
    const d = new THREE.Mesh(new THREE.CircleGeometry(r, 28), mat);
    d.position.z = z;
    g.add(d);
  };
  const holes = (count, r, at) => {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const h = new THREE.Mesh(new THREE.CircleGeometry(r, 12), dark);
      h.position.set(Math.cos(a) * at, Math.sin(a) * at, face + 0.002);
      g.add(h);
    }
  };
  switch (style) {
    case 'tole': disc(rimR); holes(6, rimR * 0.13, rimR * 0.6); break;
    case 'rallye': disc(rimR); holes(8, rimR * 0.07, rimR * 0.82); break;
    case 'mesh': spoke(10, 0.018, 0, 0.35); spoke(10, 0.018, 0, -0.35); break;
    case 'turbofan': disc(rimR * 0.55, face - 0.03); spoke(12, 0.05, 0, 0.6, rimR * 0.92); break;
    default: spoke(5, 0.06); break;
  }
  return g;
}

function buildWheel(R, width, rimStyle, rimColor, left) {
  const pivot = new THREE.Group();
  const spin = new THREE.Group();
  pivot.add(spin);
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(R, R, width, 26), tireMat());
  tire.rotation.x = Math.PI / 2;
  tire.castShadow = true;
  spin.add(tire);
  const side = new THREE.Mesh(new THREE.TorusGeometry(R * 0.86, R * 0.14, 8, 26), tireMat());
  side.position.z = width / 2 - 0.02;
  spin.add(side);
  const rim = buildRim(rimStyle, rimColor, R, width);
  spin.add(rim);
  if (left) spin.rotation.y = Math.PI; // jante vers l'extérieur
  return { pivot, spin, left };
}

// --- Voiture complète -----------------------------------------------------------
export function buildCar(car, cfg, opts = {}) {
  const shape = SHAPES[car.shape];
  const { L, W, wheelR, wheelbase, track } = car.dims;
  const half = L / 2;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  body.position.y = HEIGHT_OFFSET[cfg.height] || 0;

  const canvas = paintLivery(cfg);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const paint = paintMaterial(cfg, tex);
  const glass = glassMaterial(cfg.tint);
  const sec = colorHex(cfg.livery2);
  const secMat = new THREE.MeshStandardMaterial({ color: sec, roughness: 0.4, metalness: 0.1 });

  const topPts = shape.top.map(([x, y]) => [x * half, y]);
  const cabinPts = shape.cabin.map(([x, y]) => [x * half, y]);
  const axleF = wheelbase / 2, axleR = -wheelbase / 2;
  const floor = shape.floor;
  const archR = 2 * wheelR + 0.06 - floor;
  const bevel = 0.07;
  const depth = W - 2 * bevel;

  // Contour : ligne supérieure arrière → avant, puis bas de caisse avec passages de roues.
  const lower = extrudeProfile(topPts, depth, bevel, (s) => {
    s.lineTo(half, floor);
    s.lineTo(axleF + archR, floor);
    s.absarc(axleF, floor, archR, 0, Math.PI, false);
    s.lineTo(axleR + archR, floor);
    s.absarc(axleR, floor, archR, 0, Math.PI, false);
    s.lineTo(-half, floor);
  });
  // Le dernier point "top" est déjà (half, …) : on ferme proprement.
  const cabin = extrudeProfile(cabinPts, W * 0.74, 0.06);

  const roofY = Math.max(...cabinPts.map((p) => p[1]));
  const roofX0 = cabinPts[1][0], roofX1 = cabinPts[2][0];
  const roofGeo = new THREE.BoxGeometry(roofX1 - roofX0 + 0.12, 0.05, W * 0.74 + 0.1).toNonIndexed();
  roofGeo.translate((roofX0 + roofX1) / 2, roofY + 0.045, 0);

  const bounds = { minX: -half - bevel, maxX: half + bevel, minY: floor, maxY: roofY + 0.1, minZ: -W / 2, maxZ: W / 2 };
  const paintedGeos = [lower, roofGeo];
  for (const g of paintedGeos) projectLiveryUV(g, bounds);
  const lowerMesh = new THREE.Mesh(lower, paint);
  const roofMesh = new THREE.Mesh(roofGeo, paint);
  const cabinMesh = new THREE.Mesh(cabin, glass);
  body.add(lowerMesh, roofMesh, cabinMesh);

  const addPainted = (geo, x, y, z, rot) => {
    geo = geo.toNonIndexed();
    const m4 = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(rot || new THREE.Euler()), new THREE.Vector3(1, 1, 1));
    geo.applyMatrix4(m4);
    projectLiveryUV(geo, bounds);
    const mesh = new THREE.Mesh(geo, paint);
    body.add(mesh);
    return mesh;
  };
  const addMesh = (geo, mat, x, y, z, parent = body) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  // Élargisseurs d'ailes (WRC / raid).
  if (shape.flares || shape.blackFlares) {
    for (const ax of [axleF, axleR]) for (const sz of [-1, 1]) {
      const fl = new THREE.Mesh(new THREE.TorusGeometry(archR + 0.02, 0.07, 6, 16, Math.PI), shape.blackFlares ? blackPlastic() : paint);
      if (!shape.blackFlares) { const g = fl.geometry.toNonIndexed(); fl.geometry = g; projectLiveryUV(g, bounds, new THREE.Matrix4().makeTranslation(ax, floor, sz * (W / 2 - 0.02))); }
      fl.position.set(ax, floor, sz * (W / 2 - 0.02));
      fl.scale.z = 1.6;
      body.add(fl);
    }
  }

  // Boucliers, calandre, phares, feux.
  const noseY = profileY(shape.top, 1) ;
  const bumperH = 0.2;
  addMesh(new THREE.BoxGeometry(0.16, bumperH, W - 0.05), blackPlastic(), half + 0.02, floor + bumperH / 2, 0);
  addMesh(new THREE.BoxGeometry(0.14, bumperH, W - 0.05), blackPlastic(), -half - 0.02, floor + bumperH / 2, 0);
  const grilleY = floor + bumperH + (noseY - floor - bumperH) * 0.45;
  addMesh(new THREE.BoxGeometry(0.04, Math.max(0.08, (noseY - floor - bumperH) * 0.5), W * 0.38), blackPlastic(), half + bevel, grilleY, 0);
  for (const sz of [-1, 1]) {
    addMesh(new THREE.BoxGeometry(0.05, 0.1, W * 0.2), lampMat(), half + bevel - 0.005, grilleY, sz * W * 0.32);
    const rearY = profileY(shape.top, -1) - 0.12;
    addMesh(new THREE.BoxGeometry(0.05, 0.1, W * 0.18), tailMat(), -half - bevel + 0.005, rearY, sz * W * 0.34);
    // Rétroviseurs
    const mx = cabinPts[3][0] - 0.12, my = cabinPts[3][1] + 0.08;
    addPainted(new THREE.BoxGeometry(0.12, 0.09, 0.14), mx, my, sz * (W * 0.37 + 0.12));
  }

  // Capot.
  const hoodX = (cabinPts[3][0] + half) / 2;
  const hoodY = profileY(topPts, hoodX);
  if (cfg.hood === 'scoop') {
    addPainted(new THREE.BoxGeometry(0.5, 0.1, 0.5), hoodX - 0.05, hoodY + 0.03, 0, new THREE.Euler(0, 0, -0.18));
    addMesh(new THREE.BoxGeometry(0.03, 0.06, 0.42), blackPlastic(), hoodX + 0.21, hoodY + 0.06, 0);
  } else if (cfg.hood === 'vents') {
    for (const sz of [-1, 1]) for (let i = 0; i < 3; i++) {
      const v = addMesh(new THREE.BoxGeometry(0.06, 0.03, 0.32), blackPlastic(), hoodX - 0.15 + i * 0.12, hoodY + 0.005 - i * 0.02, sz * 0.36);
      v.rotation.z = -0.25;
    }
  }

  // Aileron.
  const sp = shape.spoiler;
  const spX = sp.x * half, spY = sp.y;
  const wingMat = cfg.livery !== 'none' ? secMat : paint;
  if (cfg.spoiler === 'lip') {
    addPainted(new THREE.BoxGeometry(0.22, 0.04, W * 0.72), spX - 0.06, spY + 0.02, 0, new THREE.Euler(0, 0, 0.25));
  } else if (cfg.spoiler === 'ducktail') {
    addPainted(new THREE.BoxGeometry(0.3, 0.1, W * 0.9), -half + 0.12, profileY(topPts, -half + 0.12) + 0.04, 0, new THREE.Euler(0, 0, 0.35));
  } else if (cfg.spoiler === 'wing' || cfg.spoiler === 'gt') {
    const big = cfg.spoiler === 'gt';
    const h = big ? 0.32 : 0.2;
    const wx = sp.roof ? spX - 0.05 : -half + 0.22;
    const baseY = sp.roof ? spY : profileY(topPts, wx);
    for (const sz of [-1, 1]) addMesh(new THREE.BoxGeometry(0.12, h, 0.03), blackPlastic(), wx, baseY + h / 2, sz * W * 0.3);
    const wing = addMesh(new THREE.BoxGeometry(big ? 0.38 : 0.28, 0.035, big ? W + 0.08 : W * 0.88), wingMat, wx - 0.04, baseY + h, 0);
    wing.rotation.z = 0.12;
    if (big) for (const sz of [-1, 1]) addMesh(new THREE.BoxGeometry(0.44, 0.2, 0.02), wingMat, wx - 0.04, baseY + h - 0.03, sz * (W / 2 + 0.04));
  }

  // Toit.
  const roofMid = (roofX0 + roofX1) / 2;
  if (cfg.roof === 'scoop') {
    addPainted(new THREE.BoxGeometry(0.34, 0.09, 0.26), roofX1 - 0.25, roofY + 0.1, 0, new THREE.Euler(0, 0, -0.1));
    addMesh(new THREE.BoxGeometry(0.02, 0.06, 0.2), blackPlastic(), roofX1 - 0.08, roofY + 0.12, 0);
  } else if (cfg.roof === 'rack') {
    const rl = roofX1 - roofX0 - 0.1, rw = W * 0.7;
    for (const sz of [-1, 1]) addMesh(new THREE.BoxGeometry(rl, 0.04, 0.04), blackPlastic(), roofMid, roofY + 0.16, sz * rw / 2);
    for (const xx of [-1, 0, 1]) addMesh(new THREE.BoxGeometry(0.04, 0.04, rw), blackPlastic(), roofMid + xx * rl / 2.2, roofY + 0.16, 0);
    for (const xx of [-1, 1]) for (const sz of [-1, 1]) addMesh(new THREE.BoxGeometry(0.04, 0.12, 0.04), blackPlastic(), roofMid + xx * rl / 2.2, roofY + 0.1, sz * rw / 2);
    const spare = new THREE.Mesh(new THREE.CylinderGeometry(wheelR, wheelR, 0.2, 20), tireMat());
    spare.position.set(roofMid - 0.1, roofY + 0.28, 0);
    body.add(spare);
  }

  // Longues portées.
  const lightLevel = { none: 0, pod2: 1, pod4: 2, bar: 2 }[cfg.lights] || 0;
  if (cfg.lights === 'pod2' || cfg.lights === 'pod4') {
    const n = cfg.lights === 'pod2' ? 2 : 4;
    const y = noseY + 0.05;
    addMesh(new THREE.BoxGeometry(0.05, 0.04, W * 0.8), blackPlastic(), half - 0.02, y - 0.05, 0);
    for (let i = 0; i < n; i++) {
      const z = (i - (n - 1) / 2) * (W * 0.75 / n);
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.1, 18), blackPlastic());
      pod.rotation.z = Math.PI / 2;
      pod.position.set(half + 0.04, y + 0.05, z);
      body.add(pod);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.085, 18), podLampMat());
      lens.rotation.y = Math.PI / 2;
      lens.position.set(half + 0.095, y + 0.05, z);
      body.add(lens);
    }
  } else if (cfg.lights === 'bar') {
    addMesh(new THREE.BoxGeometry(0.1, 0.08, W * 0.7), blackPlastic(), roofX1 - 0.05, roofY + 0.1, 0);
    addMesh(new THREE.BoxGeometry(0.02, 0.05, W * 0.66), podLampMat(), roofX1 + 0.005, roofY + 0.1, 0);
  }

  // Bavettes.
  if (cfg.mudflaps === 'on') {
    for (const ax of [axleF, axleR]) for (const sz of [-1, 1]) {
      addMesh(new THREE.BoxGeometry(0.02, 0.26, 0.3), secMat, ax - archR - 0.04, floor - 0.06, sz * (track / 2));
    }
  }

  // Échappement.
  const exhaust = new THREE.Vector3(-half - 0.08, floor + 0.08, W * 0.3);
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.2, 10), chromeMat());
  pipe.rotation.z = Math.PI / 2;
  pipe.position.copy(exhaust).add(new THREE.Vector3(0.06, 0, 0));
  body.add(pipe);

  // Néons.
  let neon = null;
  const neonDef = PARTS.neon.find((n) => n.id === cfg.neon);
  if (neonDef && neonDef.hex) {
    neon = new THREE.Mesh(new THREE.PlaneGeometry(L * 1.15, W * 1.5), new THREE.MeshBasicMaterial({
      color: neonDef.hex, map: glowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9,
    }));
    neon.rotation.x = -Math.PI / 2;
    neon.position.y = 0.04;
    root.add(neon);
  }

  // Roues.
  const wheels = [];
  const tw = Math.min(0.26, wheelR * 0.75);
  for (const [ax, front] of [[axleF, true], [axleR, false]]) for (const sz of [-1, 1]) {
    const w = buildWheel(wheelR, tw, cfg.rims, colorHex(cfg.rimColor), sz < 0);
    w.pivot.position.set(ax, wheelR, sz * (track / 2));
    w.front = front;
    w.baseY = wheelR;
    root.add(w.pivot);
    wheels.push(w);
  }

  root.traverse((o) => {
    if (o.isMesh) { o.castShadow = !opts.ghost && o !== neon; o.receiveShadow = false; }
  });

  if (opts.ghost) {
    const gm = new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.28, depthWrite: false });
    root.traverse((o) => { if (o.isMesh) o.material = gm; });
  }

  return {
    group: root, body, wheels, exhaust, lightLevel, neon,
    nose: new THREE.Vector3(half, noseY, 0), roofY, texture: tex,
    dispose() {
      root.traverse((o) => {
        if (!o.isMesh) return;
        o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) if (!Object.values(shared).includes(m)) m.dispose();
      });
      tex.dispose();
    },
  };
}

let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.45)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

// Met à jour roues / caisse depuis l'état physique.
export function poseCar(model, phys, dtVis) {
  for (const w of model.wheels) {
    w.spin.rotation.z = -(w.front ? phys.rotF : phys.rotR);
    if (w.left) w.spin.rotation.z = (w.front ? phys.rotF : phys.rotR);
    w.pivot.rotation.y = w.front ? phys.steer : 0;
  }
  // Roulis / tangage visuels de la caisse (suspension).
  const roll = THREE.MathUtils.clamp(phys.ayF * 0.012, -0.07, 0.07);
  const pitch = THREE.MathUtils.clamp(phys.axF * 0.01, -0.05, 0.05);
  model.body.rotation.x = THREE.MathUtils.lerp(model.body.rotation.x, roll, Math.min(1, dtVis * 10));
  model.body.rotation.z = THREE.MathUtils.lerp(model.body.rotation.z, pitch, Math.min(1, dtVis * 10));
}
