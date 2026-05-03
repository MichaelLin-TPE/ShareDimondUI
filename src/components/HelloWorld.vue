<script setup lang="ts">
defineProps<{
  msg: string
}>()
</script>

<template>
  <div class="greetings">
    <h1>{{ msg }}</h1>
    <h3>最專業的遊戲分紅系統</h3>
  </div>
</template>

<style scoped>
.greetings h1 {
  position: relative;
  top: -10px;
  margin: 0;
  font-size: 2.6rem;
  font-weight: 800;
  letter-spacing: 2px;
  color: var(--c-light);
  /* 暈光低調版 — 適用所有主題 (顏色仍為主題色) */
  text-shadow:
    0 0 6px rgba(var(--c-light-rgb), 0.45),
    0 0 16px rgba(var(--c-deep-rgb), 0.35);
}

/* 紫藍主題: 還原一個月前的「鑽石青 + 紫光」雙色霓虹效果 (暈光低調版) */
:root[data-theme='indigo'] .greetings h1 {
  color: #6cf2ff;
  text-shadow:
    0 0 6px rgba(108, 242, 255, 0.45),
    0 0 16px rgba(180, 110, 255, 0.35);
}

.greetings h3 {
  margin: 4px 0 0;
  font-size: 1rem;
  font-weight: 500;
  color: #94a3b8;
  letter-spacing: 1px;
}

.greetings h1,
.greetings h3 {
  text-align: center;
}

@media (min-width: 1024px) {
  .greetings h1,
  .greetings h3 {
    text-align: left;
  }
}
</style>
