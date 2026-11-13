// Milestone 1 (visual): procedural city. No external assets, so there are no licence issues.
// Everything is merged into a handful of meshes so it stays light on phones.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

let seed = 7;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const NEON = [0x00c8ff, 0x3a6bff, 0x9b5cff, 0x00ffd5];
const SIGNS = [['LUMEN', '#00e5ff'], ['NOVA-9', '#ff3fa4'], ['ARCADIA', '#ffb347'],
               ['OKAMI', '#7cff6b'], ['VANTA', '#a06bff'], ['MERIDIAN', '#00ffd5']];
let ANISO = 4;

function tex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = ANISO;
  return t;
}

// ---------- Textures ----------
const COLS = 8, ROWS = 6, lit = [];
function facadeTex(emissive) {
  return tex(512, 512, (g, W, H) => {
    const cw = W / COLS, ch = H / ROWS;
    g.fillStyle = emissive ? '#000' : '#18213a'; g.fillRect(0, 0, W, H);
    if (!emissive) {
      g.fillStyle = '#0f1629';
      for (let c = 0; c < COLS; c++) g.fillRect(c * cw - 2, 0, 4, H);
      for (let r = 0; r < ROWS; r++) g.fillRect(0, r * ch - 3, W, 6);
    }
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const x = c * cw + 10, y = r * ch + 14, w = cw - 20, h = ch - 34, L = lit[r * COLS + c];
      if (emissive) { if (L) { g.fillStyle = L; g.globalAlpha = 0.9; g.fillRect(x, y, w, h); g.globalAlpha = 1; } }
      else {
        g.fillStyle = L ? '#3a3320' : '#070c19'; g.fillRect(x, y, w, h);
        const gr = g.createLinearGradient(x, y, x + w, y + h);
        gr.addColorStop(0, 'rgba(120,170,255,.22)'); gr.addColorStop(1, 'rgba(120,170,255,0)');
        g.fillStyle = gr; g.fillRect(x, y, w, h);
      }
    }
    if (!emissive) for (let i = 0; i < 40; i++) { // grime streaks
      g.fillStyle = `rgba(0,0,0,${0.08 + rand() * 0.12})`;
      g.fillRect(rand() * W, 0, 2 + rand() * 6, H * (0.3 + rand() * 0.7));
    }
  });
}
const signTex = ([txt, col]) => tex(512, 192, (g, W, H) => {
  g.fillStyle = '#05080f'; g.fillRect(0, 0, W, H);
  g.strokeStyle = col; g.lineWidth = 8; g.strokeRect(10, 10, W - 20, H - 20);
  g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 24;
  g.font = `700 ${txt.length > 6 ? 78 : 100}px system-ui, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, W / 2, H / 2 + 4);
});
const roadTex = () => tex(512, 512, (g, W, H) => { // one tile = 24 m, lines sit on the tile edges
  g.fillStyle = '#10172a'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(${rand() < 0.5 ? '255,255,255' : '0,0,0'},${rand() * 0.07})`; g.fillRect(rand() * W, rand() * H, 1 + rand() * 2, 1 + rand() * 2); }
  for (let i = 0; i < 7; i++) { g.fillStyle = `rgba(0,0,0,${0.15 + rand() * 0.15})`; g.fillRect(rand() * W, rand() * H, 40 + rand() * 90, 30 + rand() * 80); }
  g.strokeStyle = 'rgba(0,0,0,.7)'; g.lineWidth = 1.5;
  for (let i = 0; i < 14; i++) { let x = rand() * W, y = rand() * H; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 8; j++) { x += (rand() - 0.5) * 50; y += (rand() - 0.5) * 50; g.lineTo(x, y); } g.stroke(); }
  g.fillStyle = '#bcc6d6'; g.globalAlpha = 0.3; // faded lane edges
  g.fillRect(90, 0, 3, H); g.fillRect(W - 93, 0, 3, H); g.fillRect(0, 90, W, 3); g.fillRect(0, H - 93, W, 3);
  g.fillStyle = '#c9a227'; g.globalAlpha = 0.75; // dashed centre lines
  for (let p = 0; p < W; p += 48) { g.fillRect(p, 0, 26, 4); g.fillRect(p, H - 4, 26, 4); g.fillRect(0, p, 4, 26); g.fillRect(W - 4, p, 4, 26); }
});
const plazaTex = () => tex(256, 256, (g, W, H) => {
  g.fillStyle = '#1a2236'; g.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 32) for (let x = 0; x < W; x += 32) {
    g.fillStyle = `rgba(${rand() < 0.5 ? '255,255,255' : '0,0,0'},${rand() * 0.08})`; g.fillRect(x + 1, y + 1, 30, 30);
  }
  g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 2;
  for (let p = 0; p <= W; p += 32) { g.beginPath(); g.moveTo(p, 0); g.lineTo(p, H); g.moveTo(0, p); g.lineTo(W, p); g.stroke(); }
});
const skyTex = () => tex(8, 256, (g, W, H) => {
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#04081a'); gr.addColorStop(0.35, '#0c1c3a'); gr.addColorStop(0.5, '#2a5782'); gr.addColorStop(0.56, '#10213d'); gr.addColorStop(1, '#070d1c');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
});

