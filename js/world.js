// Construction du décor 3D d'une spéciale à partir du tracé généré.
// Conversion des coordonnées : monde 2D (x, y) + altitude h  →  three (x, h, -y).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32, smoothstep, clamp } from './util.js';
import { SAMPLE } from './trackgen.js';
import { glowTexture } from './carModel.js';

export const THEMES = {
  forest: {
    sky: '#7fb4e2', horizon: '#d8e7f0', fog: '#c2d5df', fogNear: 70, fogFar: 520,
    sun: '#fff1d8', sunI: 2.6, hemiSky: '#d2e4ff', hemiGround: '#3d4a26', hemiI: 0.9,
    ground: ['#3c6829', '#54782f', '#2c5021'], verge: '#7a6442', rock: '#7d7a74',
    trees: ['pine', 'pine', 'broad'], density: 1.15, rocks: 0.4, dust: '#b49a76',
  },
  med: {
    sky: '#6db5f0', horizon: '#e6f0f6', fog: '#d6e5ee', fogNear: 90, fogFar: 650,
    sun: '#fff4e0', sunI: 2.9, hemiSky: '#d6eaff', hemiGround: '#5a5434', hemiI: 0.9,
    ground: ['#878c48', '#a79e5e', '#6c7838'], verge: '#9a8a66', rock: '#a29a8c',
    trees: ['olive', 'olive', 'pine', 'bush'], density: 0.7, rocks: 1, rails: true, dust: '#cfcfcf',
  },
  snow: {
    sky: '#9fbedb', horizon: '#eaf0f6', fog: '#dde6ee', fogNear: 60, fogFar: 450,
    sun: '#fff6ea', sunI: 2.2, hemiSky: '#e4eeff', hemiGround: '#b8c4d0', hemiI: 1.0,
    ground: ['#f3f6fa', '#e4ebf3', '#dbe3ed'], verge: '#e6ecf3', rock: '#8a8e94',
    trees: ['pineSnow'], density: 1.2, rocks: 0.1, dust: '#ffffff',
  },
  desert: {
    sky: '#6eaee2', horizon: '#f4e2bd', fog: '#ecd9b2', fogNear: 90, fogFar: 700,
    sun: '#fff0d0', sunI: 3.0, hemiSky: '#ffeccc', hemiGround: '#a07a48', hemiI: 0.9,
    ground: ['#d8b278', '#e5c38d', '#c89e64'], verge: '#c8a26c', rock: '#a0673f',
    trees: ['palm', 'bush'], density: 0.14, rocks: 1.3, dust: '#e0c38c',
  },
  wales: {
    sky: '#8a97a1', horizon: '#b4bdc3', fog: '#9aa6ad', fogNear: 25, fogFar: 240,
    sun: '#e6ecf2', sunI: 1.3, hemiSky: '#c4ccd4', hemiGround: '#2f3a24', hemiI: 1.1,
    ground: ['#33572a', '#44662e', '#294621'], verge: '#4e3d2a', rock: '#6b6b66',
    trees: ['pine', 'broad', 'pine'], density: 1.35, rocks: 0.4, rain: true, dust: '#5a4630',
  },
  night: {
    sky: '#03060f', horizon: '#0d1830', fog: '#081022', fogNear: 25, fogFar: 300,
    sun: '#9fb2ff', sunI: 0.35, hemiSky: '#3a4a80', hemiGround: '#10140c', hemiI: 0.35,
    ground: ['#4a5832', '#5b683b', '#3a4829'], verge: '#6b6150', rock: '#77736c',
    trees: ['pine', 'olive'], density: 0.8, rocks: 0.6, rails: true, flares: true, stars: true, dust: '#cfcfcf',
  },
};

const ROAD_COLORS = {
  gravel: { base: '#8f7b5d', rut: '#6f5c42', speck: ['#a8957a', '#6b5a43', '#b8a688'], edge: '#7b6a50' },
  tarmac: { base: '#404247', rut: '#34363a', speck: ['#55575c', '#2f3134', '#606368'], edge: '#3a3c40', lines: true },
  snow: { base: '#dde5ee', rut: '#afbdcd', speck: ['#ffffff', '#d4dde8', '#b9c6d4'], edge: '#f2f5f9' },
  sand: { base: '#d0ab72', rut: '#b48e58', speck: ['#e2c08a', '#b9935c', '#c9a46a'], edge: '#d8b67e' },
  mud: { base: '#5b4630', rut: '#3c2d1e', speck: ['#6e573c', '#403020', '#7a6448'], edge: '#4e3c28', puddles: true },
};

