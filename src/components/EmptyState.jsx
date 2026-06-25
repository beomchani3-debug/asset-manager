import { T } from '../theme'

export default function EmptyState({ icon = '📭', title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6 py-16">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
        style={{ backgroundColor: T.card, border: `1px solid ${T.gold}` }}
      >
        {icon}
      </div>
      <p className="text-[15px] font-semibold" style={{ color: T.textPrimary }}>{title}</p>
      {description && (
        <p className="text-[13px] leading-relaxed" style={{ color: T.textMuted }}>{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-1 px-5 py-2.5 text-[13px] font-semibold rounded-xl active:opacity-80 shadow-sm"
          style={{ backgroundColor: T.gold, color: '#0A0A0A' }}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
