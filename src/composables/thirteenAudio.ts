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

  // ---- 背景音樂(柔情慢板:暖 pad + 低音根音 + 偶爾輕鈴) ----
  let musicGain: GainNode | null = null
  let chordTimer: number | undefined
  let chordIdx = 0
  const CHORD_MS = 7000
  // Am – F – C – G 抒情進行。bass=低音根音,notes=和弦音(中音域)
  interface Chord { bass: number; notes: number[]; top: number }
  const CHORDS: Chord[] = [
    { bass: 110.0, notes: [220.0, 261.63, 329.63], top: 659.25 },  // Am
    { bass: 87.31, notes: [174.61, 220.0, 261.63], top: 523.25 },  // F
    { bass: 130.81, notes: [261.63, 329.63, 392.0], top: 783.99 }, // C
    { bass: 98.0, notes: [196.0, 246.94, 293.66], top: 587.33 },   // G
  ]

  // 一個帶平滑淡入淡出的暖音(三角波),自動接到 musicGain
  function voice(c: AudioContext, freq: number, type: OscillatorType, peak: number, attack: number, hold: number, release: number) {
    if (!musicGain) return
    const t = c.currentTime
    const o = c.createOscillator()
    o.type = type
    o.frequency.value = freq
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + attack)
    g.gain.setValueAtTime(peak, t + attack + hold)
    g.gain.linearRampToValueAtTime(0.0001, t + attack + hold + release)
    o.connect(g); g.connect(musicGain)
    o.start(t); o.stop(t + attack + hold + release + 0.1)
  }

  function playChord(ch: Chord) {
    const c = audio(); if (!c || !musicGain) return
    voice(c, ch.bass, 'sine', 0.12, 2.0, 2.0, 2.8)          // 低音根音,溫暖
    for (const f of ch.notes) voice(c, f, 'triangle', 0.07, 2.2, 1.8, 2.8) // 和弦 pad
    // 偶爾一聲輕柔鈴音(高音頂音,慢慢消失)
    voice(c, ch.top, 'sine', 0.045, 0.6, 0.2, 3.0)
  }

  function startMusic() {
    const c = audio(); if (!c || musicGain) return
    musicGain = c.createGain()
    musicGain.gain.value = 0.0001
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1500
    lp.Q.value = 0.3
    musicGain.connect(lp)
    lp.connect(c.destination)
    musicGain.gain.linearRampToValueAtTime(0.55, c.currentTime + 3) // 整體很輕,慢慢進來
    chordIdx = 0
    playChord(CHORDS[0]!)
    chordTimer = window.setInterval(() => {
      chordIdx = (chordIdx + 1) % CHORDS.length
      playChord(CHORDS[chordIdx]!)
    }, CHORD_MS)
  }
  function stopMusic() {
    if (chordTimer) { clearInterval(chordTimer); chordTimer = undefined }
    if (musicGain && ctx) {
      try {
        musicGain.gain.cancelScheduledValues(ctx.currentTime)
        musicGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 1.0)
        const g = musicGain
        window.setTimeout(() => { try { g.disconnect() } catch { /* ignore */ } }, 1200)
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
