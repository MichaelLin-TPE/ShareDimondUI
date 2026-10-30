// 技能介紹:只列各職業的高階技能與本服自改的技能(資料對伺服器 skills 表,效果為玩家版說明)。
// 範圍:王族 40 級以上、騎士 50 / 60 級、精靈魔法 5～6 階、法師 8～10 階、暗黑魔法 2 階,加上五個 60 級首創技能(滅世龍掉落)。
// custom = 本服首創或自改的技能(頁面標「首創」;使用者 10-30:不要寫「本服調整」、不要提天堂 W)。普通低階魔法不列。
export type AgClassKey = 'royal' | 'knight' | 'elf' | 'wizard' | 'darkelf'

export interface AgSkill {
  name: string
  cls: AgClassKey
  level: number
  mp: number
  cooldown: string
  type: '攻擊' | '輔助' | '治癒' | '減益'
  effect: string
  tier: string
  custom?: boolean
}

export const AG_SKILL_TABS: { key: AgClassKey; label: string; note: string }[] = [
  { key: 'royal', label: '君主', note: '40 級以上的血盟光環技能。灼熱武器、閃亮之盾、勇猛意志是本服首創的強化版;帝國反擊 60 級首創技能,滅世龍掉落。' },
  { key: 'knight', label: '騎士', note: '50 / 60 級技能。衝擊之暈的命中公式見下方「平衡算法」;龍嘯 60 級首創技能,滅世龍掉落。' },
  { key: 'elf', label: '妖精', note: '精靈魔法 5～6 階(45 / 50 級)。烈焰之魂是本服首創的強化版;精靈大師:精神 60 級首創技能,滅世龍掉落。' },
  { key: 'wizard', label: '法師', note: '8～10 階魔法(32 / 36 / 40 級)。寒冰尖刺是本服首創的 10 階攻擊魔法;時間靜止 60 級首創技能,滅世龍掉落。負面魔法命中公式見下方。' },
  { key: 'darkelf', label: '黑妖', note: '暗黑魔法 2 階(30 級)。暗影閃避:命運 60 級首創技能,滅世龍掉落。' },
]

