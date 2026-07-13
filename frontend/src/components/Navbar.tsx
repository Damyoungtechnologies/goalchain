import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, Bell, Search, Menu, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useNotifications } from '../contexts/NotificationContext'
import { useAuth } from '../contexts/AuthContext'

interface NavbarProps {
  onMenuClick: () => void
}

export default function Navbar({ onMenuClick }: NavbarProps) {
  const { connected } = useWallet()
  const { notifications, markAllAsRead, addNotification } = useNotifications()
  const { user, signInWithGoogle, logout } = useAuth()
  const [showNotifications, setShowNotifications] = useState(false)
  const [page, setPage] = useState(0)
  const location = useLocation()
  const navigate = useNavigate()
  const isPublicPage = ['/', '/terms', '/privacy'].includes(location.pathname)

  const unreadCount = notifications.filter(n => !n.read).length
  
  const ITEMS_PER_PAGE = 5
  const totalPages = Math.ceil(notifications.length / ITEMS_PER_PAGE)
  const displayedNotifications = notifications.slice(
    page * ITEMS_PER_PAGE,
    (page + 1) * ITEMS_PER_PAGE
  )

  const formatTime = (date: Date) => {
    const diff = Math.floor((new Date().getTime() - date.getTime()) / 1000)
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="sticky top-0 z-50 bg-secondary/80 backdrop-blur-lg border-b border-white/10"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            {connected && !isPublicPage && (
              <button 
                onClick={onMenuClick}
                className="mr-4 p-2 -ml-2 text-text-secondary hover:text-text md:hidden rounded-lg hover:bg-white/5 transition-colors"
              >
                <Menu className="w-6 h-6" />
              </button>
            )}
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-3">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-accent to-accent-secondary flex items-center justify-center">
                <Trophy className="w-5 h-5 md:w-6 md:h-6 text-background" />
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-bold text-text">GoalChain</h1>
                <p className="hidden md:block text-xs text-text-secondary">Prediction Markets</p>
              </div>
            </Link>
          </div>

          {/* Search */}
          {!isPublicPage && (
            <div className="hidden lg:flex items-center flex-1 max-w-md mx-8">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                <input
                  type="text"
                  placeholder="Search matches, teams..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      addNotification('info', 'Global search is under construction.')
                      e.currentTarget.value = ''
                    }
                  }}
                  className="w-full bg-card border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-text placeholder-text-secondary focus:outline-none focus:border-accent transition-colors"
                />
              </div>
            </div>
          )}

          {/* Right side */}
          <div className="flex items-center space-x-2 md:space-x-4">
            {connected && !isPublicPage && (
              <div className="relative">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 text-text-secondary hover:text-text transition-colors"
                >
                  <Bell className="w-5 h-5 md:w-6 md:h-6" />
                  {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 w-4 h-4 md:w-5 md:h-5 bg-red-500 text-white text-[10px] md:text-xs font-bold flex items-center justify-center rounded-full border-2 border-secondary shadow-lg shadow-red-500/50">
                      {unreadCount}
                    </span>
                  )}
                </motion.button>

                {/* Dropdown Menu */}
                <AnimatePresence>
                  {showNotifications && (
                    <>
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowNotifications(false)}
                        className="fixed inset-0 z-40 sm:hidden"
                      />
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-80 bg-card border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 transform origin-top-right"
                      >
                        <div className="px-4 py-3 border-b border-white/10 flex justify-between items-center bg-white/5">
                          <h3 className="font-semibold text-text">Notifications</h3>
                          <div className="flex space-x-3 items-center">
                            <button 
                              onClick={() => markAllAsRead()}
                              className="text-xs text-accent hover:text-accent-secondary"
                            >
                              Mark all read
                            </button>
                            <button onClick={() => setShowNotifications(false)} className="sm:hidden text-text-secondary">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        
                        <div className="max-h-96 overflow-y-auto">
                          {notifications.length === 0 ? (
                            <div className="px-4 py-8 text-center text-text-secondary flex flex-col items-center">
                              <Bell className="w-8 h-8 mb-2 opacity-20" />
                              <p className="text-sm">No new notifications</p>
                            </div>
                          ) : (
                            displayedNotifications.map(notif => (
                              <div key={notif.id} className={`px-4 py-3 cursor-pointer transition-colors border-b border-white/5 last:border-0 ${notif.read ? 'opacity-70 hover:bg-white/5' : 'bg-accent/5 hover:bg-accent/10'}`}>
                                <div className="flex justify-between items-start">
                                  <p className={`text-sm font-medium ${notif.type === 'error' ? 'text-red-400' : notif.type === 'success' ? 'text-green-400' : 'text-text'}`}>
                                    {notif.type === 'error' ? 'Error' : notif.type === 'success' ? 'Success' : 'Notification'}
                                  </p>
                                  {!notif.read && <span className="w-2 h-2 rounded-full bg-accent mt-1.5" />}
                                </div>
                                <p className="text-xs text-text-secondary mt-1 whitespace-pre-wrap">{notif.message}</p>
                                <p className="text-[10px] text-text-secondary/60 mt-2">{formatTime(notif.timestamp)}</p>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Pagination Footer */}
                        {totalPages > 1 && (
                          <div className="px-4 py-3 border-t border-white/10 bg-white/5 flex justify-between items-center">
                            <button 
                              disabled={page === 0}
                              onClick={() => setPage(p => p - 1)}
                              className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent text-text-secondary"
                            >
                              <ChevronLeft className="w-5 h-5" />
                            </button>
                            <span className="text-xs text-text-secondary">
                              Page {page + 1} of {totalPages}
                            </span>
                            <button 
                              disabled={page >= totalPages - 1}
                              onClick={() => setPage(p => p + 1)}
                              className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent text-text-secondary"
                            >
                              <ChevronRight className="w-5 h-5" />
                            </button>
                          </div>
                        )}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}
            
            {isPublicPage ? (
              !user ? (
                <button 
                  onClick={async () => {
                    try {
                      await signInWithGoogle()
                      navigate('/dashboard')
                    } catch (e) {
                      console.error(e)
                    }
                  }}
                  className="bg-white text-black font-bold px-4 py-2 rounded-lg text-sm hover:bg-gray-200 transition-colors flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    <path fill="none" d="M1 1h22v22H1z" />
                  </svg>
                  <span>Sign in</span>
                </button>
              ) : (
                <button 
                  onClick={() => navigate('/dashboard')}
                  className="gradient-button px-6 py-2"
                >
                  Go to Dashboard
                </button>
              )
            ) : (
              <div className="flex items-center space-x-3">
                {user && (
                  <div className="hidden md:flex items-center space-x-2 bg-white/5 rounded-full pl-2 pr-4 py-1">
                    <img 
                      src={user.photoURL} 
                      alt="Avatar" 
                      className="w-6 h-6 rounded-full" 
                      referrerPolicy="no-referrer"
                    />
                    <span className="text-sm font-medium text-text">{user.displayName}</span>
                  </div>
                )}
                <WalletMultiButton className="!bg-gradient-to-r !from-accent !to-accent-secondary !text-background !font-semibold !rounded-lg !px-3 md:!px-4 !py-2 !text-sm md:!text-base" />
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.nav>
  )
}