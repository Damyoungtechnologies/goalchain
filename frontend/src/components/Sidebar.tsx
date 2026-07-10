import { NavLink } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Activity,
  Target,
  Trophy,
  BarChart3,
  Receipt,
  Settings,
  HelpCircle,
  X,
  LogOut
} from 'lucide-react'
import { useNotifications } from '@/contexts/NotificationContext'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/live', icon: Activity, label: 'Live Matches' },
  { to: '/predictions', icon: Target, label: 'My Predictions' },
  { to: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/settlements', icon: Receipt, label: 'Settlements' },
]

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { addNotification } = useNotifications()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <>
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
          />
        )}
      </AnimatePresence>

      <aside
        className={`fixed top-0 left-0 z-50 h-screen w-64 bg-secondary border-r border-white/10 flex flex-col transition-transform duration-300 ease-in-out md:translate-x-0 md:top-16 md:h-[calc(100vh-4rem)] md:z-30 shadow-2xl md:shadow-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 md:hidden border-b border-white/10">
          <span className="font-bold text-lg text-text">Menu</span>
          <button onClick={onClose} className="p-2 text-text-secondary hover:text-text rounded-lg hover:bg-white/5 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => onClose()}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-accent/10 text-accent border border-accent/20'
                    : 'text-text-secondary hover:text-text hover:bg-white/5'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium text-sm">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 space-y-2 border-t border-white/10">
          <NavLink
            to="/admin"
            onClick={() => onClose()}
            className={({ isActive }) =>
              `flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                isActive
                  ? 'bg-blue/10 text-blue border border-blue/20'
                  : 'text-text-secondary hover:text-text hover:bg-white/5'
              }`
            }
          >
            <Settings className="w-5 h-5" />
            <span className="font-medium text-sm">Admin</span>
          </NavLink>

          {user && (
            <button 
              onClick={async () => {
                await logout()
                onClose()
                navigate('/')
              }}
              className="flex items-center space-x-3 px-4 py-3 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-400/10 w-full transition-all duration-200 mt-4"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium text-sm">Logout</span>
            </button>
          )}
        </div>
      </aside>
    </>
  )
}