export function buildCity(scene, renderer, colliders, lowPower) {
  ANISO = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  for (let i = 0; i < COLS * ROWS; i++) lit.push(rand() < 0.3 ? (rand() < 0.7 ? '#ffc979' : '#6ff0ff') : null);

  // Sky dome (follows the camera) + a tiny environment map for wet reflections
  const sky = skyTex();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(200, 24, 16),
    new THREE.MeshBasicMaterial({ map: sky, side: THREE.BackSide, fog: false, depthWrite: false }));
  dome.renderOrder = -1;
  scene.add(dome);
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 16, 12), new THREE.MeshBasicMaterial({ map: sky, side: THREE.BackSide })));
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 1), new THREE.MeshBasicMaterial({ color: NEON[i % 4] }));
    const a = (i / 14) * Math.PI * 2; m.position.set(Math.cos(a) * 40, 3 + rand() * 9, Math.sin(a) * 40); m.lookAt(0, 0, 0);
    envScene.add(m);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromScene(envScene, 0.02).texture;
  pmrem.dispose();

  // Materials
  const wallMat = new THREE.MeshStandardMaterial({ map: facadeTex(false), emissiveMap: facadeTex(true), emissive: 0xffffff, emissiveIntensity: 0.9, color: 0xaab4c8, roughness: 0.55, metalness: 0.25, envMap, envMapIntensity: 0.35 });
  const propMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.2, envMap, envMapIntensity: 0.25 });
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const signMats = SIGNS.map(s => new THREE.MeshBasicMaterial({ map: signTex(s), toneMapped: false }));
  const puddleMat = new THREE.MeshStandardMaterial({ color: 0x04070f, roughness: 0.04, metalness: 0.9, envMap, envMapIntensity: 1.4, polygonOffset: true, polygonOffsetFactor: -1 });

  // Ground: wet asphalt, lane lines sit on the street centres (x or z = 12 + 24k)
  const rt = roadTex(); rt.repeat.set(17, 17);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(408, 408),
    new THREE.MeshStandardMaterial({ map: rt, roughness: 0.38, metalness: 0.25, envMap, envMapIntensity: 0.55 }));
  road.rotation.x = -Math.PI / 2; road.receiveShadow = true; scene.add(road);
  const pt = plazaTex(); pt.repeat.set(10, 10);
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(21, 48),
    new THREE.MeshStandardMaterial({ map: pt, roughness: 0.3, metalness: 0.3, envMap, envMapIntensity: 0.7 }));
  plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.01; plaza.receiveShadow = true; scene.add(plaza);

  // ---------- Geometry lists (merged at the end) ----------
  const W = [], P = [], T = [], PUD = [], S = SIGNS.map(() => []);
  const B = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g; };
  const paint = (g, col) => {
    const c = col.isColor ? col : new THREE.Color(col), n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return g.index ? g.toNonIndexed() : g;
  };
  const prop = (g, c) => P.push(paint(g, c));
  const trim = (g, c) => T.push(paint(g, c));
  const green = () => new THREE.Color().setHSL(0.24 + rand() * 0.08, 0.45, 0.1 + rand() * 0.1);
  function wall(w, h, d, x, y, z) {
    const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, ou = rand(), ov = rand();
    for (let i = 0; i < 24; i++) {
      const f = i >> 2, sw = f < 2 ? d : w, sh = (f === 2 || f === 3) ? d : h;
      uv.setXY(i, uv.getX(i) * sw / 16 + ou, uv.getY(i) * sh / 24 + ov);
    }
    g.translate(x, y, z); W.push(g.toNonIndexed());
  }
  const bush = (x, z, r) => { const g = new THREE.IcosahedronGeometry(r, 0); g.scale(1, 0.7, 1); g.translate(x, r * 0.5, z); prop(g, green()); };

  // ---------- Buildings ----------
  for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) {
    const x = i * 24 + (rand() - 0.5) * 4, z = j * 24 + (rand() - 0.5) * 4;
    if (Math.hypot(x, z) < 22) continue; // keep tutorial area clear
    const w = 8 + rand() * 8, d = 8 + rand() * 8, h = 12 + Math.pow(rand(), 1.7) * 58, col = NEON[(rand() * 4) | 0];
    colliders.push({ x, z, hw: w / 2, hd: d / 2 });
    const tiers = h > 44 ? 3 : h > 26 ? 2 : 1;
    let y = 0, tw = w, td = d, ox = 0, oz = 0;
    for (let t = 0; t < tiers; t++) { // stepped setbacks
      const th = t === tiers - 1 ? h - y : (h - y) * (t === 0 ? 0.55 : 0.6);
      wall(tw, th, td, x + ox, y + th / 2, z + oz); y += th;
      trim(B(tw + 0.3, 0.35, td + 0.3, x + ox, y, z + oz), col);
      tw *= 0.78; td *= 0.78; ox += (rand() - 0.5) * 1.5; oz += (rand() - 0.5) * 1.5;
    }
    trim(B(0.3, h * 0.8, 0.3, x + w / 2, h / 2, z + d / 2), col);
    prop(B(tw * 0.5, 1.5, td * 0.5, x + ox, h + 0.75, z + oz), 0x151b2b);
    if (h > 34) { prop(B(0.25, 6, 0.25, x + ox, h + 3, z + oz), 0x1a2030); trim(B(0.5, 0.5, 0.5, x + ox, h + 6, z + oz), 0xff3b5c); }
    // overgrowth: bushes at the base + ivy strips up the walls
    for (let k = 0; k < 4; k++) {
      const fx = rand() < 0.5, s = rand() < 0.5 ? -1 : 1;
      bush(fx ? x + s * (w / 2 + 0.4) : x + (rand() - 0.5) * w, fx ? z + (rand() - 0.5) * d : z + s * (d / 2 + 0.4), 1 + rand() * 1.6);
    }
    for (let k = 0; k < 3; k++) {
      const hh = 4 + rand() * Math.min(h * 0.7, 16), s = rand() < 0.5 ? -1 : 1, off = (rand() - 0.5) * w * 0.7;
      prop(k < 2 ? B(1.2 + rand() * 2, hh, 0.3, x + off, hh / 2, z + s * (d / 2 + 0.05)) : B(0.3, hh, 1.2 + rand() * 2, x + s * (w / 2 + 0.05), hh / 2, z + (rand() - 0.5) * d * 0.7), green());
    }
    // neon sign on a random face
    if (rand() < 0.4) {
      const k = (rand() * SIGNS.length) | 0, sw = 3 + rand() * 3, side = (rand() * 4) | 0;
      const yy = 5 + rand() * Math.min(h * 0.45, 18), off = (rand() - 0.5) * (w - sw) * 0.6, g = new THREE.PlaneGeometry(sw, sw * 0.4);
      if (side === 0) g.translate(x + off, yy, z + d / 2 + 0.2);
      else if (side === 1) { g.rotateY(Math.PI); g.translate(x + off, yy, z - d / 2 - 0.2); }
      else if (side === 2) { g.rotateY(Math.PI / 2); g.translate(x + w / 2 + 0.2, yy, z + off); }
      else { g.rotateY(-Math.PI / 2); g.translate(x - w / 2 - 0.2, yy, z + off); }
      S[k].push(g.toNonIndexed());
    }
  }

  // ---------- Street details ----------
  const street = spread => {
    for (;;) {
      const alongZ = rand() < 0.5, line = 12 + 24 * (Math.floor(rand() * 14) - 7) + (rand() - 0.5) * spread, t = (rand() - 0.5) * 300;
      const x = alongZ ? line : t, z = alongZ ? t : line;
      if (Math.hypot(x, z) > 24) return { x, z, alongZ };
    }
  };
  const RUST = [0x6b3a1e, 0x4a4f55, 0x7a5a2a, 0x3a2a24];
  for (let n = 0; n < 30; n++) { // rusted, overgrown wrecks
    const { x, z, alongZ } = street(3), ry = (alongZ ? 0 : Math.PI / 2) + (rand() - 0.5) * 0.1, rc = RUST[(rand() * 4) | 0];
    const part = (w, h, d, lx, ly, lz, c) => { const g = B(w, h, d, lx, ly, lz); g.rotateY(ry); g.translate(x, 0, z); prop(g, c); };
    part(1.9, 0.7, 4.2, 0, 0.55, 0, rc); part(1.6, 0.6, 2.2, 0, 1.2, -0.2, rc); part(1.7, 0.18, 2.3, 0, 1.55, -0.2, green());
    for (const sx of [-0.95, 0.95]) for (const sz of [-1.4, 1.4]) part(0.3, 0.6, 0.6, sx, 0.3, sz, 0x0a0c12);
    colliders.push({ x, z, hw: alongZ ? 1 : 2.2, hd: alongZ ? 2.2 : 1 });
  }
  const lamp = (x, z, c) => { const g = new THREE.CylinderGeometry(0.1, 0.14, 6, 6); g.translate(x, 3, z); prop(g, 0x1b2233); trim(B(0.9, 0.25, 0.5, x, 6.1, z), c); };
  for (let n = 0; n < 36; n++) { const s = street(1); lamp(s.x, s.z, n % 2 ? 0xffd9a0 : 0x7fe9ff); }
  for (let k = 0; k < 6; k++) lamp(Math.cos(k * 1.047 + 0.26) * 12, Math.sin(k * 1.047 + 0.26) * 12, 0x7fe9ff);
  for (let k = 0; k < 14; k++) { const a = rand() * 6.28; bush(Math.cos(a) * (20.5 + rand()), Math.sin(a) * (20.5 + rand()), 0.8 + rand() * 1.2); }
  for (let n = 0; n < 43; n++) {
    let x, z;
    if (n < 40) ({ x, z } = street(6)); else { const a = rand() * 6.28; x = Math.cos(a) * (13 + rand() * 5); z = Math.sin(a) * (13 + rand() * 5); }
    const g = new THREE.CircleGeometry(1.2 + rand() * 3, 18); g.rotateX(-Math.PI / 2); g.translate(x, 0.025, z); PUD.push(g.toNonIndexed());
  }

  // ---------- Merge into a few meshes ----------
  const add = (list, mat, cast, recv) => {
    if (!list.length) return;
    const m = new THREE.Mesh(mergeGeometries(list, false), mat); m.castShadow = cast; m.receiveShadow = recv; scene.add(m);
  };
  add(W, wallMat, true, true); add(P, propMat, true, true); add(T, glowMat, false, false);
  add(PUD, puddleMat, false, false); S.forEach((l, i) => add(l, signMats[i], false, false));

  return { update: camPos => dome.position.copy(camPos) };
}
