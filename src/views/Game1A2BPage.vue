<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

interface HistoryEntry {
  guess: string
  a: number
  b: number
  remaining: number
}

const allCandidates = ref<string[]>([])
const candidates = ref<string[]>([])
const history = ref<HistoryEntry[]>([])
const currentGuess = ref<string>('')
const inputA = ref(0)
const inputB = ref(0)
const gameWon = ref(false)
const impossible = ref(false)
const thinking = ref(false)

// 產生所有 5040 組 4 位不重複數字
function generateAll(): string[] {
  const result: string[] = []
  for (let a = 0; a <= 9; a++) {
    for (let b = 0; b <= 9; b++) {
      if (b === a) continue
      for (let c = 0; c <= 9; c++) {
        if (c === a || c === b) continue
        for (let d = 0; d <= 9; d++) {
          if (d === a || d === b || d === c) continue
          result.push(`${a}${b}${c}${d}`)
        }
      }
    }
  }
  return result
}

// 計算 guess 跟 secret 之間的 A 數和 B 數
function calcAB(guess: string, secret: string) {
  let a = 0
  let b = 0
  for (let i = 0; i < 4; i++) {
    const g = guess.charAt(i)
    if (g === secret.charAt(i)) a++
    else if (secret.includes(g)) b++
  }
  return { a, b }
}

// minimax 選下一猜：挑一個「最壞情況剩餘候選最少」的
function pickNextGuess(pool: string[]): string {
  const first = pool[0]
  if (!first) return ''
  if (pool.length <= 2) return first

  // 候選多時，從 pool 內挑（快速且接近最佳）
  const searchSpace = pool.length > 300 ? pool.slice(0, 300) : pool
  let best = first
  let bestWorst = Infinity

  for (const g of searchSpace) {
    const counts: Record<string, number> = {}
    for (const s of pool) {
      const { a, b } = calcAB(g, s)
      const key = `${a}-${b}`
      counts[key] = (counts[key] || 0) + 1
    }
    let worst = 0
    for (const v of Object.values(counts)) if (v > worst) worst = v
    if (worst < bestWorst) {
      bestWorst = worst
      best = g
    }
  }
  return best
}

function startGame() {
  allCandidates.value = generateAll()
  candidates.value = [...allCandidates.value]
  history.value = []
  inputA.value = 0
  inputB.value = 0
  gameWon.value = false
  impossible.value = false
  currentGuess.value = '0123' // 經典起手
}

async function submitFeedback() {
  if (inputA.value + inputB.value > 4) return
  if (inputA.value === 4) {
    history.value.push({
      guess: currentGuess.value,
      a: 4,
      b: 0,
      remaining: 1,
    })
    gameWon.value = true
    return
  }

  const filtered = candidates.value.filter((c) => {
    const r = calcAB(currentGuess.value, c)
    return r.a === inputA.value && r.b === inputB.value
  })

  history.value.push({
    guess: currentGuess.value,
    a: inputA.value,
    b: inputB.value,
    remaining: filtered.length,
  })

  candidates.value = filtered

  if (filtered.length === 0) {
    impossible.value = true
    return
  }
  if (filtered.length === 1) {
    const only = filtered[0]
    if (only) {
      currentGuess.value = only
      inputA.value = 0
      inputB.value = 0
      return
    }
  }

  // 非同步選下一猜（讓 UI 先更新）
  thinking.value = true
  inputA.value = 0
  inputB.value = 0
  await new Promise((r) => setTimeout(r, 30))
  currentGuess.value = pickNextGuess(filtered)
  thinking.value = false
}

const guessDigits = computed(() => currentGuess.value.split(''))
const guessCount = computed(() => history.value.length)
const gameOver = computed(() => gameWon.value || impossible.value)
const canIncA = computed(() => inputA.value + inputB.value < 4 && inputA.value < 4)
const canIncB = computed(() => inputA.value + inputB.value < 4 && inputB.value < 4)

onMounted(() => {
  startGame()
})
</script>

