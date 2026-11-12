import * as THREE from 'three';

// ---------- Renderer, scene, camera ----------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050b1a);
scene.fog = new THREE.FogExp2(0x050b1a, 0.016);

const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 300);

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();

// ---------- Lights ----------
scene.add(new THREE.HemisphereLight(0x3a6bff, 0x05060f, 0.6));
const moon = new THREE.DirectionalLight(0x6f9bff, 0.5);
moon.position.set(-20, 40, 10);
scene.add(moon);
[[0x00c8ff, 6, 6], [0x4a5bff, -8, -6], [0x00ffd5, 0, -16]].forEach(([c, x, z]) => {
  const l = new THREE.PointLight(c, 40, 30, 2);
  l.position.set(x, 3, z);
  scene.add(l);
});

// ---------- Ground (wet road look) ----------
const road = new THREE.Mesh(
  new THREE.PlaneGeometry(400, 400),
  new THREE.MeshStandardMaterial({ color: 0x0b1226, roughness: 0.12, metalness: 0.7 })
);
road.rotation.x = -Math.PI / 2;
scene.add(road);

// Tutorial pad: glowing ring
const ring = new THREE.Mesh(
  new THREE.RingGeometry(9.6, 10, 64),
  new THREE.MeshBasicMaterial({ color: 0x00c8ff, side: THREE.DoubleSide })
);
ring.rotation.x = -Math.PI / 2;
ring.position.y = 0.02;
scene.add(ring);

// ---------- Buildings ----------
const colliders = []; // {x, z, hw, hd}
let seed = 7;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const neon = [0x00c8ff, 0x3a6bff, 0x9b5cff, 0x00ffd5];

for (let i = -6; i <= 6; i++) {
  for (let j = -6; j <= 6; j++) {
    const x = i * 24 + (rand() - 0.5) * 4;
    const z = j * 24 + (rand() - 0.5) * 4;
    if (Math.hypot(x, z) < 22) continue; // keep tutorial area clear
    const w = 8 + rand() * 8, d = 8 + rand() * 8, h = 12 + rand() * 40;
    const b = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: 0x0d1428, roughness: 0.6, metalness: 0.3 })
    );
    b.position.set(x, h / 2, z);
    scene.add(b);
    const c = neon[Math.floor(rand() * neon.length)];
    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.3, 0.4, d + 0.3),
      new THREE.MeshBasicMaterial({ color: c })
    );
    trim.position.set(x, h, z);
    scene.add(trim);
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, h * 0.8, 0.3),
      new THREE.MeshBasicMaterial({ color: c })
    );
    strip.position.set(x + w / 2, h / 2, z + d / 2);
    scene.add(strip);
    colliders.push({ x, z, hw: w / 2, hd: d / 2 });
  }
}

// ---------- Player ----------
const player = new THREE.Group();
const body = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.4, 0.9, 4, 12),
  new THREE.MeshStandardMaterial({ color: 0x1a2a4a, roughness: 0.4, metalness: 0.5 })
);
body.position.y = 0.9;
const visor = new THREE.Mesh(
  new THREE.BoxGeometry(0.5, 0.15, 0.2),
  new THREE.MeshBasicMaterial({ color: 0x00e5ff })
);
visor.position.set(0, 1.45, 0.3);
player.add(body, visor);
scene.add(player);
player.position.set(0, 0, 4);

// ---------- Input ----------
const keys = {};
addEventListener('keydown', e => { keys[e.code] = true; });
addEventListener('keyup', e => { keys[e.code] = false; });

const touch = { x: 0, y: 0, run: false, jump: false };

// Virtual joystick
const joy = document.getElementById('joy');
const knob = document.getElementById('knob');
let joyId = null;
function joyMove(e) {
  const r = joy.getBoundingClientRect();
  let dx = e.clientX - (r.left + r.width / 2);
  let dy = e.clientY - (r.top + r.height / 2);
  const len = Math.hypot(dx, dy), max = 50;
  if (len > max) { dx = dx / len * max; dy = dy / len * max; }
  knob.style.transform = `translate(${dx}px, ${dy}px)`;
  touch.x = dx / max; touch.y = dy / max;
}
function joyEnd() {
  joyId = null; touch.x = touch.y = 0;
  knob.style.transform = 'translate(0,0)';
}
joy.addEventListener('pointerdown', e => { joyId = e.pointerId; joy.setPointerCapture(joyId); joyMove(e); });
joy.addEventListener('pointermove', e => { if (e.pointerId === joyId) joyMove(e); });
joy.addEventListener('pointerup', joyEnd);
joy.addEventListener('pointercancel', joyEnd);