export const AG_SKILLS: AgSkill[] = [
  { name: '灼熱武器', cls: 'royal', level: 40, mp: 40, cooldown: '—', type: '輔助', effect: '隊友武器傷害與命中提升（持續 640 秒）', custom: true, tier: '王族技能' },
  { name: '閃亮之盾', cls: 'royal', level: 45, mp: 40, cooldown: '—', type: '輔助', effect: '隊友 AC −8（持續 640 秒）', custom: true, tier: '王族技能' },
  { name: '勇猛意志', cls: 'royal', level: 50, mp: 40, cooldown: '—', type: '輔助', effect: '隊友 30% 機率造成 1.5 倍傷害（持續 640 秒）', custom: true, tier: '王族技能' },
  { name: '王者加護', cls: 'royal', level: 55, mp: 1, cooldown: '—', type: '輔助', effect: '王者加護狀態（持續 29 秒）', tier: '王族技能' },
  { name: '衝擊之暈', cls: 'knight', level: 50, mp: 15, cooldown: '6 秒', type: '減益', effect: '目標暈眩,無法行動 2～6 秒（持續 6 秒）', custom: true, tier: '騎士技能' },
  { name: '增幅防禦', cls: 'knight', level: 50, mp: 5, cooldown: '3 秒', type: '輔助', effect: '受到的物理傷害降低（持續 32 秒、消耗 HP 50）', tier: '騎士技能' },
  { name: '尖刺盔甲', cls: 'knight', level: 60, mp: 5, cooldown: '5 秒', type: '輔助', effect: '反彈近戰傷害（持續 64 秒、消耗 HP 120）', tier: '騎士技能' },
  { name: '堅固防護', cls: 'knight', level: 60, mp: 10, cooldown: '3 秒', type: '輔助', effect: 'AC 大幅提升（持續 64 秒、消耗 HP 100）', tier: '騎士技能' },
  { name: '反擊屏障', cls: 'knight', level: 60, mp: 10, cooldown: '3 秒', type: '輔助', effect: '反彈魔法傷害（持續 64 秒、消耗 HP 100）', tier: '騎士技能' },
  { name: '封印禁地', cls: 'elf', level: 45, mp: 40, cooldown: '9 秒', type: '減益', effect: '周圍敵人無法使用傳送（持續 16 秒）', tier: '精靈魔法 5 階' },
  { name: '召喚強力屬性精靈', cls: 'elf', level: 45, mp: 20, cooldown: '—', type: '輔助', effect: '召喚強力屬性精靈', tier: '精靈魔法 5 階' },
  { name: '烈炎武器', cls: 'elf', level: 45, mp: 30, cooldown: '—', type: '輔助', effect: '武器附加強力火屬性傷害（持續 960 秒）', tier: '精靈魔法 5 階' },
  { name: '生命的祝福', cls: 'elf', level: 45, mp: 30, cooldown: '0.5 秒', type: '治癒', effect: '回復大量 HP', tier: '精靈魔法 5 階' },
  { name: '生命呼喚', cls: 'elf', level: 45, mp: 50, cooldown: '—', type: '輔助', effect: '讓死者復活', tier: '精靈魔法 5 階' },
  { name: '暴風神射', cls: 'elf', level: 45, mp: 30, cooldown: '—', type: '輔助', effect: '弓箭傷害大幅提升（持續 960 秒）', tier: '精靈魔法 5 階' },
  { name: '風之枷鎖', cls: 'elf', level: 45, mp: 15, cooldown: '0.5 秒', type: '減益', effect: '目標減速並無法使用加速（持續 16 秒）', tier: '精靈魔法 5 階' },
  { name: '鋼鐵防護', cls: 'elf', level: 45, mp: 30, cooldown: '—', type: '輔助', effect: 'AC 大幅提升（持續 960 秒）', tier: '精靈魔法 5 階' },
  { name: '體能激發', cls: 'elf', level: 50, mp: 30, cooldown: '—', type: '輔助', effect: 'STR 提升（持續 960 秒）', tier: '精靈魔法 6 階' },
  { name: '水之元氣', cls: 'elf', level: 50, mp: 1, cooldown: '—', type: '輔助', effect: '解除水屬性減益（持續 64 秒）', tier: '精靈魔法 6 階' },
  { name: '屬性之火', cls: 'elf', level: 50, mp: 20, cooldown: '—', type: '輔助', effect: '近戰攻擊 40% 機率傷害 2 倍（持續 192 秒）', tier: '精靈魔法 6 階' },
  { name: '暴風疾走', cls: 'elf', level: 50, mp: 10, cooldown: '—', type: '輔助', effect: '傳送到隨機地點', tier: '精靈魔法 6 階' },
  { name: '污濁之水', cls: 'elf', level: 50, mp: 20, cooldown: '1.2 秒', type: '減益', effect: '目標中毒並降低回復（持續 192 秒）', tier: '精靈魔法 6 階' },
  { name: '精準射擊', cls: 'elf', level: 50, mp: 10, cooldown: '3 秒', type: '輔助', effect: '一段時間內弓箭必定命中（持續 192 秒）', tier: '精靈魔法 6 階' },
  { name: '烈焰之魂', cls: 'elf', level: 50, mp: 30, cooldown: '—', type: '輔助', effect: '火屬性強力附魔，打怪傷害固定不亂跳，另有 33% 機率打出武器最大傷害的 2 倍（持續 64 秒）', custom: true, tier: '精靈魔法 6 階' },
  { name: '能量激發', cls: 'elf', level: 50, mp: 30, cooldown: '—', type: '輔助', effect: 'INT 提升（持續 960 秒）', tier: '精靈魔法 6 階' },
  { name: '全部治癒術', cls: 'wizard', level: 32, mp: 48, cooldown: '0.8 秒', type: '治癒', effect: '隊伍全體回復 HP', tier: '魔法 8 階' },
  { name: '火牢', cls: 'wizard', level: 32, mp: 60, cooldown: '—', type: '攻擊', effect: '單體火屬性攻擊,持續灼燒（火屬性）', tier: '魔法 8 階' },
  { name: '冰雪暴', cls: 'wizard', level: 32, mp: 60, cooldown: '1.5 秒', type: '攻擊', effect: '範圍水屬性攻擊（3d10+2、水屬性、消耗 HP 10）', tier: '魔法 8 階' },
  { name: '隱身術', cls: 'wizard', level: 32, mp: 15, cooldown: '3 秒', type: '輔助', effect: '進入隱身', tier: '魔法 8 階' },
  { name: '返生術', cls: 'wizard', level: 32, mp: 50, cooldown: '—', type: '輔助', effect: '讓死者復活', tier: '魔法 8 階' },
  { name: '震裂術', cls: 'wizard', level: 32, mp: 40, cooldown: '1.5 秒', type: '攻擊', effect: '範圍地屬性攻擊（6d8+20、地屬性）', tier: '魔法 8 階' },
  { name: '治癒能量風暴', cls: 'wizard', level: 32, mp: 20, cooldown: '—', type: '治癒', effect: '一段時間內持續回復 HP', tier: '魔法 8 階' },
  { name: '魔法封印', cls: 'wizard', level: 32, mp: 20, cooldown: '0.75 秒', type: '減益', effect: '目標無法施法（持續 16 秒）', tier: '魔法 8 階' },
  { name: '雷霆風暴', cls: 'wizard', level: 36, mp: 48, cooldown: '2 秒', type: '攻擊', effect: '範圍風屬性強力攻擊（5d10+17、風屬性）', tier: '魔法 9 階' },
  { name: '沉睡之霧', cls: 'wizard', level: 36, mp: 40, cooldown: '2.5 秒', type: '減益', effect: '範圍沉睡,受攻擊解除（持續 32 秒）', tier: '魔法 9 階' },
  { name: '變形術', cls: 'wizard', level: 36, mp: 80, cooldown: '—', type: '輔助', effect: '變身成怪物（持續 7200 秒）', tier: '魔法 9 階' },
  { name: '聖結界', cls: 'wizard', level: 36, mp: 30, cooldown: '2 秒', type: '輔助', effect: '周圍隊友 AC −6（持續 32 秒）', tier: '魔法 9 階' },
  { name: '集體傳送術', cls: 'wizard', level: 36, mp: 60, cooldown: '—', type: '輔助', effect: '隊伍集體傳送', tier: '魔法 9 階' },
  { name: '火風暴', cls: 'wizard', level: 36, mp: 48, cooldown: '2 秒', type: '攻擊', effect: '範圍火屬性強力攻擊（6d13+20、火屬性）', tier: '魔法 9 階' },
  { name: '藥水霜化術', cls: 'wizard', level: 36, mp: 20, cooldown: '0.5 秒', type: '減益', effect: '目標無法使用藥水（持續 16 秒）', tier: '魔法 9 階' },
  { name: '強力無所遁形術', cls: 'wizard', level: 36, mp: 30, cooldown: '—', type: '攻擊', effect: '範圍現形', tier: '魔法 9 階' },
  { name: '創造魔法武器', cls: 'wizard', level: 40, mp: 200, cooldown: '—', type: '輔助', effect: '製作魔法武器', tier: '魔法 10 階' },
  { name: '流星雨', cls: 'wizard', level: 40, mp: 60, cooldown: '1.5 秒', type: '攻擊', effect: '超大範圍火屬性攻擊（8d15+60、火屬性）', tier: '魔法 10 階' },
  { name: '終極返生術', cls: 'wizard', level: 40, mp: 100, cooldown: '—', type: '輔助', effect: '讓死者復活且不掉經驗', tier: '魔法 10 階' },
  { name: '集體緩速術', cls: 'wizard', level: 40, mp: 20, cooldown: '3 秒', type: '減益', effect: '範圍減速（持續 64 秒）', tier: '魔法 10 階' },
  { name: '究極光裂術', cls: 'wizard', level: 40, mp: 70, cooldown: '5 秒', type: '攻擊', effect: '單體光屬性最強攻擊（8d15+160、光屬性）', tier: '魔法 10 階' },
  { name: '絕對屏障', cls: 'wizard', level: 40, mp: 30, cooldown: '12 秒', type: '輔助', effect: '短時間完全無敵（持續 12 秒）', tier: '魔法 10 階' },
  { name: '靈魂昇華', cls: 'wizard', level: 40, mp: 40, cooldown: '0.5 秒', type: '輔助', effect: '減少受到的魔法傷害（持續 1200 秒）', tier: '魔法 10 階' },
  { name: '寒冰尖刺', cls: 'wizard', level: 40, mp: 60, cooldown: '—', type: '攻擊', effect: '單體水屬性最強攻擊魔法:無冷卻、不冰凍、會爆擊', custom: true, tier: '魔法 10 階' },
  { name: '雙重破壞', cls: 'darkelf', level: 30, mp: 30, cooldown: '—', type: '輔助', effect: '雙刀攻擊有機率連擊兩次（持續 192 秒）', tier: '暗黑魔法 2 階' },
  { name: '暗影閃避', cls: 'darkelf', level: 30, mp: 20, cooldown: '—', type: '輔助', effect: '閃避大幅提升（持續 192 秒）', tier: '暗黑魔法 2 階' },
  { name: '暗影之牙', cls: 'darkelf', level: 30, mp: 30, cooldown: '—', type: '輔助', effect: '攻擊附加額外傷害（持續 192 秒）', tier: '暗黑魔法 2 階' },
  { name: '會心一擊', cls: 'darkelf', level: 30, mp: 1, cooldown: '18 秒', type: '攻擊', effect: '犧牲 HP 打出最強一擊(消耗體力 × 0.8)（消耗 HP 1）', tier: '暗黑魔法 2 階' },
  { name: '力量提升', cls: 'darkelf', level: 30, mp: 10, cooldown: '—', type: '輔助', effect: 'STR 提升（持續 960 秒）', tier: '暗黑魔法 2 階' },
  { name: '敏捷提升', cls: 'darkelf', level: 30, mp: 10, cooldown: '—', type: '輔助', effect: 'DEX 提升（持續 960 秒）', tier: '暗黑魔法 2 階' },
  { name: '閃避提升', cls: 'darkelf', level: 30, mp: 20, cooldown: '—', type: '輔助', effect: '閃避提升（持續 32 秒）', tier: '暗黑魔法 2 階' },
  { name: '破壞盔甲', cls: 'darkelf', level: 30, mp: 32, cooldown: '5.5 秒', type: '減益', effect: '目標 AC 下降（持續 8 秒、消耗 HP 30）', tier: '暗黑魔法 2 階' },
  { name: '龍嘯', cls: 'knight', level: 60, mp: 30, cooldown: '獨立冷卻', type: '減益', effect: '雙手劍限定,遠距離指定目標、機率昏迷;跟衝擊之暈分開算冷卻,可以先遠暈再衝暈', custom: true, tier: '首創技能(滅世龍掉落 10%)' },
  { name: '帝國反擊', cls: 'royal', level: 60, mp: 30, cooldown: '—', type: '輔助', effect: '自身 buff:期間最大血量提升;被打到時有機率把傷害反射回去並讓對方出血', custom: true, tier: '首創技能(滅世龍掉落 10%)' },
  { name: '精靈大師:精神', cls: 'elf', level: 60, mp: 30, cooldown: '—', type: '輔助', effect: '自身 buff:四屬性抗性 +30、所受傷害 −15%、近戰與弓傷害 +5%、昏迷 / 石化 / 沉睡 / 支撐等抗性提升;重放不疊加', custom: true, tier: '首創技能(滅世龍掉落 10%)' },
  { name: '時間靜止', cls: 'wizard', level: 60, mp: 60, cooldown: '—', type: '減益', effect: '周圍敵人睡著(跟沉睡之霧一樣,被打會醒);隊友、血盟、聯盟不受影響;睡著的目標被衝擊之暈或龍嘯打一律命中', custom: true, tier: '首創技能(滅世龍掉落 10%)' },
  { name: '暗影閃避:命運', cls: 'darkelf', level: 60, mp: 30, cooldown: '—', type: '輔助', effect: '暗影閃避的強化版(獨立技能):迴避更高,被近距離攻擊時 15% 完全閃過,閃過時 50% 把傷害反彈(等級×2 + 力量×2);跟暗影閃避後放的取代先放的', custom: true, tier: '首創技能(滅世龍掉落 10%)' },
]
