// 骨骼動畫(2026-10-10):角色切成零件(頭、身、腿),手臂用程式畫(兩段式關節),武器整把程式畫,動作是程式裡的關鍵格。
// 跟 Spine 同一套原理,差在零件是我們自己切。rig.json 由 Tools/SDGen/rig_cut.py 產生。
//
// 座標:rig 空間 = 原圖像素(例如妖精 230×260),feet 是腳底;畫的時候整體縮到顯示高度、腳底對齊塔位。
// 面向:每隻原圖都標了 left(原圖朝左);姿勢一律在 rig 空間算,「前方」= 原圖面向那邊(fwd = left ? -1 : +1),
//      畫面上要朝另一邊時 drawRig 整個鏡射,所以頭、手、武器永遠同一邊。

export interface RigPart { file: string; x: number; y: number; w: number; h: number; pivot: [number, number]; parent: string; z: number; img: HTMLImageElement }
export interface RigArm { shoulder: [number, number]; len: number; z: number; sleeve: string; skin: string }
export interface WeaponSpec { type: 'bow' | 'sword' | 'staff' | 'daggers'; len: number; z: number; color: string; edge: string; guard?: string; gem?: string }
export interface RigData {
  size: [number, number]; feet: [number, number]; weapon: WeaponSpec
  /** 原圖面向左(rig_cut.py 寫入;沒寫視為左) */
  left?: boolean
  parts: Record<string, RigPart>
  /** armMain = 拿武器那隻(朝目標那側);armOff = 另一隻(盾牌角色沒有,盾跟那隻手留在身體圖上) */
  arms: Record<string, RigArm>
}
export interface Rig {
  key: string; data: RigData
  /** 這套動作「命中」在第幾毫秒(放箭 / 劍劈到那一刻),出手起手要提前這麼多 */
  hit: number
  /** 一次攻擊動作總長(毫秒) */
  total: number
  /** 原圖面向左 */
  left: boolean
}

const ASSET = '/aegis/td/rig/'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('圖片載入失敗:' + src))
    img.src = src
  })
}

/** 讀一個單位的骨骼;沒有就回 null(那個單位走舊的畫法) */
export async function loadRig(key: string): Promise<Rig | null> {
  try {
    const res = await fetch(`${ASSET}${key}/rig.json`, { cache: 'no-cache' })
    if (!res.ok) return null
    const data = (await res.json()) as RigData
    await Promise.all(Object.values(data.parts).map(async (p) => { p.img = await loadImage(`${ASSET}${key}/${p.file}`) }))
    const timing = TIMING[data.weapon.type] ?? TIMING.bow!
    return { key, data, hit: timing.hit, total: timing.total, left: data.left ?? true }
  } catch {
    return null
  }
}

/** 各武器一次攻擊的時間軸(毫秒):hit = 伺服器算的出手那一刻要對到的格 */
const TIMING: Record<string, { hit: number; total: number }> = {
  bow: { hit: 480, total: 760 },
  sword: { hit: 360, total: 700 },
  staff: { hit: 420, total: 760 },
  daggers: { hit: 300, total: 640 },
}

// ===================== 姿勢 =====================

export interface PartXf { rot: number; dx: number; dy: number; sx: number; sy: number }
/** 一格的姿勢(全部 rig 空間) */
export interface Pose {
  parts: Record<string, PartXf>
  /** 整個人(root)繞腳底的傾斜與位移 */
  root: PartXf
  /** 程式手臂:手的位置 */
  hands: Record<string, [number, number]>
  /** 指定手肘位置的手臂(拉弓那隻:肘要往正後方抬高,IK 算不出來,直接給) */
  elbows: Record<string, [number, number]>
  /** 武器角度(弧度,0 = 直立朝上;正 = 往 +x 那邊倒):armMain 的武器 / armOff 的武器(雙匕首) */
  weaponRot: number
  offRot: number
  /** 弓:拉弦手位置(有就畫被拉開的弦);箭 1 = 搭在弦上;放箭瞬間弓壓扁 */
  stringHand: [number, number] | null
  arrow: number
  bowSquash: number
  /** 法杖寶石發光 0~1 */
  glow: number
  /** 揮砍殘影:哪隻手、從幾度到幾度、透明度 */
  trail: { arm: string; from: number; to: number; alpha: number } | null
}

const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2)
const easeOut = (k: number) => 1 - (1 - k) * (1 - k)
const easeIn = (k: number) => k * k * k
const easeOutBack = (k: number) => 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2)   // 過衝一點再回來
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const lerp2 = (a: [number, number], b: [number, number], k: number): [number, number] => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)]
/** 放開之後 ~100ms 的衰減震盪 */
const ring = (ms: number) => (ms < 0 ? 0 : Math.exp(-ms / 45) * Math.sin(ms * 0.25))

