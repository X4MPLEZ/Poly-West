/* ---------- drunk vision: the picture doubles and swims ----------
   Only while drunk: the scene is drawn into a texture, then onto the screen through a shader that adds a second,
   drifting copy of the picture (double vision), a slow wave through the image and a warm, rich colour.
   Sober, the scene goes straight to the screen and this costs nothing. */
const POST = {
  rt: null, scene: null, cam: null, mat: null, size: new THREE.Vector2(), amt: 0,
  init() {
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tScene: { value: null }, uAmt: { value: 0 }, uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        uniform sampler2D tScene; uniform float uAmt; uniform float uTime; varying vec2 vUv;
        void main() {
          vec2 uv = vUv;
          // a slow wave runs through the picture
          uv += vec2(sin(uv.y * 5.0 + uTime * 1.3), cos(uv.x * 4.0 + uTime * 1.1)) * 0.005 * uAmt;
          // the second picture drifts away and comes back
          float sep = 0.5 + 0.5 * sin(uTime * 0.55);
          vec2 off = vec2(sin(uTime * 0.7), cos(uTime * 0.9) * 0.35) * 0.018 * uAmt * sep;
          vec3 a = texture2D(tScene, uv).rgb;
          vec3 b = texture2D(tScene, clamp(uv + off, 0.001, 0.999)).rgb;
          vec3 c = mix(a, b, 0.42 * clamp(uAmt * 1.6, 0.0, 1.0));
          // warm and a little too rich
          float l = dot(c, vec3(0.3, 0.59, 0.11));
          c = mix(vec3(l), c, 1.0 + 0.3 * uAmt) * vec3(1.0 + 0.07 * uAmt, 1.0, 1.0 - 0.08 * uAmt);
          gl_FragColor = vec4(c, 1.0);
        }`,
      depthTest: false, depthWrite: false
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    quad.frustumCulled = false;
    this.scene = new THREE.Scene(); this.scene.add(quad);
    this.cam = new THREE.Camera();
  },
  render(r, scene, cam) {
    const L = Math.min(DRUNK.level, 1);
    this.amt += (clamp((L - 0.06) * 1.4, 0, 1) - this.amt) * 0.05;
    if (this.amt < 0.01 || !this.mat) { r.setRenderTarget(null); r.render(scene, cam); return; }
    r.getDrawingBufferSize(this.size);
    if (!this.rt || this.rt.width !== this.size.x || this.rt.height !== this.size.y) {
      if (this.rt) this.rt.dispose();
      this.rt = new THREE.WebGLRenderTarget(this.size.x, this.size.y, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true, stencilBuffer: false });
    }
    r.setRenderTarget(this.rt); r.render(scene, cam);
    this.mat.uniforms.tScene.value = this.rt.texture; this.mat.uniforms.uAmt.value = this.amt; this.mat.uniforms.uTime.value = G.time;
    r.setRenderTarget(null); r.render(this.scene, this.cam);
  }
};
