/* ---------- GLSL ---------- */
const G_ATLAS = `
uniform sampler2D uAtlas;
vec2 atlasUV(float tIn, vec2 uvIn) {
  float t = floor(tIn + 0.5);
  vec2 f; vec2 px;
  if (t < 31.5) {
    f = t > 11.5 ? clamp(uvIn, 0.0, 1.0) : fract(uvIn);
    vec2 cell = vec2(mod(t, 8.0), floor(t / 8.0));
    px = cell * 32.0 + 0.5 + vec2(f.x, 1.0 - f.y) * 31.0;
  } else if (t < 63.5) {
    f = clamp(uvIn, 0.0, 1.0);
    float s = t - 32.0;
    vec2 cell = vec2(mod(s, 2.0), floor(s / 2.0));
    px = vec2(0.0, 128.0) + cell * vec2(256.0, 64.0) + 0.5 + vec2(f.x, 1.0 - f.y) * vec2(255.0, 63.0);
  } else {
    f = clamp(uvIn, 0.0, 1.0);
    float s = t - 64.0;
    vec2 cell = vec2(mod(s, 4.0), floor(s / 4.0));
    px = vec2(256.0, 0.0) + cell * 64.0 + 0.5 + vec2(f.x, 1.0 - f.y) * 63.0;
  }
  return vec2(px.x / 512.0, 1.0 - px.y / 512.0);
}
// surface colour: grey detail tiles darken by amt; signs and pictures always show, ink drawn over the board colour
vec3 albedo(vec3 col, float tIn, vec2 uv, float amt) {
  if (tIn > 31.5) {
    vec4 s = texture2D(uAtlas, atlasUV(tIn, uv));
    vec3 ink = s.g < 0.33 ? vec3(0.12, 0.09, 0.07) : (s.g < 0.66 ? vec3(0.96, 0.91, 0.8) : vec3(0.92, 0.7, 0.28));
    return mix(col * s.r * 1.34, ink, s.b);
  }
  if (amt <= 0.0) return col;
  return col * mix(1.0, texture2D(uAtlas, atlasUV(tIn, uv)).r * 1.34, amt);
}`;

