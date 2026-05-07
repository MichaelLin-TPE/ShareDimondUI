<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.ts'
import { generateSignature } from '@/utils/SignTools.ts'
import { useAlert } from '@/utils/alerts.ts'

const authStore = useAuthStore()

interface FaqItem {
  id: number
  scope: string
  clanId: string | null
  category: string | null
  title: string
  content: string
  tags: string | null
  sortOrder: number
  enabled: boolean
  createdAt: string
  updatedAt: string
}

const items = ref<FaqItem[]>([])
const loading = ref(false)
const searchQuery = ref('')
const expanded = reactive<Record<number, boolean>>({})

// === 新增 / 編輯 modal 狀態 ===
const modalOpen = ref(false)
const editingId = ref<number | null>(null)
const form = reactive({
  category: '機制',
  title: '',
  content: '',
  tags: '',
  sortOrder: 0,
  enabled: true,
})

const CATEGORIES = ['機制', '道具', 'Boss', '公會規則', '系統教學', '其他']

const headers = (): Record<string, string> => {
  const ts = Math.floor(Date.now() / 1000).toString()
  return {
    Authorization: `Bearer ${authStore.authToken}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Sign: generateSignature(ts),
    TimeStamp: ts,
  }
}

const fetchList = async () => {
  loading.value = true
  try {
    const res = await fetch('https://api.gameshare-system.com/faq', {
      headers: headers(),
    })
    const data = await res.json()
    if (!res.ok) {
      useAlert.error(data.message ?? '取得 FAQ 失敗')
      items.value = []
      return
    }
    items.value = data
  } catch (e) {
    console.error(e)
    useAlert.error('連線失敗')
  } finally {
    loading.value = false
  }
}

const filteredItems = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return items.value
  return items.value.filter(
    (it) =>
      it.title.toLowerCase().includes(q) ||
      (it.content ?? '').toLowerCase().includes(q) ||
      (it.category ?? '').toLowerCase().includes(q) ||
      (it.tags ?? '').toLowerCase().includes(q),
  )
})

// 按分類分組顯示
const groupedItems = computed(() => {
  const map = new Map<string, FaqItem[]>()
  for (const it of filteredItems.value) {
    const cat = it.category ?? '其他'
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat)!.push(it)
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
})

const resetForm = () => {
  form.category = '機制'
  form.title = ''
  form.content = ''
  form.tags = ''
  form.sortOrder = 0
  form.enabled = true
  editingId.value = null
}

const openNew = () => {
  resetForm()
  modalOpen.value = true
}

const openEdit = (it: FaqItem) => {
  form.category = it.category ?? '機制'
  form.title = it.title
  form.content = it.content
  form.tags = it.tags ?? ''
  form.sortOrder = it.sortOrder ?? 0
  form.enabled = it.enabled
  editingId.value = it.id
  modalOpen.value = true
}

const closeModal = () => {
  modalOpen.value = false
}

const saveForm = async () => {
  if (!form.title.trim()) {
    useAlert.error('標題必填')
    return
  }
  if (!form.content.trim()) {
    useAlert.error('內容必填')
    return
  }
  const body = JSON.stringify({
    category: form.category,
    title: form.title,
    content: form.content,
    tags: form.tags || null,
    sortOrder: form.sortOrder,
    enabled: form.enabled,
  })
  try {
    const url = editingId.value
      ? `https://api.gameshare-system.com/faq/${editingId.value}`
      : 'https://api.gameshare-system.com/faq'
    const method = editingId.value ? 'PUT' : 'POST'
    const res = await fetch(url, { method, headers: headers(), body })
    const data = await res.json()
    if (!res.ok) {
      useAlert.error(data.message ?? '儲存失敗')
      return
    }
    useAlert.success(editingId.value ? '已更新' : '已新增')
    closeModal()
    await fetchList()
  } catch (e) {
    console.error(e)
    useAlert.error('連線失敗')
  }
}

