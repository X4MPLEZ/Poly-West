/* ---------- renderer, shared uniforms, materials, scene ---------- */
const G = {};          // global render state
const U = {
  uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Vector3(1, 1, 1) },
  uSkyAmb: { value: new THREE.Vector3(0.4, 0.4, 0.4) }, uGndAmb: { value: new THREE.Vector3(0.3, 0.3, 0.3) },
  uFogCol: { value: new THREE.Vector3(1, 1, 1) }, uGlowCol: { value: new THREE.Vector3(1, 1, 1) },
  uFogDen: { value: 0 }, uFogMax: { value: 1 }, uTexAmt: { value: 0 }, uShadowAmt: { value: 0 },
  uPoster: { value: 0 }, uSat: { value: 1 }, uBright: { value: 1 },
  uShadowMap: { value: null }, uShadowMat: { value: new THREE.Matrix4() }, uShadowTexel: { value: 1 / 2048 },
  uAtlas: { value: null }, uFlash: { value: new THREE.Vector4(0, -100, 0, 0) },
  // day and night (gfx/daynight.js): how deep in the night, daylight left for the rooms, lamps lit, light pools on the street
  uNight: { value: 0 }, uDayK: { value: 1 }, uLampK: { value: 0 }, uLamp: { value: [0, 1, 2, 3, 4, 5].map(() => new THREE.Vector4(0, -100, 0, 0)) }
};
const NEAREST = { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false, depthBuffer: true, stencilBuffer: false };

