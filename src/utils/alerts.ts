import Swal from 'sweetalert2'

export const useAlert = {
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

    const { value: selectedCurrency } = await Swal.fire({
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

  // 成功通知
  success: (message: string, title = '系統通知') => {
    return Swal.fire({
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
    return Swal.fire({
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
    return Swal.fire({
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
  inputDialog: async (placeholder = '請輸入內容', title = '系統輸入') => {
    const { value: text } = await Swal.fire({
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
          Swal.showValidationMessage('內容不能為空！')
        }
        return value
      },
    })
    return text
  },
}