const to3 = (x, y, h) => new THREE.Vector3(x, h, -y);

function roadTexture(surface) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 512;
  const g = c.getContext('2d');
  const col = ROAD_COLORS[surface];
  const rng = mulberry32(99);
  g.fillStyle = col.base;
  g.fillRect(0, 0, 256, 512);
  // Ornières
  for (const x of [0.3, 0.7]) {
    const grd = g.createLinearGradient((x - 0.08) * 256, 0, (x + 0.08) * 256, 0);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(0.5, col.rut);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect((x - 0.08) * 256, 0, 0.16 * 256, 512);
  }
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = col.speck[i % col.speck.length];
    const s = rng() < 0.9 ? 1.5 : 3;
    g.globalAlpha = 0.35 + rng() * 0.5;
    g.fillRect(rng() * 256, rng() * 512, s, s);
  }
  g.globalAlpha = 1;
  // Bords
  for (const x of [0, 236]) {
    const grd = g.createLinearGradient(x, 0, x + 20, 0);
    grd.addColorStop(x ? 0 : 1, 'rgba(0,0,0,0)');
    grd.addColorStop(x ? 1 : 0, col.edge);
    g.fillStyle = grd;
    g.fillRect(x, 0, 20, 512);
  }
  if (col.lines) {
    g.fillStyle = '#e9e9e2';
    g.fillRect(8, 0, 6, 512);
    g.fillRect(242, 0, 6, 512);
    g.fillRect(125, 0, 5, 200);
  }
  if (col.puddles) {
    for (let i = 0; i < 5; i++) {
      g.fillStyle = 'rgba(40,30,22,0.75)';
      g.beginPath();
      g.ellipse(40 + rng() * 176, rng() * 512, 14 + rng() * 26, 20 + rng() * 40, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// Texture de détail en niveaux de gris (multipliée par les couleurs du terrain).
function detailTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const rng = mulberry32(7);
  g.fillStyle = '#e8e8e8';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 2600; i++) {
    const v = 170 + Math.floor(rng() * 85);
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(rng() * 128, rng() * 128, 1 + rng() * 2.5, 1 + rng() * 2.5);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function textTexture(lines, bg, fg, w = 1024, h = 192) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (lines.length === 1) {
    g.font = `900 ${h * 0.62}px "Arial Black", Arial, sans-serif`;
    g.fillText(lines[0], w / 2, h * 0.53);
  } else {
    g.font = `900 ${h * 0.45}px "Arial Black", Arial, sans-serif`;
    g.fillText(lines[0], w / 2, h * 0.36);
    g.font = `700 ${h * 0.22}px Arial, sans-serif`;
    g.fillText(lines[1], w / 2, h * 0.78);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------------------
export class World {
  constructor(track, stage, quality = 'high') {
    this.track = track;
    this.stage = stage;
    this.theme = THEMES[track.theme];
    this.quality = quality;
    this.group = new THREE.Group();
    this.colliders = new Map();
    this.colliderCell = 10;
    this.barriers = [];
    this.spectators = [];
    this.flares = [];
    this.rng = mulberry32(stage.seed * 3 + 11);
    this.disposables = [];
    this.build();
  }

  addCollider(x, y, r) {
    const cx = Math.floor(x / this.colliderCell), cy = Math.floor(y / this.colliderCell);
    const key = cx * 92837111 ^ cy * 689287499;
    let list = this.colliders.get(key);
    if (!list) this.colliders.set(key, (list = []));
    list.push({ x, y, r });
  }

  collidersNear(x, y) {
    const out = [];
    const cx = Math.floor(x / this.colliderCell), cy = Math.floor(y / this.colliderCell);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const list = this.colliders.get((cx + i) * 92837111 ^ (cy + j) * 689287499);
      if (list) out.push(...list);
    }
    return out;
  }

  build() {
    this.buildSky();
    this.buildLights();
    this.buildTerrain();
    this.buildRoad();
    this.buildScenery();
    this.buildBarriers();
    this.buildSpectators();
    this.buildGates();
  }

  // ------------------------------------------------------------- ciel / lumière
  buildSky() {
    const th = this.theme;
    const geo = new THREE.SphereGeometry(4000, 32, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(th.sky) }, bottom: { value: new THREE.Color(th.horizon) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float t = smoothstep(-0.05, 0.45, vP.y); gl_FragColor = vec4(mix(bottom, top, t), 1.0); }',
    });
    this.sky = new THREE.Mesh(geo, mat);
    this.sky.renderOrder = -10;
    this.group.add(this.sky);
    if (th.stars) {
      const n = 1500, pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const u = this.rng() * Math.PI * 2, v = Math.acos(1 - this.rng() * 0.9);
        pos.set([Math.sin(v) * Math.cos(u) * 3500, Math.cos(v) * 3500, Math.sin(v) * Math.sin(u) * 3500], i * 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 4, sizeAttenuation: false, fog: false }));
      this.sky.add(stars);
    }
  }

  buildLights() {
    const th = this.theme;
    this.hemi = new THREE.HemisphereLight(th.hemiSky, th.hemiGround, th.hemiI);
    this.group.add(this.hemi);
    this.sun = new THREE.DirectionalLight(th.sun, th.sunI);
    this.sunOffset = new THREE.Vector3(60, 90, 35);
    this.sun.castShadow = this.quality !== 'low';
    const sc = this.sun.shadow.camera;
    sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.near = 1; sc.far = 300;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.group.add(this.sun, this.sun.target);
  }

  follow(pos) {
    this.sun.position.copy(pos).add(this.sunOffset);
    this.sun.target.position.copy(pos);
    this.sky.position.copy(pos);
  }

  // ------------------------------------------------------------- terrain
  terrainColor(x, y, h, ad, slope, out) {
    const th = this.theme;
    const n = this.track.noise2.noise(x / 18, y / 18) * 0.5 + 0.5;
    const n2 = this.track.noise.noise(x / 90 + 5, y / 90) * 0.5 + 0.5;
    const c0 = this._c0 || (this._c0 = th.ground.map((c) => new THREE.Color(c)));
    out.copy(c0[0]).lerp(c0[1], n).lerp(c0[2], n2 * 0.6);
    if (slope > 0.55) out.lerp(this._rock || (this._rock = new THREE.Color(th.rock)), smoothstep(0.55, 0.9, slope) * 0.8);
    const vergeK = 1 - smoothstep(this.track.halfW + 0.3, this.track.halfW + 3.5, ad);
    if (vergeK > 0) out.lerp(this._verge || (this._verge = new THREE.Color(th.verge)), vergeK);
    return out;
  }

  buildTerrain() {
    const t = this.track;
    const TILE = 64, SEG = this.quality === 'low' ? 16 : 26;
    const reach = 125;
    const b = t.bounds;
    const tiles = [];
    const x0 = Math.floor((b.minX - reach) / TILE), x1 = Math.floor((b.maxX + reach) / TILE);
    const y0 = Math.floor((b.minY - reach) / TILE), y1 = Math.floor((b.maxY + reach) / TILE);
    const lim = (reach + TILE * 0.72) ** 2;
    for (let tx = x0; tx <= x1; tx++) for (let ty = y0; ty <= y1; ty++) {
      const cx = (tx + 0.5) * TILE, cy = (ty + 0.5) * TILE;
      let ok = false;
      for (let i = 0; i < t.n && !ok; i += 3) {
        const dx = t.px[i] - cx, dy = t.py[i] - cy;
        if (dx * dx + dy * dy < lim) ok = true;
      }
      if (ok) tiles.push([tx, ty]);
    }
    this.tileSet = new Set(tiles.map(([a, c]) => `${a},${c}`));

    const detail = detailTexture();
    detail.repeat.set(TILE / 9, TILE / 9);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, map: detail });
    this.disposables.push(mat, detail);
    const col = new THREE.Color();
    const geos = [];
    for (const [tx, ty] of tiles) {
      const geo = new THREE.PlaneGeometry(TILE, TILE, SEG, SEG);
      geo.rotateX(-Math.PI / 2); // plan XZ, normale +Y
      geo.translate((tx + 0.5) * TILE, 0, -(ty + 0.5) * TILE);
      const pos = geo.attributes.position;
      const colors = new Float32Array(pos.count * 3);
      const ads = new Float32Array(pos.count);
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = -pos.getZ(i);
        const nr = t.nearest(x, y, -1);
        let h = t.heightFrom(x, y, nr);
        const ad = nr.far ? 999 : Math.abs(nr.d);
        if (ad < t.halfW + 0.5) h -= 0.25; // passe sous la route
        pos.setY(i, h);
        ads[i] = ad;
      }
      geo.computeVertexNormals();
      const nrm = geo.attributes.normal;
      for (let i = 0; i < pos.count; i++) {
        const slope = 1 - nrm.getY(i);
        this.terrainColor(pos.getX(i), -pos.getZ(i), pos.getY(i), ads[i], slope * 3, col);
        colors.set([col.r, col.g, col.b], i * 3);
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geos.push(geo);
    }
    // Fusion par paquets pour limiter les appels de dessin.
    for (let i = 0; i < geos.length; i += 40) {
      const merged = mergeGeometries(geos.slice(i, i + 40));
      const mesh = new THREE.Mesh(merged, mat);
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.disposables.push(merged);
    }
    geos.forEach((g) => g.dispose());

    // Terrain lointain, basse résolution, enfoncé là où les tuiles détaillées existent.
    const FAR = 2600, FSEG = 110;
    const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
    const far = new THREE.PlaneGeometry(FAR, FAR, FSEG, FSEG);
    far.rotateX(-Math.PI / 2);
    far.translate(cx, 0, -cy);
    const fp = far.attributes.position;
    const fcol = new Float32Array(fp.count * 3);
    for (let i = 0; i < fp.count; i++) {
      const x = fp.getX(i), y = -fp.getZ(i);
      let h = t.baseHeight(x, y) + t.mountain(x, y);
      // Enfoncé seulement si toutes les cellules voisines sont couvertes par des tuiles détaillées,
      // pour que les pentes de raccord restent cachées sous celles-ci.
      const cell = FAR / FSEG;
      const cov = (px, py) => this.tileSet.has(`${Math.floor(px / TILE)},${Math.floor(py / TILE)}`);
      let covered = true;
      for (const [ox, oy] of [[0, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]) if (!cov(x + ox * cell, y + oy * cell)) { covered = false; break; }
      if (covered) h -= 80;
      const edge = Math.max(Math.abs(x - cx), Math.abs(y - cy)) / (FAR / 2);
      h += smoothstep(0.55, 1, edge) * 120; // montagnes à l'horizon
      fp.setY(i, h);
      this.terrainColor(x, y, h, 999, 0, col);
      col.multiplyScalar(0.92);
      fcol.set([col.r, col.g, col.b], i * 3);
    }
    far.setAttribute('color', new THREE.BufferAttribute(fcol, 3));
    far.computeVertexNormals();
    const farMesh = new THREE.Mesh(far, mat);
    this.group.add(farMesh);
    this.disposables.push(far);
  }

  // ------------------------------------------------------------- route
  buildRoad() {
    const t = this.track;
    const n = t.n;
    const pos = new Float32Array(n * 2 * 3);
    const uv = new Float32Array(n * 2 * 2);
    const idx = [];
    for (let i = 0; i < n; i++) {
      const nx = -t.ty[i], ny = t.tx[i];
      const h = t.h[i] + 0.04;
      for (let k = 0; k < 2; k++) {
        const side = k === 0 ? 1 : -1; // gauche puis droite
        const x = t.px[i] + nx * t.halfW * side, y = t.py[i] + ny * t.halfW * side;
        pos.set([x, h, -y], (i * 2 + k) * 3);
        uv.set([k, (i * SAMPLE) / 16], (i * 2 + k) * 2);
      }
      if (i < n - 1) {
        const a = i * 2, b2 = a + 1, c = a + 2, d = a + 3;
        idx.push(a, b2, c, b2, d, c);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    // Corrige l'orientation si nécessaire (normales vers le haut).
    if (geo.attributes.normal.getY(0) < 0) {
      const ix = geo.index.array;
      for (let i = 0; i < ix.length; i += 3) { const tmp = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = tmp; }
      geo.computeVertexNormals();
    }
    const tex = roadTexture(t.surface);
    const mat = new THREE.MeshStandardMaterial({
      map: tex, roughness: t.surface === 'snow' ? 0.55 : t.surface === 'mud' ? 0.6 : 0.95,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    this.group.add(mesh);
    this.disposables.push(geo, mat, tex);
  }

  // ------------------------------------------------------------- végétation, rochers
  treeGeometries(kind) {
    const colorize = (geo, color, topColor, split) => {
      geo = geo.toNonIndexed();
      const p = geo.attributes.position;
      const cols = new Float32Array(p.count * 3);
      const c1 = new THREE.Color(color), c2 = topColor ? new THREE.Color(topColor) : c1;
      for (let i = 0; i < p.count; i++) {
        const c = topColor && p.getY(i) > split ? c2 : c1;
        cols.set([c.r, c.g, c.b], i * 3);
      }
      geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      geo.deleteAttribute('uv');
      return geo;
    };
    const trunk = (h, r, color = '#5b4027') => colorize(new THREE.CylinderGeometry(r * 0.7, r, h, 6).translate(0, h / 2, 0), color);
    switch (kind) {
      case 'pine':
      case 'pineSnow': {
        const snow = kind === 'pineSnow';
        const parts = [trunk(2.2, 0.22)];
        const green = '#2b4d2a';
        [[0, 3.4, 2.1], [1.8, 2.9, 1.6], [3.4, 2.3, 1.1]].forEach(([y, h, r]) => {
          parts.push(colorize(new THREE.ConeGeometry(r, h, 7).translate(0, 1.6 + y + h / 2, 0), green, snow ? '#f4f8fc' : null, 1.6 + y + h * 0.45));
        });
        return mergeGeometries(parts);
      }
      case 'broad': {
        const crown = colorize(new THREE.IcosahedronGeometry(2.4, 1).scale(1, 1.15, 1).translate(0, 4.6, 0), '#3f6b2c');
        return mergeGeometries([trunk(3.2, 0.25), crown]);
      }
      case 'olive': {
        const crown = colorize(new THREE.IcosahedronGeometry(1.8, 1).scale(1.3, 0.75, 1.3).translate(0, 2.9, 0), '#6f7d4a');
        return mergeGeometries([trunk(2.2, 0.28, '#6d5a45'), crown]);
      }
      case 'bush':
        return colorize(new THREE.IcosahedronGeometry(1, 1).scale(1.3, 0.8, 1.3).translate(0, 0.5, 0), '#5c6b3a');
      case 'palm': {
        const parts = [trunk(6.5, 0.22, '#8a6a46')];
        for (let i = 0; i < 7; i++) {
          const leaf = new THREE.ConeGeometry(0.5, 3.2, 4).scale(1, 1, 0.2);
          leaf.rotateZ(-Math.PI / 2 - 0.35);
          leaf.translate(1.5, 6.2, 0);
          leaf.rotateY((i / 7) * Math.PI * 2);
          parts.push(colorize(leaf, '#4f7a2e'));
        }
        return mergeGeometries(parts);
      }
      default:
        return trunk(2, 0.2);
    }
  }

  buildScenery() {
    const t = this.track, th = this.theme, rng = this.rng;
    const kinds = th.trees;
    const count = Math.floor((t.length / 1000) * 650 * th.density * (this.quality === 'low' ? 0.5 : 1));
    const placements = {};
    kinds.forEach((k) => (placements[k] = []));
    for (let k = 0; k < count; k++) {
      const kind = kinds[Math.floor(rng() * kinds.length)];
      const p = this.randomRoadside(4 + (kind === 'bush' ? 0 : 1.5), 95, 1.6);
      if (!p) continue;
      const scale = 0.75 + rng() * 0.6;
      placements[kind].push({ ...p, scale, rot: rng() * Math.PI * 2 });
      if (p.ad < 16 && kind !== 'bush') this.addCollider(p.x, p.y, 0.45 * scale + 0.15);
    }
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
    this.disposables.push(mat);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const tint = new THREE.Color();
    for (const kind of kinds) {
      const list = placements[kind];
      if (!list || !list.length || list._done) continue;
      list._done = true;
      const geo = this.treeGeometries(kind);
      const inst = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((p, i) => {
        q.setFromAxisAngle(up, p.rot);
        s.setScalar(p.scale);
        m4.compose(to3(p.x, p.y, p.h - 0.2), q, s);
        inst.setMatrixAt(i, m4);
        tint.setHSL(0, 0, 0.82 + rng() * 0.3);
        inst.setColorAt(i, tint);
      });
      inst.castShadow = true;
      inst.receiveShadow = false;
      this.group.add(inst);
      this.disposables.push(geo);
    }

    // Rochers
    const rocks = Math.floor((t.length / 1000) * 120 * th.rocks);
    if (rocks > 0) {
      const geo = new THREE.IcosahedronGeometry(1, 0);
      const rmat = new THREE.MeshStandardMaterial({ color: th.rock, roughness: 0.95, flatShading: true });
      const inst = new THREE.InstancedMesh(geo, rmat, rocks);
      let used = 0;
      for (let k = 0; k < rocks; k++) {
        const p = this.randomRoadside(3, 70, 1.2);
        if (!p) continue;
        const sc = 0.4 + rng() ** 2 * 1.8;
        q.setFromEuler(new THREE.Euler(rng() * 3, rng() * 3, rng() * 3));
        s.set(sc * (0.8 + rng() * 0.6), sc * (0.5 + rng() * 0.4), sc * (0.8 + rng() * 0.6));
        m4.compose(to3(p.x, p.y, p.h - sc * 0.15), q, s);
        inst.setMatrixAt(used++, m4);
        if (p.ad < 14 && sc > 0.7) this.addCollider(p.x, p.y, sc * 0.8);
      }
      inst.count = used;
      inst.castShadow = true;
      this.group.add(inst);
      this.disposables.push(geo, rmat);
    }

    // Bottes de paille à l'extérieur des épingles et virages serrés.
    const bales = [];
    for (const note of th.rails ? [] : t.notes) {
      if (note.kind !== 'corner' || note.grade > 2) continue;
      const side = -note.dir; // extérieur du virage
      for (let s2 = note.s; s2 < note.end; s2 += 2.6) {
        const pt = t.pointAt(s2);
        const nx = -Math.sin(pt.a), ny = Math.cos(pt.a);
        const d = (t.halfW + 1.3) * side;
        const x = pt.x + nx * d, y = pt.y + ny * d;
        const nr = t.nearest(x, y, pt.idx);
        if (Math.abs(nr.d) < t.halfW + 0.8) continue;
        bales.push({ x, y, h: t.heightFrom(x, y, nr), a: pt.a });
        this.addCollider(x, y, 0.75);
      }
    }
    if (bales.length) {
      const geo = new THREE.CylinderGeometry(0.6, 0.6, 1.25, 12).rotateZ(Math.PI / 2);
      const bmat = new THREE.MeshStandardMaterial({ color: '#d9bf6a', roughness: 1 });
      const inst = new THREE.InstancedMesh(geo, bmat, bales.length);
      bales.forEach((b, i) => {
        q.setFromAxisAngle(up, b.a);
        m4.compose(to3(b.x, b.y, b.h + 0.55), q, s.setScalar(1));
        inst.setMatrixAt(i, m4);
      });
      inst.castShadow = true;
      this.group.add(inst);
      this.disposables.push(geo, bmat);
    }
  }

  randomRoadside(minGap, maxDist, power) {
    const t = this.track, rng = this.rng;
    for (let tries = 0; tries < 4; tries++) {
      const i = Math.floor(rng() * t.n);
      const side = rng() < 0.5 ? -1 : 1;
      const dist = t.halfW + minGap + Math.pow(rng(), power) * maxDist;
      const nx = -t.ty[i], ny = t.tx[i];
      const x = t.px[i] + nx * dist * side + t.tx[i] * (rng() - 0.5) * 6;
      const y = t.py[i] + ny * dist * side + t.ty[i] * (rng() - 0.5) * 6;
      const nr = t.nearest(x, y, -1);
      const ad = nr.far ? 999 : Math.abs(nr.d);
      if (ad < t.halfW + minGap) continue;
      return { x, y, h: t.heightFrom(x, y, nr), ad };
    }
    return null;
  }

  // ------------------------------------------------------------- glissières
  buildBarriers() {
    const t = this.track;
    if (!this.theme.rails) return;
    const posts = [], rails = [];
    for (const note of t.notes) {
      if (note.kind !== 'corner' || note.grade > 4 || note.grade < 1) continue;
      const side = -note.dir;
      const s0 = Math.max(note.s - 15, t.start + 20), s1 = Math.min(note.end + 15, t.finish - 5);
      this.barriers.push({ s0, s1, side });
      for (let s2 = s0; s2 < s1; s2 += 4) {
        const a = t.pointAt(s2), b = t.pointAt(Math.min(s2 + 4, s1));
        const off = t.halfW + 0.9;
        const pa = [a.x - Math.sin(a.a) * off * side, a.y + Math.cos(a.a) * off * side];
        const pb = [b.x - Math.sin(b.a) * off * side, b.y + Math.cos(b.a) * off * side];
        rails.push({ pa, pb, ha: a.h, hb: b.h });
        posts.push({ x: pa[0], y: pa[1], h: a.h });
      }
    }
    if (!rails.length) return;
    const railGeo = new THREE.BoxGeometry(1, 0.3, 0.06);
    const postGeo = new THREE.BoxGeometry(0.1, 0.75, 0.1);
    const mat = new THREE.MeshStandardMaterial({ color: '#b9bec4', metalness: 0.8, roughness: 0.35 });
    const ri = new THREE.InstancedMesh(railGeo, mat, rails.length);
    const pi = new THREE.InstancedMesh(postGeo, mat, posts.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    rails.forEach((r, i) => {
      const A = to3(r.pa[0], r.pa[1], r.ha + 0.6), B = to3(r.pb[0], r.pb[1], r.hb + 0.6);
      const mid = A.clone().add(B).multiplyScalar(0.5);
      const dir = B.clone().sub(A);
      const len = dir.length();
      q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.normalize());
      m4.compose(mid, q, s.set(len + 0.05, 1, 1));
      ri.setMatrixAt(i, m4);
    });
    posts.forEach((p, i) => {
      m4.compose(to3(p.x, p.y, p.h + 0.37), q.identity(), s.set(1, 1, 1));
      pi.setMatrixAt(i, m4);
    });
    ri.castShadow = pi.castShadow = true;
    this.group.add(ri, pi);
    this.disposables.push(railGeo, postGeo, mat);
  }

  // ------------------------------------------------------------- spectateurs
  buildSpectators() {
    const t = this.track, rng = this.rng;
    const spots = t.notes.filter((n) => (n.kind === 'corner' && n.grade <= 3) || n.kind === 'crest');
    const people = [];
    const jackets = ['#d42430', '#1f4fbf', '#f6c516', '#ffffff', '#222222', '#f26b1d', '#2e8b57', '#ff4fa3'];
    for (const spot of spots) {
      if (spot.s < t.start + 30 || spot.s > t.finish - 20) continue;
      if (rng() < 0.3) continue;
      const side = spot.kind === 'corner' ? spot.dir : rng() < 0.5 ? 1 : -1; // intérieur du virage
      const sMid = (spot.s + spot.end) / 2;
      const count = 5 + Math.floor(rng() * 9);
      for (let k = 0; k < count; k++) {
        const pt = t.pointAt(sMid + (rng() - 0.5) * 18);
        const d = (t.halfW + 6 + rng() * 5) * side;
        const x = pt.x - Math.sin(pt.a) * d, y = pt.y + Math.cos(pt.a) * d;
        const nr = t.nearest(x, y, pt.idx);
        if (Math.abs(nr.d) < t.halfW + 5) continue;
        people.push({ x, y, h: t.heightFrom(x, y, nr), color: jackets[Math.floor(rng() * jackets.length)], phase: rng() * 6, face: pt.a + (side > 0 ? -Math.PI / 2 : Math.PI / 2), s: sMid, flare: this.theme.flares && rng() < 0.15 });
      }
    }
    if (!people.length) return;
    const bodyGeo = new THREE.CapsuleGeometry(0.22, 0.8, 2, 8).translate(0, 0.62, 0);
    const headGeo = new THREE.SphereGeometry(0.15, 8, 6).translate(0, 1.38, 0);
    const bodyMat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
    const headMat = new THREE.MeshStandardMaterial({ roughness: 0.8 });
    this.bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, people.length);
    this.heads = new THREE.InstancedMesh(headGeo, headMat, people.length);
    const skins = ['#f1c7a5', '#d9a07a', '#a8714c', '#6e4630'];
    const col = new THREE.Color();
    people.forEach((p, i) => {
      this.bodies.setColorAt(i, col.set(p.color));
      this.heads.setColorAt(i, col.set(skins[i % skins.length]));
    });
    this.bodies.castShadow = true;
    this.group.add(this.bodies, this.heads);
    this.disposables.push(bodyGeo, headGeo, bodyMat, headMat);
    this.spectators = people;
    this.updateSpectators(0, null);

    const flares = people.filter((p) => p.flare);
    if (flares.length) {
      const mat = new THREE.SpriteMaterial({ map: glowTexture(), color: '#ff3a1a', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
      for (const f of flares) {
        const sp = new THREE.Sprite(mat);
        sp.position.copy(to3(f.x, f.y, f.h + 1.5));
        sp.scale.setScalar(2.2);
        this.group.add(sp);
        this.flares.push(sp);
      }
      this.disposables.push(mat);
    }
  }

  updateSpectators(time, carS) {
    if (!this.bodies) return;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
    this.spectators.forEach((p, i) => {
      const excited = carS !== null && Math.abs(p.s - carS) < 90;
      const jump = excited ? Math.abs(Math.sin(time * 9 + p.phase)) * 0.25 : 0;
      q.setFromAxisAngle(up, p.face);
      m4.compose(to3(p.x, p.y, p.h + jump), q, s);
      this.bodies.setMatrixAt(i, m4);
      this.heads.setMatrixAt(i, m4);
    });
    this.bodies.instanceMatrix.needsUpdate = true;
    this.heads.instanceMatrix.needsUpdate = true;
    this.flares.forEach((f, i) => f.scale.setScalar(2.1 + Math.sin(time * 23 + i * 1.7) * 0.25));
  }

  // ------------------------------------------------------------- arches départ/arrivée
  buildGates() {
    const t = this.track;
    const make = (s, lines, bg, fg) => {
      const p = t.pointAt(s);
      const g = new THREE.Group();
      const w = t.halfW * 2 + 3;
      const postMat = new THREE.MeshStandardMaterial({ color: '#e8e8e8', roughness: 0.6 });
      for (const side of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5.2, 0.4), postMat);
        post.position.set(0, 2.6, (side * w) / 2);
        post.castShadow = true;
        g.add(post);
      }
      const tex = textTexture(lines, bg, fg);
      const banner = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.2, w), [new THREE.MeshStandardMaterial({ map: tex }), new THREE.MeshStandardMaterial({ map: tex }), postMat, postMat, postMat, postMat]);
      banner.position.y = 5.2;
      banner.castShadow = true;
      g.add(banner);
      g.position.copy(to3(p.x, p.y, p.h));
      g.rotation.y = p.a;
      this.group.add(g);
      this.disposables.push(tex, postMat);
      // Ligne au sol.
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.8, t.halfW * 2), new THREE.MeshStandardMaterial({ color: bg, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
      line.rotation.x = -Math.PI / 2;
      line.position.y = 0.08;
      g.add(line);
      return g;
    };
    make(t.start, ['DÉPART', this.stage.name.toUpperCase()], '#1f4fbf', '#ffffff');
    make(t.finish, ['ARRIVÉE', 'RALLYE CLUB'], '#d42430', '#ffffff');
    // Panneaux de pointage intermédiaires.
    t.splits.forEach((s, i) => {
      const p = t.pointAt(s);
      for (const side of [-1, 1]) {
        const d = (t.halfW + 1.2) * side;
        const tex = textTexture([`INTER ${i + 1}`], '#f6c516', '#111111', 512, 192);
        const board = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.7), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide }));
        board.position.copy(to3(p.x - Math.sin(p.a) * d, p.y + Math.cos(p.a) * d, p.h + 1.6));
        board.rotation.y = p.a - Math.PI / 2;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6), new THREE.MeshStandardMaterial({ color: '#333' }));
        pole.position.copy(board.position).add(new THREE.Vector3(0, -0.85, 0));
        this.group.add(board, pole);
        this.disposables.push(tex);
      }
    });
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.isMesh || o.isInstancedMesh || o.isPoints) {
        o.geometry?.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => { m?.map?.dispose?.(); m?.dispose?.(); });
      }
    });
    this.disposables.forEach((d) => d.dispose?.());
  }
}
