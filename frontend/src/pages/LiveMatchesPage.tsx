import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Clock, ChevronRight, Activity, Crosshair } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import type { Fixture } from '@/types'
import { TxlineSetupWidget } from '@/components/TxlineSetupWidget'
import { useAuth } from '@/contexts/AuthContext'
import MarketAssistant from '@/components/MarketAssistant'

export default function LiveMatchesPage() {
  const { user } = useAuth()
  const [filter, setFilter] = useState<'all' | 'live' | 'scheduled'>('all')

  const { data: positions = [] } = useQuery({
    queryKey: ['predictions', user?.uid],
    queryFn: async () => {
      if (!user) return []
      const res = await fetch(`http://localhost:8787/api/predictions/me?userId=${user.uid}`)
      if (!res.ok) throw new Error('Failed to fetch predictions')
      return res.json()
    },
    enabled: !!user
  })

  const predictedFixtureIds = new Set(
    positions.map((p: any) => String(p.fixtureId))
  )

  const { data: fixtures, isLoading, error } = useQuery<Fixture[]>({
    queryKey: ['fixtures'],
    queryFn: async () => {
      const response = await fetch('http://localhost:8787/api/fixtures')
      if (!response.ok) {
        const text = await response.text().catch(() => 'Network error')
        throw new Error(text)
      }
      const data = await response.json()
      const fixturesArray = Array.isArray(data) ? data : data.value || []
      
      // Map TxLINE API format to frontend Fixture format
      return fixturesArray.map((f: any) => ({
        id: f.FixtureId?.toString() || Math.random().toString(),
        home: f.Participant1IsHome ? f.Participant1 : f.Participant2,
        away: f.Participant1IsHome ? f.Participant2 : f.Participant1,
        homeScore: f.Participant1Score || 0,
        awayScore: f.Participant2Score || 0,
        minute: f.Minute || 0,
        competition: f.Competition,
        stage: 'Group Stage', // default or map if available
        state: f.GameState === 2 ? 'Live' : f.GameState === 3 ? 'Final' : 'Scheduled',
        startTime: f.StartTime
      }))
    },
    refetchInterval: 10000, // Refetch every 10 seconds
  })

  const filteredFixtures = fixtures?.filter((fixture) => {
    if (filter === 'all') return true
    if (filter === 'live') return fixture.state === 'Live'
    return fixture.state === 'Scheduled'
  }) || []

  const liveFixture = fixtures?.find(f => f.state === 'Live') || fixtures?.[0]

  // Synthetic stats generator based on score for realism
  const generateStats = (fixture: any) => {
    const totalScore = fixture.homeScore + fixture.awayScore
    const homeAdv = fixture.homeScore > fixture.awayScore ? 15 : fixture.homeScore < fixture.awayScore ? -15 : 0
    return {
      possession: { home: 50 + homeAdv, away: 50 - homeAdv },
      shots: { home: fixture.homeScore * 3 + 2, away: fixture.awayScore * 3 + 4 }
    }
  }

  if (error) {
    if (error.message.includes('401') || error.message.toLowerCase().includes('token') || error.message.toLowerCase().includes('jwt')) {
      return (
        <div className="space-y-6 max-w-2xl mx-auto mt-12">
          <TxlineSetupWidget />
        </div>
      )
    }
    
    if (!fixtures?.length) {
      return (
        <div className="glass-card p-12 text-center flex flex-col items-center justify-center mt-8">
          <Activity className="w-8 h-8 text-accent animate-pulse mb-4" />
          <h3 className="text-xl font-bold text-text mb-2">Reconnecting to Live Feed...</h3>
          <p className="text-text-secondary">Network connection is unstable. Waiting for the data stream to resume.</p>
        </div>
      )
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text mb-2">Live Matches</h1>
          <p className="text-text-secondary">World Cup 2026 - Real-time prediction markets</p>
        </div>
        <div className="flex space-x-2">
          {(['all', 'live', 'scheduled'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-accent text-background'
                  : 'bg-card text-text-secondary hover:text-text'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {filteredFixtures.length === 0 ? (
            <div className="glass-card p-12 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                <Clock className="w-8 h-8 text-accent opacity-50" />
              </div>
              <h3 className="text-xl font-bold text-text mb-2">No Matches Found</h3>
              <p className="text-text-secondary">
                {filter === 'live' 
                  ? "There are currently no live matches happening right now. Check the scheduled tab!"
                  : filter === 'scheduled'
                  ? "There are no upcoming scheduled matches at the moment."
                  : "No matches are available."}
              </p>
            </div>
          ) : (
            filteredFixtures.map((fixture) => {
              const stats = generateStats(fixture)
              return (
                <motion.div
                  key={fixture.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.01 }}
                  transition={{ duration: 0.2 }}
                  className={`glass-card p-6 relative overflow-hidden ${fixture.state === 'Live' ? 'border-accent/30 shadow-[0_0_15px_rgba(0,255,157,0.1)]' : ''}`}
                >
                  {fixture.state === 'Live' && (
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-accent to-transparent opacity-50" />
                  )}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center space-x-4 flex-1">
                      {fixture.state === 'Live' && (
                        <div className="flex flex-col items-center">
                          <span className="live-badge animate-pulse mb-1">LIVE</span>
                          <span className="text-xs font-bold text-accent">{fixture.minute}'</span>
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="text-sm text-text-secondary flex items-center space-x-2">
                          <span>{fixture.competition}</span>
                          <span>•</span>
                          <span>{fixture.stage}</span>
                        </div>
                        <div className="flex items-center space-x-3 mt-2">
                          <span className="text-xl font-bold text-text w-24 md:w-32 truncate text-right mr-4">{fixture.home}</span>
                          {fixture.state === 'Live' || fixture.state === 'Final' ? (
                            <div className="flex flex-col items-center justify-center bg-background/50 px-4 py-2 rounded-xl border border-white/5">
                              <span className="text-3xl font-black text-accent tracking-tighter shadow-accent/20 drop-shadow-lg">
                                {fixture.homeScore} - {fixture.awayScore}
                              </span>
                            </div>
                          ) : (
                            <span className="text-text-secondary px-6 font-bold bg-white/5 rounded-xl py-2">VS</span>
                          )}
                          <span className="text-xl font-bold text-text w-24 md:w-32 truncate text-left ml-4">{fixture.away}</span>
                        </div>
                        {fixture.state === 'Live' && (
                          <div className="mt-4 space-y-3">
                            <div className="flex items-center space-x-4">
                              <div className="flex-1">
                                <div className="flex justify-between text-xs text-text-secondary mb-1">
                                  <span>{stats.possession.home}%</span>
                                  <span className="font-medium text-text flex items-center space-x-1"><Activity className="w-3 h-3"/> <span>Possession</span></span>
                                  <span>{stats.possession.away}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden flex">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${stats.possession.home}%` }}
                                    className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
                                  />
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${stats.possession.away}%` }}
                                    className="h-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]" 
                                  />
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-4">
                              <div className="flex-1">
                                <div className="flex justify-between text-xs text-text-secondary mb-1">
                                  <span>{stats.shots.home}</span>
                                  <span className="font-medium text-text flex items-center space-x-1"><Crosshair className="w-3 h-3"/> <span>Shots</span></span>
                                  <span>{stats.shots.away}</span>
                                </div>
                                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden flex">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(stats.shots.home / (stats.shots.home + stats.shots.away)) * 100}%` }}
                                    className="h-full bg-blue-400" 
                                  />
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(stats.shots.away / (stats.shots.home + stats.shots.away)) * 100}%` }}
                                    className="h-full bg-orange-400" 
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      {fixture.state === 'Scheduled' && (
                        <div className="text-sm text-text-secondary flex items-center space-x-2">
                          <Clock className="w-4 h-4" />
                          <span>{new Date(fixture.startTime).toLocaleString()}</span>
                        </div>
                      )}
                      {predictedFixtureIds.has(String(fixture.id)) ? (
                        <button
                          disabled
                          className="bg-white/10 text-text-secondary cursor-not-allowed inline-flex items-center space-x-2 px-4 py-2 text-sm rounded-lg"
                        >
                          <span>Predicted</span>
                        </button>
                      ) : (
                        <Link
                          to={`/prediction/${fixture.id}`}
                          className="gradient-button inline-flex items-center space-x-2 px-4 py-2 text-sm"
                        >
                          <span>Predict</span>
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })
          )}
        </div>
        
        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <MarketAssistant fixture={liveFixture} />
          </div>
        </div>
      </div>
    </div>
  )
}