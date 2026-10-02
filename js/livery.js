// Peinture des livrées sur un canvas, appliqué à la carrosserie par projection.
// Disposition du canvas (1024²) :
//   y ∈ [0, 512)    vue de dessus (capot, toit, coffre)
//   y ∈ [512, 768)  flanc gauche (dessiné à l'envers pour que le texte reste lisible)
//   y ∈ [768, 1024) flanc droit
import * as THREE from 'three';
import { colorHex } from './data.js';
import { mulberry32 } from './util.js';

const SIZE = 1024;

function shade(hex, k) {
  const c = new THREE.Color(hex);
  if (k > 0) c.lerp(new THREE.Color('#ffffff'), k);
  else c.lerp(new THREE.Color('#000000'), -k);
  return `#${c.getHexString()}`;
}

// Contexte de dessin normalisé pour un flanc : sx 0 = arrière → 1 = avant, sy 0 = bas → 1 = haut.
function sideCtx(ctx, region, flip) {
  const y0 = region === 'left' ? 512 : 768;
  return {
    X: (sx) => (flip ? 1 - sx : sx) * SIZE,
    Y: (sy) => y0 + 256 - sy * 256,
    flip,
    ctx,
  };
}

function poly(c, pts, fill) {
  const { ctx, X, Y } = c;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

// Vue de dessus : tx 0 = arrière → 1 = avant, ty 0 = gauche → 1 = droite.
const TX = (tx) => tx * SIZE;
const TY = (ty) => 512 - ty * 512;

function topRect(ctx, x0, x1, y0, y1, fill) {
  ctx.fillStyle = fill;
  ctx.fillRect(TX(x0), TY(y1), TX(x1) - TX(x0), TY(y0) - TY(y1));
}

function drawNumberPlate(c, n, sx, sy, h, bg = '#ffffff', fg = '#111111') {
  const { ctx, X, Y } = c;
  const w = h * 1.25 * 256;
  const hh = h * 256;
  const cx = X(sx), cy = Y(sy);
  ctx.fillStyle = bg;
  roundRect(ctx, cx - w / 2, cy - hh / 2, w, hh, hh * 0.25);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.font = `900 ${Math.floor(hh * 0.82)}px "Arial Black", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(n), cx, cy + hh * 0.04);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function sideText(c, text, sx, sy, px, color, weight = 900, italic = true) {
  const { ctx, X, Y } = c;
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${italic ? 'italic ' : ''}${weight} ${px}px "Arial Black", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, X(sx), Y(sy));
  ctx.restore();
}

// Chaque motif : side(c, p) et top(ctx, p) avec p = { base, sec, number, rng }.
const PATTERNS = {
  none: { side() {}, top() {} },
  stripes: {
    side(c, p) { poly(c, [[0, 0.14], [1, 0.14], [1, 0.19], [0, 0.19]], p.sec); },
    top(ctx, p) {
      topRect(ctx, 0, 1, 0.36, 0.45, p.sec);
      topRect(ctx, 0, 1, 0.55, 0.64, p.sec);
    },
  },
  split: {
    side(c, p) {
      poly(c, [[0, 0], [0, 0.42], [0.55, 0.42], [0.75, 0.2], [1, 0.2], [1, 0]], p.sec);
      poly(c, [[0, 0.44], [0.56, 0.44], [0.6, 0.4], [0, 0.4]], shade(p.sec, 0.5));
    },
    top(ctx, p) { topRect(ctx, 0.82, 1, 0, 1, p.sec); },
  },
  rally: {
    side(c, p) {
      const a = p.sec, b = shade(p.sec, 0.45), r = '#c8102e';
      const band = (y, h, col) => poly(c, [[0, y + 0.12], [0.3, y + 0.04], [1, y], [1, y + h], [0.3, y + h + 0.04], [0, y + h + 0.12]], col);
      band(0.3, 0.06, a);
      band(0.37, 0.03, b);
      band(0.41, 0.03, r);
    },
    top(ctx, p) {
      topRect(ctx, 0, 1, 0.04, 0.12, p.sec);
      topRect(ctx, 0, 1, 0.88, 0.96, p.sec);
      topRect(ctx, 0, 1, 0.13, 0.16, '#c8102e');
      topRect(ctx, 0, 1, 0.84, 0.87, '#c8102e');
    },
  },
  checker: {
    side(c, p) {
      const n = 18, rows = 3;
      for (let i = 0; i < n; i++) for (let j = 0; j < rows; j++) {
        if ((i + j) % 2) continue;
        const x0 = i / n * 0.6, x1 = (i + 1) / n * 0.6;
        const y0 = 0.08 + j * 0.06;
        poly(c, [[x0, y0], [x1, y0], [x1, y0 + 0.06], [x0, y0 + 0.06]], p.sec);
      }
    },
    top(ctx, p) {
      const n = 10;
      for (let i = 0; i < n; i++) for (let j = 0; j < 3; j++) {
        if ((i + j) % 2) continue;
        topRect(ctx, 0.78 + j * 0.05, 0.83 + j * 0.05, i / n, (i + 1) / n, p.sec);
      }
    },
  },
  tricolore: {
    side(c) {
      const cols = ['#1f4fbf', '#ffffff', '#d42430'];
      cols.forEach((col, i) => {
        const x = 0.62 + i * 0.07;
        poly(c, [[x, 0], [x + 0.07, 0], [x + 0.2, 1], [x + 0.13, 1]], col);
      });
    },
    top(ctx) {
      topRect(ctx, 0, 1, 0.38, 0.46, '#1f4fbf');
      topRect(ctx, 0, 1, 0.46, 0.54, '#ffffff');
      topRect(ctx, 0, 1, 0.54, 0.62, '#d42430');
    },
  },
  camo: {
    side(c, p) {
      const cols = [p.sec, shade(p.base, -0.35), shade(p.sec, 0.3)];
      for (let i = 0; i < 40; i++) {
        const x = p.rng(), y = p.rng(), r = 0.04 + p.rng() * 0.07;
        c.ctx.beginPath();
        c.ctx.ellipse(c.X(x), c.Y(y), r * SIZE, r * 256 * 1.6, p.rng() * 3, 0, Math.PI * 2);
        c.ctx.fillStyle = cols[i % 3];
        c.ctx.fill();
      }
    },
    top(ctx, p) {
      const cols = [p.sec, shade(p.base, -0.35), shade(p.sec, 0.3)];
      for (let i = 0; i < 50; i++) {
        ctx.beginPath();
        ctx.ellipse(p.rng() * SIZE, p.rng() * 512, 30 + p.rng() * 60, 20 + p.rng() * 40, p.rng() * 3, 0, Math.PI * 2);
        ctx.fillStyle = cols[i % 3];
        ctx.fill();
      }
    },
  },
  flames: {
    side(c, p) {
      const outer = p.sec, inner = shade(p.sec, 0.55);
      const flame = (scale, col) => {
        const pts = [[1, 0.08], [1, 0.62]];
        const tips = 6;
        for (let i = 0; i < tips; i++) {
          const y = 0.62 - (i + 0.5) * (0.54 / tips);
          const len = (0.35 + ((i * 37) % 5) * 0.06) * scale;
          pts.push([1 - len, y + 0.03]);
          pts.push([1 - len * 0.55, y - 0.04]);
        }
        pts.push([1, 0.08]);
        poly(c, pts, col);
      };
      flame(1, outer);
      flame(0.6, inner);
    },
    top(ctx, p) {
      ctx.fillStyle = p.sec;
      for (let i = 0; i < 5; i++) {
        const y = 0.15 + i * 0.175;
        ctx.beginPath();
        ctx.moveTo(TX(1), TY(y - 0.08));
        ctx.lineTo(TX(0.62 - (i % 2) * 0.08), TY(y));
        ctx.lineTo(TX(1), TY(y + 0.08));
        ctx.fill();
      }
    },
  },
  sponsor: {
    side(c, p) {
      poly(c, [[0, 0], [0, 0.22], [0.35, 0.3], [1, 0.16], [1, 0]], p.sec);
      poly(c, [[0, 0.24], [0.35, 0.32], [1, 0.18], [1, 0.21], [0.35, 0.35], [0, 0.27]], shade(p.sec, 0.5));
      sideText(c, 'RALLYE CLUB', 0.24, 0.62, 30, shade(p.base, p.dark ? 0.8 : -0.8));
      sideText(c, 'TURBO+', 0.8, 0.42, 34, p.sec);
      sideText(c, 'GRAVEL OIL', 0.24, 0.12, 22, p.dark ? '#111' : '#fff', 900, false);
    },
    top(ctx, p) {
      topRect(ctx, 0.72, 1, 0.3, 0.7, p.sec);
      ctx.save();
      ctx.translate(TX(0.86), TY(0.5));
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = p.dark ? '#111' : '#fff';
      ctx.font = 'italic 900 64px "Arial Black", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('TURBO+', 0, 0);
      ctx.restore();
    },
  },
};

export function paintLivery(cfg, existingCanvas) {
  const canvas = existingCanvas || document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  const base = colorHex(cfg.paint);
  const sec = colorHex(cfg.livery2);
  const dark = new THREE.Color(sec).getHSL({}).l > 0.55;
  const pat = PATTERNS[cfg.livery] || PATTERNS.none;

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, SIZE, SIZE);

  const p = { base, sec, dark, number: cfg.number, rng: mulberry32(cfg.number * 31 + 7) };
  pat.top(ctx, p);
  for (const region of ['left', 'right']) {
    const c = sideCtx(ctx, region, region === 'left');
    p.rng = mulberry32(cfg.number * 31 + 7);
    pat.side(c, p);
    if (cfg.number > 0) drawNumberPlate(c, cfg.number, 0.52, 0.42, 0.24);
  }
  // Numéro sur le toit (tradition rallye) : orienté pour être lu depuis l'arrière.
  if (cfg.number > 0) {
    ctx.save();
    ctx.translate(TX(0.42), TY(0.5));
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, -70, -48, 140, 96, 16);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.font = '900 80px "Arial Black", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(cfg.number), 0, 4);
    ctx.restore();
  }
  return canvas;
}

// Projette les UV d'une géométrie (non indexée) selon la normale de chaque face.
export function projectLiveryUV(geometry, bounds, matrix) {
  if (geometry.index) geometry = geometry.toNonIndexed();
  const pos = geometry.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), n = new THREE.Vector3();
  const { minX, maxX, minY, maxY, minZ, maxZ } = bounds;
  const L = maxX - minX, H = maxY - minY, W = maxZ - minZ;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    if (matrix) { a.applyMatrix4(matrix); b.applyMatrix4(matrix); c.applyMatrix4(matrix); }
    n.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a)).normalize();
    const side = Math.abs(n.z) > 0.6 ? (n.z > 0 ? 'right' : 'left') : 'top';
    for (let k = 0; k < 3; k++) {
      v.fromBufferAttribute(pos, i + k);
      if (matrix) v.applyMatrix4(matrix);
      let u = (v.x - minX) / L;
      let vv;
      if (side === 'top') {
        vv = 0.5 + 0.5 * THREE.MathUtils.clamp((v.z - minZ) / W, 0, 1);
      } else {
        const hy = THREE.MathUtils.clamp((v.y - minY) / H, 0, 1);
        if (side === 'right') vv = hy * 0.25;
        else { vv = 0.25 + hy * 0.25; u = 1 - u; }
      }
      uv[(i + k) * 2] = THREE.MathUtils.clamp(u, 0.001, 0.999);
      uv[(i + k) * 2 + 1] = vv;
    }
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geometry;
}
