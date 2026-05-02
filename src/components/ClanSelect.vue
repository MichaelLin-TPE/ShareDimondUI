<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

interface Clan {
  id: string | number
  name: string
  clanId: string
}

const props = defineProps<{
  modelValue: string
  clans: Clan[]
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const isOpen = ref(false)
const rootEl = ref<HTMLElement | null>(null)

const selectedName = computed(() => {
  if (!props.modelValue) return ''
  return props.clans.find((c) => c.clanId === props.modelValue)?.name ?? ''
})

const toggle = () => {
  isOpen.value = !isOpen.value
}
const close = () => {
  isOpen.value = false
}
const selectClan = (clanId: string) => {
  emit('update:modelValue', clanId)
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
  <div ref="rootEl" class="clan-select" :class="{ 'is-open': isOpen }">
    <button
      type="button"
      class="cs-trigger"
      :class="{ 'has-value': !!modelValue }"
      @click="toggle"
    >
      <span class="cs-text">
        {{ selectedName || placeholder || '選擇血盟' }}
      </span>
      <svg class="cs-chevron" viewBox="0 0 24 24" width="14" height="14">
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

    <Transition name="cs-pop">
      <div v-if="isOpen" class="cs-panel">
        <div v-if="clans.length === 0" class="cs-empty">尚無血盟資料</div>
        <button
          v-for="clan in clans"
          :key="clan.id"
          type="button"
          class="cs-option"
          :class="{ 'is-selected': clan.clanId === modelValue }"
          @click="selectClan(clan.clanId)"
        >
          <span class="cs-option-name">{{ clan.name }}</span>
          <svg
            v-if="clan.clanId === modelValue"
            class="cs-check"
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
.clan-select {
  position: relative;
  width: 100%;
}

/* === 觸發按鈕(看起來像 input) === */
.cs-trigger {
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
}
.cs-trigger.has-value {
  color: #fff;
  font-weight: 600;
}
.cs-trigger:hover {
  border-color: #3a3f5c;
}
.clan-select.is-open .cs-trigger {
  border-color: var(--c-light);
  box-shadow: 0 0 0 3px rgba(var(--c-light-rgb), 0.15);
}

.cs-text {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cs-chevron {
  color: var(--c-light);
  flex-shrink: 0;
  transition: transform 0.22s ease;
}
.clan-select.is-open .cs-chevron {
  transform: rotate(180deg);
}

/* === 下拉面板 === */
.cs-panel {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 50;
  max-height: 240px;
  overflow-x: hidden;
  overflow-y: auto;
  background: #14161f;
  border: 1px solid #2e3147;
  border-radius: 10px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6);
  padding: 0;
}
.cs-panel::-webkit-scrollbar {
  width: 6px;
}
.cs-panel::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 999px;
}

.cs-empty {
  padding: 12px 14px;
  color: #64748b;
  font-size: 0.85rem;
  text-align: center;
}

.cs-option {
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
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  transition:
    background 0.12s,
    color 0.12s;
}
.cs-option:hover {
  background: rgba(var(--c-light-rgb), 0.08);
  color: #fff;
}
.cs-option.is-selected {
  background: rgba(var(--c-light-rgb), 0.14);
  color: var(--c-light);
  font-weight: 700;
}
.cs-check {
  color: var(--c-light);
  flex-shrink: 0;
}

.cs-option-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 展開動畫 */
.cs-pop-enter-active,
.cs-pop-leave-active {
  transition:
    opacity 0.16s,
    transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}
.cs-pop-enter-from,
.cs-pop-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