<template>
  <div class="g-page">
    <!-- Header -->
    <div class="g-header">
      <div class="g-title-row">
        <span class="g-icon">🎯</span>
        <div>
          <h1 class="g-title">1A2B 猜數字</h1>
          <p class="g-sub">你心裡想一個 4 位不重複數字（0~9），我來猜！</p>
        </div>
      </div>
      <button class="g-btn g-btn--ghost" @click="startGame">🔄 重新開始</button>
    </div>

    <!-- 勝利 / 無解狀態 -->
    <div v-if="gameWon" class="g-status win">
      🎉 猜中了！答案是 <strong>{{ currentGuess }}</strong
      >，共用了 <strong>{{ guessCount }}</strong> 次！
    </div>
    <div v-else-if="impossible" class="g-status err">
      😵 剩餘候選為 0，表示之前某次回報可能有誤。請重新開始。
    </div>

    <!-- 當前猜測 -->
    <div v-else class="g-guess-card">
      <div class="g-step">第 {{ guessCount + 1 }} 次猜測</div>
      <div class="g-digits">
        <div v-for="(d, i) in guessDigits" :key="i" class="g-digit">
          {{ d }}
        </div>
      </div>
      <div class="g-remaining">剩餘可能答案：{{ candidates.length }} 組</div>

      <div v-if="thinking" class="g-thinking">🧠 思考下一步...</div>

      <!-- A/B 輸入 -->
      <div v-else class="g-input-row">
        <div class="g-input-group">
          <div class="g-input-label">A（數字+位置對）</div>
          <div class="g-stepper">
            <button class="g-step-btn" :disabled="inputA <= 0" @click="inputA--">−</button>
            <div class="g-step-num">{{ inputA }}</div>
            <button class="g-step-btn" :disabled="!canIncA" @click="inputA++">+</button>
          </div>
        </div>

        <div class="g-input-group">
          <div class="g-input-label">B（數字對位置錯）</div>
          <div class="g-stepper">
            <button class="g-step-btn" :disabled="inputB <= 0" @click="inputB--">−</button>
            <div class="g-step-num">{{ inputB }}</div>
            <button class="g-step-btn" :disabled="!canIncB" @click="inputB++">+</button>
          </div>
        </div>
      </div>

      <button v-if="!thinking" class="g-btn g-btn--primary" @click="submitFeedback">
        {{ inputA === 4 ? '🎉 完全正確！' : '✅ 提交結果' }}
      </button>

      <p class="g-hint">提示：A + B ≤ 4，若想的數字就是 {{ currentGuess }}，直接填 4A0B</p>
    </div>

    <!-- 歷史紀錄 -->
    <div v-if="history.length > 0" class="g-history">
      <h3 class="g-history-title">📜 歷史紀錄</h3>
      <div
        v-for="(entry, idx) in history"
        :key="idx"
        class="g-history-item"
        :class="{ win: entry.a === 4 }"
      >
        <span class="g-history-idx">#{{ idx + 1 }}</span>
        <span class="g-history-guess">{{ entry.guess }}</span>
        <span class="g-history-result">
          <span class="g-a">{{ entry.a }}A</span>
          <span class="g-b">{{ entry.b }}B</span>
        </span>
        <span class="g-history-remain">剩 {{ entry.remaining }} 組</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.g-page {
  padding: 24px;
  max-width: 640px;
  margin: 0 auto;
  color: #f1f5f9;
}

/* Header */
.g-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  gap: 12px;
}
.g-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.g-icon {
  font-size: 2rem;
  filter: drop-shadow(0 0 8px rgba(180, 110, 255, 0.5));
}
.g-title {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 800;
  background: linear-gradient(135deg, #a5b4fc, #f0abfc);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.g-sub {
  margin: 2px 0 0;
  font-size: 0.8rem;
  color: #64748b;
}

/* Status */
.g-status {
  padding: 20px;
  border-radius: 14px;
  text-align: center;
  font-size: 1rem;
  line-height: 1.6;
  margin-bottom: 20px;
  animation: pop 0.4s ease-out;
}
.g-status strong {
  font-size: 1.3rem;
  color: var(--c-light);
  padding: 0 4px;
}
.g-status.win {
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.4);
  color: #6ee7b7;
}
.g-status.err {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.4);
  color: #fca5a5;
}

/* Guess Card */
.g-guess-card {
  background: rgba(17, 19, 28, 0.85);
  border: 1px solid rgba(180, 110, 255, 0.25);
  border-radius: 16px;
  padding: 24px 20px;
  margin-bottom: 20px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
}
.g-step {
  text-align: center;
  font-size: 0.82rem;
  color: #94a3b8;
  font-weight: 600;
  margin-bottom: 16px;
  letter-spacing: 1px;
}

