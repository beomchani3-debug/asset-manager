import { NavLink } from 'react-router-dom'
import { T } from '../theme'

const tabs = [
  {
    to: '/dashboard',
    label: '대시보드',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    to: '/portfolio',
    label: '포트폴리오',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v10l5.5 3.5" />
        <circle cx="12" cy="12" r="10" />
        <path d="M12 12 7 8" />
      </svg>
    ),
  },
  {
    to: '/transactions',
    label: '거래기록',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <path d="M9 12h6M9 16h4" />
      </svg>
    ),
  },
  {
    to: '/budget',
    label: '가계부',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20M6 15h2M10 15h4" />
      </svg>
    ),
  },
  {
    to: '/report',
    label: '리포트',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M8 17V13M12 17V9M16 17V11" />
      </svg>
    ),
  },
]

export default function BottomTabBar() {
  return (
    <nav
      className="shrink-0 border-t z-50"
      style={{ backgroundColor: T.tabBg, borderColor: T.gold }}
    >
      <div className="flex items-center justify-around h-16 px-1 pb-safe">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors duration-150"
            style={({ isActive }) => ({ color: isActive ? T.tabActive : T.tabInactive })}
          >
            {({ isActive }) => (
              <>
                <span className="relative">
                  {tab.icon(isActive)}
                  {isActive && (
                    <span
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                      style={{ backgroundColor: T.tabActive }}
                    />
                  )}
                </span>
                <span className="text-[9px] font-medium leading-none">
                  {tab.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
