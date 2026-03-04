import Swal from 'sweetalert2'

export const useAlert = {
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
