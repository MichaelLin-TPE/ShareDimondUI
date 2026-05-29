<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import SearchableSelect from '@/components/SearchableSelect.vue'
import { useSharedListsStore } from '@/stores/sharedLists.ts'
import {
  REMARK_WAREHOUSE,
  REMARK_ON_ME,
  buildGiveRemark,
  parseRemark,
  type RemarkChoice,
} from '@/composables/remarkOptions.ts'

const props = defineProps<{
  modelValue: boolean
  /** 目前的備註,開啟時用來預選 */
  current?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: [remark: string]
}>()

const sharedLists = useSharedListsStore()
const memberOptions = computed(() =>
  sharedLists.members.map((m) => ({ value: m.memberName, label: m.memberName })),
)

const choice = ref<RemarkChoice>('onme')
const giveMember = ref('')

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    sharedLists.loadMembers()
    const parsed = parseRemark(props.current)
    choice.value = parsed.choice
    giveMember.value = parsed.memberName
  },
  { immediate: true },
)

const canConfirm = computed(() => choice.value !== 'give' || !!giveMember.value)

const close = () => emit('update:modelValue', false)

const confirm = () => {
  if (!canConfirm.value) return
  let remark = REMARK_ON_ME
  if (choice.value === 'warehouse') remark = REMARK_WAREHOUSE
  else if (choice.value === 'give') remark = buildGiveRemark(giveMember.value)
  emit('confirm', remark)
  close()
}
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="rp-modal">
      <div class="rp-mask" @click="close"></div>
      <div class="rp-panel" role="dialog">
        <button class="rp-close" type="button" @click="close">×</button>
        <div class="rp-head">
          <h2>更新備註</h2>
          <p>選擇道具目前的去向</p>
        </div>

        <div class="rp-options">
          <label class="rp-chip">
            <input type="radio" value="warehouse" v-model="choice" name="rp-choice" />
            <span>🏰 已繳倉庫</span>
          </label>
          <label class="rp-chip">
            <input type="radio" value="onme" v-model="choice" name="rp-choice" />
            <span>🧍 在我身上</span>
          </label>
          <label class="rp-chip">
            <input type="radio" value="give" v-model="choice" name="rp-choice" />
            <span>🎁 道具給 XXX 了</span>
          </label>
        </div>

        <div v-if="choice === 'give'" class="rp-give">
          <label class="rp-give-label">選擇收到道具的會員</label>
          <SearchableSelect
            v-model="giveMember"
            :options="memberOptions"
            placeholder="輸入關鍵字搜尋會員..."
          />
        </div>

        <div class="rp-actions">
          <button type="button" class="rp-btn rp-btn--cancel" @click="close">取消</button>
          <button
            type="button"
            class="rp-btn rp-btn--submit"
            :disabled="!canConfirm"
            @click="confirm"
          >
            確認更新
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.rp-modal {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  box-sizing: border-box;
}
.rp-mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.72);
}
.rp-panel {
  position: relative;
  background: #1a1f2e;
  border: 1px solid #334155;
  border-radius: 16px;
  width: 100%;
  max-width: 420px;
  max-height: 92vh;
  overflow-y: auto;
  padding: 28px 24px 24px;
  color: #f1f5f9;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
  box-sizing: border-box;
}
.rp-close {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  border-radius: 8px;
  transition: color 0.15s, background 0.15s;
}
.rp-close:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #f1f5f9;
}
.rp-head {
  text-align: center;
  margin-bottom: 18px;
}
.rp-head h2 {
  margin: 0 0 4px;
  font-size: 1.3rem;
  color: #f8fafc;
  font-weight: 700;
}
.rp-head p {
  margin: 0;
  font-size: 0.82rem;
  color: #64748b;
}

/* 選項 chips — 抄 .ot-chip 視覺 (同產品線) */
.rp-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rp-chip {
  cursor: pointer;
}
.rp-chip input {
  display: none;
}
.rp-chip span {
  display: block;
  background: #0f172a;
  border: 1px solid #334155;
  padding: 12px 14px;
  border-radius: 10px;
  text-align: center;
  font-size: 0.95rem;
  color: #94a3b8;
  transition: all 0.12s;
}
.rp-chip input:checked + span {
  border-color: var(--c-light);
  background: rgba(var(--c-light-rgb), 0.12);
  color: #fff;
  font-weight: 700;
}

.rp-give {
  margin-top: 14px;
}
.rp-give-label {
  display: block;
  font-size: 0.82rem;
  color: #94a3b8;
  margin-bottom: 6px;
  font-weight: 600;
}

.rp-actions {
  display: flex;
  gap: 10px;
  margin-top: 22px;
}
.rp-btn {
  border: none;
  padding: 12px;
  border-radius: 10px;
  font-weight: bold;
  font-size: 0.95rem;
  cursor: pointer;
  transition: filter 0.15s, opacity 0.15s;
  font-family: inherit;
}
.rp-btn--cancel {
  flex: 1;
  background: #334155;
  color: #f1f5f9;
}
.rp-btn--cancel:hover {
  background: #475569;
}
.rp-btn--submit {
  flex: 2;
  background: linear-gradient(135deg, var(--c-mid), var(--c-deep));
  color: var(--c-on);
}
.rp-btn--submit:hover:not(:disabled) {
  filter: brightness(1.08);
}
.rp-btn--submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
