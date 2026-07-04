import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import useToastStore from '../store/useToastStore'
import { T } from '../theme'

const TYPE_BG = {
  success: T.green,
  error:   T.red,
  warning: T.amber,
  info:    T.blue,
}
const TYPE_ICON = {
  success: '✓',
  error:   '✕',
  warning: '⚠',
  info:    'ℹ',
}

function ToastItem({ id, message, type }) {
  const [show, setShow] = useState(false)
  const dismiss = useToastStore((s) => s.dismiss)

  useEffect(() => { requestAnimationFrame(() => setShow(true)) }, [])

  return (
    <div
      onClick={() => dismiss(id)}
      className={`
        flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-lg
        pointer-events-auto cursor-pointer active:opacity-80
        text-white transition-all duration-300
        ${show ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-3 scale-95'}
      `}
      style={{ backgroundColor: TYPE_BG[type] ?? TYPE_BG.success }}
    >
      <span className="text-[15px] font-bold shrink-0">{TYPE_ICON[type] ?? '✓'}</span>
      <p className="text-[13px] font-semibold">{message}</p>
    </div>
  )
}

export default function Toast() {
  const toasts = useToastStore((s) => s.toasts)

  if (!toasts.length) return null

  return createPortal(
    <div
      className="fixed inset-x-0 top-0 z-[200] flex justify-center pointer-events-none"
      style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}
    >
      <div className="w-full max-w-[430px] px-4 flex flex-col items-center gap-2">
        {toasts.map((t) => (
          <ToastItem key={t.id} {...t} />
        ))}
      </div>
    </div>,
    document.body
  )
}
