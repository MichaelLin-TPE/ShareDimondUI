// 天堂塔防的音效。聲音檔大多是從天堂客戶端的 Sound 資料夾挑出來轉檔的(public/aegis/td/sfx),
// 哪個動作配哪個聲音照客戶端的造型清單:妖精射箭、騎士揮劍、各種魔法、每種怪倒下的叫聲都是原本那個。
// 客戶端沒有合適原音的(過關、結界擋下、首領來襲的號角、賣出)是自己合成的。
const BASE = '/aegis/td/sfx/'
const MUTE_KEY = 'aegis_td_muted'
const MUSIC_KEY = 'aegis_td_music_off'
const BGM_BASE = '/aegis/td/bgm/'
const BGM_VOLUME = 0.5
/** 音效總音量:使用者 10-03 說音效比背景音樂大聲,壓到 0.55 */
const SFX_MASTER = 0.55

/**
 * 背景音樂(使用者 2026-10-03 從天堂客戶端挑的):布置時、七個場景各一首、王來了、結算。
 * 原檔是客戶端 Sound/music<N>.mp3,轉成 96kbps 放在 public/aegis/td/bgm。
 */
export const BGM = {
  setup: 'setup',                                              // music0
  chapters: ['ch0', 'ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6'], // music1 說話之島、music10 古魯丁、music18 風木、music12 奇岩、music11 海音、music4 龍之谷、music3 歐瑞
  boss: 'boss',                                                // music2
  result: 'result',                                            // music5
} as const

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
  musicOff = false
  /** 現在在放哪一首(淡出中的不算) */
  private bgm: HTMLAudioElement | null = null
  private bgmName = ''
  /** 瀏覽器還不准出聲的時候先記著,解鎖後再放 */
  private bgmWanted = ''
  private fadeTimer = 0
  private unlocked = false

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1'
      this.musicOff = localStorage.getItem(MUSIC_KEY) === '1'
    } catch { /* 存不了就用預設 */ }
    document.addEventListener('visibilitychange', this.onVisibility)
    // 手機把瀏覽器收到背景、鎖螢幕、關掉分頁:只靠 visibilitychange 不夠(使用者 10-04 回報關了瀏覽器音樂還在放),
    // 這幾個事件也都當成「離開」,一律暫停;回到前景(pageshow / 視窗取得焦點)再接著放
    window.addEventListener('pagehide', this.onLeave)
    document.addEventListener('freeze', this.onLeave)
    window.addEventListener('pageshow', this.onVisibility)
    document.addEventListener('resume', this.onVisibility)
    if (this.mobile) {   // 電腦上點到別的視窗音樂不用停,手機上視窗失去焦點就是人走了
      window.addEventListener('blur', this.onLeave)
      window.addEventListener('focus', this.onVisibility)
    }
    // 通知列的媒體控制(Android 會把網頁的音樂掛在通知上):按暫停就真的停
    try {
      navigator.mediaSession?.setActionHandler('pause', () => this.onLeave())
      navigator.mediaSession?.setActionHandler('play', () => this.onVisibility())
    } catch { /* 不支援就算了 */ }
  }

  private readonly mobile = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches

  private get away() {
    return document.visibilityState === 'hidden' || (this.mobile && !document.hasFocus())
  }

  private onLeave = () => {
    this.bgm?.pause()
    try { if (navigator.mediaSession) navigator.mediaSession.playbackState = 'paused' } catch { /* 不支援 */ }
  }

  /** 切到別的分頁或 App 就暫停音樂,回來再繼續 */
  private onVisibility = () => {
    if (!this.bgm) return
    if (this.away) this.onLeave()
    else if (!this.muted && !this.musicOff) {
      this.bgm.play().catch(() => {})
      try { if (navigator.mediaSession) navigator.mediaSession.playbackState = 'playing' } catch { /* 不支援 */ }
    }
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
      this.gain.gain.value = this.muted ? 0 : SFX_MASTER
      this.gain.connect(this.ctx.destination)
      for (const n of SFX_NAMES) this.load(n)
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {})
    this.unlocked = true
    if (this.bgmWanted) this.music(this.bgmWanted)
  }

  // ===================== 背景音樂 =====================

  /**
   * 換一首背景音樂(淡出舊的、淡入新的);name = '' 停掉。同一首重複呼叫不會重頭播。
   * 瀏覽器要使用者點過畫面才准出聲:還沒解鎖就先記著,unlock() 時再放。
   */
  music(name: string) {
    this.bgmWanted = name
    if (!this.unlocked || this.muted || this.musicOff) { if (!name) this.stopMusic(); return }
    if (name === this.bgmName && this.bgm) return
    this.stopMusic()
    if (!name) return
    const a = new Audio(`${BGM_BASE}${name}.mp3`)
    a.loop = true
    a.volume = 0
    a.preload = 'auto'
    this.bgm = a
    this.bgmName = name
    // 人不在畫面上(收到背景時剛好換曲):先不放,回到前景 onVisibility 會接著放
    if (!this.away) a.play().catch(() => { /* 還不准出聲:下次 unlock 再放 */ this.bgm = null; this.bgmName = '' })
    // 淡入
    let v = 0
    const step = () => {
      if (this.bgm !== a) return
      v = Math.min(BGM_VOLUME, v + 0.04)
      a.volume = v
      if (v < BGM_VOLUME) this.fadeTimer = window.setTimeout(step, 60)
    }
    step()
  }

  private stopMusic() {
    const old = this.bgm
    this.bgm = null
    this.bgmName = ''
    window.clearTimeout(this.fadeTimer)
    if (!old) return
    if (this.away) { old.pause(); old.src = ''; return }   // 人不在就直接停,不留一個還在淡出的聲音
    // 淡出再停,不會「啪」一聲斷掉
    const fade = () => {
      old.volume = Math.max(0, old.volume - 0.05)
      if (old.volume > 0.01) window.setTimeout(fade, 50)
      else { old.pause(); old.src = '' }
    }
    fade()
  }

  setMusicOff(off: boolean) {
    this.musicOff = off
    try { localStorage.setItem(MUSIC_KEY, off ? '1' : '0') } catch { /* 存不了就算了 */ }
    if (off) this.stopMusic()
    else this.music(this.bgmWanted)
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

  /** 音效總開關(音樂另外有自己的開關;總開關關掉時音樂也不放) */
  setMuted(m: boolean) {
    this.muted = m
    try { localStorage.setItem(MUTE_KEY, m ? '1' : '0') } catch { /* 存不了就算了 */ }
    if (this.gain && this.ctx) this.gain.gain.setTargetAtTime(m ? 0 : SFX_MASTER, this.ctx.currentTime, 0.03)
    if (m) this.stopMusic()
    else this.music(this.bgmWanted)
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
    document.removeEventListener('visibilitychange', this.onVisibility)
    window.removeEventListener('pagehide', this.onLeave)
    window.removeEventListener('blur', this.onLeave)
    document.removeEventListener('freeze', this.onLeave)
    window.removeEventListener('pageshow', this.onVisibility)
    window.removeEventListener('focus', this.onVisibility)
    document.removeEventListener('resume', this.onVisibility)
    try { navigator.mediaSession?.setActionHandler('pause', null); navigator.mediaSession?.setActionHandler('play', null) } catch { /* 不支援 */ }
    const old = this.bgm
    this.bgm = null
    this.bgmName = ''
    window.clearTimeout(this.fadeTimer)
    if (old) { old.pause(); old.src = '' }   // 離開頁面:直接停,不淡出(淡出的計時器在頁面卸載後不一定會跑)
    this.ctx?.close().catch(() => {})
    this.ctx = null
  }
}
