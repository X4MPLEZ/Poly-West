/* ---------- dust kicked up by footfalls: one dynamic mesh, no transparency ---------- */
const DUST = {
  N: 48, items: [],
  init(scene) {
    const tpl = new THREE.OctahedronGeometry(1, 0);
    this.tpl = tpl.attributes.position.array;
    tpl.computeVertexNormals();
    const nv = this.tpl.length / 3;
    this.nv = nv;
    const P = new Float32Array(this.N * nv * 3), N = new Float32Array(this.N * nv * 3), C = new Float32Array(this.N * nv * 3), T = new Float32Array(this.N * nv), UV = new Float32Array(this.N * nv * 2);
    const tn = tpl.attributes.normal.array;
    const rnd = mulberry32(5);
    for (let i = 0; i < this.N; i++) {
      const c = mixc(rgb(0xd9b88c), rgb(0xc49a6c), rnd());
      for (let v = 0; v < nv; v++) {
        N.set([tn[v * 3], tn[v * 3 + 1], tn[v * 3 + 2]], (i * nv + v) * 3);
        C.set(c, (i * nv + v) * 3);
      }
      this.items.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, life: 1, size: 0.1 });
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    g.setAttribute('color', new THREE.BufferAttribute(C, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(UV, 2));
    g.setAttribute('tile', new THREE.BufferAttribute(T, 1));
    g.attributes.position.setUsage(THREE.DynamicDrawUsage);
    this.mesh = new THREE.Mesh(g);
    this.mesh.frustumCulled = false;
    this.next = 0;
    return this.mesh;
  },
  burst(at, yaw, n) {
    const count = Math.round(n);
    for (let j = 0; j < count; j++) {
      const it = this.items[this.next]; this.next = (this.next + 1) % this.N;
      const a = yaw + Math.PI + (Math.random() - 0.5) * 2.2, sp = 0.4 + Math.random() * 0.9;
      Object.assign(it, { alive: true, x: at.x + (Math.random() - 0.5) * 0.15, y: at.y + 0.03, z: at.z + (Math.random() - 0.5) * 0.15,
        vx: Math.sin(a) * sp, vy: 0.35 + Math.random() * 0.5, vz: Math.cos(a) * sp, age: 0, life: 0.45 + Math.random() * 0.35, size: 0.045 + Math.random() * 0.05 });
    }
  },
  update(dt) {
    const P = this.mesh.geometry.attributes.position.array, tpl = this.tpl, nv = this.nv;
    for (let i = 0; i < this.N; i++) {
      const it = this.items[i];
      let r = 0;
      if (it.alive) {
        it.age += dt;
        if (it.age >= it.life) it.alive = false;
        else {
          const damp = Math.exp(-dt * 4);
          it.vx *= damp; it.vz *= damp; it.vy = it.vy * damp - 0.4 * dt;
          it.x += it.vx * dt; it.y += it.vy * dt; it.z += it.vz * dt;
          const u = it.age / it.life;
          r = it.size * Math.min(1, u * 8) * Math.pow(1 - u, 0.8) * (1 + u * 1.5);
        }
      }
      for (let v = 0; v < nv; v++) {
        const o = (i * nv + v) * 3;
        P[o] = it.x + tpl[v * 3] * r; P[o + 1] = it.y + tpl[v * 3 + 1] * r; P[o + 2] = it.z + tpl[v * 3 + 2] * r;
      }
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
  }
};
