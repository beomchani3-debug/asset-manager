import { Outlet, useLocation } from 'react-router-dom'
import BottomTabBar from './BottomTabBar'
import Toast from './Toast'
import { T } from '../theme'

const PAGE_TITLES = {
  '/dashboard':    '대시보드',
  '/portfolio':    '포트폴리오',
  '/transactions': '거래기록',
  '/budget':       '가계부',
  '/settings':     '설정',
}

export default function Layout() {
  const { pathname } = useLocation()
  const title = PAGE_TITLES[pathname] ?? '내 자산관리'

  return (
    <div
      className="w-full max-w-[430px] h-screen flex flex-col shadow-2xl overflow-hidden"
      style={{ backgroundColor: T.bg }}
    >
      {/* 상단 고정 헤더 */}
      <header
        className="shrink-0 border-b pt-safe z-40"
        style={{ backgroundColor: T.card, borderColor: T.gold }}
      >
        <div className="flex items-center justify-between h-14 px-5">
          <h1
            className="text-[17px] font-bold tracking-tight"
            style={{ color: T.goldLight }}
          >
            {title}
          </h1>
        </div>
      </header>

      {/* 스크롤 가능한 콘텐츠 영역 */}
      <main className="flex-1 overflow-y-auto no-scrollbar">
        <Outlet />
      </main>

      {/* 하단 탭바 */}
      <BottomTabBar />

      {/* 전역 토스트 알림 */}
      <Toast />
    </div>
  )
}