function zeroPose(rig: Rig): Pose {
  const parts: Pose['parts'] = {}
  for (const n of Object.keys(rig.data.parts)) parts[n] = { rot: 0, dx: 0, dy: 0, sx: 1, sy: 1 }
  return { parts, root: { rot: 0, dx: 0, dy: 0, sx: 1, sy: 1 }, hands: {}, elbows: {}, weaponRot: 0, offRot: 0, stringHand: null, arrow: 0, bowSquash: 1, glow: 0, trail: null }
}

/** 共用:呼吸 + 重心慢慢左右換(每座塔錯相) */
function breathe(p: Pose, clock: number, phase: number) {
  const br = Math.sin(clock * 2.2 + phase)
  const sway = Math.sin(clock * 0.9 + phase)
  p.parts.torso!.sy = 1 + 0.018 * br
  p.parts.head!.rot = 0.02 * Math.sin(clock * 1.3 + phase)
  p.parts.head!.dy = -1.5 * br
  p.root.dx = 1.5 * sway
  p.root.rot = 0.012 * sway
  return { br, sway }
}

/** 共用:整個人的出手身法 —— lean 往前坐進去的程度、lunge 衝刺、recoil 後座、prep 預備蹲(全部 0~1) */
function body(p: Pose, fwd: number, lean: number, lunge: number, recoil: number, prep: number) {
  const front = fwd < 0 ? 'legL' : 'legR', back = fwd < 0 ? 'legR' : 'legL'
  p.root.rot += fwd * (-0.05 * lean - 0.12 * lunge - 0.06 * recoil)
  p.root.dx += fwd * (-4 * lean + 9 * lunge - 4 * recoil)
  p.root.sx *= 1 + 0.04 * recoil + 0.03 * prep
  p.root.sy *= 1 - 0.035 * recoil - 0.04 * prep
  p.root.dy += 2 * lean + 3 * lunge + 2 * recoil + 3 * prep
  p.parts.torso!.rot += fwd * (-0.03 * lean - 0.04 * lunge)
  p.parts.head!.rot += fwd * (0.05 * lean + 0.03 * lunge)
  p.parts.head!.dx += -fwd * (3 * lean + 2 * recoil) + fwd * 2 * lunge
  if (p.parts[front]) { p.parts[front]!.dx += fwd * (6 * lean + 12 * lunge + 3 * recoil); p.parts[front]!.rot += -fwd * (0.12 * lean + 0.1 * lunge) }
  if (p.parts[back]) p.parts[back]!.dx += -fwd * (3 * lean + 4 * lunge + 2 * prep)
}

/** 依武器挑動作。clock = 秒(待機用);atk = 出手後幾毫秒(< 0 = 沒在出手);phase = 這座塔的相位 */
export function poseFor(rig: Rig, clock: number, atk: number, phase: number): Pose {
  switch (rig.data.weapon.type) {
    case 'sword': return swordPose(rig, clock, atk, phase)
    case 'staff': return staffPose(rig, clock, atk, phase)
    case 'daggers': return daggerPose(rig, clock, atk, phase)
    default: return bowPose(rig, clock, atk, phase)
  }
}

/**
 * 弓手:預備微蹲 0~60 → 舉弓(帶過衝)60~190 → 搭箭、拉弦到下巴旁(肘往正後方抬到肩高、前臂跟箭平行)190~420 → 停住瞄 420~480 → 放箭 480(後座 + 彈震)→ 放下 580~760
 */