const deleteItem = async (it: FaqItem) => {
  if (!confirm(`確定刪除「${it.title}」?`)) return
  try {
    const res = await fetch(`https://api.gameshare-system.com/faq/${it.id}`, {
      method: 'DELETE',
      headers: headers(),
    })
    const data = await res.json()
    if (!res.ok) {
      useAlert.error(data.message ?? '刪除失敗')
      return
    }
    useAlert.success('已刪除')
    await fetchList()
  } catch (e) {
    console.error(e)
    useAlert.error('連線失敗')
  }
}

const toggle = (id: number) => {
  expanded[id] = !expanded[id]
}

onMounted(() => {
  fetchList()
})
</script>

<template>
  <div class="faq-page">
    <!-- 標題 -->
    <header class="faq-head">
      <div class="head-text">
        <h2 class="faq-title">📚 FAQ 管理</h2>
        <p class="faq-sub">本公會專屬 · 共 {{ items.length }} 條</p>
      </div>
      <button type="button" class="head-add-btn" @click="openNew">
        ＋ 新增 FAQ
      </button>
    </header>

    <!-- 搜尋 -->
    <div class="filter-section">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="🔍 搜尋標題 / 內容 / 分類 / tags..."
        class="search-input"
      />
    </div>

    <!-- 列表 -->
    <div class="faq-grid">
      <div v-if="loading" class="state-card">
        <div class="state-icon">⏳</div>
        載入中...
      </div>
      <div v-else-if="filteredItems.length === 0" class="state-card">
        <div class="state-icon">📂</div>
        {{ items.length === 0 ? '還沒有 FAQ,點右上「新增」開始吧' : '找不到符合條件的 FAQ' }}
      </div>
      <template v-else>
        <div v-for="[cat, list] in groupedItems" :key="cat" class="cat-group">
          <div class="cat-header">{{ cat }}（{{ list.length }}）</div>
          <div
            v-for="it in list"
            :key="it.id"
            class="faq-card"
            :class="{ 'is-disabled': !it.enabled }"
          >
            <div class="card-head">
              <span class="card-title">{{ it.title }}</span>
              <span v-if="!it.enabled" class="badge-disabled">停用</span>
              <div class="card-actions">
                <button type="button" class="card-act-btn" @click="openEdit(it)">編輯</button>
                <button
                  type="button"
                  class="card-act-btn card-act-del"
                  @click="deleteItem(it)"
                >刪除</button>
              </div>
            </div>
            <div class="card-content">
              <div class="card-content-text" :class="{ 'is-clamped': !expanded[it.id] }">
                {{ it.content }}
              </div>
            </div>
            <div v-if="it.tags" class="card-tags">
              <span v-for="t in it.tags.split(',')" :key="t" class="tag-chip">#{{ t.trim() }}</span>
            </div>
            <button
              v-if="it.content && it.content.length > 80"
              type="button"
              class="card-toggle"
              @click="toggle(it.id)"
            >
              {{ expanded[it.id] ? '收起 ▲' : '展開全文 ▼' }}
            </button>
          </div>
        </div>
      </template>
    </div>

    <!-- 新增 / 編輯 Modal -->
    <div v-if="modalOpen" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-head">
          <h3 class="modal-title">
            {{ editingId ? '編輯 FAQ' : '新增 FAQ' }}
          </h3>
          <button type="button" class="modal-close" @click="closeModal">✕</button>
        </div>

        <div class="modal-body">
          <label class="field">
            <span class="field-label">分類</span>
            <select v-model="form.category" class="field-select">
              <option v-for="c in CATEGORIES" :key="c" :value="c">{{ c }}</option>
            </select>
          </label>

          <label class="field">
            <span class="field-label">標題 <span class="required">*</span></span>
            <input v-model="form.title" type="text" class="field-input" placeholder="例: 地龍多久重生" />
          </label>

          <label class="field">
            <span class="field-label">內容（支援 Markdown） <span class="required">*</span></span>
            <textarea
              v-model="form.content"
              class="field-textarea"
              rows="8"
              placeholder="例: 地龍重生時間 22-26 小時。首殺後通知公會頻道。"
            />
          </label>

          <label class="field">
            <span class="field-label">Tags（逗號分隔,可選）</span>
            <input v-model="form.tags" type="text" class="field-input" placeholder="例: 天堂W,血盟戰,Boss" />
          </label>

          <div class="field-row">
            <label class="field field-half">
              <span class="field-label">排序</span>
              <input v-model.number="form.sortOrder" type="number" class="field-input" />
            </label>
            <label class="field field-half">
              <span class="field-label">啟用</span>
              <div class="enable-toggle">
                <button
                  type="button"
                  class="enable-btn"
                  :class="{ 'is-on': form.enabled }"
                  @click="form.enabled = !form.enabled"
                >
                  {{ form.enabled ? '✅ 啟用中' : '⏸ 停用' }}
                </button>
              </div>
            </label>
          </div>
        </div>

        <div class="modal-foot">
          <button type="button" class="modal-btn modal-btn-cancel" @click="closeModal">取消</button>
          <button type="button" class="modal-btn modal-btn-save" @click="saveForm">
            {{ editingId ? '儲存變更' : '建立' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.faq-page {
  padding: 20px;
  background-color: #0b0d14;
  color: #ffffff;
  min-height: 100%;
  font-family: 'Helvetica Neue', Arial, sans-serif;
  box-sizing: border-box;
}

/* === 標題 === */
.faq-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
  padding-left: 48px;
  min-height: 42px;
}
.head-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.faq-title {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 800;
  color: #e2e8f0;
  letter-spacing: 0.3px;
  line-height: 1.2;
}
.faq-sub {
  margin: 4px 0 0;
  font-size: 0.78rem;
  color: #64748b;
  line-height: 1.2;
}
.head-add-btn {
  flex-shrink: 0;
  height: 38px;
  padding: 0 16px;
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  color: var(--c-on);
  border: none;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 800;
  cursor: pointer;
  transition: transform 0.1s;
  font-family: inherit;
  appearance: none;
  -webkit-appearance: none;
  line-height: 1;
  box-shadow: 0 2px 8px rgba(var(--c-deep-rgb), 0.35);
}
.head-add-btn:hover {
  transform: translateY(-1px);
}

/* === 搜尋 === */
.filter-section {
  margin-bottom: 16px;
}
.search-input {
  width: 100%;
  height: 42px;
  padding: 0 16px;
  background: #0f111a;
  border: 1px solid #2e3147;
  border-radius: 10px;
  color: #fff;
  font-size: 0.95rem;
  outline: none;
  box-sizing: border-box;
  line-height: 1;
  transition: all 0.15s;
}
.search-input::placeholder {
  color: #475569;
}
.search-input:focus {
  border-color: var(--c-light);
  box-shadow: 0 0 0 3px rgba(var(--c-light-rgb), 0.15);
}

/* === 列表 === */
.faq-grid {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.cat-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cat-header {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--c-light);
  letter-spacing: 0.3px;
  padding: 4px 0 4px 4px;
  border-bottom: 1px dashed rgba(var(--c-light-rgb), 0.25);
  margin-bottom: 4px;
}
.faq-card {
  background: rgba(22, 24, 34, 0.95);
  border: 1px solid #24263a;
  border-left: 4px solid var(--c-light);
  border-radius: 12px;
  padding: 12px 14px;
  transition: transform 0.15s, box-shadow 0.15s;
  box-sizing: border-box;
}
.faq-card.is-disabled {
  opacity: 0.5;
  border-left-color: #475569;
}
.faq-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
}
.card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.card-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: #e2e8f0;
  flex: 1;
}
.badge-disabled {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 6px;
  background: rgba(71, 85, 105, 0.3);
  color: #94a3b8;
}
.card-actions {
  display: flex;
  gap: 6px;
}
.card-act-btn {
  height: 28px;
  padding: 0 10px;
  background: transparent;
  border: 1px solid #2e3147;
  color: #94a3b8;
  font-size: 0.75rem;
  border-radius: 6px;
  cursor: pointer;
  font-family: inherit;
  appearance: none;
  -webkit-appearance: none;
  line-height: 1;
  transition: all 0.15s;
}
.card-act-btn:hover {
  background: rgba(var(--c-light-rgb), 0.12);
  color: var(--c-light);
  border-color: rgba(var(--c-light-rgb), 0.4);
}
.card-act-del:hover {
  background: rgba(231, 76, 60, 0.18);
  color: #ff7066;
  border-color: rgba(231, 76, 60, 0.5);
}
.card-content {
  margin-bottom: 8px;
}
.card-content-text {
  font-size: 0.88rem;
  color: #cbd5e1;
  line-height: 1.55;
  white-space: pre-line;
}
.card-content-text.is-clamped {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}
.tag-chip {
  font-size: 0.72rem;
  color: #64748b;
  background: #0f111a;
  border: 1px solid #24263a;
  padding: 2px 8px;
  border-radius: 6px;
}
.card-toggle {
  display: block;
  width: 100%;
  margin-top: 4px;
  padding: 8px 0;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  color: #94a3b8;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  appearance: none;
  -webkit-appearance: none;
  transition: background 0.15s, color 0.15s;
}
.card-toggle:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--c-light);
}

