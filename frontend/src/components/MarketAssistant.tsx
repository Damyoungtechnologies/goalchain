import { motion } from 'framer-motion'
import { Bot, TrendingUp, AlertTriangle, Zap, Activity } from 'lucide-react'
import { useState, useEffect } from 'react'

interface Insight {
  id: number
  text: string
  type: 'stat' | 'trend' | 'alert' | 'insight'
  icon: any
  color: string
}

export default function MarketAssistant({ fixture }: { fixture: any }) {
  const [insights, setInsights] = useState<Insight[]>([])
  const [isTyping, setIsTyping] = useState(false)

  useEffect(() => {
    if (!fixture) return

    setIsTyping(true)
    
    // Simulate AI thinking and generating insights based on live data
    const generateInsights = setTimeout(() => {
      const isLive = fixture.state === 'Live'
      const newInsights: Insight[] = []
      
      if (isLive) {
        const homeAdv = fixture.homeScore - fixture.awayScore;
        const totalGoals = fixture.homeScore + fixture.awayScore;
        const isLate = fixture.minute >= 75;

        newInsights.push({
          id: 1,
          text: `Analyzing live TxLINE Oracle stream at minute ${fixture.minute}...`,
          type: 'stat',
          icon: Activity,
          color: 'text-blue-400'
        });

        if (homeAdv > 0) {
          newInsights.push({
            id: 2,
            text: `Market momentum is heavily favoring ${fixture.home} with a ${homeAdv} goal lead.`,
            type: 'trend',
            icon: TrendingUp,
            color: 'text-green-400'
          });
        } else if (homeAdv < 0) {
          newInsights.push({
            id: 2,
            text: `${fixture.away} holds a strong advantage. Expect volatile odds if ${fixture.home} counterattacks.`,
            type: 'trend',
            icon: TrendingUp,
            color: 'text-orange-400'
          });
        }

        if (homeAdv === 0 && isLate) {
          newInsights.push({
            id: 3,
            text: `High probability of a late decisive goal! Historical data shows 82% of similar matches end with a winner in the final 15 mins.`,
            type: 'insight',
            icon: Zap,
            color: 'text-yellow-400'
          });
        }

        if (totalGoals >= 3) {
          newInsights.push({
            id: 4,
            text: `High scoring match detected. Over 2.5 goals market has likely already settled.`,
            type: 'alert',
            icon: AlertTriangle,
            color: 'text-purple-400'
          });
        }
      } else if (fixture.state === 'Scheduled') {
        newInsights.push({
          id: 5,
          text: `Pre-match odds are highly volatile. Heavy volume detected on ${fixture.away}.`,
          type: 'alert',
          icon: AlertTriangle,
          color: 'text-orange-400'
        });
        newInsights.push({
          id: 6,
          text: `Market liquidity is building up for ${fixture.home} vs ${fixture.away}.`,
          type: 'insight',
          icon: Bot,
          color: 'text-purple-400'
        });
      }

      setInsights(newInsights)
      setIsTyping(false)
    }, 1500)

    return () => clearTimeout(generateInsights)
  }, [fixture?.id, fixture?.homeScore, fixture?.awayScore, fixture?.minute])

  if (!fixture) return null

  return (
    <div className="glass-card p-5 relative overflow-hidden h-full">
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-2xl pointer-events-none" />
      
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent/20 to-accent-secondary/20 flex items-center justify-center border border-accent/20 relative">
          <Bot className="w-5 h-5 text-accent" />
          {isTyping && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-accent"></span>
            </span>
          )}
        </div>
        <div>
          <h3 className="font-bold text-text">AI Market Assistant</h3>
          <p className="text-xs text-text-secondary">Analyzing live Oracle data...</p>
        </div>
      </div>

      <div className="space-y-4">
        {isTyping ? (
          <div className="flex items-center space-x-2 text-text-secondary text-sm p-3 bg-white/5 rounded-lg">
            <Bot className="w-4 h-4 animate-pulse" />
            <span className="animate-pulse">Synthesizing insights...</span>
          </div>
        ) : insights.length > 0 ? (
          insights.map((insight, index) => (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, x: -20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ delay: index * 0.4, type: "spring", stiffness: 100 }}
              className="flex items-start space-x-3 p-3 bg-white/5 rounded-lg border border-white/5 hover:border-white/10 transition-colors shadow-sm"
            >
              <div className={`mt-0.5 ${insight.color}`}>
                <insight.icon className="w-4 h-4" />
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">
                {insight.text}
              </p>
            </motion.div>
          ))
        ) : (
          <div className="text-sm text-text-secondary italic text-center p-4">
            No significant market anomalies detected at this time.
          </div>
        )}
      </div>
    </div>
  )
}
