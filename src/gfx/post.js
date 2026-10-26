/* ---------- drunk vision ----------
   Only while drunk the scene is drawn into a texture and then onto the screen through this shader:
   - the edges blur first; the clear middle shrinks the more you drink, until the whole picture is soft
   - a second, drifting copy of the picture (double vision), a slow wave, warm rich colour, darker edges
   - close to passing out the eyelids droop and blink shut, and finally close (lid = 1)
   Sober, the scene goes straight to the screen and this costs nothing. */
const POST = {
  rt: null, scene: null, cam: null, mat: null, size: new THREE.Vector2(), amt: 0, lid: 0,
  init() {
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tScene: { value: null }, uAmt: { value: 0 }, uTime: { value: 0 }, uLid: { value: 0 }, uAspect: { value: 1 }, uPx: { value: new THREE.Vector2(1, 1) } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        uniform sampler2D tScene; uniform float uAmt; uniform float uTime; uniform float uLid; uniform float uAspect; uniform vec2 uPx; varying vec2 vUv;
        vec3 soft(vec2 uv, float r) {
          // a small disc of taps: radius r in screen height units
          vec3 c = texture2D(tScene, uv).rgb * 0.2;
          for (int i = 0; i < 8; i++) {
            float a = float(i) * 0.785398 + 0.3;
            c += texture2D(tScene, clamp(uv + vec2(cos(a) / uAspect, sin(a)) * r, 0.001, 0.999)).rgb * 0.1;
          }
          return c;
        }
        void main() {
          vec2 uv = vUv, p = (uv - 0.5) * vec2(uAspect, 1.0);
          float d = length(p) / max(uAspect * 0.5, 0.5) * 1.15;
          // a slow wave runs through the picture
          uv += vec2(sin(uv.y * 5.0 + uTime * 1.3), cos(uv.x * 4.0 + uTime * 1.1)) * 0.006 * uAmt;
          // blur: none in a clear middle that shrinks as the level rises, then everywhere
          float clearR = mix(0.75, -0.2, uAmt);
          float r = (smoothstep(clearR, clearR + 0.6, d) * 0.016 + smoothstep(0.55, 1.0, uAmt) * 0.006) * uAmt;
          vec3 a = r > 0.0005 ? soft(uv, r) : texture2D(tScene, uv).rgb;
          // the second picture drifts away and comes back
          float sep = 0.55 + 0.45 * sin(uTime * 0.55);
          vec2 off = vec2(sin(uTime * 0.7), cos(uTime * 0.9) * 0.35) * 0.028 * uAmt * sep;
          vec3 b = soft(uv + off, r + 0.002 * uAmt);
          vec3 c = mix(a, b, 0.45 * clamp(uAmt * 1.4, 0.0, 1.0));
          // warm and too rich, darker towards the edges
          float l = dot(c, vec3(0.3, 0.59, 0.11));
          c = mix(vec3(l), c, 1.0 + 0.35 * uAmt) * vec3(1.0 + 0.08 * uAmt, 1.0, 1.0 - 0.1 * uAmt);
          c *= 1.0 - smoothstep(0.35, 1.25, d) * (0.35 + 0.45 * uAmt) * uAmt;
          // eyelids: an opening that narrows from above and below, curved
          float open = 0.5 * (1.0 - uLid) * sqrt(max(0.0, 1.0 - (uv.x - 0.5) * (uv.x - 0.5) * 1.6));
          float lid = smoothstep(open, open + 0.06, abs(vUv.y - 0.5 + 0.03 * uLid));
          c *= 1.0 - lid;
          gl_FragColor = vec4(c, 1.0);
        }`,
      depthTest: false, depthWrite: false
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    quad.frustumCulled = false;
    this.scene = new THREE.Scene(); this.scene.add(quad);
    this.cam = new THREE.Camera();
  },
  // how drunk the picture looks, and how far the eyes are shut
  update(dt) {
    const L = Math.min(DRUNK.level, 1.05);
    this.amt += (clamp((L - 0.04) / 0.9, 0, 1) - this.amt) * (1 - Math.exp(-dt * 3));
    let lid = smoothstep(0.82, 1.0, L) * (0.45 + 0.4 * Math.max(0, Math.sin(G.time * 1.6)));   // heavy eyes falling shut
    const O = DRUNK.out;
    if (O) lid = O.phase === 'fade' ? Math.max(lid, clamp(O.t / 2.0, 0, 1)) : O.phase === 'dark' ? 1 : clamp(1 - O.t / 2.2, 0, 1) * (0.8 + 0.2 * Math.sin(O.t * 9));
    this.lid = lid;
  },
  render(r, scene, cam) {
    if ((this.amt < 0.01 && this.lid < 0.01) || !this.mat) { r.setRenderTarget(null); r.render(scene, cam); return; }
    r.getDrawingBufferSize(this.size);
    if (!this.rt || this.rt.width !== this.size.x || this.rt.height !== this.size.y) {
      if (this.rt) this.rt.dispose();
      this.rt = new THREE.WebGLRenderTarget(this.size.x, this.size.y, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true, stencilBuffer: false });
    }
    r.setRenderTarget(this.rt); r.render(scene, cam);
    const u = this.mat.uniforms;
    u.tScene.value = this.rt.texture; u.uAmt.value = this.amt; u.uTime.value = G.time; u.uLid.value = this.lid; u.uAspect.value = this.size.x / this.size.y;
    r.setRenderTarget(null); r.render(this.scene, this.cam);
  }
};
