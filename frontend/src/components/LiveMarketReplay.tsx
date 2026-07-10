import { motion } from 'framer-motion'
import { Clock, TrendingUp, AlertCircle, PlayCircle, FastForward } from 'lucide-react'
import { useState, useEffect } from 'react'

interface LiveMarketReplayProps {
  prediction: any
  fixture: any
}

export default function LiveMarketReplay({ prediction, fixture }: LiveMarketReplayProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentMinute, setCurrentMinute] = useState(0)

  // Synthetic replay timeline based on match outcome
  const generateTimeline = () => {
    if (!fixture) return []
    
    const timeline = []
    let currentOdds = 45 // starting generic odds

    // Match Start
    timeline.push({ minute: 0, event: "Match Started", odds: currentOdds, type: "info" })

    if (prediction.status === 'won') {
      timeline.push({ minute: 15, event: "Early Pressure", odds: 52, type: "trend" })
      timeline.push({ minute: 38, event: "Spain Scores!", odds: 78, type: "action" })
      timeline.push({ minute: 60, event: "Belgium Equalizes!", odds: 92, type: "action" })
      timeline.push({ minute: 89, event: "Spain Late Winner! (2-1)", odds: 100, type: "success" })
    } else {
      timeline.push({ minute: 20, event: "Slow Tempo", odds: 38, type: "trend" })
      timeline.push({ minute: 55, event: "Few Chances Created", odds: 15, type: "alert" })
      timeline.push({ minute: 90, event: "Full Time - Under/Lost", odds: 0, type: "error" })
    }

    return timeline
  }

  const timeline = generateTimeline()

  useEffect(() => {
    if (isPlaying) {
      if (currentMinute >= 90) {
        setIsPlaying(false)
        return
      }
      const timer = setInterval(() => {
        setCurrentMinute(prev => Math.min(prev + 5, 90))
      }, 300)
      return () => clearInterval(timer)
    }
  }, [isPlaying, currentMinute])

  const activeEvents = timeline.filter(t => t.minute <= currentMinute)

  const getTypeStyle = (type: string) => {
    switch(type) {
      case 'action': return 'text-accent border-accent bg-accent/10'
      case 'success': return 'text-green-400 border-green-400 bg-green-400/10'
      case 'error': return 'text-red-400 border-red-400 bg-red-400/10'
      case 'alert': return 'text-orange-400 border-orange-400 bg-orange-400/10'
      default: return 'text-blue-400 border-blue-400 bg-blue-400/10'
    }
  }

  const getIcon = (type: string) => {
    switch(type) {
      case 'action': return <Zap className="w-3 h-3" />
      case 'trend': return <TrendingUp className="w-3 h-3" />
      case 'alert': return <AlertCircle className="w-3 h-3" />
      default: return <Clock className="w-3 h-3" />
    }
  }
  
  // Need Zap icon for action
  const Zap = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
  )

  if (!fixture || (prediction.status !== 'won' && prediction.status !== 'lost')) {
    return null
  }

  return (
    <div className="glass-card p-6 mt-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-text">Live Market Replay</h3>
          <p className="text-sm text-text-secondary">See how this market evolved</p>
        </div>
        <button 
          onClick={() => {
            if (currentMinute >= 90) setCurrentMinute(0)
            setIsPlaying(!isPlaying)
          }}
          className="flex items-center space-x-2 bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg border border-white/10 transition-colors"
        >
          {isPlaying ? <FastForward className="w-4 h-4 text-accent" /> : <PlayCircle className="w-4 h-4 text-accent" />}
          <span className="text-sm font-medium text-text">{isPlaying ? 'Speeding...' : currentMinute >= 90 ? 'Replay' : 'Play Replay'}</span>
        </button>
      </div>

      <div className="relative">
        {/* Timeline track */}
        <div className="absolute top-0 bottom-0 left-[27px] w-[2px] bg-white/5" />
        
        {/* Progress bar */}
        <div 
          className="absolute top-0 left-[27px] w-[2px] bg-accent transition-all duration-300"
          style={{ height: `${(currentMinute / 90) * 100}%` }}
        />

        <div className="space-y-6 relative">
          {timeline.map((item, index) => {
            const isActive = item.minute <= currentMinute
            const isLastActive = isActive && (index === activeEvents.length - 1)
            const style = getTypeStyle(item.type)
            
            return (
              <div 
                key={index} 
                className={`flex items-center space-x-4 transition-all duration-500 ${isActive ? 'opacity-100 translate-x-0' : 'opacity-30 -translate-x-4'}`}
              >
                <div className="w-14 text-right">
                  <span className={`text-sm font-bold ${isActive ? 'text-text' : 'text-text-secondary'}`}>
                    {item.minute}'
                  </span>
                </div>
                
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 z-10 transition-colors duration-300 ${isActive ? style : 'bg-background border-white/10 text-white/20'}`}>
                  {isActive && getIcon(item.type)}
                </div>
                
                <div className={`flex-1 p-3 rounded-lg border transition-colors duration-300 ${isActive ? style.replace('text-', 'border-').split(' ')[1] + ' ' + style.split(' ')[2] : 'border-white/5 bg-transparent'}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${isActive ? 'text-text' : 'text-text-secondary'}`}>
                      {item.event}
                    </span>
                    {isActive && (
                      <span className="text-sm font-bold ml-2">
                        {prediction.outcome} {item.odds}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
