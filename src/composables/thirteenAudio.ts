import { ref } from 'vue'

/**
 * 十三支音效:全部用 Web Audio 即時合成(不需音檔)。
 * - 舒服的環境背景音樂(慢和弦 pad + 輕琶音,可開關)
 * - 互動音效:發牌 / 放牌 / 交牌 / 開牌 / 贏 / 輸 / 中彩金池 / 被邀請
 * 偏好存 localStorage。自動播放限制:背景音樂在「第一次點擊」後才會開始。
 */
export function useThirteenAudio() {
  const sfxOn = ref(localStorage.getItem('t13_sfx') !== 'off')
  const bgmOn = ref(localStorage.getItem('t13_bgm') !== 'off')

  let ctx: AudioContext | null = null
  function audio(): AudioContext | null {
    try {
      if (!ctx) {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        ctx = new Ctor()
      }
      if (ctx.state === 'suspended') void ctx.resume()
      return ctx
    } catch {
      return null
    }
  }

  // ---- 合成基本元件 ----
  function tone(c: AudioContext, t: number, freq: number, dur: number, gain: number, type: OscillatorType, dest?: AudioNode) {
    const o = c.createOscillator()
    o.type = type
    o.frequency.value = freq
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(gain, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g)
    g.connect(dest ?? c.destination)
    o.start(t)
    o.stop(t + dur)
  }
  function tick(c: AudioContext, t: number, freq: number, gain: number) {
    const n = Math.max(1, Math.floor(c.sampleRate * 0.04))
    const buf = c.createBuffer(1, n, c.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
    const src = c.createBufferSource()
    src.buffer = buf
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = freq
    bp.Q.value = 2
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(gain, t + 0.003)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06)
    src.connect(bp); bp.connect(g); g.connect(c.destination)
    src.start(t); src.stop(t + 0.06)
  }

  // ---- 互動音效 ----
  function playDeal() {
    const c = audio(); if (!c || !sfxOn.value) return
    let t = c.currentTime
    for (let i = 0; i < 13; i++) { tick(c, t, 1600 + Math.random() * 700, 0.14); t += 0.065 }
  }
  function playPlace() {
    const c = audio(); if (!c || !sfxOn.value) return
    tick(c, c.currentTime, 1300, 0.12)
  }
  function playSubmit() {
    const c = audio(); if (!c || !sfxOn.value) return
    const t = c.currentTime
    ;[523, 784].forEach((f, i) => tone(c, t + i * 0.07, f, 0.18, 0.14, 'triangle'))
  }
  function playReveal() {
    const c = audio(); if (!c || !sfxOn.value) return
    const t = c.currentTime
    ;[392, 494, 587].forEach((f, i) => tone(c, t + i * 0.06, f, 0.2, 0.12, 'triangle'))
  }
  function playWin() {
    const c = audio(); if (!c || !sfxOn.value) return
    const t = c.currentTime
    ;[523, 659, 784, 1047].forEach((f, i) => tone(c, t + i * 0.1, f, 0.28, 0.16, 'triangle'))
  }
  function playLose() {
    const c = audio(); if (!c || !sfxOn.value) return
    const t = c.currentTime
    ;[330, 262, 196].forEach((f, i) => tone(c, t + i * 0.13, f, 0.3, 0.12, 'sine'))
  }
  function playJackpot() {
    const c = audio(); if (!c || !sfxOn.value) return
    const t = c.currentTime
    ;[523, 659, 784, 1047, 784, 1047, 1319, 1568].forEach((f, i) => tone(c, t + i * 0.11, f, 0.32, 0.18, 'sawtooth'))
  }
  function playInvite() {
    const c = audio(); if (!c || !sfxOn.value) return
    const t = c.currentTime
    ;[784, 1047].forEach((f, i) => tone(c, t + i * 0.12, f, 0.3, 0.16, 'sine'))
  }

  // ---- 背景音樂(慢和弦 pad + 輕琶音) ----
  let musicGain: GainNode | null = null
  let chordTimer: number | undefined
  let arpTimer: number | undefined
  let chordIdx = 0
  // Cmaj7 / Am7 / Fmaj7 / G7 — 輕鬆 lounge 進行(Hz)
  const CHORDS = [
    [130.81, 164.81, 196.0, 246.94],
    [110.0, 130.81, 164.81, 196.0],
    [174.61, 130.81, 164.81, 196.0],
    [196.0, 146.83, 174.61, 246.94],
  ]

  function playPad(notes: number[]) {
    const c = audio(); if (!c || !musicGain) return
    const t = c.currentTime
    for (const f of notes) {
      const o = c.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      const g = c.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.linearRampToValueAtTime(0.16, t + 1.2)   // 慢慢淡入
      g.gain.linearRampToValueAtTime(0.13, t + 3.0)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 4.4) // 淡出
      o.connect(g); g.connect(musicGain)
      o.start(t); o.stop(t + 4.5)
    }
  }
  function playArp() {
    const c = audio(); if (!c || !musicGain) return
    const notes = CHORDS[chordIdx % CHORDS.length] ?? []
    const f = notes[(Math.floor(c.currentTime / 0.55)) % notes.length] ?? 196
    const o = c.createOscillator()
    o.type = 'triangle'
    o.frequency.value = f * 2 // 高八度,像鐘琴
    const g = c.createGain()
    const t = c.currentTime
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(0.05, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
    o.connect(g); g.connect(musicGain)
    o.start(t); o.stop(t + 0.5)
  }

  function startMusic() {
    const c = audio(); if (!c || musicGain) return
    musicGain = c.createGain()
    musicGain.gain.value = 0.0
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 900
    musicGain.connect(lp)
    lp.connect(c.destination)
    musicGain.gain.linearRampToValueAtTime(0.5, c.currentTime + 2) // 整體音量很輕
    chordIdx = 0
    playPad(CHORDS[0]!)
    chordTimer = window.setInterval(() => {
      chordIdx = (chordIdx + 1) % CHORDS.length
      playPad(CHORDS[chordIdx]!)
    }, 4200)
    arpTimer = window.setInterval(playArp, 560)
  }
  function stopMusic() {
    if (chordTimer) { clearInterval(chordTimer); chordTimer = undefined }
    if (arpTimer) { clearInterval(arpTimer); arpTimer = undefined }
    if (musicGain && ctx) {
      try {
        musicGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.6)
        const g = musicGain
        window.setTimeout(() => { try { g.disconnect() } catch { /* ignore */ } }, 800)
      } catch { /* ignore */ }
      musicGain = null
    }
  }

  // 第一次使用者點擊後才能播音樂(瀏覽器自動播放限制)
  let armed = false
  function armAutoStart() {
    if (armed) return
    armed = true
    const handler = () => {
      audio()
      if (bgmOn.value) startMusic()
      window.removeEventListener('pointerdown', handler)
      window.removeEventListener('keydown', handler)
    }
    window.addEventListener('pointerdown', handler)
    window.addEventListener('keydown', handler)
  }

  function toggleSfx() {
    sfxOn.value = !sfxOn.value
    localStorage.setItem('t13_sfx', sfxOn.value ? 'on' : 'off')
    if (sfxOn.value) playPlace()
  }
  function toggleBgm() {
    bgmOn.value = !bgmOn.value
    localStorage.setItem('t13_bgm', bgmOn.value ? 'on' : 'off')
    if (bgmOn.value) startMusic()
    else stopMusic()
  }

  function dispose() {
    stopMusic()
    if (ctx) { ctx.close().catch(() => {}); ctx = null }
  }

  return {
    sfxOn, bgmOn,
    playDeal, playPlace, playSubmit, playReveal, playWin, playLose, playJackpot, playInvite,
    startMusic, stopMusic, armAutoStart, toggleSfx, toggleBgm, dispose,
  }
}