export function bowPose(rig: Rig, clock: number, atk: number, phase: number): Pose {
  const p = zeroPose(rig)
  const d = rig.data
  const fwd = rig.left ? -1 : 1
  const shB = d.arms.armMain!.shoulder, shD = d.arms.armOff!.shoulder
  // 休息:兩手自然垂下,弓直直立在前側身旁、下端快碰地
  const restBow: [number, number] = [shB[0] + fwd * 8, shB[1] + 50]
  const restDraw: [number, number] = [shD[0] - fwd * 6, shD[1] + 50]
  // 瞄準:前手往前伸直把弓立起來(弓在臉前方一個手臂遠);後手先搭到弦上,再一路拉到下巴旁
  const aimBow: [number, number] = [shB[0] + fwd * 52, shB[1] + 6]
  const nock: [number, number] = [aimBow[0] - fwd * 14, aimBow[1] + 2]
  const cheek: [number, number] = [shD[0] + fwd * 8, shD[1] + 7]
  const elbowNock: [number, number] = [shD[0] - fwd * 18, shD[1] + 18]
  const elbowFull: [number, number] = [shD[0] - fwd * 44, shD[1] + 1]
  const elbowFlung: [number, number] = [shD[0] - fwd * 48, shD[1] - 8]
  const uprightRot = fwd * 0.35      // 瞄準時弓頂微微往目標那邊倒
  const restRot = -fwd * 0.18        // 休息時弓頂往後靠著

  const { br, sway } = breathe(p, clock, phase)
  if (atk < 0 || atk >= rig.total) {
    p.hands.armMain = [restBow[0] + 1.2 * sway, restBow[1] + 1.5 * br]
    p.hands.armOff = [restDraw[0] + fwd * 2 * br - 1.2 * sway, restDraw[1] + 1.5 * br]
    p.weaponRot = restRot + 0.03 * br + 0.02 * sway
    return p
  }
  let bowK = 0, drawK = 0, lean = 0, recoil = 0, lower = 0, prep = 0, settle = 0
  if (atk < 60) prep = Math.sin((atk / 60) * Math.PI)
  else if (atk < 190) bowK = easeOutBack((atk - 60) / 130)
  else if (atk < 420) { bowK = 1; drawK = ease((atk - 190) / 230); lean = drawK }
  else if (atk < 480) { bowK = 1; drawK = 1; lean = 1; settle = 1 }
  else if (atk < 580) { bowK = 1; lean = 1 - (atk - 480) / 100; recoil = 1 - (atk - 480) / 100 }
  else { lower = ease((atk - 580) / 180); bowK = 1 - lower }
  const tremor = settle ? Math.sin(atk * 0.75) * 0.6 : 0
  const snap = ring(atk - 480)
  const bowHand = lerp2(restBow, aimBow, bowK)
  bowHand[0] += -fwd * 4 * prep + fwd * 5 * snap + tremor * 0.5
  bowHand[1] += 2 * prep - 2 * snap
  p.hands.armMain = bowHand
  p.weaponRot = lerp(restRot, uprightRot, bowK) + fwd * 0.18 * snap - fwd * 0.05 * prep
  const flung: [number, number] = [cheek[0] - fwd * 22, cheek[1] - 8]
  let drawHand: [number, number]
  if (atk < 60) drawHand = [restDraw[0] - fwd * 2 * prep, restDraw[1] + 2 * prep]
  else if (atk < 190) drawHand = lerp2(restDraw, nock, easeOut((atk - 60) / 130))
  else if (atk < 480) {
    drawHand = lerp2(nock, cheek, drawK); drawHand[0] += tremor; drawHand[1] += tremor * 0.4
    const e = lerp2(elbowNock, elbowFull, drawK); e[1] += tremor * 0.5
    p.elbows.armOff = e
  } else if (atk < 580) {
    const k = easeOut((atk - 480) / 60)
    drawHand = lerp2(cheek, flung, k)
    p.elbows.armOff = lerp2(elbowFull, elbowFlung, k)
  } else {
    drawHand = lerp2(flung, restDraw, lower)
    if (lower < 0.5) p.elbows.armOff = lerp2(elbowFlung, [shD[0] - fwd * 26, shD[1] + 20], lower * 2)
  }
  p.hands.armOff = drawHand
  p.stringHand = atk >= 190 && atk < 480 ? [drawHand[0], drawHand[1]] : null
  p.arrow = atk >= 230 && atk < 480 ? 1 : 0
  body(p, fwd, lean, 0, recoil, prep)
  p.root.rot += -fwd * 0.03 * snap
  p.root.dx += fwd * 2 * snap
  p.parts.head!.rot += fwd * 0.04 * snap
  p.parts.head!.dx += fwd * 1.5 * snap
  p.parts.head!.dy += 1.5 * lean + tremor * 0.3
  p.bowSquash = 1 - 0.1 * recoil + 0.04 * snap
  return p
}

/**
 * 劍:蓄力(劍舉到頭後上方、身體後仰)0~200 → 劈下去(越劈越快、整個人衝出去)200~360 → 劈到底再過一點、劍身震 360~450 → 收劍 450~700
 */
