// @ts-nocheck
// MotionHunter 推廣頁的 WebGL 戰場場景(scrollytelling)。
// 抽成獨立模組:three 只在進 /mh 時才被載入;initMhScene 回傳 teardown,離開頁面時完整清理。
import * as THREE from 'three'

export function initMhScene(canvas: HTMLCanvasElement): () => void {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let renderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
  } catch (e) {
    return () => {}
  }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0x070a11, 0.05)
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 160)
  const arena = new THREE.Group()
  arena.position.set(0, -0.7, 4)
  scene.add(arena)

  // terrain point grid
  const GX = 100, GZ = 64, SP = 0.6, N = GX * GZ
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), base = new Float32Array(N * 3)
  const cyan = new THREE.Color(0x2fe0ce), deep = new THREE.Color(0x0f3242)
  let k = 0
  for (let z = 0; z < GZ; z++) {
    for (let x = 0; x < GX; x++) {
      const px = (x - GX / 2) * SP, pz = -z * SP
      base[k * 3] = px; base[k * 3 + 2] = pz; pos[k * 3] = px; pos[k * 3 + 2] = pz
      const c = deep.clone().lerp(cyan, Math.max(0, 1 - (z / GZ) * 1.05))
      col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b
      k++
    }
  }
  const fgeo = new THREE.BufferGeometry()
  fgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  fgeo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  const field = new THREE.Points(fgeo, new THREE.PointsMaterial({ size: 0.055, vertexColors: true, transparent: true, opacity: 0.9, sizeAttenuation: true }))
  arena.add(field)
  const ty = (x, z, t) => Math.sin(x * 0.4 + t * 0.9) * 0.12 + Math.cos(z * 0.5 - t * 0.7) * 0.16

  function ringTex(hex) {
    const c = document.createElement('canvas'); c.width = c.height = 128
    const g = c.getContext('2d'); g.strokeStyle = hex; g.lineWidth = 9
    g.beginPath(); g.arc(64, 64, 42, 0, 7); g.stroke()
    g.fillStyle = hex; g.beginPath(); g.arc(64, 64, 6, 0, 7); g.fill()
    return new THREE.CanvasTexture(c)
  }
  function retTex(hex) {
    const c = document.createElement('canvas'); c.width = c.height = 128
    const g = c.getContext('2d'); g.strokeStyle = hex; g.lineWidth = 7
    const L = 22, O = 12, S = 128, cs = [[O, O, 1, 1], [S - O, O, -1, 1], [O, S - O, 1, -1], [S - O, S - O, -1, -1]]
    for (let j = 0; j < 4; j++) { const a = cs[j]; g.beginPath(); g.moveTo(a[0], a[1] + a[3] * L); g.lineTo(a[0], a[1]); g.lineTo(a[0] + a[2] * L, a[1]); g.stroke() }
    g.fillStyle = hex; g.beginPath(); g.arc(64, 64, 5, 0, 7); g.fill()
    return new THREE.CanvasTexture(c)
  }

  const HALFX = GX * SP * 0.42, DEPTH = GZ * SP * 0.72
  // monsters
  const M = 16, mgeo = new THREE.BufferGeometry(), mpos = new Float32Array(M * 3), mons = []
  function spawnMon(o) { o.x = (Math.random() - 0.5) * 2 * HALFX; o.z = -2 - Math.random() * DEPTH; o.a = Math.random() * 6.28; o.sp = 0.012 + Math.random() * 0.02; o.hp = 1 }
  for (let i = 0; i < M; i++) { const o = {}; spawnMon(o); mons.push(o) }
  mgeo.setAttribute('position', new THREE.BufferAttribute(mpos, 3))
  const monPts = new THREE.Points(mgeo, new THREE.PointsMaterial({ size: 0.19, color: 0xff5c6c, transparent: true, opacity: 0.95, sizeAttenuation: true, depthTest: false }))
  arena.add(monPts)

  // reticles hunt
  const retA = retTex('#FFB23E'), R = 3, reticles = []
  for (let i = 0; i < R; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: retA, transparent: true, opacity: 0.95, depthTest: false }))
    sp.scale.set(1.05, 1.05, 1); sp.position.set((Math.random() - 0.5) * 4, 0.4, -4 - Math.random() * 5)
    arena.add(sp); reticles.push({ sp, t: -1, lock: 0, rx: sp.position.x, rz: sp.position.z })
  }

  // amber strike rings
  const ringA = ringTex('#FFCf7a'), strikes = []
  for (let i = 0; i < 7; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringA, transparent: true, opacity: 0, depthTest: false })); sp.visible = false; arena.add(sp); strikes.push({ sp, life: 0 }) }
  function strikeAt(x, y, z) { for (let s = 0; s < strikes.length; s++) { if (strikes[s].life <= 0) { strikes[s].life = 1; strikes[s].sp.position.set(x, y, z); strikes[s].sp.visible = true; return } } }

  // player teleport (祝瞬) + green flashes
  const ringG = ringTex('#46E08A')
  const player = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringG, transparent: true, opacity: 0.95, depthTest: false }))
  player.scale.set(1.35, 1.35, 1); arena.add(player)
  const gstrikes = []
  for (let i = 0; i < 3; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringG, transparent: true, opacity: 0, depthTest: false })); sp.visible = false; arena.add(sp); gstrikes.push({ sp, life: 0 }) }
  function strikeGreen(x, z) { for (let s = 0; s < gstrikes.length; s++) { if (gstrikes[s].life <= 0) { gstrikes[s].life = 1; gstrikes[s].sp.position.set(x, ty(x, z, tt) + 0.1, z); gstrikes[s].sp.visible = true; return } } }
  const WP = [[-HALFX * 0.7, -4], [HALFX * 0.7, -9], [HALFX * 0.45, -17], [-HALFX * 0.6, -13]]
  let wi = 0, teleT = 0
  player.position.set(WP[0][0], 0.4, WP[0][1])

  // particles
  const AP = 210, apos = new Float32Array(AP * 3)
  for (let i = 0; i < AP; i++) { apos[i * 3] = (Math.random() - 0.5) * 48; apos[i * 3 + 1] = Math.random() * 12 - 1.5; apos[i * 3 + 2] = -Math.random() * 42 }
  const ageo = new THREE.BufferGeometry(); ageo.setAttribute('position', new THREE.BufferAttribute(apos, 3))
  const motes = new THREE.Points(ageo, new THREE.PointsMaterial({ size: 0.04, color: 0x6cf2ff, transparent: true, opacity: 0.45 }))
  scene.add(motes)

  // camera flythrough
  const CAM = [
    { p: [0, 4.4, 12], l: [0, 0.2, -6] },
    { p: [0, 1.7, 6], l: [0, 0, -12] },
    { p: [-4.6, 1.5, 3], l: [2, 0.1, -13] },
    { p: [3.6, 2.4, 5], l: [-2, 0.4, -12] },
    { p: [0, 5.4, 13], l: [0, 0.3, -9] },
  ]
  const sm = (a) => a * a * (3 - 2 * a)
  function camAt(p) {
    const f = Math.max(0, Math.min(0.999, p)) * (CAM.length - 1)
    const i = Math.floor(f), t = sm(f - i), A = CAM[i], B = CAM[i + 1]
    return [A.p[0] + (B.p[0] - A.p[0]) * t, A.p[1] + (B.p[1] - A.p[1]) * t, A.p[2] + (B.p[2] - A.p[2]) * t,
      A.l[0] + (B.l[0] - A.l[0]) * t, A.l[1] + (B.l[1] - A.l[1]) * t, A.l[2] + (B.l[2] - A.l[2]) * t]
  }

  function resize() { const w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix() }
  resize()
  let tmx = 0, tmy = 0, mx = 0, my = 0
  const onPointer = (e) => { tmx = e.clientX / window.innerWidth - 0.5; tmy = e.clientY / window.innerHeight - 0.5 }
  let docP = 0
  const onScroll = () => { const h = document.documentElement.scrollHeight - window.innerHeight; docP = h > 0 ? (window.scrollY || window.pageYOffset || 0) / h : 0 }
  onScroll()
  window.addEventListener('resize', resize)
  window.addEventListener('pointermove', onPointer, { passive: true })
  window.addEventListener('scroll', onScroll, { passive: true })

  let running = true, tt = 0, rafId = 0
  const timers = []
  const P = fgeo.attributes.position.array, MA = motes.geometry.attributes.position.array, MP = mgeo.attributes.position.array

  // click interaction: radar ping ring + terrain ripple + insta-hunt nearby
  const raycaster = new THREE.Raycaster()
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -arena.position.y)
  const hitV = new THREE.Vector3()
  const ringC = ringTex('#2FE0CE')
  const pings = []
  for (let i = 0; i < 6; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringC, transparent: true, opacity: 0, depthTest: false })); sp.visible = false; arena.add(sp); pings.push({ sp, life: 0 }) }
  const ripples = []
  const RAMP = 0.6, RSPEED = 7, RLIFE = 1.5
  function spawnPing(lx, lz) { for (let i = 0; i < pings.length; i++) { if (pings[i].life <= 0) { pings[i].life = 1; pings[i].sp.position.set(lx, ty(lx, lz, tt) + 0.06, lz); pings[i].sp.visible = true; return } } }
  const onClick = (e) => {
    const t = e.target
    if (t && t.closest && t.closest('a,button,input,textarea,select,.card,.qcard,.demo-cap,.phone,.price,.qr,.nav-cta,.btn,.topbar,.screen')) return
    const ndcx = (e.clientX / window.innerWidth) * 2 - 1
    const ndcy = -(e.clientY / window.innerHeight) * 2 + 1
    raycaster.setFromCamera({ x: ndcx, y: ndcy }, camera)
    if (!raycaster.ray.intersectPlane(groundPlane, hitV)) return
    const lx = hitV.x - arena.position.x, lz = hitV.z - arena.position.z
    if (!isFinite(lx) || !isFinite(lz) || Math.abs(lx) > 70 || Math.abs(lz) > 100) return
    ripples.push({ x: lx, z: lz, t0: tt }); if (ripples.length > 6) ripples.shift()
    spawnPing(lx, lz)
    for (let m = 0; m < M; m++) { if (mons[m].hp <= 0) continue; const d = Math.sqrt((mons[m].x - lx) * (mons[m].x - lx) + (mons[m].z - lz) * (mons[m].z - lz)); if (d < 3.2) { strikeAt(mons[m].x, ty(mons[m].x, mons[m].z, tt) + 0.12, mons[m].z); mons[m].hp = 0; timers.push(setTimeout(((oo) => () => spawnMon(oo))(mons[m]), 600 + Math.random() * 900)) } }
  }
  window.addEventListener('pointerdown', onClick)

  const onVis = () => { running = !document.hidden; if (running) loop() }
  document.addEventListener('visibilitychange', onVis)

  function loop() {
    if (!running) return
    const dt = 0.016; tt += dt
    while (ripples.length && tt - ripples[0].t0 >= RLIFE) ripples.shift()
    for (let a = 0; a < N; a++) {
      const bx = base[a * 3], bz = base[a * 3 + 2]
      let yv = ty(bx, bz, tt)
      for (let rp = 0; rp < ripples.length; rp++) {
        const Rp = ripples[rp], age = tt - Rp.t0
        if (age > 0) { const front = Math.sqrt((bx - Rp.x) * (bx - Rp.x) + (bz - Rp.z) * (bz - Rp.z)) - age * RSPEED; yv += RAMP * (1 - age / RLIFE) * Math.exp(-front * front * 1.6) }
      }
      P[a * 3 + 1] = yv
    }
    fgeo.attributes.position.needsUpdate = true
    for (let m = 0; m < M; m++) {
      const o = mons[m]; o.a += (Math.random() - 0.5) * 0.35; o.x += Math.cos(o.a) * o.sp; o.z += Math.sin(o.a) * o.sp
      if (o.x > HALFX) { o.x = HALFX; o.a += 3.14 } if (o.x < -HALFX) { o.x = -HALFX; o.a += 3.14 }
      if (o.z > -1.5) { o.z = -1.5; o.a += 3.14 } if (o.z < -2 - DEPTH) { o.z = -2 - DEPTH; o.a += 3.14 }
      MP[m * 3] = o.x; MP[m * 3 + 1] = o.hp > 0 ? ty(o.x, o.z, tt) + 0.06 : -99; MP[m * 3 + 2] = o.z
    }
    mgeo.attributes.position.needsUpdate = true
    for (let r = 0; r < R; r++) {
      const Rr = reticles[r]
      if (Rr.t < 0 || mons[Rr.t].hp <= 0) {
        let bd = 1e9, bi = -1
        for (let m2 = 0; m2 < M; m2++) { if (mons[m2].hp <= 0) continue; const dx = mons[m2].x - Rr.rx, dz = mons[m2].z - Rr.rz, d = dx * dx + dz * dz; if (d < bd) { bd = d; bi = m2 } }
        Rr.t = bi; Rr.lock = 0
      }
      if (Rr.t >= 0) {
        const o2 = mons[Rr.t]; Rr.rx += (o2.x - Rr.rx) * 0.09; Rr.rz += (o2.z - Rr.rz) * 0.09
        const dd = Math.sqrt((o2.x - Rr.rx) * (o2.x - Rr.rx) + (o2.z - Rr.rz) * (o2.z - Rr.rz))
        Rr.sp.position.set(Rr.rx, ty(Rr.rx, Rr.rz, tt) + 0.35, Rr.rz)
        if (dd < 0.55) {
          Rr.lock += dt; const sc = 1.0 - Math.min(0.32, Rr.lock * 0.55); Rr.sp.scale.set(sc, sc, 1)
          if (Rr.lock > 0.5) { strikeAt(o2.x, ty(o2.x, o2.z, tt) + 0.12, o2.z); o2.hp = 0; timers.push(setTimeout(() => spawnMon(o2), 650 + Math.random() * 900)); Rr.t = -1; Rr.lock = 0 }
        } else { Rr.sp.scale.set(1.05, 1.05, 1); Rr.lock = 0 }
      }
    }
    for (let s = 0; s < strikes.length; s++) { const S0 = strikes[s]; if (S0.life > 0) { S0.life -= dt * 2.2; const e = 1 - S0.life; S0.sp.scale.set(0.3 + e * 1.7, 0.3 + e * 1.7, 1); S0.sp.material.opacity = Math.max(0, S0.life); if (S0.life <= 0) S0.sp.visible = false } }
    for (let s = 0; s < gstrikes.length; s++) { const G0 = gstrikes[s]; if (G0.life > 0) { G0.life -= dt * 2.4; const e = 1 - G0.life; G0.sp.scale.set(0.4 + e * 1.8, 0.4 + e * 1.8, 1); G0.sp.material.opacity = Math.max(0, G0.life); if (G0.life <= 0) G0.sp.visible = false } }
    for (let s = 0; s < pings.length; s++) { const Pg = pings[s]; if (Pg.life > 0) { Pg.life -= dt * 1.1; const e = 1 - Pg.life; Pg.sp.scale.set(0.3 + e * 3.4, 0.3 + e * 3.4, 1); Pg.sp.material.opacity = Math.max(0, Pg.life * 0.9); if (Pg.life <= 0) Pg.sp.visible = false } }
    teleT += dt; player.material.opacity = 0.7 + Math.sin(tt * 4) * 0.24
    if (teleT > 3.4) { teleT = 0; strikeGreen(player.position.x, player.position.z); wi = (wi + 1) % WP.length; player.position.set(WP[wi][0], ty(WP[wi][0], WP[wi][1], tt) + 0.42, WP[wi][1]); strikeGreen(WP[wi][0], WP[wi][1]) }
    else { player.position.y = ty(player.position.x, player.position.z, tt) + 0.42 }
    for (let mm = 0; mm < AP; mm++) { MA[mm * 3 + 2] += 0.012; if (MA[mm * 3 + 2] > 5) MA[mm * 3 + 2] = -42 }
    motes.geometry.attributes.position.needsUpdate = true
    mx += (tmx - mx) * 0.05; my += (tmy - my) * 0.05
    const C = camAt(docP)
    camera.position.set(C[0] + mx * 1.4, C[1] - my * 0.7, C[2])
    camera.lookAt(arena.position.x + C[3], arena.position.y + C[4], arena.position.z + C[5])
    renderer.render(scene, camera)
    rafId = requestAnimationFrame(loop)
  }

  if (reduce) {
    const C0 = camAt(0)
    camera.position.set(C0[0], C0[1], C0[2])
    camera.lookAt(arena.position.x + C0[3], arena.position.y + C0[4], arena.position.z + C0[5])
    renderer.render(scene, camera)
  } else {
    loop()
  }

  return function teardown() {
    running = false
    cancelAnimationFrame(rafId)
    window.removeEventListener('resize', resize)
    window.removeEventListener('pointermove', onPointer)
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('pointerdown', onClick)
    document.removeEventListener('visibilitychange', onVis)
    timers.forEach((t) => clearTimeout(t))
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose()
      if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose() }
    })
    renderer.dispose()
  }
}
