import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { generateSignature } from '@/utils/SignTools'

export type AttendanceRange = 7 | 30 | 90 | 0 // 0 = 全部

export interface MemberStat {
  memberId: number
  userName: string
  role: 'LEADER' | 'OFFICER' | 'MEMBER'
  attended: number
  total: number
  attendanceRate: number
}

export interface AttendanceStatsResponse {
  days: number
  totalTreasures: number
  rangeStart: string
  rangeEnd: string
  members: MemberStat[]
}

const RANGE_OPTIONS: { value: AttendanceRange; label: string }[] = [
  { value: 7, label: '近 7 天' },
  { value: 30, label: '近 30 天' },
  { value: 90, label: '近 90 天' },
  { value: 0, label: '全部' },
]

export function useAttendance() {
  const authStore = useAuthStore()

  const range = ref<AttendanceRange>(30)
  const loading = ref(false)
  const error = ref<string>('')
  const data = ref<AttendanceStatsResponse | null>(null)

  const members = computed<MemberStat[]>(() => data.value?.members ?? [])
  const totalTreasures = computed(() => data.value?.totalTreasures ?? 0)
  const rangeText = computed(() => {
    if (!data.value) return ''
    return `${data.value.rangeStart} ~ ${data.value.rangeEnd}`
  })

  async function load() {
    loading.value = true
    error.value = ''
    try {
      const ts = Math.floor(Date.now() / 1000).toString()
      const res = await fetch(
        `https://api.gameshare-system.com/attendance/stats?days=${range.value}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${authStore.authToken}`,
            Sign: generateSignature(ts),
            TimeStamp: ts,
          },
        },
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message ?? '載入失敗')
      }
      data.value = await res.json()
    } catch (e) {
      console.error(e)
      error.value = e instanceof Error ? e.message : '載入失敗'
    } finally {
      loading.value = false
    }
  }

  function setRange(r: AttendanceRange) {
    if (range.value === r) return
    range.value = r
    load()
  }

  function rateColor(rate: number): string {
    if (rate >= 80) return 'rate-high'
    if (rate >= 50) return 'rate-mid'
    if (rate > 0) return 'rate-low'
    return 'rate-zero'
  }

  function roleLabel(role: string): string {
    if (role === 'LEADER') return '會長'
    if (role === 'OFFICER') return '幹部'
    return '成員'
  }

  onMounted(load)

  return {
    RANGE_OPTIONS,
    range,
    loading,
    error,
    data,
    members,
    totalTreasures,
    rangeText,
    setRange,
    load,
    rateColor,
    roleLabel,
  }
}