export function swordPose(rig: Rig, clock: number, atk: number, phase: number): Pose {
  const p = zeroPose(rig)
  const d = rig.data
  const fwd = rig.left ? -1 : 1
  const shM = d.arms.armMain!.shoulder, shO = d.arms.armOff?.shoulder
  const rest: [number, number] = [shM[0] + fwd * 8, shM[1] + 46]
  const restRot = fwd * 2.75                                       // 劍尖朝下、微微朝前
  // Q 版頭太大,劍舉過頭會蓋在臉上;改成先把劍拉到身後腰際(劍尖朝後下),再從後往前橫掃到正前方、尾勁往上帶
  const raise: [number, number] = [shM[0] - fwd * 22, shM[1] + 34]
  const raiseRot = -fwd * 2.35                                     // 劍尖朝後下方
  const strike: [number, number] = [shM[0] + fwd * 50, shM[1] + 4]
  const strikeRot = fwd * 1.6                                      // 掃到正前方(水平)
  const { br, sway } = breathe(p, clock, phase)
  if (atk < 0 || atk >= rig.total) {
    p.hands.armMain = [rest[0] + 1.2 * sway, rest[1] + 1.5 * br]
    if (shO) p.hands.armOff = [shO[0] - fwd * 6 - 1.2 * sway, shO[1] + 46 + 1.5 * br]
    p.weaponRot = restRot + 0.03 * br
    return p
  }
  let hand: [number, number], rot: number, lunge = 0, back = 0
  if (atk < 200) {
    const k = easeOut(atk / 200)
    hand = lerp2(rest, raise, k); rot = lerp(restRot, raiseRot, k); back = k
  } else if (atk < 360) {
    const k = easeIn((atk - 200) / 160)
    hand = lerp2(raise, strike, k); rot = lerp(raiseRot, strikeRot, k); lunge = k; back = 1 - k
    if (atk > 280) p.trail = { arm: 'armMain', from: lerp(raiseRot, strikeRot, easeIn(clamp01((atk - 260) / 160))), to: rot, alpha: clamp01((atk - 280) / 60) }
  } else if (atk < 450) {
    const k = (atk - 360) / 90
    hand = [strike[0] + fwd * 3 * (1 - k), strike[1] + 4 * (1 - k)]
    rot = strikeRot + fwd * 0.25 * ring(atk - 360) * 3 - fwd * 0.25 * (1 - k)   // 掃到底尾勁往上帶一點,劍身震
    lunge = 1 - 0.3 * k
    p.trail = { arm: 'armMain', from: strikeRot - fwd * 1.2, to: rot, alpha: 0.9 * (1 - k) }
  } else {
    const k = ease((atk - 450) / 250)
    hand = lerp2([strike[0], strike[1] + 4], rest, k); rot = lerp(strikeRot - fwd * 0.25, restRot, k); lunge = 0.7 * (1 - k)
  }
  p.hands.armMain = hand
  p.weaponRot = rot
  // 另一隻手(王子):蓄力時往前平衡、衝刺時往後甩
  if (shO) p.hands.armOff = [shO[0] + fwd * (14 * back - 20 * lunge) - fwd * 6, shO[1] + 46 - 30 * back - 10 * lunge]
  body(p, fwd, 0, lunge, 0, 0)
  p.root.rot += fwd * 0.07 * back          // 蓄力後仰、微蹲
  p.root.dx += -fwd * 3 * back
  p.root.dy += 3 * back
  p.parts.head!.rot += -fwd * 0.04 * back
  return p
}

/**
 * 法杖:雙手把杖舉起來 0~250 → 杖尖往前推出去、寶石爆亮、整個人前傾 250~420 → 停住放光 420~520 → 收 520~760
 */
export function staffPose(rig: Rig, clock: number, atk: number, phase: number): Pose {
  const p = zeroPose(rig)
  const d = rig.data
  const fwd = rig.left ? -1 : 1
  const shM = d.arms.armMain!.shoulder, shO = d.arms.armOff?.shoulder
  const rest: [number, number] = [shM[0] + fwd * 6, shM[1] + 42]
  const restRot = fwd * 0.08
  const raise: [number, number] = [shM[0] + fwd * 18, shM[1] - 12]
  const raiseRot = fwd * 0.5
  const thrust: [number, number] = [shM[0] + fwd * 44, shM[1] + 6]
  const thrustRot = fwd * 1.25
  const { br, sway } = breathe(p, clock, phase)
  if (atk < 0 || atk >= rig.total) {
    p.hands.armMain = [rest[0] + 1.2 * sway, rest[1] + 1.5 * br]
    if (shO) p.hands.armOff = [shO[0] - fwd * 4 - 1.2 * sway, shO[1] + 44 + 1.5 * br]
    p.weaponRot = restRot + 0.02 * br
    p.glow = 0.15 + 0.1 * br
    return p
  }
  let hand: [number, number], rot: number, off: [number, number], lean = 0, glow = 0, up = 0
  const offRest: [number, number] = shO ? [shO[0] - fwd * 4, shO[1] + 44] : [0, 0]
  const offUp: [number, number] = shO ? [shO[0] + fwd * 2, shO[1] - 26] : [0, 0]
  const offBack: [number, number] = shO ? [shO[0] - fwd * 18, shO[1] - 6] : [0, 0]
  if (atk < 250) {
    const k = easeOutBack(atk / 250)
    hand = lerp2(rest, raise, k); rot = lerp(restRot, raiseRot, k); off = lerp2(offRest, offUp, k); up = k; glow = 0.3 * k
  } else if (atk < 420) {
    const k = easeIn((atk - 250) / 170)
    hand = lerp2(raise, thrust, k); rot = lerp(raiseRot, thrustRot, k); off = lerp2(offUp, offBack, k); lean = k; up = 1 - k; glow = 0.3 + 0.7 * k
  } else if (atk < 520) {
    const t = atk - 420
    hand = [thrust[0] + fwd * 3 * ring(t), thrust[1] + Math.sin(atk * 0.6) * 0.6]; rot = thrustRot + fwd * 0.1 * ring(t); off = offBack; lean = 1
    glow = 1 + 0.15 * Math.sin(atk * 0.08)
  } else {
    const k = ease((atk - 520) / 240)
    hand = lerp2(thrust, rest, k); rot = lerp(thrustRot, restRot, k); off = lerp2(offBack, offRest, k); lean = 1 - k; glow = 1 - 0.85 * k
  }
  p.hands.armMain = hand
  if (shO) p.hands.armOff = off
  p.weaponRot = rot
  p.glow = glow
  body(p, fwd, 0, lean * 0.7, 0, 0)
  p.root.sy *= 1 + 0.03 * up          // 舉杖時整個人拉高
  p.parts.head!.dy += -2 * up
  return p
}

