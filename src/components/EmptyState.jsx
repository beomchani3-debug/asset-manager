export default function EmptyState({ icon = '📭', title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6 py-16">
      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-3xl">
        {icon}
      </div>
      <p className="text-[15px] font-semibold text-slate-600">{title}</p>
      {description && (
        <p className="text-[13px] text-slate-400 leading-relaxed">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-1 px-5 py-2.5 bg-blue-600 text-white text-[13px] font-semibold rounded-xl active:opacity-80 shadow-sm shadow-blue-200"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
