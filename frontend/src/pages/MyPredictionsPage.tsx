import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, XCircle, Clock, Target, AlertCircle, ShieldCheck, Activity, X, Bot, Code2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationContext'
import SettlementProofViewer from '../components/SettlementProofViewer'
import LiveMatchFeed from '../components/LiveMatchFeed'
import MarketAssistant from '../components/MarketAssistant'
import { useState } from 'react'

const statusConfig = {
  open: { icon: Clock, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  won: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-400/10' },
  lost: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-400/10' },
  cashed_out: { icon: CheckCircle, color: 'text-yellow-400', bg: 'bg-yellow-400/10' }
}

export default function MyPredictionsPage() {
  const { user } = useAuth()
  const { addNotification } = useNotifications()
  const queryClient = useQueryClient()
  const { publicKey } = useWallet()
  const { connection } = useConnection()
  
  const [proofViewerOpen, setProofViewerOpen] = useState(false)
  const [selectedPrediction, setSelectedPrediction] = useState<any>(null)
  const [activeLiveFeed, setActiveLiveFeed] = useState<any>(null)
  const [activeAI, setActiveAI] = useState<any>(null)

  const { data: positions = [], isLoading } = useQuery({
    queryKey: ['predictions', user?.uid],
    queryFn: async () => {
      if (!user) return []
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8787'}/api/predictions/me?userId=${user.uid}`)
      if (!res.ok) throw new Error('Failed to fetch predictions')
      return res.json()
    },
    enabled: !!user,
    refetchInterval: 5000 // Poll for updates
  })

  const { data: fixtures = [], isLoading: isFixturesLoading } = useQuery({
    queryKey: ['fixtures'],
    queryFn: async () => {
      // Use standard relative fetch to support both dev and prod, but fallback to localhost:8787 for dev
      const apiUrl = window.location.hostname === 'localhost' ? `${import.meta.env.VITE_API_URL || 'http://localhost:8787'}` : '';
      const res = await fetch(`${apiUrl}/api/fixtures`);
      let data = await res.json();
      
      // Some fixtures might have dropped off the active feed if they are finished.
      // We will try to fetch them individually if they are missing but we have a prediction for them.
      const missingFixtureIds = positions
        .map((p: any) => p.fixtureId)
        .filter((fid: string) => !data.some((f: any) => f.FixtureId?.toString() === fid));

      const historicalFixtures = await Promise.all(
        missingFixtureIds.map(async (fid: string) => {
          try {
            const hRes = await fetch(`${apiUrl}/api/fixtures/${fid}`);
            if (hRes.ok) {
              const hData = await hRes.json();
              // Try to find the team names from the position
              const pos = positions.find((p: any) => p.fixtureId === fid);
              if (pos && pos.fixtureName && pos.fixtureName.includes(' vs ')) {
                const [h, a] = pos.fixtureName.split(' vs ');
                hData.Participant1 = h;
                hData.Participant2 = a;
              }
              return hData;
            }
          } catch (e) {
            console.error('Failed to fetch historical fixture', fid);
          }
          return null;
        })
      );

      data = [...data, ...historicalFixtures.filter(f => f !== null)];

      return data.map((f: any) => ({
        id: f.FixtureId?.toString() || Math.random().toString(),
        home: f.Participant1 || 'Home',
        away: f.Participant2 || 'Away',
        homeScore: f.Participant1Score || 0,
        awayScore: f.Participant2Score || 0,
        state: f.GameState === 2 ? 'Live' : f.GameState === 3 ? 'Final' : 'Scheduled',
        minute: Number(f.Minute || f.minute || f.GameTime || 0),
        events: f.events || [],
        raw: f
      }));
    },
    refetchInterval: 5000,
    enabled: positions.length > 0
  });

  const cashoutMutation = useMutation({
    mutationFn: async ({ predictionId, amount }: { predictionId: string, amount: number }) => {
      addNotification('info', 'Requesting Smart Contract Cashout...')
      
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8787'}/api/predictions/cashout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          predictionId, 
          cashoutAmount: amount,
          userPubKey: publicKey ? publicKey.toBase58() : null
        })
      })
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Cashout failed')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['predictions', user?.uid] })
      addNotification('success', 'Cash out successful!')
    },
    onError: (err: Error) => {
      addNotification('error', err.message || 'Cash out failed')
    }
  })

  if (!user) {
    return (
      <div className="glass-card p-12 text-center mt-8">
        <AlertCircle className="w-12 h-12 text-accent mx-auto mb-4 opacity-50" />
        <h2 className="text-xl font-bold text-text mb-2">Please Sign In</h2>
        <p className="text-text-secondary">Sign in with Google to view your predictions.</p>
      </div>
    )
  }

  const stats = {
    total: positions.length,
    open: positions.filter((p: any) => p.status === 'open').length,
    won: positions.filter((p: any) => p.status === 'won').length,
    totalStaked: positions.reduce((sum: number, p: any) => sum + p.stakeAmount, 0),
  }

  return (
    <div className="space-y-6 relative">
      <div>
        <h1 className="text-3xl font-bold text-text mb-2">My Predictions</h1>
        <p className="text-text-secondary">Track your positions and settlements</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <div className="text-2xl font-bold text-text">{stats.total}</div>
          <div className="text-sm text-text-secondary">Total</div>
        </div>
        <div className="glass-card p-4">
          <div className="text-2xl font-bold text-blue-400">{stats.open}</div>
          <div className="text-sm text-text-secondary">Open</div>
        </div>
        <div className="glass-card p-4">
          <div className="text-2xl font-bold text-green-400">{stats.won}</div>
          <div className="text-sm text-text-secondary">Won</div>
        </div>
        <div className="glass-card p-4">
          <div className="text-2xl font-bold text-text">{stats.totalStaked.toFixed(2)}</div>
          <div className="text-sm text-text-secondary">Total Volume</div>
        </div>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center p-8 text-text-secondary">Loading predictions...</div>
        ) : positions.length === 0 ? (
          <div className="glass-card p-12 text-center flex flex-col items-center justify-center mt-8">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
              <Target className="w-8 h-8 text-accent opacity-50" />
            </div>
            <h3 className="text-xl font-bold text-text mb-2">No Active Predictions</h3>
            <p className="text-text-secondary mb-6">
              You haven't made any predictions yet. Head over to the live matches to start predicting!
            </p>
            <Link to="/live" className="gradient-button px-6 py-2">
              Browse Matches
            </Link>
          </div>
        ) : (
          positions.map((position: any, index: number) => {
            const statusInfo = statusConfig[position.status as keyof typeof statusConfig] || statusConfig.open
            const StatusIcon = statusInfo.icon
            
            // Find live fixture
            const fixture = fixtures.find((f: any) => f.id === position.fixtureId)
            
            // Dynamic Cashout Algorithm
            let cashoutValue = position.stakeAmount * 0.8
            if (fixture && position.status === 'open') {
              let isWinning = false
              let isLosing = false
              let isTied = false

              if (position.outcome === fixture.home) {
                if (fixture.homeScore > fixture.awayScore) isWinning = true
                else if (fixture.homeScore === fixture.awayScore) isTied = true
                else isLosing = true
              } else if (position.outcome === fixture.away) {
                if (fixture.awayScore > fixture.homeScore) isWinning = true
                else if (fixture.homeScore === fixture.awayScore) isTied = true
                else isLosing = true
              } else {
                if (fixture.homeScore === fixture.awayScore) isWinning = true
                else isLosing = true
              }

              if (isWinning) {
                cashoutValue = position.stakeAmount + ((position.potentialPayout - position.stakeAmount) * 0.5)
              } else if (isLosing) {
                cashoutValue = position.stakeAmount * 0.3
              } else if (isTied) {
                cashoutValue = position.stakeAmount * 0.9
              }
            }
            
            return (
              <div key={position.id}>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="glass-card p-6"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      {fixture ? (
                        <div className="flex items-center space-x-3 mb-2">
                          {fixture.state === 'Live' && <span className="live-badge">LIVE {fixture.minute}'</span>}
                          <span className="text-xl font-bold text-text">{fixture.home}</span>
                          <span className="text-xl font-bold text-accent">
                            {fixture.state === 'Scheduled' ? 'vs' : `${fixture.homeScore} - ${fixture.awayScore}`}
                          </span>
                          <span className="text-xl font-bold text-text">{fixture.away}</span>
                        </div>
                      ) : (
                        <div className="text-xl font-bold text-text mb-2">
                          {position.fixtureName || `Fixture ID: ${position.fixtureId}`}
                        </div>
                      )}
                      <div className="font-bold text-text-secondary text-sm">
                        {position.marketId.replace(/^[0-9]+-/, '').replace(/-/g, ' ')}
                      </div>
                      <div className="text-sm text-text-secondary mt-1">
                        Pick: <span className="text-text font-bold uppercase">{position.outcome}</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4 md:gap-8">
                      <div className="text-left md:text-right">
                        <div className="text-sm text-text-secondary">Stake</div>
                        <div className="font-bold text-text">{position.stakeAmount.toFixed(2)} {position.currency || 'SOL'}</div>
                      </div>
                      <div className="text-left md:text-right">
                        <div className="text-sm text-text-secondary">To Win</div>
                        <div className="font-bold text-accent">{position.potentialPayout.toFixed(2)} {position.currency || 'SOL'}</div>
                      </div>
                      <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${statusInfo.bg}`}>
                        <StatusIcon className={`w-4 h-4 ${statusInfo.color}`} />
                        <span className={`text-sm font-bold uppercase tracking-wider ${statusInfo.color}`}>
                          {position.status.replace('_', ' ')}
                        </span>
                      </div>
                      
                      {position.status === 'open' && (
                        <button 
                          onClick={() => cashoutMutation.mutate({ predictionId: position.id, amount: cashoutValue })}
                          disabled={cashoutMutation.isPending}
                          className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg shadow-lg shadow-green-500/20 transition-all flex items-center space-x-2"
                        >
                          {cashoutMutation.isPending ? 'Processing...' : `CASH OUT ${cashoutValue.toFixed(2)}`}
                        </button>
                      )}

                      {(position.status === 'won' || position.status === 'cashed_out') && (
                        <button 
                          onClick={() => {
                            setSelectedPrediction(position)
                            setProofViewerOpen(true)
                          }}
                          className="bg-white/10 hover:bg-white/20 text-text font-bold py-2 px-4 rounded-lg border border-white/10 transition-all flex items-center space-x-2"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          <span>View Proof</span>
                        </button>
                      )}
                    </div>
                  </div>
                  {fixture && (
                    <div className="mt-4 border-t border-white/5 pt-4 flex flex-col md:flex-row gap-4">
                      <button
                        onClick={() => setActiveLiveFeed(fixture)}
                        className="flex-1 py-2 bg-accent/10 hover:bg-accent/20 text-accent font-bold rounded-lg border border-accent/20 transition-all flex items-center justify-center gap-2"
                      >
                        <Activity className="w-5 h-5 animate-pulse" />
                        Live Match Events
                      </button>
                      <button
                        onClick={() => setActiveAI(fixture)}
                        className="flex-1 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 font-bold rounded-lg border border-purple-500/20 transition-all flex items-center justify-center gap-2"
                      >
                        <Bot className="w-5 h-5" />
                        AI Analysis Log
                      </button>
                    </div>
                  )}
                </motion.div>
              </div>
            )
          })
        )}
      </div>

      <SettlementProofViewer 
        isOpen={proofViewerOpen} 
        onClose={() => setProofViewerOpen(false)} 
        prediction={selectedPrediction} 
      />
      <AnimatePresence>
        {activeLiveFeed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-2xl max-h-[85vh] flex flex-col glass-card border border-white/10 shadow-2xl overflow-hidden rounded-xl"
            >
              <div className="absolute top-4 right-4 z-20">
                <button
                  onClick={() => setActiveLiveFeed(null)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors text-text-secondary hover:text-text"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="overflow-y-auto custom-scrollbar flex-grow p-1">
                <LiveMatchFeed events={activeLiveFeed.events} homeTeam={activeLiveFeed.home} awayTeam={activeLiveFeed.away} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeAI && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
            >
              <div className="absolute top-4 right-4 z-20">
                <button
                  onClick={() => setActiveAI(null)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors text-text-secondary hover:text-text"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <MarketAssistant fixture={activeAI} showHistory={true} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}