/**
 * 雙匕首:蹲低蓄力 0~120 → 主手往前劃 120~300(命中)→ 副手交叉再劃一刀 300~420 → 收 420~640
 */
export function daggerPose(rig: Rig, clock: number, atk: number, phase: number): Pose {
  const p = zeroPose(rig)
  const d = rig.data
  const fwd = rig.left ? -1 : 1
  const shM = d.arms.armMain!.shoulder, shO = d.arms.armOff!.shoulder
  const restM: [number, number] = [shM[0] + fwd * 10, shM[1] + 44], restMRot = fwd * 2.6
  const restO: [number, number] = [shO[0] - fwd * 8, shO[1] + 44], restORot = -fwd * 2.6
  const windM: [number, number] = [shM[0] - fwd * 12, shM[1] + 6], windMRot = -fwd * 0.6
  const windO: [number, number] = [shO[0] - fwd * 16, shO[1] + 20], windORot = -fwd * 2.2
  const cutM: [number, number] = [shM[0] + fwd * 46, shM[1] + 12], cutMRot = fwd * 1.9
  const cutO: [number, number] = [shO[0] + fwd * 42, shO[1] + 4], cutORot = fwd * 1.5
  const pullM: [number, number] = [shM[0] + fwd * 20, shM[1] + 20], pullMRot = fwd * 2.3
  const { br, sway } = breathe(p, clock, phase)
  if (atk < 0 || atk >= rig.total) {
    p.hands.armMain = [restM[0] + 1.2 * sway, restM[1] + 1.5 * br]
    p.hands.armOff = [restO[0] - 1.2 * sway, restO[1] + 1.5 * br]
    p.weaponRot = restMRot + 0.03 * br; p.offRot = restORot - 0.03 * br
    return p
  }
  let hm: [number, number], ho: [number, number], rm: number, ro: number, lunge = 0, prep = 0
  if (atk < 120) {
    const k = easeOut(atk / 120)
    hm = lerp2(restM, windM, k); ho = lerp2(restO, windO, k); rm = lerp(restMRot, windMRot, k); ro = lerp(restORot, windORot, k); prep = k
  } else if (atk < 300) {
    const k = easeIn((atk - 120) / 180)
    hm = lerp2(windM, cutM, k); ho = windO; rm = lerp(windMRot, cutMRot, k); ro = windORot; lunge = k; prep = 1 - k
    if (atk > 230) p.trail = { arm: 'armMain', from: lerp(windMRot, cutMRot, easeIn(clamp01((atk - 160) / 180))), to: rm, alpha: clamp01((atk - 230) / 50) }
  } else if (atk < 420) {
    const k = easeIn((atk - 300) / 120)
    hm = lerp2(cutM, pullM, k); ho = lerp2(windO, cutO, k); rm = lerp(cutMRot, pullMRot, k); ro = lerp(windORot, cutORot, k); lunge = 1
    if (atk > 350) p.trail = { arm: 'armOff', from: lerp(windORot, cutORot, easeIn(clamp01((atk - 340) / 120))), to: ro, alpha: clamp01((atk - 350) / 40) }
    else p.trail = { arm: 'armMain', from: cutMRot - fwd * 1.0, to: cutMRot, alpha: 1 - (atk - 300) / 50 }
  } else {
    const k = ease((atk - 420) / 220)
    hm = lerp2(pullM, restM, k); ho = lerp2(cutO, restO, k); rm = lerp(pullMRot, restMRot, k); ro = lerp(cutORot, restORot, k); lunge = 1 - k
  }
  p.hands.armMain = hm; p.hands.armOff = ho; p.weaponRot = rm; p.offRot = ro
  body(p, fwd, 0, lunge, 0, prep)
  p.root.dy += 3 * prep               // 蹲更低
  p.root.sy *= 1 - 0.03 * prep
  return p
}

// ===================== 畫 =====================

const OUTLINE = 'rgba(40,30,20,0.9)'