/* === Empty / loading state === */
.state-card {
  text-align: center;
  padding: 60px 20px;
  color: #64748b;
  font-size: 0.95rem;
  background: rgba(22, 24, 34, 0.95);
  border-radius: 14px;
  border: 1px dashed #2e3147;
}
.state-icon {
  font-size: 32px;
  margin-bottom: 12px;
  opacity: 0.55;
}

/* === Modal === */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(3px);
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.modal {
  width: 100%;
  max-width: 560px;
  max-height: 90vh;
  background: #0f111a;
  border: 1px solid #2e3147;
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid #24263a;
}
.modal-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
  color: #e2e8f0;
}
.modal-close {
  width: 32px;
  height: 32px;
  background: transparent;
  border: 1px solid #2e3147;
  border-radius: 8px;
  color: #94a3b8;
  font-size: 0.85rem;
  cursor: pointer;
  font-family: inherit;
  appearance: none;
  -webkit-appearance: none;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-close:hover {
  background: #1f2233;
  color: #e2e8f0;
}
.modal-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field-label {
  font-size: 0.8rem;
  color: #94a3b8;
  font-weight: 600;
}
.required {
  color: #ff7066;
}
.field-input,
.field-select,
.field-textarea {
  width: 100%;
  padding: 10px 12px;
  background: #161822;
  border: 1px solid #2e3147;
  border-radius: 8px;
  color: #fff;
  font-size: 0.9rem;
  outline: none;
  box-sizing: border-box;
  font-family: inherit;
  transition: all 0.15s;
}
.field-input:focus,
.field-select:focus,
.field-textarea:focus {
  border-color: var(--c-light);
  box-shadow: 0 0 0 3px rgba(var(--c-light-rgb), 0.15);
}
.field-textarea {
  resize: vertical;
  min-height: 120px;
  line-height: 1.5;
}
.field-row {
  display: flex;
  gap: 10px;
}
.field-half {
  flex: 1 1 0;
}
.enable-toggle {
  height: 40px;
  display: flex;
  align-items: center;
}
.enable-btn {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  background: #161822;
  border: 1px solid #2e3147;
  color: #94a3b8;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  appearance: none;
  -webkit-appearance: none;
  line-height: 1;
  transition: all 0.15s;
}
.enable-btn.is-on {
  background: rgba(var(--c-light-rgb), 0.18);
  color: var(--c-light);
  border-color: rgba(var(--c-light-rgb), 0.5);
}
.modal-foot {
  display: flex;
  gap: 10px;
  padding: 14px 16px;
  border-top: 1px solid #24263a;
}
.modal-btn {
  flex: 1 1 0;
  height: 42px;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  appearance: none;
  -webkit-appearance: none;
  line-height: 1;
  transition: all 0.15s;
}
.modal-btn-cancel {
  background: transparent;
  border: 1px solid #2e3147;
  color: #94a3b8;
}
.modal-btn-cancel:hover {
  background: #1f2233;
  color: #e2e8f0;
}
.modal-btn-save {
  background: linear-gradient(135deg, var(--c-light), var(--c-deep));
  color: var(--c-on);
  border: none;
  font-weight: 800;
  box-shadow: 0 2px 8px rgba(var(--c-deep-rgb), 0.35);
}
.modal-btn-save:hover {
  transform: translateY(-1px);
}
</style>
