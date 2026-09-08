<script setup lang="ts">
// 「聚焦」文字:取景框會一直輪巡每個詞(清晰帶框,其他詞微糊);滑鼠停在哪個詞就固定在那裡,移開後繼續輪巡。
// 中文沒有空格,所以由呼叫端把句子切成詞陣列傳進來。
import { onMounted, onUnmounted, ref } from 'vue'

const props = withDefaults(defineProps<{ words: string[]; autoplay?: boolean; interval?: number }>(), {
  autoplay: true,
  interval: 900,
})

const hover = ref<number | null>(null) // 滑鼠所在的詞
const auto = ref<number | null>(null) // 輪巡到的詞
let timer: ReturnType<typeof setInterval> | null = null
let i = -1

const stopAuto = () => { if (timer) { clearInterval(timer); timer = null } auto.value = null }
const step = () => { i = (i + 1) % props.words.length; auto.value = i }
const startAuto = () => {
  const rm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!props.autoplay || rm || props.words.length < 2 || timer) return
  step()
  timer = setInterval(step, props.interval)
}

onMounted(() => { setTimeout(startAuto, 700) })
onUnmounted(stopAuto)

const onEnter = (idx: number) => { stopAuto(); hover.value = idx }
const onLeave = () => { hover.value = null; startAuto() }

const focusIdx = () => (hover.value !== null ? hover.value : auto.value)
</script>

<template>
  <span class="ft" :class="{ live: focusIdx() !== null }">
    <span
      v-for="(w, idx) in words"
      :key="idx"
      class="w"
      :class="{ on: focusIdx() === idx }"
      @mouseenter="onEnter(idx)"
      @mouseleave="onLeave"
    >{{ w }}</span>
  </span>
</template>

<style scoped>
.ft { display: inline; }
.w { position: relative; display: inline-block; padding: 0 0.06em; transition: filter 0.35s ease, opacity 0.35s ease, transform 0.35s ease; will-change: filter; }
/* 有詞被聚焦時,其他詞退到背景 */
.ft.live .w:not(.on) { filter: blur(3px); opacity: 0.45; }
.ft.live .w.on { filter: none; opacity: 1; transform: translateY(-1px); }
/* 取景框:四個角 */
.w::before, .w::after { content: ''; position: absolute; width: 0.28em; height: 0.28em; border: 2px solid var(--ag-ember, #e8842a); opacity: 0; transition: opacity 0.25s ease, transform 0.25s ease; pointer-events: none; }
.w::before { left: -0.12em; top: -0.08em; border-right: 0; border-bottom: 0; transform: translate(-6px, -6px); }
.w::after { right: -0.12em; bottom: -0.02em; border-left: 0; border-top: 0; transform: translate(6px, 6px); }
.w.on::before, .w.on::after { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) {
  .w { transition: none; }
  .ft.live .w:not(.on) { filter: none; opacity: 1; }
}
</style>
