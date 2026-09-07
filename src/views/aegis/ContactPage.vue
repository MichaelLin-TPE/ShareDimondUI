<script setup lang="ts">
import AgPage from './ui/AgPage.vue'
import { AG_SITE } from './nav'
</script>

<template>
  <AgPage eyebrow="CONTACT // 聯絡客服" title="有事直接找人。" sub="客戶端取得、帳號問題、回報 bug。">
    <section class="ag-section">
      <div class="ag-wrap">
        <div class="ag-row2 ct">
          <div class="l">
            <div class="qr"><img :src="AG_SITE.lineQr" alt="加入 LINE 官方帳號" /></div>
          </div>
          <div class="r">
            <div class="ag-cap ember">LINE 官方帳號</div>
            <p class="ag-body">掃描 QR code 加入,客戶端下載連結、登入問題、遊戲內回報都在這裡處理。</p>
            <p class="ag-body">回報 bug 時請附:角色名、發生時間、當時在做什麼。有截圖更快。</p>
            <RouterLink class="ag-btn" to="/aegis/play">回到進場說明</RouterLink>
          </div>
        </div>
      </div>
    </section>
  </AgPage>
</template>

<style scoped>
.ct { align-items: flex-start; }
.qr { width: 200px; padding: 12px; border: 1px solid var(--ag-line-soft); background: #fff; }
.qr img { display: block; width: 100%; height: auto; }
.r .ag-btn { align-self: flex-start; margin-top: 8px; }
</style>
