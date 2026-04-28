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
  color: #ffd166;
  text-shadow:
    0 0 12px rgba(245, 196, 81, 0.5),
    0 2px 16px rgba(245, 158, 11, 0.3);
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
