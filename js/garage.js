// Scène du garage : plateau tournant, éclairage studio, caméra qui cadre la pièce choisie.
import * as THREE from 'three';
import { buildCar } from './carModel.js';
import { damp } from './util.js';

const FOCUS = {
  menu: { dist: 9.6, h: 2.3, yaw: 0.75, look: [0, 0.7, 0], spin: true },
  threeq: { dist: 8.6, h: 2.2, yaw: 0.7, look: [0, 0.75, 0], spin: true },
  side: { dist: 8.2, h: 1.6, yaw: 1.45, look: [0, 0.75, 0] },
  front: { dist: 7.2, h: 1.7, yaw: 0.4, look: [0.5, 0.8, 0] },
  rear: { dist: 7.4, h: 2.6, yaw: 2.6, look: [-0.5, 1.0, 0] },
  wheel: { dist: 5.2, h: 1.0, yaw: 1.25, look: [1.0, 0.45, 0.5] },
};

export class Garage {
  constructor(app) {
    this.app = app;
    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color('#0d1016');
    scene.environment = app.envMap;
    scene.environmentIntensity = 0.85;
    scene.fog = new THREE.Fog('#0d1016', 18, 40);
    this.camera = new THREE.PerspectiveCamera(40, app.aspect, 0.1, 200);

    // Sol et plateau.
    const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 64), new THREE.MeshStandardMaterial({ color: '#1a1e26', roughness: 0.35, metalness: 0.4 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    this.turntable = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.5, 0.12, 64), new THREE.MeshStandardMaterial({ color: '#262b35', roughness: 0.3, metalness: 0.6 }));
    disc.position.y = 0.06;
    disc.receiveShadow = true;
    this.turntable.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.45, 0.03, 8, 96), new THREE.MeshBasicMaterial({ color: '#ffb300' }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.12;
    this.turntable.add(ring);
    scene.add(this.turntable);
    this.ring = ring;

    // Panneaux lumineux en fond.
    const panelMat = new THREE.MeshBasicMaterial({ color: '#2a3140' });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(4, 9), panelMat);
      p.position.set(Math.cos(a) * 16, 4.5, Math.sin(a) * 16);
      p.lookAt(0, 4.5, 0);
      scene.add(p);
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 8), new THREE.MeshBasicMaterial({ color: '#ffcf4d' }));
      strip.position.copy(p.position).multiplyScalar(0.99);
      strip.lookAt(0, 4.5, 0);
      scene.add(strip);
    }

    scene.add(new THREE.HemisphereLight('#b9c8ff', '#1b1d22', 0.6));
    const key = new THREE.SpotLight('#ffffff', 600, 40, 0.6, 0.6, 1.6);
    key.position.set(4, 9, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0005;
    scene.add(key);
    const rim = new THREE.SpotLight('#9fc4ff', 500, 40, 0.7, 0.7, 1.6);
    rim.position.set(-6, 6, -6);
    scene.add(rim);
    const fill = new THREE.PointLight('#ffd9a0', 40, 20, 1.5);
    fill.position.set(-3, 2, 5);
    scene.add(fill);

    this.focusName = 'menu';
    this.yaw = FOCUS.menu.yaw;
    this.camDist = FOCUS.menu.dist;
    this.camH = FOCUS.menu.h;
    this.look = new THREE.Vector3(...FOCUS.menu.look);
    this.userYaw = 0;
    this.spinAngle = 0;
    this.idle = 0;
    this.bindDrag(app.renderer.domElement);
  }

  bindDrag(el) {
    let dragging = false, lastX = 0;
    el.addEventListener('pointerdown', (e) => {
      if (this.app.mode !== 'garage') return;
      dragging = true; lastX = e.clientX; this.idle = 0;
    });
    window.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      this.userYaw += (e.clientX - lastX) * 0.008;
      lastX = e.clientX;
      this.idle = 0;
    });
    window.addEventListener('pointerup', () => { dragging = false; });
  }

  setCar(car, cfg) {
    if (this.model) {
      this.turntable.remove(this.model.group);
      this.model.dispose();
    }
    this.model = buildCar(car, cfg);
    this.model.group.position.y = 0.12;
    this.turntable.add(this.model.group);
  }

  focus(name) {
    if (!FOCUS[name]) name = 'threeq';
    if (name !== this.focusName) this.userYaw = 0;
    this.focusName = name;
  }

  update(dt, time) {
    const f = FOCUS[this.focusName];
    this.idle += dt;
    if (f.spin && this.idle > 2) this.spinAngle += dt * 0.25;
    else if (!f.spin) this.spinAngle = damp(this.spinAngle, Math.round(this.spinAngle / (Math.PI * 2)) * Math.PI * 2, 3, dt);
    this.turntable.rotation.y = this.spinAngle + this.userYaw;
    this.camDist = damp(this.camDist, f.dist, 4, dt);
    this.camH = damp(this.camH, f.h, 4, dt);
    this.yaw = damp(this.yaw, f.yaw, 4, dt);
    this.look.x = damp(this.look.x, f.look[0], 4, dt);
    this.look.y = damp(this.look.y, f.look[1], 4, dt);
    this.look.z = damp(this.look.z, f.look[2], 4, dt);
    const cam = this.camera;
    // Le point visé est exprimé dans le repère du plateau (pour cadrer une roue).
    const lookW = this.look.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), f.spin ? 0 : this.turntable.rotation.y);
    cam.position.set(Math.cos(this.yaw) * this.camDist + lookW.x * 0.5, this.camH, Math.sin(this.yaw) * this.camDist + lookW.z * 0.5);
    cam.lookAt(lookW);
    // Décale le cadrage pour laisser la place à l'interface.
    const w = window.innerWidth, h = window.innerHeight, narrow = w < 760;
    const screen = this.app.screen;
    let sx = 0, sy = 0;
    if (screen === 'menu') { sx = narrow ? 0 : -0.13; sy = narrow ? 0.06 : 0.04; }
    else if (screen === 'garage') { sx = narrow ? 0 : 0.12; sy = narrow ? 0.22 : 0; }
    else if (screen === 'stages') { sy = -0.1; }
    this.sx = damp(this.sx ?? sx, sx, 5, dt);
    this.sy = damp(this.sy ?? sy, sy, 5, dt);
    cam.setViewOffset(w, h, this.sx * w, this.sy * h, w, h);
    if (this.model?.neon) this.model.neon.material.opacity = 0.75 + Math.sin(time * 3) * 0.15;
    this.ring.material.color.setHSL(0.12, 1, 0.45 + Math.sin(time * 2) * 0.08);
    for (const w of this.model?.wheels || []) w.pivot.rotation.y = w.front ? Math.sin(time * 0.6) * 0.25 : 0;
  }

  resize() {
    this.camera.aspect = this.app.aspect;
    this.camera.updateProjectionMatrix();
  }

  render(renderer) { renderer.render(this.scene, this.camera); }
}
