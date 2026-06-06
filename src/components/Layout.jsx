import { Outlet, useLocation } from 'react-router-dom'
import BottomTabBar from './BottomTabBar'
import Toast from './Toast'

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
    <div className="w-full max-w-[430px] h-screen flex flex-col bg-slate-50 shadow-2xl overflow-hidden">
      {/* 상단 고정 헤더 */}
      <header className="shrink-0 bg-white border-b border-slate-100 pt-safe z-40">
        <div className="flex items-center justify-between h-14 px-5">
          <h1 className="text-[17px] font-bold text-slate-900 tracking-tight">{title}</h1>
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
