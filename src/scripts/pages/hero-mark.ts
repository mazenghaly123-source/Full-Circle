// Home hero: the real logo, extruded in 3D (three.js). One settle on load, then a gentle tilt toward
// the pointer (finger-drag on phones). It never spins. If WebGL is missing, or three.js does not
// arrive within 2.6s, the flat mark draws itself in a 360° sweep instead.
//
// The canvas and its WebGL context are made once and moved into each new home page, so coming back
// to Home shows the mark as you left it (no second settle, no fade), as in the prototype.
import type { Feature } from '../core/lifecycle';
import { fine, rm } from '../core/util';
import { arrival } from '../core/nav';

let gl = false;
try { const c = document.createElement('canvas'); gl = !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { /* no WebGL */ }

let ready = false, building: Promise<void> | null = null, swept = false;
let canvas: HTMLCanvasElement | null = null, rw: HTMLElement | null = null;
let io: IntersectionObserver | null = null, loop: () => void = () => {};

function ensureBuilt() {
  if (!gl) return Promise.resolve();
  building ??= build().catch((err) => { console.warn('[hero mark] 3D unavailable, showing the flat mark', err); building = null; });
  return building;
}

async function build() {
  const sym = document.getElementById('fc-mark');
  if (!sym) return;
  const THREE = await import('three');
  const { SVGLoader } = await import('three/addons/loaders/SVGLoader.js');
  const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');
  const cv = canvas ?? document.createElement('canvas');
  cv.className = 'mark3'; cv.id = 'mark3'; cv.setAttribute('aria-hidden', 'true');
  canvas = cv;

  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(26, 1, 10, 5000); camera.position.set(0, 0, 1010);
  // geometry from the real logo
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${sym.getAttribute('viewBox')}">${sym.innerHTML.replace(/currentColor/g, '#000')}</svg>`;
  const shapes: InstanceType<typeof THREE.Shape>[] = []; new SVGLoader().parse(svg).paths.forEach((p) => SVGLoader.createShapes(p).forEach((sh) => shapes.push(sh)));
  const geo = new THREE.ExtrudeGeometry(shapes, { depth: 34, curveSegments: 10, bevelEnabled: true, bevelThickness: 4, bevelSize: 2.2, bevelOffset: 0, bevelSegments: 10 });
  geo.center(); geo.computeVertexNormals();
  const face = new THREE.MeshPhysicalMaterial({ color: 0xE3DCD0, roughness: 0.48, metalness: 0.0, clearcoat: 0.35, clearcoatRoughness: 0.32, envMapIntensity: 0.32 });
  const side = new THREE.MeshPhysicalMaterial({ color: 0x8F8578, roughness: 0.3, metalness: 0.35, clearcoat: 0.9, clearcoatRoughness: 0.15, envMapIntensity: 1.0 });
  const mesh = new THREE.Mesh(geo, [face, side]); mesh.rotation.x = Math.PI; // SVG y runs down
  const pivot = new THREE.Group(); pivot.add(mesh); scene.add(pivot);
  // light: warm key that follows the pointer, burnt orange + indigo rims from the hero's own lights
  const key = new THREE.DirectionalLight(0xFFF2E2, 2.6); key.position.set(-480, 520, 380); scene.add(key);
  const rimO = new THREE.DirectionalLight(0xC96832, 3.2); rimO.position.set(560, 260, -260); scene.add(rimO);
  const rimI = new THREE.DirectionalLight(0x3B5BC4, 2.4); rimI.position.set(-560, -320, -200); scene.add(rimI);
  scene.add(new THREE.AmbientLight(0xffffff, 0.12));
  let dirty = true;
  function size() { const w = cv.clientWidth || 1, h = cv.clientHeight || 1; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); dirty = true; }
  new ResizeObserver(() => { size(); loop(); }).observe(cv); size();
  // motion: one settle on entry, then a gentle tilt toward the pointer (or a finger), never a spin
  let tx = 0, ty = 0, cx = 0, cy = 0, t0 = 0, intro = !rm, drag: { x: number; y: number; x0: number; y0: number } | null = null;
  addEventListener('pointermove', (e) => {
    if (drag) { tx = Math.max(-1, Math.min(1, drag.x0 + (e.clientX - drag.x) / 160)); ty = Math.max(-1, Math.min(1, drag.y0 + (e.clientY - drag.y) / 160)); return; }
    if (!fine || !rw) return; const r = rw.getBoundingClientRect();
    tx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (innerWidth * 0.45)));
    ty = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (innerHeight * 0.55)));
  }, { passive: true });
  cv.addEventListener('pointerdown', (e) => { if (fine) return; drag = { x: e.clientX, y: e.clientY, x0: tx, y0: ty }; });
  const endDrag = () => { if (drag) { drag = null; tx = 0; ty = 0; } };
  addEventListener('pointerup', endDrag); addEventListener('pointercancel', endDrag);
  document.addEventListener('mouseleave', () => { tx = 0; ty = 0; });
  let visible = true;
  io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) loop(); }, { threshold: 0 });
  let raf = 0;
  loop = () => { if (!raf) raf = requestAnimationFrame(tick); };
  function tick(now: number) {
    raf = 0; if (!visible || document.hidden || !cv.isConnected || !cv.offsetParent) return;
    if (!t0) t0 = now;
    const k = rm ? 1 : 0.06; cx += (tx - cx) * k; cy += (ty - cy) * k;
    let iy = 0, ix = 0, iz = 0;
    if (intro) { const q = Math.min(1, (now - t0) / 1900), e = 1 - Math.pow(1 - q, 4); iy = -0.55 * (1 - e); ix = 0.22 * (1 - e); iz = -260 * (1 - e); if (q >= 1) intro = false; }
    pivot.rotation.y = 0.24 + cx * 0.5 + iy; pivot.rotation.x = -0.16 + cy * 0.34 + ix; pivot.position.z = iz;
    key.position.set(-480 + cx * 520, 520 - cy * 360, 380);
    renderer.render(scene, camera);
    const moving = intro || Math.abs(tx - cx) > 0.0005 || Math.abs(ty - cy) > 0.0005;
    if (moving || dirty) { dirty = false; raf = requestAnimationFrame(tick); }
  }
  addEventListener('pointermove', () => loop(), { passive: true }); addEventListener('pointerup', () => loop());
  renderer.render(scene, camera);
  ready = true;
}

