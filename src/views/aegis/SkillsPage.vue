<script setup lang="ts">
import { computed, ref } from 'vue'
import AgPage from './ui/AgPage.vue'
import { AG_SKILLS, AG_SKILL_TABS, type AgClassKey } from '@/data/aegis/skills'

const tab = ref<AgClassKey>('all')
const q = ref('')
const rows = computed(() => {
  const k = q.value.trim()
  return AG_SKILLS.filter((s) => (k ? s.name.includes(k) || s.effect.includes(k) : s.cls === tab.value))
})
const note = computed(() => AG_SKILL_TABS.find((t) => t.key === tab.value)?.note ?? '')

// 平衡算法(數值對應伺服器設定,改設定時記得同步這裡)
const BALANCE = [
  {
    idx: '01',
    who: '騎士',
    name: '衝擊之暈',
    formula: '命中率 = 50% + (你的等級 − 目標等級) × 1% − 目標的抗暈裝備',
    cap: '只看等級差和抗暈裝備,智力、魔法命中裝、目標抗魔都不影響。',
    lines: ['同等級對手:50%', '高對手 10 級:60%,低 10 級:40%', '等級差每 1 級就是 1%,沒有硬上限', '暈眩 2～6 秒,冷卻 6 秒'],
  },
  {
    idx: '02',
    who: '妖精',
    name: '精靈魔法減益',
    formula: '命中率 = 技能基礎值 + (你的等級 − 目標等級)',
    cap: '純等級命中,智力、抗魔、魔法命中裝都不看。',
    lines: ['風之枷鎖、地面障礙:35% + 等級差', '弱化屬性、魔法消除、大地屏障、封印禁地、污濁之水、精準射擊:50% + 等級差', '釋放元素例外:骰面 ÷ 10 × 等級差 + 50% − 對方抗魔 ÷ 10', '黑妖的暗黑盲咒、破壞盔甲同一套:40% + 等級差'],
  },
  {
    idx: '03',
    who: '法師',
    name: '負面魔法',
    formula: '強力控制:命中率 = 骰面 ÷ 10 × 等級差 + 技能基礎值 + 智力命中 + 魔法命中裝備 + 20 − 目標抗魔 ÷ 10',
    cap: '木乃伊、沉睡之霧、冰矛圍籬、魔法封印、藥水霜化、緩速、壞物、魔力奪取、魔法相消 這九招是強力控制。闇盲、毒咒、弱化、疾病、黑闇之影、迷魅走弱減益:魔法骰(最多 5 顆)+ 智力命中 + 魔法命中裝 − 抗魔 ÷ 10。',
    lines: ['強控固定 +20%', '木乃伊:基礎 20%,骰面 10', '沉睡之霧:基礎 15%,骰面 8', '弱減益骰數 = 魔法等級(每 4 級 +1),上限 5 顆'],
  },
]
</script>

