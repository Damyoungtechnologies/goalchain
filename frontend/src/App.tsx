import { useState, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { useWallet } from '@solana/wallet-adapter-react'
import { useAuth } from './contexts/AuthContext'
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'
import LandingPage from './pages/LandingPage'
import DashboardPage from './pages/DashboardPage'
import LiveMatchesPage from './pages/LiveMatchesPage'
import PredictionPage from './pages/PredictionPage'
import MyPredictionsPage from './pages/MyPredictionsPage'
import LeaderboardPage from './pages/LeaderboardPage'
import AnalyticsPage from './pages/AnalyticsPage'
import SettlementExplorerPage from './pages/SettlementExplorerPage'
import AdminPage from './pages/AdminPage'
import TermsPage from './pages/TermsPage'
import PrivacyPage from './pages/PrivacyPage'

function App() {
  const { connected } = useWallet()
  const { user } = useAuth()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const location = useLocation()
  const isPublicPage = ['/', '/terms', '/privacy'].includes(location.pathname)

  // Close sidebar on route change on mobile
  useEffect(() => {
    setIsSidebarOpen(false)
  }, [location.pathname])

  return (
    <div className="min-h-screen bg-background">
      <Navbar onMenuClick={() => setIsSidebarOpen(true)} />
      <div className="flex relative">
        {(connected || user) && !isPublicPage && (
          <Sidebar 
            isOpen={isSidebarOpen} 
            onClose={() => setIsSidebarOpen(false)} 
          />
        )}
        <main className={`flex-1 w-full transition-all duration-300 ${(connected && !isPublicPage) ? 'md:ml-64' : ''} p-4 md:p-6 overflow-x-hidden min-h-[calc(100vh-4rem)]`}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/live" element={<LiveMatchesPage />} />
            <Route path="/prediction/:fixtureId" element={<PredictionPage />} />
            <Route path="/predictions" element={<MyPredictionsPage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/settlements" element={<SettlementExplorerPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default App