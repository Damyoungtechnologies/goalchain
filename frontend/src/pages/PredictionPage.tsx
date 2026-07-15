import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Clock, AlertCircle, Code2, X, Activity, Bot } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { Market, Fixture } from '@/types'
import { useState } from 'react'
import BetSlip from '../components/BetSlip'
import LiveMatchFeed from '../components/LiveMatchFeed'
import MarketAssistant from '../components/MarketAssistant'

const mockMarkets: Market[] = [
  {
    id: '17952170-winner-home',
    key: 'winner-home',
    fixtureId: 17952170,
    name: 'Match Winner',
    condition: 'Final score result',
    status: 'open',
    escrow: 342,
    result: null,
    outcomes: [
      { label: 'Home', probability: 0.4, decimal: 2.5 },
      { label: 'Draw', probability: 0.3, decimal: 3.33 },
      { label: 'Away', probability: 0.3, decimal: 3.33 },
    ],
  },
  {
    id: '17952170-total-25',
    key: 'total-25',
    fixtureId: 17952170,
    name: 'Total Goals 2.5',
    condition: 'Home plus away goals',
    status: 'open',
    escrow: 216,
    result: null,
    outcomes: [
      { label: 'Over', probability: 0.54, decimal: 1.85 },
      { label: 'Under', probability: 0.46, decimal: 2.17 },
    ],
  },
  {
    id: '17952170-btts',
    key: 'btts',
    fixtureId: 17952170,
    name: 'Both Teams to Score',
    condition: 'Will both teams score?',
    status: 'open',
    escrow: 185,
    result: null,
    outcomes: [
      { label: 'Yes', probability: 0.58, decimal: 1.72 },
      { label: 'No', probability: 0.42, decimal: 2.38 },
    ],
  },
  {
    id: '17952170-dc',
    key: 'double-chance',
    fixtureId: 17952170,
    name: 'Double Chance',
    condition: 'Home/Draw or Away/Draw',
    status: 'open',
    escrow: 512,
    result: null,
    outcomes: [
      { label: 'Home or Draw', probability: 0.7, decimal: 1.42 },
      { label: 'Away or Draw', probability: 0.6, decimal: 1.66 },
      { label: 'Home or Away', probability: 0.7, decimal: 1.42 },
    ],
  }
]

