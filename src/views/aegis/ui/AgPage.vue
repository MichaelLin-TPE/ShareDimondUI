<script setup lang="ts">
// 子頁外框:頂部標題帶(小標 / 兩行標題 / 導言 / hairline)+ 內容 slot。
defineProps<{ eyebrow: string; title: string; sub?: string; lead?: string }>()
</script>

<template>
  <div class="ag-page">
    <section class="ag-band">
      <div class="ag-wrap">
        <div class="ag-cap ember ag-anim" style="--d: 0.05s">{{ eyebrow }}</div>
        <h1 class="ag-h ag-anim" style="--d: 0.15s; --y: 24px">
          {{ title }}
          <span v-if="sub" class="thin">{{ sub }}</span>
        </h1>
        <p v-if="lead" class="ag-body ag-lead ag-anim" style="--d: 0.3s">{{ lead }}</p>
        <div class="ag-line ag-anim grow" style="--d: 0.4s"></div>
      </div>
    </section>
    <slot />
  </div>
</template>

<style scoped>
.ag-page { min-height: 70vh; }
</style>
