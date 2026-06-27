import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Portfolio from './pages/Portfolio'
import Transactions from './pages/Transactions'
import CashFlow from './pages/CashFlow'
import Settings from './pages/Settings'
import PnLAnalysis from './pages/PnLAnalysis'
import MonthlyReport from './pages/MonthlyReport'
import DividendCalendar from './pages/DividendCalendar'
import Login from './pages/Login'
import Register from './pages/Register'
import AuthProvider from './components/AuthProvider'
import ProtectedRoute from './components/ProtectedRoute'
import { useDataSync } from './hooks/useDataSync'
import { useFixedExpenseAutoInsert } from './hooks/useFixedExpenseAutoInsert'
import { useMonthlyReportNotification } from './hooks/useMonthlyReportNotification'

function AppRoutes() {
  useDataSync()
  useFixedExpenseAutoInsert()
  useMonthlyReportNotification()
  return (
    <Routes>
      <Route path="/login"    element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard"        element={<Dashboard />} />
          <Route path="/portfolio"        element={<Portfolio />} />
          <Route path="/transactions"     element={<Transactions />} />
          <Route path="/budget"           element={<CashFlow />} />
          <Route path="/pnl"              element={<PnLAnalysis />} />
          <Route path="/report"           element={<MonthlyReport />} />
          <Route path="/dividend-calendar" element={<DividendCalendar />} />
          <Route path="/settings"         element={<Settings />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
