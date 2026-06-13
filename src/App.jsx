import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Portfolio from './pages/Portfolio'
import Transactions from './pages/Transactions'
import CashFlow from './pages/CashFlow'
import Settings from './pages/Settings'
import PnLAnalysis from './pages/PnLAnalysis'
import { useDataSync } from './hooks/useDataSync'

export default function App() {
  useDataSync()
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/budget" element={<CashFlow />} />
        <Route path="/pnl" element={<PnLAnalysis />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}