/** 兩段式手臂:肩 → 肘 → 手。整隻先描一次邊再上色,關節處不會露出接縫;肘沒給就用 IK(肘往 bendSign 那邊彎) */
function drawArm(c: CanvasRenderingContext2D, arm: RigArm, hand: [number, number], bendSign: number, elbow?: [number, number]) {
  const [sx, sy] = arm.shoulder
  let [hx, hy] = hand
  let ex: number, ey: number
  if (elbow) {
    ex = elbow[0]; ey = elbow[1]
  } else {
    const half = arm.len / 2
    const dx = hx - sx, dy = hy - sy
    const dist = Math.hypot(dx, dy)
    const reach = Math.min(dist, arm.len - 0.5)
    const ux = dist > 0.01 ? dx / dist : 1, uy = dist > 0.01 ? dy / dist : 0
    hx = sx + ux * reach; hy = sy + uy * reach
    const h = Math.sqrt(Math.max(0, half * half - (reach / 2) * (reach / 2)))
    ex = (sx + hx) / 2 - uy * bendSign * h; ey = (sy + hy) / 2 + ux * bendSign * h
  }
  c.lineCap = 'round'; c.lineJoin = 'round'
  // 描邊:整隻一次
  c.strokeStyle = OUTLINE
  c.lineWidth = 11 + 2.6; c.beginPath(); c.moveTo(sx, sy); c.lineTo(ex, ey); c.stroke()
  c.lineWidth = 9 + 2.6; c.beginPath(); c.moveTo(ex, ey); c.lineTo(hx, hy); c.stroke()
  c.fillStyle = OUTLINE; c.beginPath(); c.arc(hx, hy, 7.3, 0, Math.PI * 2); c.fill()
  // 上色:袖子、前臂、手;肘用袖子色補一個圓蓋住接縫
  c.strokeStyle = arm.sleeve; c.lineWidth = 11; c.beginPath(); c.moveTo(sx, sy); c.lineTo(ex, ey); c.stroke()
  c.strokeStyle = arm.skin; c.lineWidth = 9; c.beginPath(); c.moveTo(ex, ey); c.lineTo(hx, hy); c.stroke()
  c.fillStyle = arm.sleeve; c.beginPath(); c.arc(ex, ey, 5.5, 0, Math.PI * 2); c.fill()
  c.fillStyle = arm.skin; c.beginPath(); c.arc(hx, hy, 6, 0, Math.PI * 2); c.fill()
  return [hx, hy] as [number, number]
}

/** 武器:在手的位置、轉 rot 之後的本地座標畫(本地 -y = 武器朝向) */
function drawSword(c: CanvasRenderingContext2D, w: WeaponSpec, len: number) {
  const guard = w.guard ?? '#8a7a4a'
  c.lineCap = 'round'; c.lineJoin = 'round'
  c.strokeStyle = w.edge; c.lineWidth = 2.4
  c.fillStyle = w.edge
  c.beginPath(); c.moveTo(-4.5, -10); c.lineTo(-1.2, -len); c.lineTo(1.2, -len); c.lineTo(4.5, -10); c.closePath(); c.fill(); c.stroke()
  c.beginPath(); c.rect(-10, -12, 20, 5); c.fill(); c.stroke()
  c.lineWidth = 6.4; c.beginPath(); c.moveTo(0, -8); c.lineTo(0, 9); c.stroke()
  c.fillStyle = w.color
  c.beginPath(); c.moveTo(-3.3, -11); c.lineTo(-0.6, -len + 2); c.lineTo(0.6, -len + 2); c.lineTo(3.3, -11); c.closePath(); c.fill()
  c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-1.2, -14); c.lineTo(-0.3, -len + 6); c.stroke()
  c.fillStyle = guard; c.beginPath(); c.rect(-9, -11, 18, 3); c.fill()
  c.strokeStyle = '#4a3420'; c.lineWidth = 4; c.beginPath(); c.moveTo(0, -8); c.lineTo(0, 8); c.stroke()
  c.fillStyle = guard; c.beginPath(); c.arc(0, 9.5, 3, 0, Math.PI * 2); c.fill()
}

function drawStaff(c: CanvasRenderingContext2D, w: WeaponSpec, len: number, glow: number) {
  const top = -len * 0.6, bottom = len * 0.4
  c.lineCap = 'round'
  c.strokeStyle = w.edge; c.lineWidth = 7.4; c.beginPath(); c.moveTo(0, bottom); c.lineTo(0, top); c.stroke()
  c.strokeStyle = w.color; c.lineWidth = 5; c.beginPath(); c.moveTo(0, bottom); c.lineTo(0, top); c.stroke()
  c.strokeStyle = 'rgba(255,255,255,0.3)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-1.2, bottom - 6); c.lineTo(-1.2, top + 6); c.stroke()
  const gem = w.gem ?? '#c86cf0'
  const gy = top - 9
  if (glow > 0) {
    const k = 0.35 + 0.55 * Math.min(1, glow)
    const g = c.createRadialGradient(0, gy, 2, 0, gy, 14 + 22 * glow)
    g.addColorStop(0, gem); g.addColorStop(1, 'rgba(255,255,255,0)')
    const a = c.globalAlpha
    c.globalAlpha = a * k
    c.fillStyle = g; c.beginPath(); c.arc(0, gy, 14 + 22 * glow, 0, Math.PI * 2); c.fill()
    c.globalAlpha = a
  }
  c.strokeStyle = w.edge; c.lineWidth = 2
  c.fillStyle = gem
  c.beginPath(); c.moveTo(0, gy - 11); c.lineTo(6, gy); c.lineTo(0, gy + 9); c.lineTo(-6, gy); c.closePath(); c.fill(); c.stroke()
  c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.moveTo(-1, gy - 7); c.lineTo(2, gy - 3); c.lineTo(-2, gy - 1); c.closePath(); c.fill()
  c.strokeStyle = w.color; c.lineWidth = 3; c.beginPath(); c.moveTo(-6, top + 2); c.lineTo(-5, gy); c.moveTo(6, top + 2); c.lineTo(5, gy); c.stroke()
}

