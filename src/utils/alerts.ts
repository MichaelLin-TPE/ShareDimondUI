import Swal from 'sweetalert2'

/**
 * 全域 Swal 預設值 — 解掉 SweetAlert2 預設會 lock body scroll 的問題
 * (開關 alert 時頁面會被強制 scroll 到頂,使用者體驗很差)
 *
 * - heightAuto: false → 不會把 html height 改成 auto + body scroll lock
 * - scrollbarPadding: false → 不會額外加 padding 補捲軸寬度,避免 layout shift
 */
const SwalApp = Swal.mixin({
  heightAuto: false,
  scrollbarPadding: false,
})

export const useAlert = {
  // 載入中彈窗 (Loading)
  loading: (message = '載入中...', title = '請稍候') => {
    return SwalApp.fire({
      title,
      html: `<div class="loading-text">${message}</div>`,
      allowOutsideClick: false,
      showConfirmButton: false,
      background: '#1e1e1e',
      color: '#ffffff',
      didOpen: () => {
        SwalApp.showLoading() // 顯示 Swal 內建的漂亮的旋轉動畫
      },
      customClass: {
        popup: 'custom-swal-loading-popup',
      }
    })
  },

  // 關閉目前所有的彈窗
  close: () => {
    SwalApp.close()
  },
  currencySelect: async (
    currencyList: { currency: string; amount: number | string }[],
    title = '請選擇你要購買的幣別',
  ) => {
    // 將傳入的陣列轉換為 Swal radio 需要的 Object 格式
    // 範例產出: { '天幣': '天幣 (1,750,000)', '元寶': '元寶 (5,000)' }
    const inputOptions: Record<string, string> = {}
    currencyList.forEach((item) => {
      inputOptions[item.currency] = `${item.currency} (${Number(item.amount).toLocaleString()})`
    })

    const { value: selectedCurrency } = await SwalApp.fire({
      title,
      input: 'radio',
      inputOptions,
      background: '#1e1e1e',
      color: '#ffffff',
      showCancelButton: true,
      confirmButtonText: '確定購買',
      cancelButtonText: '取消',
      confirmButtonColor: '#b46eff', // 使用你們專案的紫色調
      cancelButtonColor: '#334155',
      // 客製化 radio 按鈕的樣式，讓它符合你們的深色主題
      customClass: {
        input: 'custom-swal-radio',
        confirmButton: 'custom-swal-confirm',
        cancelButton: 'custom-swal-cancel',
      },
      inputValidator: (value) => {
        if (!value) {
          return '請選擇一種幣別才能繼續！'
        }
      },
    })

    // 如果使用者按取消，會回傳 undefined；如果有選，會回傳 currency 字串 (例如: '天幣')
    return selectedCurrency
  },

  // 選擇一位成員(下拉),回傳選到的 memberId(number)或 undefined(取消)
  selectMember: async (
    members: { id: number; name: string }[],
    title = '選擇要補登記的人',
    confirmText = '補登記 +1',
  ): Promise<number | undefined> => {
    if (!members.length) {
      await SwalApp.fire({
        title: '沒有可補登記的人',
        text: '這張單的成員都已在分紅名單中了',
        icon: 'info',
        background: '#1e1e1e',
        color: '#ffffff',
        confirmButtonText: '關閉',
        confirmButtonColor: '#b46eff',
      })
      return undefined
    }
    const inputOptions: Record<string, string> = {}
    members.forEach((m) => {
      inputOptions[String(m.id)] = m.name
    })
    const { value } = await SwalApp.fire({
      title,
      input: 'select',
      inputOptions,
      inputPlaceholder: '請選擇成員',
      background: '#1e1e1e',
      color: '#ffffff',
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: '取消',
      confirmButtonColor: '#b46eff',
      cancelButtonColor: '#334155',
      inputValidator: (v) => {
        if (!v) return '請選擇一位成員才能繼續！'
      },
    })
    return value ? Number(value) : undefined
  },

  // 成功通知
  success: (message: string, title = '系統通知') => {
    return SwalApp.fire({
      title,
      text: message,
      icon: 'success',
      iconColor: '#a5dc86',
      background: '#1e1e1e',
      color: '#ffffff',
      confirmButtonText: 'OK',
      confirmButtonColor: '#4CAF50',
    })
  },

  // 錯誤通知
  error: (message: string, title = '發生錯誤') => {
    return SwalApp.fire({
      title,
      text: message,
      icon: 'error',
      iconColor: '#f27474',
      background: '#1e1e1e',
      color: '#ffffff',
      confirmButtonText: '關閉',
      confirmButtonColor: '#d33',
    })
  },

  // 確認通知
  confirm: (message: string, title = '請確認') => {
    return SwalApp.fire({
      title,
      text: message,
      icon: 'warning',
      iconColor: '#f8bb86',
      background: '#1e1e1e',
      color: '#ffffff',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#444',
      confirmButtonText: '確定',
      cancelButtonText: '取消',
    })
  },
  // 數字金額輸入彈窗 — 幹部改成交金額用,可帶入目前金額與幣別
  amountInput: async (
    currentAmount: number | string,
    currency = '',
    title = '修改成交金額',
  ): Promise<number | undefined> => {
    const { value } = await SwalApp.fire({
      title,
      input: 'number',
      inputValue: String(currentAmount ?? ''),
      inputLabel: currency ? `幣別：${currency}` : undefined,
      inputAttributes: { min: '1', step: '1' },
      background: '#1e1e1e',
      color: '#ffffff',
      showCancelButton: true,
      confirmButtonText: '確認修改',
      cancelButtonText: '取消',
      customClass: {
        input: 'custom-swal-input',
        actions: 'custom-swal-actions',
        confirmButton: 'custom-swal-confirm',
        cancelButton: 'custom-swal-cancel',
      },
      preConfirm: (val) => {
        const num = Number(val)
        if (!val || isNaN(num) || num <= 0) {
          SwalApp.showValidationMessage('請輸入大於 0 的金額！')
          return
        }
        return Math.floor(num)
      },
    })
    return value as number | undefined
  },
  inputDialog: async (placeholder = '請輸入內容', title = '系統輸入') => {
    const { value: text } = await SwalApp.fire({
      title,
      input: 'text',
      inputPlaceholder: placeholder,
      background: '#1e1e1e',
      color: '#ffffff',
      showCancelButton: true,
      // 這裡改用 Class 控制顏色會更美
      confirmButtonText: '送出',
      cancelButtonText: '取消',
      customClass: {
        input: 'custom-swal-input',
        actions: 'custom-swal-actions',
        confirmButton: 'custom-swal-confirm',
        cancelButton: 'custom-swal-cancel',
      },
      preConfirm: (value) => {
        if (!value) {
          SwalApp.showValidationMessage('內容不能為空！')
        }
        return value
      },
    })
    return text
  },
}
