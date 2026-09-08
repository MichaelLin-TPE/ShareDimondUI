<script setup lang="ts">
import AgPage from './ui/AgPage.vue'
import { AG_SITE } from './nav'

const steps = [
  { n: '01', t: '下載 AEGIS 登入器', d: '從下方按鈕取得最新版壓縮檔,約 0.3 MB。' },
  { n: '02', t: '解壓到客戶端資料夾', d: '解壓到你的天堂資料夾(跟 Login.exe 同一層)。沒有客戶端?找客服拿。' },
  { n: '03', t: '執行 MyLauncher.exe', d: '啟動時自動檢查更新,更新完直接進登入畫面。第一次請以系統管理員身分開啟。' },
]
</script>

<template>
  <AgPage eyebrow="PLAY // 進場" title="門開著。" sub="三步驟,回到天堂。" lead="登入器自己會更新,常用輔助都內建,不用再裝一堆外掛。">
    <section class="ag-section">
      <div class="ag-wrap">
        <div class="ag-grid c3">
          <div v-for="s in steps" :key="s.n" class="ag-card">
            <div class="ci">// STEP {{ s.n }}</div>
            <h3>{{ s.t }}</h3>
            <p>{{ s.d }}</p>
          </div>
        </div>
        <div class="dl">
          <a class="ag-btn primary" :href="AG_SITE.downloadUrl" target="_blank" rel="noopener">下載 AEGIS 登入器 <span class="arr">↓</span></a>
          <RouterLink class="ag-btn" to="/aegis/contact">客戶端取得 · 聯絡客服</RouterLink>
        </div>
        <p class="ag-cap note">系統需求:Windows 10 / 11 · 顯示傷害覆蓋層需要系統管理員權限</p>
      </div>
    </section>
  </AgPage>
</template>

<style scoped>
.dl { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 36px; }
.note { margin-top: 22px; color: var(--ag-ink-35); }
</style>
