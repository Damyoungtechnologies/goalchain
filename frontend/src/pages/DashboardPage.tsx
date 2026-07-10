import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { TrendingUp, Target, Trophy, DollarSign, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'

export default function DashboardPage() {
  const { connected, publicKey } = useWallet()
  const { connection } = useConnection()
  const { user } = useAuth()
  const [balance, setBalance] = useState<number>(0)

  useEffect(() => {
    if (connected && publicKey) {
      connection.getBalance(publicKey).then((lamports) => {
        setBalance(lamports / LAMPORTS_PER_SOL)
      }).catch(console.error)
    } else {
      setBalance(0)
    }
  }, [connected, publicKey, connection])

  const { data: predictions = [] } = useQuery({
    queryKey: ['predictions', user?.uid],
    queryFn: async () => {
      if (!user) return []
      const res = await fetch(`http://localhost:8787/api/predictions/me?userId=${user.uid}`)
      if (!res.ok) throw new Error('Failed to fetch predictions')
      return res.json()
    },
    enabled: !!user
  })

  const activeCount = predictions.filter((p: any) => p.status === 'open').length
  const wonCount = predictions.filter((p: any) => p.status === 'won').length
  
  const totalStaked = predictions.reduce((sum: number, p: any) => sum + p.stakeAmount, 0)
  const totalPayout = predictions.filter((p: any) => p.status === 'won' || p.status === 'cashed_out')
                                 .reduce((sum: number, p: any) => sum + p.potentialPayout, 0)
  
  const roi = totalStaked > 0 ? (((totalPayout - totalStaked) / totalStaked) * 100).toFixed(1) : '0.0'

  const stats = [
    { icon: DollarSign, label: 'Wallet Balance', value: `${balance.toFixed(5)} SOL`, change: '' },
    { icon: Target, label: 'Active Predictions', value: activeCount.toString(), change: '' },
    { icon: Trophy, label: 'Won Predictions', value: wonCount.toString(), change: '' },
    { icon: TrendingUp, label: 'Total ROI', value: `${roi}%`, change: '' },
  ]

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="glass-card p-12 text-center max-w-md">
          <h2 className="text-2xl font-bold text-text mb-4">Google Sign-in Required</h2>
          <p className="text-text-secondary mb-8">
            Please sign in with Google to view your dashboard.
          </p>
        </div>
      </div>
    )
  }

  if (!connected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="glass-card p-12 text-center max-w-md">
          <h2 className="text-2xl font-bold text-text mb-4">Connect Your Wallet</h2>
          <p className="text-text-secondary mb-8">
            Connect your Solana wallet to view your dashboard, predictions, and earnings.
          </p>
          <WalletMultiButton className="!bg-gradient-to-r !from-accent !to-accent-secondary !text-background !font-semibold !rounded-lg !px-6 !py-3" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-text mb-2">Dashboard</h1>
        <p className="text-text-secondary">
          Welcome back, {user?.displayName || (publicKey ? `${publicKey.toString().slice(0, 4)}...${publicKey.toString().slice(-4)}` : 'User')}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="glass-card p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <stat.icon className="w-5 h-5 text-accent" />
              </div>
              {stat.change && (
                <span className="text-sm text-accent flex items-center">
                  <ArrowUpRight className="w-4 h-4 mr-1" />
                  {stat.change}
                </span>
              )}
            </div>
            <div className="text-2xl font-bold text-text mb-1">{stat.value}</div>
            <div className="text-sm text-text-secondary">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link to="/live" className="glass-card p-6 hover:border-accent/30 transition-colors group">
          <h3 className="text-lg font-bold text-text mb-2 group-hover:text-accent transition-colors">
            Live Matches
          </h3>
          <p className="text-text-secondary text-sm">
            View current and upcoming World Cup matches with live odds
          </p>
        </Link>
        <Link to="/predictions" className="glass-card p-6 hover:border-accent/30 transition-colors group">
          <h3 className="text-lg font-bold text-text mb-2 group-hover:text-accent transition-colors">
            My Predictions
          </h3>
          <p className="text-text-secondary text-sm">
            Track your active and settled predictions
          </p>
        </Link>
        <Link to="/leaderboard" className="glass-card p-6 hover:border-accent/30 transition-colors group">
          <h3 className="text-lg font-bold text-text mb-2 group-hover:text-accent transition-colors">
            Leaderboard
          </h3>
          <p className="text-text-secondary text-sm">
            See top predictors and compete for rankings
          </p>
        </Link>
      </div>
    </div>
  )
}