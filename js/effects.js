// Effets visuels : projections (poussière, neige, boue), flammes, traces de pneus, pluie.
import * as THREE from 'three';

export class Particles {
  constructor(max = 1500, additive = false) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.age = new Float32Array(max);
    this.life = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.alpha0 = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.cursor = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('psize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uScale: { value: 600 }, uLight: { value: 1 } },
      vertexShader: `
        attribute vec4 pcolor; attribute float psize; varying vec4 vC; uniform float uScale;
        void main(){ vC = pcolor; vec4 mv = modelViewMatrix * vec4(position,1.0);
          vC.a *= smoothstep(1.0, 5.0, -mv.z); // s'efface près de la caméra
          gl_PointSize = psize * uScale / max(-mv.z, 0.1); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `
        varying vec4 vC; uniform float uLight;
        void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d);
          float a = smoothstep(0.5, 0.1, r) * vC.a; if (a < 0.01) discard;
          gl_FragColor = vec4(vC.rgb * uLight, a); }`,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  emit(x, y, z, vx, vy, vz, color, alpha, size, life, grow = 1, grav = 0) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.col[i * 4] = color.r; this.col[i * 4 + 1] = color.g; this.col[i * 4 + 2] = color.b; this.col[i * 4 + 3] = alpha;
    this.alpha0[i] = alpha;
    this.size[i] = size;
    this.age[i] = 0;
    this.life[i] = life;
    this.grow[i] = grow;
    this.grav[i] = grav;
  }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.age[i] += dt;
      const k = this.age[i] / this.life[i];
      if (k >= 1) { this.life[i] = 0; this.size[i] = 0; this.col[i * 4 + 3] = 0; continue; }
      const drag = Math.exp(-2.2 * dt);
      this.vel[i * 3] *= drag; this.vel[i * 3 + 2] *= drag;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * drag - this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] += this.grow[i] * dt;
      this.col[i * 4 + 3] = this.alpha0[i] * Math.pow(1 - k, 1.4);
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.pcolor.needsUpdate = true;
    g.attributes.psize.needsUpdate = true;
  }

  setScale(height, fov) {
    this.material.uniforms.uScale.value = height / (2 * Math.tan((fov * Math.PI) / 360));
  }

  dispose() { this.points.geometry.dispose(); this.material.dispose(); }
}

export class SkidMarks {
  constructor(max = 1400, color = '#000000', opacity = 0.35) {
    this.max = max;
    this.geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6,
    });
    this.mesh = new THREE.InstancedMesh(this.geo, this.mat, max);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.cursor = 0;
    this.last = new Map();
    this.m4 = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.up = new THREE.Vector3(0, 1, 0);
  }

  // Ajoute un segment pour la roue `id` jusqu'au point p (Vector3). active=false coupe la trace.
  track(id, p, active, width = 0.22) {
    const prev = this.last.get(id);
    if (!active) { this.last.delete(id); return; }
    if (!prev) { this.last.set(id, p.clone()); return; }
    const dx = p.x - prev.x, dz = p.z - prev.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.45) return;
    if (len > 3) { this.last.set(id, p.clone()); return; }
    const mid = new THREE.Vector3((p.x + prev.x) / 2, (p.y + prev.y) / 2 + 0.06, (p.z + prev.z) / 2);
    this.q.setFromAxisAngle(this.up, Math.atan2(-dz, dx));
    this.m4.compose(mid, this.q, new THREE.Vector3(len + 0.05, 1, width));
    this.mesh.setMatrixAt(this.cursor, this.m4);
    this.cursor = (this.cursor + 1) % this.max;
    this.mesh.count = Math.min(this.mesh.count + 1, this.max);
    this.mesh.instanceMatrix.needsUpdate = true;
    prev.copy(p);
  }

  dispose() { this.geo.dispose(); this.mat.dispose(); }
}

export class Rain {
  constructor(count = 1800) {
    this.count = count;
    this.pos = new Float32Array(count * 6);
    for (let i = 0; i < count; i++) this.respawn(i, new THREE.Vector3(), true);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xc8d4de, transparent: true, opacity: 0.45 }));
    this.lines.frustumCulled = false;
  }

  respawn(i, c, init) {
    const x = c.x + (Math.random() - 0.5) * 60, z = c.z + (Math.random() - 0.5) * 60;
    const y = c.y + (init ? Math.random() * 30 : 25 + Math.random() * 5);
    this.pos.set([x, y, z, x + 0.05, y + 0.7, z], i * 6);
  }

  update(dt, center) {
    for (let i = 0; i < this.count; i++) {
      const o = i * 6;
      const dy = 22 * dt;
      this.pos[o + 1] -= dy; this.pos[o + 4] -= dy;
      if (this.pos[o + 1] < center.y - 5 || Math.abs(this.pos[o] - center.x) > 32 || Math.abs(this.pos[o + 2] - center.z) > 32) this.respawn(i, center, false);
    }
    this.lines.geometry.attributes.position.needsUpdate = true;
  }

  dispose() { this.lines.geometry.dispose(); this.lines.material.dispose(); }
}