/** Puts the (one) 3D canvas into the home page on screen and starts watching it. */
function attach(wrap: HTMLElement) {
  rw = wrap;
  const slot = wrap.querySelector('canvas.mark3');
  if (canvas && slot && slot !== canvas) slot.replaceWith(canvas);
  io?.disconnect(); io?.observe(wrap);
  wrap.classList.add('m3on');
  loop();
}

export const heroMarkFeature: Feature = {
  prepare(doc) {
    const wrap = doc.querySelector<HTMLElement>('.hero .ringwrap'); if (!wrap) return;
    if (ready) wrap.classList.add('m3on');
    else if (swept) wrap.classList.add('swept');
  },
  mount(signal) {
    const wrap = document.querySelector<HTMLElement>('.hero .ringwrap');
    if (!wrap) return;
    if (ready) { attach(wrap); return; }
    if (!gl) { swept = true; return; }
    // wait briefly for the 3D version, otherwise draw the flat one
    if (!canvas) canvas = wrap.querySelector('canvas.mark3');
    wrap.classList.add('m3wait');
    // building the mesh is heavy, so after a page change it waits for the wipe to finish
    const delay = arrival === 'load' ? 0 : WIPE_MS;
    const fallback = setTimeout(() => { if (!wrap.classList.contains('m3on')) { wrap.classList.remove('m3wait'); swept = true; } }, 2600 + delay);
    const start = setTimeout(() => ensureBuilt().then(() => { if (ready && !signal.aborted && wrap.isConnected && wrap.classList.contains('m3wait')) attach(wrap); }), delay);
    signal.addEventListener('abort', () => { clearTimeout(fallback); clearTimeout(start); }, { once: true });
  },
};

/** How long the ring wipe takes to clear after the swap (ring 300ms + close 520ms). */
const WIPE_MS = 850;
