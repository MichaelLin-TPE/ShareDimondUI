// 職業介紹。起始素質與可加點為伺服器原始碼 C_CreateChar 的真值;「定位」文案為佔位。
export interface AgClass {
  id: string
  name: string
  latin: string
  role: string
  desc: string
  stats: { str: number; dex: number; con: number; wis: number; cha: number; int: number }
  bonus: number
}

export const AG_CLASSES: AgClass[] = [
  { id: 'royal', name: '君主', latin: 'PRINCE', role: '血盟領袖 · 光環輔助', desc: '唯一能創血盟、發起攻城的職業。王族光環一開,隊友跟著變強。', stats: { str: 13, dex: 10, con: 10, wis: 11, cha: 13, int: 10 }, bonus: 8 },
  { id: 'knight', name: '騎士', latin: 'KNIGHT', role: '近戰坦克 · 高血量', desc: '每級血量成長最高,前排站得住。衝擊之暈重新平衡後開場控制更穩。', stats: { str: 16, dex: 12, con: 14, wis: 9, cha: 12, int: 8 }, bonus: 4 },
  { id: 'elf', name: '妖精', latin: 'ELF', role: '遠程 · 屬性魔法', desc: '弓與屬性精靈魔法並用,減益命中經過平衡,打王與清怪都有位置。', stats: { str: 11, dex: 12, con: 12, wis: 12, cha: 9, int: 12 }, bonus: 7 },
  { id: 'wizard', name: '法師', latin: 'WIZARD', role: '範圍魔攻 · 高爆發', desc: '可加點最多的職業,魔法傷害吃智力表。範圍技能是團隊清場主力。', stats: { str: 8, dex: 7, con: 12, wis: 12, cha: 8, int: 12 }, bonus: 16 },
  { id: 'darkelf', name: '黑妖', latin: 'DARK ELF', role: '雙刀爆發 · 隱身', desc: '敏捷最高,雙刀連擊與隱身突襲,單挑節奏最快的職業。', stats: { str: 12, dex: 15, con: 8, wis: 10, cha: 9, int: 11 }, bonus: 10 },
]