function initGraphics(canvas, atlasTex) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, depth: true, stencil: false, powerPreference: 'high-performance' });
  renderer.info.autoReset = false;
  renderer.setClearColor(0x110b07, 1);
  G.renderer = renderer;
  U.uAtlas.value = atlasTex;
  G.litMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: SH.litV, fragmentShader: SH.litF, vertexColors: true });
  G.depthMat = new THREE.ShaderMaterial({ vertexShader: SH.plainV, fragmentShader: SH.depthF, side: THREE.BackSide });
  G.skyU = {
    uZen: { value: new THREE.Vector3() }, uHor: { value: new THREE.Vector3() }, uGnd: { value: new THREE.Vector3() },
    uDiscDir: { value: new THREE.Vector3(0, 1, 0) }, uGlowDir: { value: new THREE.Vector3(0, 1, 0) }, uStars: { value: 0 }, uMoon: { value: 0 },
    uSunCol: { value: new THREE.Vector3(1, 1, 1) }, uSunSize: { value: 0.9994 }, uGlow: { value: 0.4 }, uHorH: { value: 0.55 }, uBright: U.uBright
  };
  G.skyMat = new THREE.ShaderMaterial({ uniforms: G.skyU, vertexShader: SH.skyV, fragmentShader: SH.skyF, depthTest: false, depthWrite: false, side: THREE.BackSide });
  G.blobU = { uK: { value: 0.45 }, uHard: { value: 0 } };
  G.blobMat = new THREE.ShaderMaterial({ uniforms: G.blobU, vertexShader: SH.uvV, fragmentShader: SH.blobF, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
}

/* ---------- world assembly ---------- */
const W = { worldMeshes: [], dynMeshes: [] };
function assembleScene() {
  const scene = new THREE.Scene();
  G.scene = scene;
  const addStatic = (geo, name) => {
    const m = new THREE.Mesh(geo, G.litMat); m.name = name; m.layers.enable(1); m.matrixAutoUpdate = false; m.updateMatrix();
    scene.add(m); W.worldMeshes.push(m); return m;
  };
  // the static world, built in this order (the town reads the ground), then merged per cell (see chunks.js)
  const terrain = buildTerrain(), road = buildRoad(), town = buildTown(), nat = buildNature();
  W.bridge = town.bridge;
  const parts = [{ geo: terrain, kind: 'terrain' }, { geo: road, kind: 'road' }, { geo: town.geo, kind: 'town' },
    { geo: nat.plants, kind: 'plants' }, { geo: nat.rocks, kind: 'rocks' }];
  for (const c of chunkStatic(parts, TOWN.cx, TOWN.cz)) {
    const m = addStatic(c.geo, 'chunk ' + c.key); m.userData.kinds = c.kinds; CHUNKS.cells.set(c.key, m);
  }
  for (const p of parts) p.geo.dispose();
  // moving bits
  const addDyn = (geo) => { const m = new THREE.Mesh(geo, G.litMat); m.layers.enable(2); scene.add(m); W.dynMeshes.push(m); return m; };
  W.poles = [];
  const pg = barberPoleGeo();
  for (const p of town.poles) { const m = addDyn(pg); m.position.copy(p); W.poles.push(m); }
  W.rotor = addDyn(buildRotor()); W.rotor.position.copy(town.rotorPos); W.rotor.rotation.y = -0.35;
  W.weeds = [];
  const tracks = [
    { z: 1.2, x0: 70, x1: -48, speed: 3.6, wob: 1.2 },
    { z: -42, x0: 130, x1: -130, speed: 4.4, wob: 4 },
    { z: 36, x0: 120, x1: -120, speed: 3.1, wob: 3 }
  ];
  tracks.forEach((t, i) => { const m = addDyn(buildTumbleweed(91 + i)); m.userData = Object.assign({ t: i * 0.37 }, t); W.weeds.push(m); });
  W.birds = [];
  const vg = buildVulture();
  for (let i = 0; i < 3; i++) { const m = addDyn(vg); m.userData = { r: 16 + i * 7, h: 40 + i * 5, sp: 0.16 - i * 0.025, ph: i * 2.1 }; W.birds.push(m); }
  const dm = DUST.init(); dm.material = G.litMat; dm.layers.enable(2); scene.add(dm); W.dynMeshes.push(dm); W.dust = dm;
  // character
  W.ch = buildCharacter();
  for (const part of W.ch.parts) part.material = G.litMat;
  scene.add(W.ch.root);
  buildInteriors(scene);
  GUN.init(scene);
  GLASS.init(scene);
  // blob shadow
  const blobGeo = new THREE.PlaneGeometry(1, 1); blobGeo.rotateX(-Math.PI / 2);
  W.blob = new THREE.Mesh(blobGeo, G.blobMat); W.blob.layers.enable(2); W.blob.renderOrder = 1; W.blob.frustumCulled = false;
  scene.add(W.blob);
  // sky dome (follows the camera)
  W.dome = new THREE.Mesh(new THREE.SphereGeometry(700, 32, 16), G.skyMat);
  W.dome.renderOrder = -10; W.dome.frustumCulled = false;
  scene.add(W.dome);
  return scene;
}
/* ---------- lighting ---------- */
const LIGHTS = {
  lowpoly: { az: 38, el: 33, sun: [0xffe1b4, 1.0], sky: [0x9cb4d8, 0.52], gnd: [0xc69466, 0.4], fog: 0xead2b2, glow: 0xffe2b4, fogDen: 0.0042, fogMax: 1, shadow: 0.82, tex: 0,
    dome: { zen: 0x4e7fc4, hor: 0xf3dab8, gnd: 0xdcb98e, sun: 0xfff5de, size: 0.9994, glow: 0.45, horH: 0.55 } }
};
function applyLight(name) {
  const L = LIGHTS[name];
  G.light = L; G.lightName = name;
  if (L.az !== undefined) U.uSunDir.value.copy(dirFromAzEl(L.az, L.el));
  if (L.sun) { const c = rgb(L.sun[0]); U.uSunCol.value.set(c[0] * L.sun[1], c[1] * L.sun[1], c[2] * L.sun[1]); }
  if (L.sky) { const c = rgb(L.sky[0]); U.uSkyAmb.value.set(c[0] * L.sky[1], c[1] * L.sky[1], c[2] * L.sky[1]); }
  if (L.gnd) { const c = rgb(L.gnd[0]); U.uGndAmb.value.set(c[0] * L.gnd[1], c[1] * L.gnd[1], c[2] * L.gnd[1]); }
  U.uFogCol.value.copy(v3(L.fog !== undefined ? L.fog : 0xffffff));
  U.uGlowCol.value.copy(v3(L.glow !== undefined ? L.glow : (L.fog !== undefined ? L.fog : 0xffffff)));
  U.uFogDen.value = L.fogDen || 0; U.uFogMax.value = L.fogMax !== undefined ? L.fogMax : 1;
  U.uTexAmt.value = L.tex || 0; U.uPoster.value = L.poster || 0; U.uSat.value = L.sat || 1; U.uBright.value = L.bright || 1;
  U.uShadowAmt.value = L.shadow || 0;
  if (L.dome) {
    const d = L.dome;
    G.skyU.uDiscDir.value.copy(U.uSunDir.value); G.skyU.uGlowDir.value.copy(U.uSunDir.value);
    G.skyU.uZen.value.copy(v3(d.zen)); G.skyU.uHor.value.copy(v3(d.hor)); G.skyU.uGnd.value.copy(v3(d.gnd));
    G.skyU.uSunCol.value.copy(v3(d.sun)); G.skyU.uSunSize.value = d.size; G.skyU.uGlow.value = d.glow; G.skyU.uHorH.value = d.horH;
  }
  if (L.shadow) updateShadow(L);
}

/* ---------- static sun shadows: rendered once per sun position ---------- */
const SHADOW = { rt: null, cam: null, key: '' };
function updateShadow(L) {
  const key = L.az + ',' + L.el;
  if (SHADOW.key === key) return;
  if (!SHADOW.rt) {
    SHADOW.rt = new THREE.WebGLRenderTarget(2048, 2048, NEAREST);
    SHADOW.cam = new THREE.OrthographicCamera(-95, 95, 95, -95, 10, 620);
    SHADOW.cam.layers.set(1);
  }
  const center = new THREE.Vector3(-6, 0, 2);
  const dir = dirFromAzEl(L.az, Math.max(L.el, 12));
  SHADOW.cam.position.copy(center).addScaledVector(dir, 300);
  SHADOW.cam.lookAt(center);
  SHADOW.cam.updateMatrixWorld();
  const r = G.renderer;
  G.scene.overrideMaterial = G.depthMat;
  r.setRenderTarget(SHADOW.rt);
  r.setClearColor(0xffffff, 1); r.clear();
  r.render(G.scene, SHADOW.cam);
  G.scene.overrideMaterial = null;
  r.setClearColor(0x110b07, 1);
  r.setRenderTarget(null);
  U.uShadowMat.value.multiplyMatrices(SHADOW.cam.projectionMatrix, SHADOW.cam.matrixWorldInverse);
  U.uShadowMap.value = SHADOW.rt.texture;
  SHADOW.key = key;
}