function drawDagger(c: CanvasRenderingContext2D, w: WeaponSpec, len: number) {
  const guard = w.guard ?? '#3a3a40'
  c.lineCap = 'round'; c.lineJoin = 'round'
  c.strokeStyle = w.edge; c.lineWidth = 2.2; c.fillStyle = w.edge
  c.beginPath(); c.moveTo(-3.6, -8); c.lineTo(-0.8, -len); c.lineTo(1.6, -len + 1); c.lineTo(3.6, -8); c.closePath(); c.fill(); c.stroke()
  c.beginPath(); c.rect(-7, -9.5, 14, 4); c.fill(); c.stroke()
  c.lineWidth = 5.4; c.beginPath(); c.moveTo(0, -6); c.lineTo(0, 8); c.stroke()
  c.fillStyle = w.color
  c.beginPath(); c.moveTo(-2.5, -9); c.lineTo(-0.3, -len + 2); c.lineTo(1, -len + 2); c.lineTo(2.5, -9); c.closePath(); c.fill()
  c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-0.8, -12); c.lineTo(0, -len + 5); c.stroke()
  c.fillStyle = guard; c.beginPath(); c.rect(-6, -9, 12, 2.6); c.fill()
  c.strokeStyle = '#2a2026'; c.lineWidth = 3.2; c.beginPath(); c.moveTo(0, -6); c.lineTo(0, 7); c.stroke()
}

/** 揮砍殘影:以手為圓心、武器長為半徑,從 from 掃到 to 的扇形 */
function drawTrail(c: CanvasRenderingContext2D, g: [number, number], len: number, from: number, to: number, alpha: number) {
  if (alpha <= 0.01 || Math.abs(to - from) < 0.02) return
  const a0 = from - Math.PI / 2, a1 = to - Math.PI / 2   // 武器角 → canvas 角
  const grad = c.createRadialGradient(g[0], g[1], len * 0.35, g[0], g[1], len * 1.05)
  grad.addColorStop(0, 'rgba(255,255,255,0)'); grad.addColorStop(0.75, `rgba(255,255,255,${0.5 * alpha})`); grad.addColorStop(1, 'rgba(255,255,255,0)')
  c.fillStyle = grad
  c.beginPath(); c.moveTo(g[0], g[1]); c.arc(g[0], g[1], len * 1.05, Math.min(a0, a1), Math.max(a0, a1)); c.closePath(); c.fill()
}

/**
 * 把一個單位畫在 (x, y)(腳底),顯示高度 h,面向 faceLeft。
 * ctx 已經 save 好;這裡自己 translate / scale。
 */
