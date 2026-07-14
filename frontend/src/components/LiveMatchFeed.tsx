import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, Activity, AlertCircle, Play, 
  Flag, Crosshair, UserX, AlertTriangle, 
  MessageSquare, Zap, Shield, StopCircle, RefreshCw
} from 'lucide-react';

interface LiveMatchFeedProps {
  events: any[];
  homeTeam: string;
  awayTeam: string;
}

export default function LiveMatchFeed({ events, homeTeam, awayTeam }: LiveMatchFeedProps) {
  const hasEvents = events && events.length > 0;
  const getEventDetails = (ev: any) => {
    const pName = ev.Participant === 1 ? homeTeam : ev.Participant === 2 ? awayTeam : '';
    
    // Filter out unexplanatory or noisy events
    const noiseActions = [
      'weather', 'venue', 'var', 'var_end', 'status', 'standby', 'score_adjustment', 
      'possible', 'players_warming_up', 'players_on_the_pitch', 'pitch', 'lineups', 
      'jersey', 'coverage_update', 'connected', 'action_discarded', 'action_amend', 
      'clock_adjustment'
    ];
    if (noiseActions.includes(ev.Action)) return null;

    switch(ev.Action) {
      case 'goal': return { icon: <Activity className="w-5 h-5 text-green-400" />, title: 'GOAL!', desc: pName ? `Goal for ${pName}` : '', color: 'bg-green-400/10 border-green-400 text-green-400' };
      case 'shot': return { icon: <Crosshair className="w-5 h-5 text-blue-400" />, title: 'Shot', desc: pName ? `Shot by ${pName} (${ev.Data?.Outcome || 'Unknown'})` : '', color: 'bg-blue-400/10 border-blue-400 text-blue-400' };
      case 'corner': return { icon: <Flag className="w-5 h-5 text-yellow-400" />, title: 'Corner Kick', desc: pName ? `Corner for ${pName}` : '', color: 'bg-yellow-400/10 border-yellow-400 text-yellow-400' };
      case 'injury': return { icon: <AlertCircle className="w-5 h-5 text-red-400" />, title: 'Injury', desc: pName ? `Player down for ${pName}` : '', color: 'bg-red-400/10 border-red-400 text-red-400' };
      case 'yellow_card': return { icon: <AlertTriangle className="w-5 h-5 text-yellow-500 fill-yellow-500" />, title: 'Yellow Card', desc: pName, color: 'bg-yellow-500/10 border-yellow-500 text-yellow-500' };
      case 'red_card': return { icon: <AlertTriangle className="w-5 h-5 text-red-500 fill-red-500" />, title: 'Red Card', desc: pName, color: 'bg-red-500/10 border-red-500 text-red-500' };
      case 'foul': return { icon: <AlertTriangle className="w-4 h-4 text-orange-400" />, title: 'Foul', desc: pName, color: 'bg-orange-400/10 border-orange-400 text-orange-400' };
      case 'free_kick': return { icon: <Play className="w-4 h-4 text-blue-300" />, title: 'Free Kick', desc: pName, color: 'bg-blue-300/10 border-blue-300 text-blue-300' };
      case 'throw_in': return { icon: <RefreshCw className="w-4 h-4 text-gray-400" />, title: 'Throw In', desc: pName, color: 'bg-gray-400/10 border-gray-400 text-gray-400' };
      case 'offside': return { icon: <Flag className="w-4 h-4 text-orange-400" />, title: 'Offside', desc: pName, color: 'bg-orange-400/10 border-orange-400 text-orange-400' };
      case 'substitution': return { icon: <RefreshCw className="w-4 h-4 text-blue-400" />, title: 'Substitution', desc: pName, color: 'bg-blue-400/10 border-blue-400 text-blue-400' };
      case 'attack_possession': 
      case 'danger_possession':
      case 'high_danger_possession': return { icon: <Zap className="w-4 h-4 text-accent" />, title: 'Dangerous Attack', desc: pName ? `${pName} is attacking` : '', color: 'bg-accent/10 border-accent text-accent' };
      case 'safe_possession': 
      case 'possession': return { icon: <Shield className="w-4 h-4 text-gray-400" />, title: 'Possession', desc: pName ? `${pName} has the ball` : '', color: 'bg-gray-400/10 border-gray-400 text-gray-400' };
      case 'comment': return { icon: <MessageSquare className="w-4 h-4 text-purple-400" />, title: 'Commentary', desc: ev.Data?.Text || 'Match update', color: 'bg-purple-400/10 border-purple-400 text-purple-400' };
      case 'additional_time': return { icon: <Clock className="w-4 h-4 text-blue-400" />, title: 'Additional Time', desc: ev.Data?.Minutes ? `+${ev.Data.Minutes} mins` : '', color: 'bg-blue-400/10 border-blue-400 text-blue-400' };
      case 'halftime_finalised': return { icon: <StopCircle className="w-4 h-4 text-text" />, title: 'Half Time', desc: 'First half ends', color: 'bg-white/10 border-white/20 text-text' };
      case 'kickoff': 
      case 'kickoff_team': return { icon: <Play className="w-4 h-4 text-green-400" />, title: 'Kick Off', desc: 'Match starts / resumes', color: 'bg-green-400/10 border-green-400 text-green-400' };
      default: 
        return { 
          icon: <Activity className="w-4 h-4 text-gray-400" />, 
          title: ev.Action ? ev.Action.replace(/_/g, ' ') : 'Event', 
          desc: ev.Data?.Text || pName || '', 
          color: 'bg-white/5 border-white/10 text-gray-400' 
        };
    }
  };

  // Filter out noise to get actual events.
  const meaningfulEvents = hasEvents 
    ? events.map((ev: any) => ({ ev, details: getEventDetails(ev) })).filter((item: any) => item.details !== null)
    : [];
  // Sort chronologically by match clock to prevent any out-of-order amendments from the Oracle
  const sortedEvents = meaningfulEvents.sort((a: any, b: any) => {
    const clockA = a.ev.Clock?.Seconds || 0;
    const clockB = b.ev.Clock?.Seconds || 0;
    if (clockA === clockB) return (a.ev.Id || 0) - (b.ev.Id || 0);
    return clockA - clockB;
  });

  // Display all meaningful events chronologically (starts from beginning of match)
  const displayEvents = sortedEvents;

  return (
    <div className="glass-card p-6 mt-4 relative overflow-hidden">
      {/* Background glowing orb */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-accent/10 blur-3xl rounded-full pointer-events-none"></div>
      
      <div className="flex items-center justify-between mb-6 relative z-10">
        <div>
          <h3 className="text-lg font-bold text-text flex items-center gap-2">
            <Activity className="w-5 h-5 text-accent animate-pulse" />
            Live Match Feed
          </h3>
          <p className="text-sm text-text-secondary">Oracle Real-Time Event Stream</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-accent border border-accent/20 bg-accent/10 px-3 py-1 rounded-full">
          <span className="w-2 h-2 rounded-full bg-accent animate-ping"></span>
          Live Connection
        </div>
      </div>

      <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2 relative z-10">
        <AnimatePresence>
          {displayEvents.length > 0 ? displayEvents.map(({ ev, details }: any, i: number) => {
            const minute = ev.Clock?.Seconds ? Math.floor(ev.Clock.Seconds / 60) : null;
            return (
              <motion.div 
                key={ev.Id || i}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-4 items-center p-3 rounded-xl border ${details.color} backdrop-blur-sm transition-all hover:bg-white/5`}
              >
                <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-black/20 shadow-inner">
                  {details.icon}
                </div>
                <div className="flex-grow">
                  <div className="flex items-center gap-2">
                    {minute !== null && <span className="font-mono text-xs px-2 py-0.5 rounded bg-black/30 opacity-90">{minute}'</span>}
                    <span className="font-bold capitalize">{details.title}</span>
                  </div>
                  {details.desc && (
                    <div className="text-sm opacity-80 mt-1">{details.desc}</div>
                  )}
                </div>
              </motion.div>
            )
          }) : (
            <div className="text-center p-8 text-text-secondary border border-white/5 rounded-xl bg-black/20">
              <Activity className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p>No events recorded for this match yet.</p>
              <p className="text-xs opacity-70 mt-1">Waiting for the oracle to broadcast updates...</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
