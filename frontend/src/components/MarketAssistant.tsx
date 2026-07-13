import { motion } from 'framer-motion'
import { Bot, TrendingUp, AlertTriangle, Zap, Activity } from 'lucide-react'
import { useState, useEffect } from 'react'

const iconMap: any = {
  Zap, TrendingUp, AlertTriangle, Activity
}

export default function MarketAssistant({ fixture, showHistory = false }: { fixture: any, showHistory?: boolean }) {
  const [isTyping, setIsTyping] = useState(false)
  const [displayedInsights, setDisplayedInsights] = useState<any[]>([])

  useEffect(() => {
    if (!fixture || !fixture.aiInsights) return

    // Sort insights chronologically
    const allInsights = [...fixture.aiInsights].sort((a, b) => a.timestamp - b.timestamp);
    
    if (showHistory) {
      setDisplayedInsights(allInsights.reverse());
    } else {
      // In live view, just show the 4 most recent
      setIsTyping(true)
      const timer = setTimeout(() => {
        setDisplayedInsights(allInsights.reverse().slice(0, 4))
        setIsTyping(false)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [fixture, showHistory])

  if (!fixture) return null

  return (
    <div className={`glass-card p-5 relative overflow-hidden ${showHistory ? 'h-full max-h-[60vh] overflow-y-auto custom-scrollbar' : 'h-full'}`}>
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-2xl pointer-events-none" />
      
      <div className="flex items-center space-x-3 mb-6 sticky top-0 bg-[#0f172a]/80 backdrop-blur-md z-10 py-2 border-b border-white/5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent/20 to-accent-secondary/20 flex items-center justify-center border border-accent/20 relative">
          <Bot className="w-5 h-5 text-accent" />
          {isTyping && !showHistory && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-accent"></span>
            </span>
          )}
        </div>
        <div>
          <h3 className="font-bold text-text">AI Market {showHistory ? 'Analysis Log' : 'Assistant'}</h3>
          <p className="text-xs text-text-secondary">{showHistory ? 'Historical Oracle Analysis' : 'Analyzing live Oracle data...'}</p>
        </div>
      </div>

      <div className="space-y-4 relative z-0">
        {isTyping && !showHistory ? (
          <div className="flex items-center space-x-2 text-text-secondary text-sm p-3 bg-white/5 rounded-lg">
            <Bot className="w-4 h-4 animate-pulse" />
            <span className="animate-pulse">Synthesizing insights...</span>
          </div>
        ) : displayedInsights.length > 0 ? (
          displayedInsights.map((insight, index) => {
            const Icon = iconMap[insight.icon] || Bot;
            return (
              <motion.div
                key={insight.id || index}
                initial={{ opacity: 0, x: showHistory ? 0 : -20, y: showHistory ? 10 : 0, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                transition={{ delay: showHistory ? index * 0.05 : index * 0.2, type: "spring", stiffness: 100 }}
                className="flex items-start space-x-3 p-3 bg-white/5 rounded-lg border border-white/5 hover:border-white/10 transition-colors shadow-sm relative"
              >
                {showHistory && (
                  <div className="absolute top-2 right-2 text-xs font-mono bg-black/40 px-2 py-0.5 rounded text-text-secondary opacity-60">
                    {insight.minute}'
                  </div>
                )}
                <div className={`mt-0.5 ${insight.color || 'text-accent'}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <p className="text-sm text-text-secondary leading-relaxed pr-8">
                  {insight.text}
                </p>
              </motion.div>
            )
          })
        ) : (
          <div className="text-sm text-text-secondary italic text-center p-4">
            No analysis data available.
          </div>
        )}
      </div>
    </div>
  )
}
