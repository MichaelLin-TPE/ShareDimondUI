// 天堂塔防的音效。聲音檔大多是從天堂客戶端的 Sound 資料夾挑出來轉檔的(public/aegis/td/sfx),
// 哪個動作配哪個聲音照客戶端的造型清單:妖精射箭、騎士揮劍、各種魔法、每種怪倒下的叫聲都是原本那個。
// 客戶端沒有合適原音的(過關、結界擋下、首領來襲的號角、賣出)是自己合成的。
const BASE = '/aegis/td/sfx/'
const MUTE_KEY = 'aegis_td_muted'

/** 全部的音效名稱(= 檔名) */
export const SFX_NAMES = [
  'elf_shoot', 'sword1', 'sword2', 'sword3', 'staff', 'dagger1', 'dagger2',
  'fireball', 'firestorm', 'blizzard', 'lightning', 'stun', 'poison', 'crit_fire', 'crit_double',
  'die0', 'die1', 'die2', 'die3', 'die4', 'die5', 'die6',
  'boss0', 'boss1', 'boss2', 'boss3', 'boss4', 'boss5',
  'bossdie0', 'bossdie1', 'bossdie2', 'bossdie3', 'bossdie4', 'bossdie5',
  'knight_down', 'knight_up', 'goddess_hit', 'revive',
  'click', 'cls0', 'cls1', 'cls2', 'cls3', 'cls4', 'upgrade', 'bless', 'wave_start', 'wave_clear', 'game_over', 'shield', 'boss_warn', 'sell',
] as const
export type SfxName = (typeof SFX_NAMES)[number]

/** 同一個聲音多久之內不重複播(毫秒);沒列的用 60 */
const GAP: Partial<Record<SfxName, number>> = {
  elf_shoot: 70, sword1: 90, sword2: 90, sword3: 90, dagger1: 90, dagger2: 90, staff: 120,
  fireball: 160, firestorm: 220, blizzard: 260, lightning: 200, stun: 300, poison: 500, crit_fire: 250, crit_double: 250,
  die0: 110, die1: 110, die2: 160, die3: 110, die4: 130, die5: 160, die6: 110, goddess_hit: 200,
}
/** 各聲音的音量(0~1);沒列的用 0.6 */
const VOL: Partial<Record<SfxName, number>> = {
  elf_shoot: 0.4, sword1: 0.5, sword2: 0.5, sword3: 0.5, dagger1: 0.45, dagger2: 0.45, staff: 0.4,
  fireball: 0.5, firestorm: 0.55, blizzard: 0.5, lightning: 0.55, stun: 0.5, poison: 0.35, crit_fire: 0.5, crit_double: 0.5,
  die0: 0.4, die1: 0.4, die2: 0.5, die3: 0.35, die4: 0.4, die5: 0.45, die6: 0.4,
  goddess_hit: 0.7, revive: 0.8, knight_down: 0.6, knight_up: 0.5, click: 0.5, upgrade: 0.6, bless: 0.7,
  wave_start: 0.6, wave_clear: 0.5, game_over: 0.8, shield: 0.45, boss_warn: 0.7, sell: 0.4,
}

export class TdAudio {
  private ctx: AudioContext | null = null
  private gain: GainNode | null = null
  private buffers = new Map<string, AudioBuffer>()
  private loading = new Set<string>()
  private lastAt = new Map<string, number>()
  private live = 0
  muted = false

  constructor() {
    try { this.muted = localStorage.getItem(MUTE_KEY) === '1' } catch { /* 存不了就用預設 */ }
  }

  /**
   * 瀏覽器規定要使用者先點過畫面才能出聲:在第一次點擊(開始、買塔…)時呼叫。
   * 這時候才開始載聲音檔,沒進來玩的人不會白白下載。
   */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return
      this.ctx = new AC()
      this.gain = this.ctx.createGain()
      this.gain.gain.value = this.muted ? 0 : 1
      this.gain.connect(this.ctx.destination)
      for (const n of SFX_NAMES) this.load(n)
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {})
  }

  private async load(name: string) {
    if (!this.ctx || this.buffers.has(name) || this.loading.has(name)) return
    this.loading.add(name)
    try {
      const res = await fetch(`${BASE}${name}.mp3`)
      if (!res.ok) return
      const buf = await this.ctx.decodeAudioData(await res.arrayBuffer())
      this.buffers.set(name, buf)
    } catch { /* 某個聲音載不到就不播那個,不影響遊戲 */ } finally {
      this.loading.delete(name)
    }
  }

  setMuted(m: boolean) {
    this.muted = m
    try { localStorage.setItem(MUTE_KEY, m ? '1' : '0') } catch { /* 存不了就算了 */ }
    if (this.gain && this.ctx) this.gain.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.03)
  }

  /** scale:再乘一個音量倍率(例如成群的小怪小聲一點) */
  play(name: SfxName, scale = 1) {
    const ctx = this.ctx
    if (!ctx || !this.gain || this.muted) return
    const buf = this.buffers.get(name)
    if (!buf) return
    const now = performance.now()
    if (now - (this.lastAt.get(name) ?? -9999) < (GAP[name] ?? 60)) return
    if (this.live >= 14) return        // 同時太多聲音會糊成一團
    this.lastAt.set(name, now)
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.playbackRate.value = 0.94 + Math.random() * 0.12   // 每次音高差一點點,連續播才不像機關槍
    const g = ctx.createGain()
    g.gain.value = (VOL[name] ?? 0.6) * scale
    src.connect(g)
    g.connect(this.gain)
    this.live++
    src.onended = () => { this.live--; g.disconnect() }
    src.start()
  }

  destroy() {
    this.ctx?.close().catch(() => {})
    this.ctx = null
  }
}
