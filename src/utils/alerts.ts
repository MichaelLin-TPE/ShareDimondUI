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
    // SweetAlert 內建的 select/radio 都被預設白底樣式綁死、深色主題壓不動,
    // 直接自刻一份乾淨清單:一列一人(小圓點 + 名字)、可搜尋、可捲動、選中高亮。
    const esc = (s: string) =>
      s.replace(/[&<>"']/g, (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
      )
    const rows = members
      .map(
        (m) => `
        <button type="button" class="sd-mem-row" data-id="${m.id}">
          <span class="sd-mem-dot"></span>
          <span class="sd-mem-name">${esc(m.name)}</span>
        </button>`,
      )
      .join('')
    const html = `
      <style>
        .sd-mem-wrap{display:flex;flex-direction:column;gap:10px}
        .sd-mem-search{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;
          border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:#f1f5f9;
          font-size:14px;outline:none}
        .sd-mem-search:focus{border-color:#b46eff}
        .sd-mem-list{display:flex;flex-direction:column;gap:6px;max-height:42vh;overflow-y:auto;
          padding:2px;margin:0}
        .sd-mem-row{display:flex;align-items:center;gap:11px;width:100%;box-sizing:border-box;
          padding:11px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.08);
          background:rgba(255,255,255,.04);color:#e5e7eb;font-size:15px;text-align:left;
          cursor:pointer;transition:background .12s,border-color .12s}
        .sd-mem-row:hover{background:rgba(255,255,255,.1)}
        .sd-mem-row.selected{background:rgba(180,110,255,.22);border-color:#b46eff;color:#fff;font-weight:700}
        .sd-mem-dot{width:16px;height:16px;border-radius:50%;border:2px solid #64748b;flex:0 0 auto;
          box-sizing:border-box;transition:all .12s}
        .sd-mem-row.selected .sd-mem-dot{border-color:#b46eff;background:#b46eff;box-shadow:inset 0 0 0 3px #1e1e1e}
        .sd-mem-name{flex:1 1 auto;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .sd-mem-empty{color:#94a3b8;font-size:13px;padding:14px;text-align:center}
      </style>
      <div class="sd-mem-wrap">
        <input class="sd-mem-search" type="text" placeholder="🔍 搜尋成員…" />
        <div class="sd-mem-list">${rows}</div>
      </div>`

    let selectedId: number | null = null
    const result = await SwalApp.fire({
      title,
      html,
      background: '#1e1e1e',
      color: '#ffffff',
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: '取消',
      confirmButtonColor: '#b46eff',
      cancelButtonColor: '#334155',
      focusConfirm: false,
      didOpen: () => {
        const popup = Swal.getPopup()
        if (!popup) return
        const list = popup.querySelector('.sd-mem-list') as HTMLElement
        const search = popup.querySelector('.sd-mem-search') as HTMLInputElement
        const rowEls = Array.from(popup.querySelectorAll<HTMLButtonElement>('.sd-mem-row'))
        rowEls.forEach((row) => {
          row.addEventListener('click', () => {
            rowEls.forEach((r) => r.classList.remove('selected'))
            row.classList.add('selected')
            selectedId = Number(row.dataset.id)
            Swal.resetValidationMessage()
          })
        })
        search?.addEventListener('input', () => {
          const q = search.value.trim().toLowerCase()
          let visible = 0
          rowEls.forEach((row) => {
            const name = (row.querySelector('.sd-mem-name')?.textContent ?? '').toLowerCase()
            const show = !q || name.includes(q)
            row.style.display = show ? '' : 'none'
            if (show) visible++
          })
          let empty = list.querySelector('.sd-mem-empty') as HTMLElement | null
          if (visible === 0) {
            if (!empty) {
              empty = document.createElement('div')
              empty.className = 'sd-mem-empty'
              empty.textContent = '找不到符合的成員'
              list.appendChild(empty)
            }
          } else if (empty) {
            empty.remove()
          }
        })
      },
      preConfirm: () => {
        if (selectedId == null) {
          Swal.showValidationMessage('請先點選一位成員')
          return false
        }
        return selectedId
      },
    })
    return result.isConfirmed && typeof result.value === 'number' ? result.value : undefined
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
  inputDialog: async (placeholder = '請輸入內容', title = '系統輸入', description = '') => {
    const { value: text } = await SwalApp.fire({
      title,
      text: description || undefined,
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