const SH = {};
SH.litV = `
attribute float tile;
varying vec3 vCol; varying vec3 vN; varying vec3 vW; varying vec2 vUv; varying float vTile;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
  vCol = color; vUv = uv; vTile = tile;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
SH.litF = `
uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSkyAmb; uniform vec3 uGndAmb; uniform vec3 uFogCol; uniform vec3 uGlowCol;
uniform float uFogDen; uniform float uFogMax; uniform float uTexAmt; uniform float uShadowAmt; uniform float uPoster; uniform float uSat; uniform float uBright;
uniform vec4 uFlash;
uniform sampler2D uShadowMap; uniform mat4 uShadowMat; uniform float uShadowTexel;
${G_ATLAS}
varying vec3 vCol; varying vec3 vN; varying vec3 vW; varying vec2 vUv; varying float vTile;
float unpackD(vec4 c) { return dot(c, vec4(1.0, 1.0 / 255.0, 1.0 / 65025.0, 1.0 / 16581375.0)); }
float shadowAt(vec3 wp, vec3 n) {
  vec4 s = uShadowMat * vec4(wp + n * 0.1, 1.0);
  vec3 p = s.xyz * 0.5 + 0.5;
  if (p.x <= 0.002 || p.x >= 0.998 || p.y <= 0.002 || p.y >= 0.998 || p.z >= 0.999) return 1.0;
  float z = p.z - 0.0012; float o = uShadowTexel;
  float sh = step(z, unpackD(texture2D(uShadowMap, p.xy)));
  sh += step(z, unpackD(texture2D(uShadowMap, p.xy + vec2(o, 0.0))));
  sh += step(z, unpackD(texture2D(uShadowMap, p.xy - vec2(o, 0.0))));
  sh += step(z, unpackD(texture2D(uShadowMap, p.xy + vec2(0.0, o))));
  sh += step(z, unpackD(texture2D(uShadowMap, p.xy - vec2(0.0, o))));
  return sh * 0.2;
}
void main() {
  vec3 n = normalize(vN);
  vec3 alb = albedo(vCol, vTile, vUv, uTexAmt);
  float sh = 1.0;
  if (uShadowAmt > 0.0) sh = mix(1.0, shadowAt(vW, n), uShadowAmt);
  float d = max(dot(n, uSunDir), 0.0) * sh;
  if (uPoster > 0.5) d = floor(d * uPoster + 0.4) / uPoster;
  vec3 c = alb * (mix(uGndAmb, uSkyAmb, n.y * 0.5 + 0.5) + uSunCol * d);
  if (uFlash.w > 0.001) { vec3 FL = uFlash.xyz - vW; float fd = length(FL); c += alb * vec3(1.0, 0.68, 0.34) * uFlash.w * (0.3 + 0.7 * max(dot(n, FL / max(fd, 0.001)), 0.0)) / (1.0 + fd * fd * 0.7); }
  float l = dot(c, vec3(0.299, 0.587, 0.114)); c = mix(vec3(l), c, uSat);
  vec3 v = vW - cameraPosition; float dist = length(v);
  float f = clamp((1.0 - exp(-dist * uFogDen)) * uFogMax, 0.0, 1.0);
  vec3 fc = mix(uFogCol, uGlowCol, pow(max(dot(v / max(dist, 1e-4), uSunDir), 0.0), 5.0));
  gl_FragColor = vec4(mix(c, fc, f) * uBright, 1.0);
}`;
SH.plainV = `void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
SH.depthF = `
vec4 packD(float v) { vec4 r = fract(v * vec4(1.0, 255.0, 65025.0, 16581375.0)); r -= r.yzww * vec4(1.0 / 255.0, 1.0 / 255.0, 1.0 / 255.0, 0.0); return r; }
void main() { gl_FragColor = packD(gl_FragCoord.z); }`;
SH.skyV = `varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
SH.skyF = `
uniform vec3 uZen; uniform vec3 uHor; uniform vec3 uGnd; uniform vec3 uSunDir; uniform vec3 uSunCol;
uniform float uSunSize; uniform float uGlow; uniform float uHorH; uniform float uBright;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 c = h > 0.0 ? mix(uHor, uZen, pow(clamp(h / uHorH, 0.0, 1.0), 0.65)) : mix(uHor, uGnd, clamp(-h * 5.0, 0.0, 1.0));
  float s = max(dot(d, uSunDir), 0.0);
  c += uSunCol * uGlow * (pow(s, 10.0) * 0.45 + pow(s, 90.0) * 0.6);
  c = mix(c, uSunCol, smoothstep(uSunSize - 0.0003, uSunSize + 0.00005, s));
  gl_FragColor = vec4(c * uBright, 1.0);
}`;
SH.uvV = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
SH.blobF = `uniform float uK; uniform float uHard; varying vec2 vUv;
void main() { float r = length(vUv - 0.5) * 2.0;
  float a = uHard > 0.5 ? step(r, 0.86) * uK : (1.0 - smoothstep(0.2, 1.0, r)) * uK;
  if (a < 0.01) discard; gl_FragColor = vec4(0.0, 0.0, 0.0, a); }`;

SH.inF = `
uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSkyAmb; uniform vec3 uGndAmb; uniform float uBright;
uniform sampler2D uShadowMap; uniform mat4 uShadowMat; uniform float uShadowTexel;
uniform vec4 uOpen[4]; uniform vec3 uRoomAmb; uniform float uTex; uniform float uK; uniform vec4 uFlash;
${G_ATLAS}
varying vec3 vCol; varying vec3 vN; varying vec3 vW; varying vec2 vUv; varying float vTile;
float unpackD(vec4 c) { return dot(c, vec4(1.0, 1.0 / 255.0, 1.0 / 65025.0, 1.0 / 16581375.0)); }
float shadowAt(vec3 wp, vec3 n) {
  vec4 s = uShadowMat * vec4(wp + n * 0.06, 1.0);
  vec3 p = s.xyz * 0.5 + 0.5;
  if (p.x <= 0.002 || p.x >= 0.998 || p.y <= 0.002 || p.y >= 0.998 || p.z >= 0.999) return 1.0;
  float z = p.z - 0.0012; float o = uShadowTexel;
  float sh = step(z, unpackD(texture2D(uShadowMap, p.xy)));
  sh += step(z, unpackD(texture2D(uShadowMap, p.xy + vec2(o, 0.0))));
  sh += step(z, unpackD(texture2D(uShadowMap, p.xy - vec2(o, 0.0))));
  sh += step(z, unpackD(texture2D(uShadowMap, p.xy + vec2(0.0, o))));
  sh += step(z, unpackD(texture2D(uShadowMap, p.xy - vec2(0.0, o))));
  return sh * 0.2;
}
void main() {
  float t = floor(vTile + 0.5);
  if (t > 29.5 && t < 30.5) { gl_FragColor = vec4(vCol * 1.15 * min(uBright, 1.7), 1.0); return; }  // daylight in a window, a lamp glass
  vec3 n = normalize(vN);
  vec3 alb = albedo(vCol, vTile, vUv, uTex);
  float sun = max(dot(n, uSunDir), 0.0) * shadowAt(vW, n);
  vec3 lit = mix(uGndAmb, uSkyAmb, n.y * 0.5 + 0.5) * 0.14 + uRoomAmb + uSunCol * sun;
  for (int i = 0; i < 4; i++) {
    vec3 L = uOpen[i].xyz - vW; float d = length(L); vec3 l = L / max(d, 0.001);
    lit += vec3(1.0, 0.93, 0.82) * uOpen[i].w * (max(dot(n, l), 0.0) * 0.75 + 0.25) / (1.0 + d * d * 0.08);
  }
  if (uFlash.w > 0.001) { vec3 FL = uFlash.xyz - vW; float fd = length(FL); lit += vec3(1.0, 0.68, 0.34) * uFlash.w * 0.9 * (0.3 + 0.7 * max(dot(n, FL / max(fd, 0.001)), 0.0)) / (1.0 + fd * fd * 0.5); }
  gl_FragColor = vec4(alb * lit * uK * uBright, 1.0);
}`;

/* gun smoke and dust: lit puffs with their own fading alpha */
SH.smokeV = `
attribute float alpha;
varying vec3 vCol; varying vec3 vN; varying vec3 vW; varying float vA;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz; vN = normal; vCol = color; vA = alpha;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
SH.smokeF = `
uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSkyAmb; uniform vec3 uGndAmb; uniform float uBright; uniform vec4 uFlash; uniform float uIndoor;
varying vec3 vCol; varying vec3 vN; varying vec3 vW; varying float vA;
void main() {
  if (vA < 0.004) discard;
  vec3 n = normalize(vN);
  float sun = (max(dot(n, uSunDir), 0.0) * 0.55 + 0.45) * (1.0 - uIndoor * 0.8);
  vec3 c = vCol * (mix(uGndAmb, uSkyAmb, n.y * 0.5 + 0.5) * (1.0 - uIndoor * 0.6) + uSunCol * sun + uIndoor * 0.12);
  vec3 FL = uFlash.xyz - vW; float fd = length(FL);
  c += vCol * vec3(1.0, 0.68, 0.34) * uFlash.w / (1.0 + fd * fd * 0.8);
  gl_FragColor = vec4(c * uBright * mix(1.0, 0.42, uIndoor), vA);
}`;

/* motion trail: a plain colour with a per-vertex alpha */
SH.trailV = `
attribute float alpha; varying float vA;
void main() { vA = alpha; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`;
SH.trailF = `
uniform vec3 uCol; varying float vA;
void main() { if (vA < 0.004) discard; gl_FragColor = vec4(uCol, vA); }`;