export function drawRig(c: CanvasRenderingContext2D, rig: Rig, pose: Pose, x: number, y: number, h: number, faceLeft: boolean, alpha = 1) {
  const d = rig.data
  const s = h / d.size[1]
  const flip = faceLeft !== rig.left
  const fwd = rig.left ? -1 : 1
  const w = d.weapon
  c.save()
  c.globalAlpha *= alpha
  c.translate(x, y)
  c.scale(flip ? -s : s, s)
  c.translate(-d.feet[0], -d.feet[1])
  // 整個人的傾斜(繞腳底)
  c.translate(d.feet[0] + pose.root.dx, d.feet[1] + pose.root.dy)
  c.rotate(pose.root.rot)
  c.scale(pose.root.sx, pose.root.sy)
  c.translate(-d.feet[0], -d.feet[1])

  const items: { z: number; draw: () => void }[] = []
  // 手的實際位置(手臂畫完才知道搆不搆得到)
  const handAt: Record<string, [number, number]> = {}
  const torsoXf = () => {
    const tt = pose.parts.torso, tp = d.parts.torso?.pivot
    if (!tt || !tp) return
    c.translate(tp[0] + tt.dx, tp[1] + tt.dy); c.rotate(tt.rot); c.scale(tt.sx, tt.sy); c.translate(-tp[0], -tp[1])
  }

  for (const [n, p] of Object.entries(d.parts)) {
    items.push({ z: p.z, draw: () => {
      const t = pose.parts[n] ?? { rot: 0, dx: 0, dy: 0, sx: 1, sy: 1 }
      c.save()
      if (p.parent === 'torso') torsoXf()   // 頭跟著身體
      c.translate(p.pivot[0] + t.dx, p.pivot[1] + t.dy)
      c.rotate(t.rot)
      c.scale(t.sx, t.sy)
      c.translate(-p.pivot[0], -p.pivot[1])
      c.drawImage(p.img, p.x, p.y, p.w, p.h)
      c.restore()
    } })
  }
  for (const [n, a] of Object.entries(d.arms)) {
    items.push({ z: a.z, draw: () => {
      const hand = pose.hands[n]
      if (!hand) return
      // 肩膀跟著身體傾斜
      let sh: [number, number] = a.shoulder
      if (pose.parts.torso && d.parts.torso) {
        const tt = pose.parts.torso, tp = d.parts.torso.pivot
        const cx = a.shoulder[0] - tp[0], cy = a.shoulder[1] - tp[1]
        sh = [tp[0] + tt.dx + (cx * Math.cos(tt.rot) - cy * Math.sin(tt.rot)) * tt.sx, tp[1] + tt.dy + (cx * Math.sin(tt.rot) + cy * Math.cos(tt.rot)) * tt.sy]
      }
      // 肘往哪邊彎(rig 空間;原圖朝左的角色 -1 = 手往前伸時肘朝下 / 手垂著時肘朝後)
      const bend = rig.left ? -1 : 1
      handAt[n] = drawArm(c, { ...a, shoulder: sh }, hand, bend, pose.elbows[n])
    } })
  }
  // 武器:跟著手,繞手轉
  const weaponAt = (arm: string, rot: number, draw: () => void) => {
    const g = handAt[arm]
    if (!g) return
    c.save(); c.translate(g[0], g[1]); c.rotate(rot); draw(); c.restore()
  }
  if (w.type === 'bow') {
    items.push({ z: w.z, draw: () => weaponAt('armMain', pose.weaponRot, () => {
      const half = w.len / 2 * pose.bowSquash, bulge = fwd * w.len * 0.24
      c.lineCap = 'round'; c.lineJoin = 'round'
      c.beginPath(); c.moveTo(0, -half); c.quadraticCurveTo(bulge, 0, 0, half)
      c.strokeStyle = w.edge; c.lineWidth = 9; c.stroke()
      c.strokeStyle = w.color; c.lineWidth = 6; c.stroke()
      c.strokeStyle = w.edge; c.lineWidth = 8; c.beginPath(); c.moveTo(bulge * 0.5, -9); c.lineTo(bulge * 0.5, 9); c.stroke()
      c.strokeStyle = 'rgba(255,240,220,0.35)'; c.lineWidth = 1.5
      c.beginPath(); c.moveTo(fwd * 1.5, -half + 10); c.quadraticCurveTo(bulge + fwd * 1.5, 0, fwd * 1.5, half - 10); c.stroke()
    }) })
    items.push({ z: w.z + 0.5, draw: () => {   // 弦與箭:在弓之上、拉弦手之下
      const g = handAt.armMain
      if (!g) return
      const half = w.len / 2 * pose.bowSquash
      const tip = (yy: number): [number, number] => [g[0] - yy * Math.sin(pose.weaponRot), g[1] + yy * Math.cos(pose.weaponRot)]
      const a = tip(-half), b = tip(half)
      c.strokeStyle = 'rgba(245,240,225,0.95)'; c.lineWidth = 1.6; c.lineCap = 'round'
      c.beginPath(); c.moveTo(a[0], a[1])
      if (pose.stringHand) c.lineTo(pose.stringHand[0], pose.stringHand[1])
      c.lineTo(b[0], b[1]); c.stroke()
      if (pose.arrow === 1 && pose.stringHand) {
        const hx = pose.stringHand[0], hy = pose.stringHand[1]
        const dx = g[0] - hx, dy = g[1] - hy, L = Math.hypot(dx, dy) || 1
        const ux = dx / L, uy = dy / L
        const ex = g[0] + ux * 26, ey = g[1] + uy * 26
        c.strokeStyle = '#6b4a2b'; c.lineWidth = 2.2
        c.beginPath(); c.moveTo(hx, hy); c.lineTo(ex, ey); c.stroke()
        c.fillStyle = '#d8e4ea'; c.beginPath(); c.moveTo(ex + ux * 7, ey + uy * 7); c.lineTo(ex - uy * 3, ey + ux * 3); c.lineTo(ex + uy * 3, ey - ux * 3); c.fill()
        c.fillStyle = '#8fd36a'; c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx + ux * 9 - uy * 4, hy + uy * 9 + ux * 4); c.lineTo(hx + ux * 9 + uy * 4, hy + uy * 9 - ux * 4); c.fill()
      }
    } })
  } else if (w.type === 'sword') {
    items.push({ z: w.z, draw: () => weaponAt('armMain', pose.weaponRot, () => drawSword(c, w, w.len)) })
  } else if (w.type === 'staff') {
    items.push({ z: w.z, draw: () => weaponAt('armMain', pose.weaponRot, () => drawStaff(c, w, w.len, pose.glow)) })
  } else if (w.type === 'daggers') {
    items.push({ z: w.z, draw: () => weaponAt('armMain', pose.weaponRot, () => drawDagger(c, w, w.len)) })
    items.push({ z: w.z, draw: () => weaponAt('armOff', pose.offRot, () => drawDagger(c, w, w.len)) })
  }
  if (pose.trail) {
    const tr = pose.trail
    items.push({ z: w.z - 0.5, draw: () => { const g = handAt[tr.arm]; if (g) drawTrail(c, g, w.len, tr.from, tr.to, tr.alpha) } })
  }
  items.sort((p, q) => p.z - q.z)
  for (const it of items) it.draw()
  c.restore()
}
