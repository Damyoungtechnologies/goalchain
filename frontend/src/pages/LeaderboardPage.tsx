import { motion } from 'framer-motion'
import { Trophy, Medal, Award, TrendingUp, Users } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import type { LeaderboardEntry } from '@/types'

const rankIcons = [Trophy, Medal, Award]

export default function LeaderboardPage() {
  const { data: leaderboardData = [] } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8787'}/api/leaderboard`)
      if (!res.ok) throw new Error('Failed to fetch leaderboard')
      return res.json()
    },
    refetchInterval: 15000
  })
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text mb-2">Leaderboard</h1>
        <p className="text-text-secondary">Top predictors competing for World Cup glory</p>
      </div>

      <div className="glass-card overflow-hidden">
        {leaderboardData.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-accent opacity-50" />
            </div>
            <h3 className="text-xl font-bold text-text mb-2">Leaderboard Empty</h3>
            <p className="text-text-secondary mb-6 max-w-md">
              No users have settled predictions yet. Be the first to make a prediction and claim the top spot!
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Podium Section */}
            {leaderboardData.length >= 3 && (
              <div className="flex justify-center items-end h-64 gap-2 md:gap-4 px-4 py-8 bg-gradient-to-t from-background/50 to-transparent rounded-t-xl">
                {/* 2nd Place */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex flex-col items-center flex-1 max-w-[120px]"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-400 flex items-center justify-center mb-2 shadow-[0_0_15px_rgba(148,163,184,0.5)]">
                    <Medal className="w-6 h-6 text-slate-800" />
                  </div>
                  <div className="text-sm font-bold text-text truncate w-full text-center">{leaderboardData[1].username || leaderboardData[1].wallet.slice(0,6)+'...'}</div>
                  <div className="text-xs text-accent font-bold mb-2">{leaderboardData[1].profit} SOL</div>
                  <div className="w-full h-32 bg-slate-800/80 rounded-t-lg border-t-4 border-slate-400 flex justify-center pt-2 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-slate-400/20 to-transparent" />
                    <span className="text-2xl font-bold text-slate-400/50">2</span>
                  </div>
                </motion.div>

                {/* 1st Place */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="flex flex-col items-center flex-1 max-w-[140px]"
                >
                  <div className="w-16 h-16 rounded-full bg-yellow-400 flex items-center justify-center mb-2 shadow-[0_0_20px_rgba(250,204,21,0.5)] z-10">
                    <Trophy className="w-8 h-8 text-yellow-800" />
                  </div>
                  <div className="text-base font-bold text-text truncate w-full text-center">{leaderboardData[0].username || leaderboardData[0].wallet.slice(0,6)+'...'}</div>
                  <div className="text-sm text-accent font-bold mb-2">{leaderboardData[0].profit} SOL</div>
                  <div className="w-full h-40 bg-yellow-900/40 rounded-t-lg border-t-4 border-yellow-400 flex justify-center pt-2 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-yellow-400/20 to-transparent" />
                    <span className="text-3xl font-bold text-yellow-400/50">1</span>
                  </div>
                </motion.div>

                {/* 3rd Place */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="flex flex-col items-center flex-1 max-w-[120px]"
                >
                  <div className="w-12 h-12 rounded-full bg-amber-700 flex items-center justify-center mb-2 shadow-[0_0_15px_rgba(180,83,9,0.5)]">
                    <Award className="w-6 h-6 text-amber-100" />
                  </div>
                  <div className="text-sm font-bold text-text truncate w-full text-center">{leaderboardData[2].username || leaderboardData[2].wallet.slice(0,6)+'...'}</div>
                  <div className="text-xs text-accent font-bold mb-2">{leaderboardData[2].profit} SOL</div>
                  <div className="w-full h-24 bg-amber-900/60 rounded-t-lg border-t-4 border-amber-700 flex justify-center pt-2 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-amber-700/20 to-transparent" />
                    <span className="text-2xl font-bold text-amber-700/50">3</span>
                  </div>
                </motion.div>
              </div>
            )}

            <table className="w-full">
              <thead className="bg-secondary/50">
                <tr>
                  <th className="text-left py-4 px-6 text-sm font-medium text-text-secondary">Rank</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-text-secondary">User</th>
                  <th className="text-right py-4 px-6 text-sm font-medium text-text-secondary">Profit</th>
                  <th className="text-right py-4 px-6 text-sm font-medium text-text-secondary">ROI</th>
                  <th className="text-right py-4 px-6 text-sm font-medium text-text-secondary hidden md:table-cell">Predictions</th>
                </tr>
              </thead>
              <tbody>
                {leaderboardData.slice(leaderboardData.length >= 3 ? 3 : 0).map((entry: any, index: number) => {
                  const actualRank = leaderboardData.length >= 3 ? index + 3 : index;
                  const RankIcon = rankIcons[actualRank] || null
                  return (
                    <motion.tr
                      key={entry.rank}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="border-t border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-2">
                          {RankIcon && <RankIcon className="w-5 h-5 text-accent" />}
                          <span className={`font-bold ${actualRank < 3 ? 'text-accent' : 'text-text'}`}>
                            #{entry.rank}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div>
                          <div className="font-medium text-text">
                            {entry.username || entry.wallet}
                          </div>
                          {entry.username && (
                            <div className="text-sm text-text-secondary">{entry.wallet}</div>
                          )}
                        </div>
                      </td>
                      <td className="text-right py-4 px-6">
                        <div className="font-bold text-accent">{entry.profit} SOL</div>
                      </td>
                      <td className="text-right py-4 px-6">
                        <div className="flex items-center justify-end space-x-1">
                          <TrendingUp className="w-4 h-4 text-accent" />
                          <span className="font-bold text-text">{entry.roi}%</span>
                        </div>
                      </td>
                      <td className="text-right py-4 px-6 hidden md:table-cell">
                        <div className="text-text">{entry.predictions}</div>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}