<template>
  <AgPage eyebrow="SKILLS // 技能介紹" title="技能表。" sub="等級、耗魔、冷卻、效果。" lead="五個職業的魔法與技能,資料直接對伺服器,效果用玩家看得懂的方式寫。">
    <section class="ag-section">
      <div class="ag-wrap">
        <div class="bar">
          <div class="ag-tabs">
            <button v-for="t in AG_SKILL_TABS" :key="t.key" type="button" class="ag-tab" :class="{ on: tab === t.key && !q }" @click="tab = t.key; q = ''">{{ t.label }}</button>
          </div>
          <label class="ag-search"><span class="ic">⌕</span><input v-model="q" placeholder="搜尋技能或效果" /></label>
        </div>
        <p v-if="!q" class="note">{{ note }}</p>
        <div class="ag-table-wrap">
          <table class="ag-table">
            <thead><tr><th>Lv</th><th>技能</th><th>階級</th><th>類型</th><th>MP</th><th>冷卻</th><th>效果</th></tr></thead>
            <tbody>
              <tr v-for="s in rows" :key="s.cls + s.name">
                <td class="num">{{ s.level }}</td>
                <td class="name">{{ s.name }}</td>
                <td class="tier">{{ s.tier }}</td>
                <td><span class="tag" :class="{ ember: s.type === '攻擊', debuff: s.type === '減益' }">{{ s.type }}</span></td>
                <td class="num">{{ s.mp }}</td>
                <td class="num">{{ s.cooldown }}</td>
                <td>{{ s.effect }}</td>
              </tr>
              <tr v-if="!rows.length"><td colspan="7" class="empty">沒有符合的技能</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section class="ag-section balance">
      <div class="ag-wrap">
        <div class="ag-sec-head">
          <div>
            <div class="idx">BALANCE // 平衡算法</div>
            <h2>減益命中怎麼算。<span class="thin">公式與伺服器一致。</span></h2>
          </div>
          <p class="sub">三種職業的控制與減益技能,命中率算法如下。</p>
        </div>
        <div class="ag-grid c3">
          <article v-for="b in BALANCE" :key="b.idx" class="ag-card bal">
            <div class="ci">{{ b.idx }} · {{ b.who }}</div>
            <h3>{{ b.name }}</h3>
            <div class="formula">{{ b.formula }}</div>
            <p>{{ b.cap }}</p>
            <ul>
              <li v-for="l in b.lines" :key="l">{{ l }}</li>
            </ul>
          </article>
        </div>
        <div class="common">
          <div class="ag-line soft"></div>
          <div class="cg">
            <div><b>智力命中</b>智力 22 以下 +0;從 23 開始每 3 點智力 +1% 命中。只有法師的負面魔法吃這個,衝暈、精靈魔法、暗黑魔法都不看。</div>
            <div><b>抗魔</b>法師的負面魔法扣「目標抗魔 ÷ 10」;衝暈、精靈魔法、暗黑魔法不看抗魔。</div>
            <div><b>命中判定</b>系統每次擲 1～100 的骰,算出來的命中率大於等於骰值就中;所以 50% 就是真的一半一半。</div>
            <div><b>抗性裝備</b>抗暈、抗冰、抗睡、抗定身四種抗性分別只對應自己那類技能,互不通用。</div>
          </div>
        </div>
      </div>
    </section>
  </AgPage>
</template>

<style scoped>
.bar { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; flex-wrap: wrap; }
.bar .ag-tabs { flex: 1; margin-bottom: 0; }
.bar .ag-search { margin-bottom: 8px; }
.note { margin-top: 16px; font-size: 15px; color: var(--ag-ink-60); line-height: 1.7; }
.ag-table-wrap { margin-top: 18px; }
.tier { font-size: 13px; color: var(--ag-ink-50); letter-spacing: 0.04em; white-space: nowrap; }
.tag.debuff { color: #c9a0ff; border-color: rgba(201, 160, 255, 0.35); }
.empty { color: var(--ag-ink-35); text-align: center; padding: 30px; }

.balance .ag-sec-head .sub { max-width: 380px; font-size: 15px; line-height: 1.7; color: var(--ag-ink-60); }
.bal { min-height: 0; display: flex; flex-direction: column; gap: 12px; }
.bal h3 { margin-bottom: 0; }
.bal .formula { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 14px; line-height: 1.7; color: var(--ag-ember); background: rgba(255, 122, 26, 0.06); border-left: 2px solid var(--ag-ember); padding: 10px 12px; }
.bal ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 6px; }
.bal li { font-size: 15px; color: var(--ag-ink); padding-left: 14px; position: relative; }
.bal li::before { content: ''; position: absolute; left: 0; top: 9px; width: 6px; height: 1px; background: var(--ag-ember); }
.common { margin-top: 28px; }
.common .cg { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px 40px; padding-top: 22px; }
.common .cg div { font-size: 15px; line-height: 1.7; color: var(--ag-ink-60); }
.common .cg b { display: block; font-weight: 500; color: var(--ag-ink); margin-bottom: 2px; }
@media (max-width: 900px) {
  .ag-grid.c3 { grid-template-columns: 1fr; }
  .common .cg { grid-template-columns: 1fr; }
}
</style>
