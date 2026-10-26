/* ---------- fists and the training dummy ----------
   With the revolver holstered the attack button punches: a tap throws a jab (left and right in turn),
   holding winds up a haymaker that lands on release. Punches cost stamina. A landed blow freezes the
   game for a few frames (hit-stop), shakes the camera and is written to WORLD_EVENTS like a shot. */

/* the dummy: a straw sack on a post, sprung at the foot so it rocks and turns when hit */
const DUMMY = {
  x: -22.6, z: 7.7, face: Math.PI, ax: 0, az: 0, vx: 0, vz: 0, spin: 0, spinV: 0,
  torsoY: 1.25, torsoR: 0.33, headY: 1.82, headR: 0.18,
  build(scene) {
    const wood = rgb(0x7a5638), dark = rgb(0x4e3624), sack = rgb(0xb89a6a), rope = rgb(0x5e4a32);
    const base = new MB();
    base.at(this.x, 0, this.z, this.face);
    base.box(0, 0, 0, 1.0, 0.1, 0.14, dark, 3, { ao: 0.2 }); base.box(0, 0, 0, 0.14, 0.1, 1.0, dark, 3, { ao: 0.2 });
    base.box(0, 0.1, 0, 0.26, 0.2, 0.26, wood, 3);
    base.pop();
    const bm = new THREE.Mesh(base.build(), G.litMat);
    bm.layers.enable(1); scene.add(bm); W.worldMeshes.push(bm);
    const mb = new MB();
    mb.box(0, 0, 0, 0.12, 1.25, 0.12, wood, 3, { bottom: true });                       // post
    mb.box(0, 0.62, 0, 0.52, 0.64, 0.34, sack, 9, { bottom: true });                   // straw sack
    for (const y of [0.74, 1.12]) mb.box(0, y, 0, 0.55, 0.05, 0.37, rope, 0);
    mb.box(0, 1.1, 0, 1.05, 0.07, 0.07, wood, 3, { bottom: true });                    // arm peg
    for (const s of [-1, 1]) mb.box(s * 0.53, 1.07, 0, 0.1, 0.13, 0.1, sack, 9, { bottom: true });
    mb.push(new THREE.Matrix4().makeTranslation(0, 0.95, 0.172).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)));
    mb.cyl(0, 0, 0, 0.13, 0.13, 0.008, 12, rgb(0xb3362c), 0); mb.cyl(0, 0.004, 0, 0.085, 0.085, 0.008, 12, rgb(0xece2cc), 0); mb.cyl(0, 0.008, 0, 0.04, 0.04, 0.008, 10, rgb(0xb3362c), 0);
    mb.pop();
    mb.push(new THREE.Matrix4().makeTranslation(0, 1.52, 0));
    mb.geo(new THREE.IcosahedronGeometry(0.18, 1), () => mixc(sack, rgb(0xd0b486), Math.random() * 0.4), 9);
    mb.pop();
    for (const s of [-1, 1]) { mb.box(s * 0.06 - 0.02, 1.56, 0.165, 0.06, 0.012, 0.01, dark, 0); mb.box(s * 0.06 - 0.02, 1.56, 0.165, 0.012, 0.06, 0.01, dark, 0); }
    mb.box(0, 1.46, 0.168, 0.11, 0.012, 0.01, dark, 0);
    mb.box(0, 1.69, 0, 0.06, 0.04, 0.06, rope, 0);
    this.mesh = new THREE.Mesh(mb.build(), G.litMat);
    this.mesh.position.set(this.x, 0.3, this.z);
    this.mesh.rotation.order = 'YXZ';
    scene.add(this.mesh);
    addCircColl(this.x, this.z, 0.34);
  },
  // a push at the given height: tips the top along (dx,dz), a sideways blow also turns it
  hit(dx, dz, strength, twist) {
    this.vx += dx * strength; this.vz += dz * strength;
    this.spinV += twist;
  },
  update(dt) {
    // tilt springs back to upright, a little bouncy; the turn on the post settles more slowly
    this.vx += (-60 * this.ax - 4.2 * this.vx) * dt; this.vz += (-60 * this.az - 4.2 * this.vz) * dt;
    this.ax = clamp(this.ax + this.vx * dt, -0.6, 0.6); this.az = clamp(this.az + this.vz * dt, -0.6, 0.6);
    this.spinV += (-9 * this.spin - 1.6 * this.spinV) * dt; this.spin += this.spinV * dt;
    // world tilt (ax, az) -> rotations: top moves +x when rolled about -z, +z when pitched about +x
    this.mesh.rotation.set(this.az, this.face + this.spin, -this.ax);
  },
  // centre of the sack and head in the world, following the tilt
  part(y) {
    const h = y - 0.3;
    return new THREE.Vector3(this.x + Math.sin(this.ax) * h, 0.3 + Math.cos(Math.hypot(this.ax, this.az)) * h, this.z + Math.sin(this.az) * h);
  },
  straw(p, dx, dz, n, big) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * TAU, sp = 0.8 + Math.random() * (big ? 3 : 1.8);
      FX.debris.spawn({ x: p.x, y: p.y + (Math.random() - 0.3) * 0.25, z: p.z, vx: Math.cos(a) * sp * 0.6 + dx * sp, vy: 0.6 + Math.random() * 1.8, vz: Math.sin(a) * sp * 0.6 + dz * sp,
        life: 0.8 + Math.random() * 1.0, size: 0.03 + Math.random() * 0.03, grav: 5, drag: 2.2, bounce: true, sx: 0.18, sy: 0.18, sz: 1.6, rot: Math.random() * TAU }, mixc(rgb(0xd9b45c), rgb(0xb08a40), Math.random()));
    }
    for (let k = 0; k < (big ? 4 : 2); k++) FX.smoke.spawn({ x: p.x, y: p.y, z: p.z, vx: dx * 0.8 + (Math.random() - 0.5) * 0.6, vy: 0.3, vz: dz * 0.8 + (Math.random() - 0.5) * 0.6,
      life: 0.9, size: 0.05, grow: 3.5, drag: 3, grav: -0.1, wind: 0.1, a0: 0.3 }, rgb(0xd8c49a));
  },
  shot(point, dir) {
    const l = Math.hypot(dir.x, dir.z) || 1;
    this.hit(dir.x / l, dir.z / l, 1.4, (Math.random() - 0.5) * 3);
    this.straw(point, dir.x / l * 0.4, dir.z / l * 0.4, 7, false);
    FSFX.bag(point, 0.7, false);
    worldEvent('dummyShot', point.x, point.y, point.z, { by: 'player' });
  }
};