// Buttons
const hold = (id, prop) => {
  const el = document.getElementById(id);
  el.addEventListener('pointerdown', () => { touch[prop] = true; });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(t =>
    el.addEventListener(t, () => { touch[prop] = false; }));
};
hold('runBtn', 'run');
hold('jumpBtn', 'jump');

// Camera look: drag anywhere on the canvas (finger or mouse)
let yaw = 0, pitch = 0.35, lookId = null, lx = 0, ly = 0;
canvas.addEventListener('pointerdown', e => {
  lookId = e.pointerId; lx = e.clientX; ly = e.clientY;
  canvas.setPointerCapture(lookId);
});
canvas.addEventListener('pointermove', e => {
  if (e.pointerId !== lookId) return;
  yaw -= (e.clientX - lx) * 0.006;
  pitch = Math.min(1.0, Math.max(0.05, pitch + (e.clientY - ly) * 0.004));
  lx = e.clientX; ly = e.clientY;
});
const lookEnd = e => { if (e.pointerId === lookId) lookId = null; };
canvas.addEventListener('pointerup', lookEnd);
canvas.addEventListener('pointercancel', lookEnd);

document.getElementById('hint').textContent =
  matchMedia('(pointer: coarse)').matches
    ? 'Left stick: move | Drag screen: look'
    : 'WASD/Arrows: move | Shift: run | Space: jump | Drag mouse: look';

// ---------- Game loop ----------
let vy = 0, onGround = true, faceAngle = 0;
const clock = new THREE.Clock();

function update(dt) {
  // Input -> forward/strafe
  let f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - touch.y;
  let s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + touch.x;
  const mag = Math.hypot(f, s);
  if (mag > 1) { f /= mag; s /= mag; }

  const running = keys.ShiftLeft || keys.ShiftRight || touch.run;
  const speed = running ? 8 : 4.5;

  // Camera-relative direction
  const mx = (-Math.sin(yaw) * f + Math.cos(yaw) * s) * speed * dt;
  const mz = (-Math.cos(yaw) * f - Math.sin(yaw) * s) * speed * dt;
  player.position.x += mx;
  player.position.z += mz;

  if (mag > 0.1) {
    const target = Math.atan2(mx, mz);
    let diff = target - faceAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    faceAngle += diff * Math.min(1, dt * 12);
    player.rotation.y = faceAngle;
  }

  // Jump + gravity
  if ((keys.Space || touch.jump) && onGround) { vy = 8; onGround = false; }
  vy -= 22 * dt;
  player.position.y += vy * dt;
  if (player.position.y <= 0) { player.position.y = 0; vy = 0; onGround = true; }

  // Building collision (circle vs box, only when low enough)
  const r = 0.5;
  for (const c of colliders) {
    const nx = Math.max(c.x - c.hw, Math.min(player.position.x, c.x + c.hw));
    const nz = Math.max(c.z - c.hd, Math.min(player.position.z, c.z + c.hd));
    const dx = player.position.x - nx, dz = player.position.z - nz;
    const dist = Math.hypot(dx, dz);
    if (dist < r) {
      if (dist > 0.0001) { player.position.x += dx / dist * (r - dist); player.position.z += dz / dist * (r - dist); }
      else player.position.x += r;
    }
  }

  // Third-person camera
  const dist = 6.5;
  const p = player.position;
  camera.position.set(
    p.x + Math.sin(yaw) * Math.cos(pitch) * dist,
    p.y + 1.5 + Math.sin(pitch) * dist,
    p.z + Math.cos(yaw) * Math.cos(pitch) * dist
  );
  camera.lookAt(p.x, p.y + 1.4, p.z);
}

function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);
  update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
loop();