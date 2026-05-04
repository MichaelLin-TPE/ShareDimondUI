<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'

interface Option {
  value: string
  label: string
}

const props = defineProps<{
  modelValue: string
  options: Option[]
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const isOpen = ref(false)
const rootEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)
const query = ref('')

const selectedLabel = computed(() => {
  if (!props.modelValue) return ''
  return props.options.find((o) => o.value === props.modelValue)?.label ?? ''
})

const displayValue = computed(() => (isOpen.value ? query.value : selectedLabel.value))

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return props.options
  return props.options.filter((o) => o.label.toLowerCase().includes(q))
})

const openPanel = async () => {
  isOpen.value = true
  query.value = ''
  await nextTick()
  inputEl.value?.focus()
}

const closePanel = () => {
  isOpen.value = false
  query.value = ''
}

const onInput = (e: Event) => {
  query.value = (e.target as HTMLInputElement).value
  if (!isOpen.value) isOpen.value = true
}

const choose = (value: string) => {
  emit('update:modelValue', value)
  closePanel()
}

const clear = () => {
  emit('update:modelValue', '')
  query.value = ''
  inputEl.value?.focus()
  isOpen.value = true
}

const onClickOutside = (e: MouseEvent) => {
  if (!rootEl.value) return
  if (!rootEl.value.contains(e.target as Node)) closePanel()
}

onMounted(() => document.addEventListener('mousedown', onClickOutside))
onUnmounted(() => document.removeEventListener('mousedown', onClickOutside))
</script>

<template>
  <div ref="rootEl" class="ss-select" :class="{ 'is-open': isOpen }">
    <div class="ss-trigger" :class="{ 'has-value': !!modelValue }" @click="openPanel">
      <span class="ss-search-icon" aria-hidden="true">🔍</span>
      <input
        ref="inputEl"
        type="text"
        class="ss-input"
        :value="displayValue"
        :placeholder="placeholder || '輸入關鍵字搜尋'"
        @input="onInput"
        @focus="openPanel"
      />
      <button
        v-if="modelValue && !isOpen"
        type="button"
        class="ss-clear"
        title="清除"
        @click.stop="clear"
      >
        ✕
      </button>
      <svg v-else class="ss-chevron" viewBox="0 0 24 24" width="14" height="14">
        <path
          d="M6 9l6 6 6-6"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </div>

    <Transition name="ss-pop">
      <div v-if="isOpen" class="ss-panel">
        <div v-if="filtered.length === 0" class="ss-empty">沒有符合「{{ query }}」的項目</div>
        <button
          v-for="opt in filtered"
          :key="opt.value"
          type="button"
          class="ss-option"
          :class="{ 'is-selected': opt.value === modelValue }"
          @mousedown.prevent="choose(opt.value)"
        >
          <span class="ss-option-label">{{ opt.label }}</span>
          <svg
            v-if="opt.value === modelValue"
            class="ss-check"
            viewBox="0 0 24 24"
            width="14"
            height="14"
          >
            <path
              d="M5 13l4 4L19 7"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.ss-select {
  position: relative;
  width: 100%;
}

.ss-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 42px;
  padding: 0 12px;
  background: #0f111a;
  border: 1px solid #2e3147;
  border-radius: 10px;
  cursor: text;
  transition: all 0.15s;
  box-sizing: border-box;
}
.ss-trigger:hover {
  border-color: #3a3f5c;
}
.ss-select.is-open .ss-trigger {
  border-color: var(--c-light);
  box-shadow: 0 0 0 3px rgba(var(--c-light-rgb), 0.15);
}

.ss-search-icon {
  flex-shrink: 0;
  font-size: 0.95rem;
  opacity: 0.5;
}

.ss-input {
  flex: 1;
  min-width: 0;
  width: 100%;
  height: 100%;
  border: none !important;
  outline: none !important;
  background: transparent !important;
  box-shadow: none !important;
  color: #fff;
  font-size: 0.95rem;
  font-weight: 500;
  font-family: inherit;
  padding: 0;
  margin: 0;
  -webkit-appearance: none;
  appearance: none;
  border-radius: 0;
}
.ss-input::placeholder {
  color: #475569;
}
.ss-input:focus,
.ss-input:focus-visible,
.ss-input:active,
.ss-input:hover {
  outline: none !important;
  box-shadow: none !important;
  border: none !important;
}
.ss-trigger.has-value:not(.is-open) .ss-input {
  font-weight: 600;
}

.ss-clear {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.08);
  color: #94a3b8;
  font-size: 0.78rem;
  font-weight: 700;
  line-height: 1; /* 確保 X 字元上下置中 */
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin: 0;
  font-family: inherit;
  transition: all 0.15s;
  box-sizing: border-box;
  /* 自動垂直對齊到 .ss-trigger (42px 父容器) 的中心,因為父用 align-items: center */
}
.ss-clear:hover {
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
}

.ss-chevron {
  flex-shrink: 0;
  color: var(--c-light);
  transition: transform 0.22s ease;
}
.ss-select.is-open .ss-chevron {
  transform: rotate(180deg);
}

.ss-panel {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 50;
  max-height: 280px;
  overflow-x: hidden;
  overflow-y: auto;
  background: #14161f;
  border: 1px solid #2e3147;
  border-radius: 10px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6);
  padding: 0;
}
.ss-panel::-webkit-scrollbar {
  width: 6px;
}
.ss-panel::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 999px;
}

.ss-empty {
  padding: 14px;
  color: #64748b;
  font-size: 0.85rem;
  text-align: center;
}

.ss-option {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 0 14px;
  margin: 0;
  height: 40px;
  line-height: 1;
  background: transparent;
  border: none;
  border-radius: 0;
  color: #e2e8f0;
  font-size: 0.92rem;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: background 0.12s, color 0.12s;
}
.ss-option:hover {
  background: rgba(var(--c-light-rgb), 0.08);
  color: #fff;
}
.ss-option.is-selected {
  background: rgba(var(--c-light-rgb), 0.14);
  color: var(--c-light);
  font-weight: 700;
}
.ss-check {
  color: var(--c-light);
  flex-shrink: 0;
}
.ss-option-label {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ss-pop-enter-active,
.ss-pop-leave-active {
  transition:
    opacity 0.16s,
    transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}
.ss-pop-enter-from,
.ss-pop-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