export default function PredictionPage() {
  const { fixtureId } = useParams()
  const [isBetSlipOpen, setIsBetSlipOpen] = useState(false)
  const [activeRawFeed, setActiveRawFeed] = useState<any>(null)
  const [activeLiveFeed, setActiveLiveFeed] = useState<any>(null)
  const [activeAI, setActiveAI] = useState<any>(null)
  const [selectedOutcome, setSelectedOutcome] = useState<{
    marketId: string
    marketName: string
    outcome: string
    odds: number
  } | null>(null)

  const { data: fixtures, isLoading, error } = useQuery<Fixture[]>({
    queryKey: ['fixtures'],
    queryFn: async () => {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8787'}/api/fixtures`)
      if (!response.ok) throw new Error('Network response was not ok')
      const data = await response.json()
      const fixturesArray = Array.isArray(data) ? data : data.value || []
      
      return fixturesArray.map((f: any) => ({
        id: f.FixtureId?.toString() || Math.random().toString(),
        home: f.Participant1IsHome ? f.Participant1 : f.Participant2,
        away: f.Participant1IsHome ? f.Participant2 : f.Participant1,
        homeScore: f.Participant1Score || 0,
        awayScore: f.Participant2Score || 0,
        minute: Number(f.Minute || f.minute || f.GameTime || 0),
        competition: f.Competition,
        stage: 'Group Stage',
        state: f.GameState === 2 ? 'Live' : f.GameState === 3 ? 'Final' : 'Scheduled',
        startTime: f.StartTime,
        events: f.events || [],
        raw: f
      }))
    },
  })

  const { data: rawTxlineMarkets, isLoading: isLoadingMarkets } = useQuery({
    queryKey: ['markets', fixtureId],
    queryFn: async () => {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8787'}/api/fixtures/${fixtureId}/markets`)
      if (!response.ok) return []
      const data = await response.json()
      return Array.isArray(data) ? data : data.value || []
    },
    enabled: !!fixtureId
  })

  const fixture = fixtures?.find((f) => String(f.id) === String(fixtureId))

  const markets = (rawTxlineMarkets || []).map((m: any) => {
    let name = m.SuperOddsType || 'Unknown Market'
    if (name === 'ASIANHANDICAP_PARTICIPANT_GOALS') name = 'Asian Handicap'
    else if (name === 'TOTAL_PARTICIPANT_GOALS') name = 'Total Goals'
    else if (name === 'OVERUNDER_PARTICIPANT_GOALS') name = 'Over/Under Goals'
    else if (name === 'MATCH_WINNER') name = 'Match Winner'

    const outcomes = (m.PriceNames || []).map((pName: string, i: number) => {
      const price = m.Prices?.[i] || 0
      const decimalOdds = price > 0 ? (price / 1000) : 0
      
      // Calculate probability from Pct array, or fallback to implied probability from odds
      let pct = parseFloat(m.Pct?.[i] || '0')
      let probability = pct > 0 ? (pct / 100) : (decimalOdds > 0 ? (1 / decimalOdds) : 0)

      let label = pName
      if (label === 'part1') label = 'Home'
      if (label === 'part2') label = 'Away'
      if (label === 'draw') label = 'Draw'
      if (label === 'over') label = 'Over'
      if (label === 'under') label = 'Under'

      return {
        label,
        probability,
        decimal: decimalOdds
      }
    })

    return {
      id: m.MessageId || Math.random().toString(),
      key: m.SuperOddsType,
      fixtureId: m.FixtureId,
      name,
      condition: m.MarketParameters ? m.MarketParameters.replace('line=', 'Line: ') : 'Result',
      status: 'open',
      escrow: 0,
      result: null,
      outcomes
    }
  })

  if (isLoading || isLoadingMarkets) {
    return <div className="text-center p-12 text-text-secondary">Loading fixture data...</div>
  }

  if (error || !fixture) {
    return (
      <div className="text-center p-12">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4 opacity-50" />
        <h2 className="text-xl font-bold text-text">Fixture not found</h2>
        <Link to="/live" className="text-accent hover:underline mt-4 inline-block">Back to live matches</Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link to="/live" className="inline-flex items-center text-text-secondary hover:text-text transition-colors">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to matches
      </Link>

      <div className="glass-card p-8 relative overflow-hidden">
        {fixture.state === 'Live' && (
          <div className="absolute top-4 left-4">
            <span className="live-badge">LIVE {fixture.minute}'</span>
          </div>
        )}
        <div className="text-center mb-4">
          <span className="text-sm font-medium px-3 py-1 bg-white/5 rounded-full text-text-secondary border border-white/10">
            {fixture.competition}
          </span>
        </div>
        <div className="flex items-center justify-center space-x-4 md:space-x-8">
          <span className="text-2xl md:text-4xl font-bold text-text text-right flex-1">{fixture.home}</span>
          <div className="flex flex-col items-center">
            {fixture.state === 'Live' || fixture.state === 'Final' ? (
              <span className="text-3xl md:text-5xl font-black text-accent tracking-tighter">
                {fixture.homeScore} - {fixture.awayScore}
              </span>
            ) : (
              <span className="text-2xl font-bold text-text-secondary px-4 py-2 bg-white/5 rounded-xl">VS</span>
            )}
          </div>
          <span className="text-2xl md:text-4xl font-bold text-text text-left flex-1">{fixture.away}</span>
        </div>
        
        <div className="mt-8 border-t border-white/5 pt-6 flex flex-col sm:flex-row gap-4 max-w-2xl mx-auto">
          <button
            onClick={() => setActiveLiveFeed(fixture)}
            className="flex-1 py-3 bg-accent/10 hover:bg-accent/20 text-accent font-bold rounded-xl border border-accent/20 transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent/5"
          >
            <Activity className="w-5 h-5 animate-pulse" />
            Live Match Events
          </button>
          <button
            onClick={() => setActiveAI(fixture)}
            className="flex-1 py-3 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 font-bold rounded-xl border border-purple-500/20 transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-500/5"
          >
            <Bot className="w-5 h-5" />
            AI Analysis Log
          </button>
        </div>

        {fixture.state === 'Scheduled' && (
          <div className="text-center mt-6 text-text-secondary flex items-center justify-center space-x-2">
            <Clock className="w-4 h-4" />
            <span>{new Date(fixture.startTime).toLocaleString()}</span>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold text-text">Markets</h2>
        {markets.length === 0 ? (
          <div className="glass-card p-12 text-center text-text-secondary">
            No live odds currently available from TxLINE for this match.
          </div>
        ) : (
          markets.map((market: any) => (
            <motion.div
              key={market.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-text">{market.name}</h3>
                  <p className="text-sm text-text-secondary">{market.condition}</p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-text-secondary">Escrow</div>
                  <div className="font-bold text-accent">{market.escrow} SOL</div>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {market.outcomes.map((outcome: any) => (
                  <button
                    key={outcome.label}
                    onClick={() => {
                      setSelectedOutcome({
                        marketId: market.id,
                        marketName: market.name,
                        outcome: outcome.label === 'Home' ? fixture.home : outcome.label === 'Away' ? fixture.away : outcome.label,
                        odds: outcome.decimal
                      })
                      setIsBetSlipOpen(true)
                    }}
                    className="p-4 rounded-lg border border-white/10 hover:border-accent/50 hover:bg-white/5 transition-colors group text-left"
                  >
                    <div className="font-medium text-text group-hover:text-accent transition-colors">
                      {outcome.label === 'Home' ? fixture.home : outcome.label === 'Away' ? fixture.away : outcome.label}
                    </div>
                    <div className="text-sm text-text-secondary mt-1">
                      {Math.round(outcome.probability * 100)}%
                    </div>
                    <div className="text-lg font-bold text-accent mt-1">
                      {outcome.decimal.toFixed(2)}x
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          ))
        )}
      </div>

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
              className="relative w-full max-w-lg max-h-[85vh] flex flex-col glass-card border border-white/10 shadow-2xl overflow-hidden rounded-xl bg-gray-900"
            >
              <div className="absolute top-4 right-4 z-20">
                <button
                  onClick={() => setActiveLiveFeed(null)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors text-text-secondary hover:text-text"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 border-b border-white/10">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Activity className="w-5 h-5 text-accent animate-pulse" />
                  Live Match Events
                </h3>
                <p className="text-sm text-text-secondary mt-1">
                  {activeLiveFeed.home} vs {activeLiveFeed.away}
                </p>
              </div>
              <div className="overflow-y-auto custom-scrollbar flex-grow p-1">
                <LiveMatchFeed events={(fixture as any)?.events || activeLiveFeed.events || (fixture as any)?.raw?.events || activeLiveFeed.raw?.events || []} homeTeam={activeLiveFeed.home} awayTeam={activeLiveFeed.away} />
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
              className="relative w-full max-w-lg max-h-[85vh] flex flex-col glass-card border border-white/10 shadow-2xl overflow-hidden rounded-xl bg-gray-900"
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

      <BetSlip 
        isOpen={isBetSlipOpen} 
        onClose={() => setIsBetSlipOpen(false)} 
        fixture={fixture} 
        selectedOutcome={selectedOutcome} 
      />
    </div>
  )
}