/* Digits */
.g-digits {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-bottom: 12px;
}
.g-digit {
  width: 56px;
  height: 72px;
  background: linear-gradient(135deg, #1e293b, #0f172a);
  border: 1px solid #334155;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.2rem;
  font-weight: 800;
  color: #f8fafc;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 4px 10px rgba(0, 0, 0, 0.3);
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
}
.g-remaining {
  text-align: center;
  font-size: 0.78rem;
  color: #64748b;
  margin-bottom: 20px;
}

.g-thinking {
  text-align: center;
  font-size: 0.9rem;
  color: #a5b4fc;
  padding: 20px 0;
  animation: pulse 1.2s ease-in-out infinite;
}

/* Input */
.g-input-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 16px;
}
.g-input-group {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid #334155;
  border-radius: 12px;
  padding: 12px;
  text-align: center;
}
.g-input-label {
  font-size: 0.72rem;
  color: #94a3b8;
  margin-bottom: 8px;
  font-weight: 600;
}
.g-stepper {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}
.g-step-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid #475569;
  background: #1e293b;
  color: #f1f5f9;
  font-size: 1.1rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}
.g-step-btn:hover:not(:disabled) {
  background: rgba(180, 110, 255, 0.2);
  border-color: #b46eff;
}
.g-step-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.g-step-num {
  width: 36px;
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--c-light);
}

/* Buttons */
.g-btn {
  border: none;
  cursor: pointer;
  font-weight: 700;
  transition: all 0.2s;
}
.g-btn--primary {
  width: 100%;
  padding: 13px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--c-mid), #a855f7);
  color: #fff;
  font-size: 1rem;
  box-shadow: 0 4px 15px rgba(var(--c-light-rgb), 0.35);
}
.g-btn--primary:hover {
  filter: brightness(1.1);
  transform: translateY(-2px);
}
.g-btn--ghost {
  padding: 9px 16px;
  border-radius: 10px;
  background: #1e293b;
  border: 1px solid #334155;
  color: #94a3b8;
  font-size: 0.85rem;
}
.g-btn--ghost:hover {
  background: #334155;
  color: #f1f5f9;
}

.g-hint {
  text-align: center;
  font-size: 0.72rem;
  color: #475569;
  margin: 12px 0 0;
}

/* History */
.g-history {
  background: rgba(17, 19, 28, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 14px;
  padding: 16px 18px;
}
.g-history-title {
  margin: 0 0 12px;
  font-size: 0.95rem;
  color: #f1f5f9;
}
.g-history-item {
  display: grid;
  grid-template-columns: 40px 1fr auto 90px;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 10px;
  margin-bottom: 6px;
  font-size: 0.85rem;
}
.g-history-item.win {
  background: rgba(16, 185, 129, 0.12);
  border-color: rgba(16, 185, 129, 0.35);
}
.g-history-idx {
  color: #64748b;
  font-weight: 700;
  font-size: 0.75rem;
}
.g-history-guess {
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  font-size: 1rem;
  font-weight: 700;
  color: #f1f5f9;
  letter-spacing: 2px;
}
.g-history-result {
  display: flex;
  gap: 8px;
}
.g-a {
  padding: 2px 8px;
  border-radius: 5px;
  background: rgba(16, 185, 129, 0.15);
  color: #6ee7b7;
  border: 1px solid rgba(16, 185, 129, 0.3);
  font-size: 0.75rem;
  font-weight: 700;
}
.g-b {
  padding: 2px 8px;
  border-radius: 5px;
  background: rgba(var(--c-deep-rgb), 0.15);
  color: var(--c-light);
  border: 1px solid rgba(var(--c-deep-rgb), 0.3);
  font-size: 0.75rem;
  font-weight: 700;
}
.g-history-remain {
  font-size: 0.72rem;
  color: #64748b;
  text-align: right;
}

@keyframes pop {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* RWD */
@media (max-width: 480px) {
  .g-page { padding: 16px 12px; }
  .g-header { margin-left: 48px; }
  .g-digit { width: 48px; height: 62px; font-size: 1.8rem; }
  .g-history-item { grid-template-columns: 30px 1fr auto; }
  .g-history-remain { grid-column: 1 / -1; text-align: left; padding-left: 40px; }
}
</style>
