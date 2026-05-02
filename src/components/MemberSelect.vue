<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

interface Member {
  memberId: number
  memberName: string
  memberRole: string
}

const props = defineProps<{
  modelValue: number | string
  members: Member[]
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number | string]
}>()

const isOpen = ref(false)
const rootEl = ref<HTMLElement | null>(null)

const selected = computed(() => {
  if (props.modelValue === '' || props.modelValue == null) return null
  return (
    props.members.find((m) => String(m.memberId) === String(props.modelValue)) ?? null
  )
})

const toggle = () => {
  isOpen.value = !isOpen.value
}
const close = () => {
  isOpen.value = false
}
const selectMember = (id: number) => {
  emit('update:modelValue', id)
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
  <div ref="rootEl" class="ms-select" :class="{ 'is-open': isOpen }">
    <button
      type="button"
      class="ms-trigger"
      :class="{ 'has-value': !!selected }"
      @click="toggle"
    >
      <span class="ms-text">
        <template v-if="selected">
          <span class="ms-name">{{ selected.memberName }}</span>
          <span class="ms-role">{{ selected.memberRole }}</span>
        </template>
        <template v-else>
          {{ placeholder || '選擇成員' }}
        </template>
      </span>
      <svg class="ms-chevron" viewBox="0 0 24 24" width="14" height="14">
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

    <Transition name="ms-pop">
      <div v-if="isOpen" class="ms-panel">
        <div v-if="members.length === 0" class="ms-empty">尚無成員資料</div>
        <button
          v-for="m in members"
          :key="m.memberId"
          type="button"
          class="ms-option"
          :class="{ 'is-selected': String(m.memberId) === String(modelValue) }"
          @click="selectMember(m.memberId)"
        >
          <span class="ms-option-name">{{ m.memberName }}</span>
          <span class="ms-option-role">{{ m.memberRole }}</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.ms-select {
  position: relative;
  width: 100%;
}

.ms-trigger {
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
.ms-trigger.has-value {
  color: #fff;
}
.ms-trigger:hover {
  border-color: #3a3f5c;
}
.ms-select.is-open .ms-trigger {
  border-color: var(--c-light);
  box-shadow: 0 0 0 3px rgba(var(--c-light-rgb), 0.15);
}

.ms-text {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ms-name {
  font-weight: 600;
}
.ms-role {
  display: inline-block;
  padding: 1px 8px;
  background: rgba(var(--c-light-rgb), 0.12);
  color: var(--c-light);
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
}

.ms-chevron {
  color: var(--c-light);
  flex-shrink: 0;
  transition: transform 0.22s ease;
}
.ms-select.is-open .ms-chevron {
  transform: rotate(180deg);
}

.ms-panel {
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
.ms-panel::-webkit-scrollbar {
  width: 6px;
}
.ms-panel::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 999px;
}

.ms-empty {
  padding: 14px;
  color: #64748b;
  font-size: 0.85rem;
  text-align: center;
}

.ms-option {
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
  transition:
    background 0.12s,
    color 0.12s;
}
.ms-option:hover {
  background: rgba(var(--c-light-rgb), 0.08);
  color: #fff;
}
.ms-option.is-selected {
  background: rgba(var(--c-light-rgb), 0.14);
  color: var(--c-light);
  font-weight: 700;
}
.ms-option-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ms-option-role {
  flex: 0 0 auto;
  font-size: 0.78rem;
  color: #94a3b8;
  font-weight: 600;
  padding: 1px 7px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 999px;
}
.ms-option.is-selected .ms-option-role {
  background: rgba(var(--c-light-rgb), 0.2);
  color: var(--c-light);
}

.ms-pop-enter-active,
.ms-pop-leave-active {
  transition:
    opacity 0.16s,
    transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}
.ms-pop-enter-from,
.ms-pop-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
