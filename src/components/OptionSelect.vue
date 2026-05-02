<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

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

const selectedLabel = computed(() => {
  if (!props.modelValue) return ''
  return props.options.find((o) => o.value === props.modelValue)?.label ?? ''
})

const toggle = () => {
  isOpen.value = !isOpen.value
}
const close = () => {
  isOpen.value = false
}
const choose = (value: string) => {
  emit('update:modelValue', value)
  close()
}

const onClickOutside = (e: MouseEvent) => {
  if (!rootEl.value) return
  if (!rootEl.value.contains(e.target as Node)) close()
}

onMounted(() => document.addEventListener('mousedown', onClickOutside))
onUnmounted(() => document.removeEventListener('mousedown', onClickOutside))
</script>

<template>
  <div ref="rootEl" class="op-select" :class="{ 'is-open': isOpen }">
    <button
      type="button"
      class="op-trigger"
      :class="{ 'has-value': !!modelValue }"
      @click="toggle"
    >
      <span class="op-text">
        {{ selectedLabel || placeholder || '請選擇' }}
      </span>
      <svg class="op-chevron" viewBox="0 0 24 24" width="14" height="14">
        <path
          d="M6 9l6 6 6-6"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>

    <Transition name="op-pop">
      <div v-if="isOpen" class="op-panel">
        <div v-if="options.length === 0" class="op-empty">沒有可選項目</div>
        <button
          v-for="opt in options"
          :key="opt.value"
          type="button"
          class="op-option"
          :class="{ 'is-selected': opt.value === modelValue }"
          @click="choose(opt.value)"
        >
          <span class="op-option-label">{{ opt.label }}</span>
          <svg
            v-if="opt.value === modelValue"
            class="op-check"
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
.op-select {
  position: relative;
  width: 100%;
}

.op-trigger {
  width: 100%;
  height: 42px;
  padding: 0 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: #0f111a;
  border: 1px solid #2e3147;
  border-radius: 10px;
  color: #475569;
  font-size: 0.95rem;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  outline: none;
  box-sizing: border-box;
  transition: all 0.15s;
  font-family: inherit;
}
.op-trigger.has-value {
  color: #fff;
  font-weight: 600;
}
.op-trigger:hover {
  border-color: #3a3f5c;
}
.op-select.is-open .op-trigger {
  border-color: var(--c-light);
  box-shadow: 0 0 0 3px rgba(var(--c-light-rgb), 0.15);
}

.op-text {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.op-chevron {
  color: var(--c-light);
  flex-shrink: 0;
  transition: transform 0.22s ease;
}
.op-select.is-open .op-chevron {
  transform: rotate(180deg);
}

.op-panel {
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
.op-panel::-webkit-scrollbar {
  width: 6px;
}
.op-panel::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 999px;
}

.op-empty {
  padding: 14px;
  color: #64748b;
  font-size: 0.85rem;
  text-align: center;
}

.op-option {
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
  transition:
    background 0.12s,
    color 0.12s;
}
.op-option:hover {
  background: rgba(var(--c-light-rgb), 0.08);
  color: #fff;
}
.op-option.is-selected {
  background: rgba(var(--c-light-rgb), 0.14);
  color: var(--c-light);
  font-weight: 700;
}
.op-check {
  color: var(--c-light);
  flex-shrink: 0;
}
.op-option-label {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.op-pop-enter-active,
.op-pop-leave-active {
  transition:
    opacity 0.16s,
    transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}
.op-pop-enter-from,
.op-pop-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
