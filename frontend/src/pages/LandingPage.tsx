import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { motion } from 'framer-motion'
import { useWallet } from '@solana/wallet-adapter-react'
import { Trophy, Shield, Zap, ArrowRight, Sparkles } from 'lucide-react'

export default function LandingPage() {
  const { connected } = useWallet()
  const { user, signInWithGoogle } = useAuth()
  const navigate = useNavigate()

  const handleAction = async (e: React.MouseEvent, path: string) => {
    e.preventDefault()
    if (!user) {
      try {
        await signInWithGoogle()
        navigate(path)
      } catch (error) {
        console.error("Login failed:", error)
      }
    } else {
      navigate(path)
    }
  }

  const features = [
    {
      icon: Shield,
      title: 'Trustless Settlement',
      description: 'Automated payouts using TxLINE cryptographic proofs and Anchor CPI validation',
    },
    {
      icon: Zap,
      title: 'Live Markets',
      description: 'Real-time odds updates streamed directly from TxLINE official data feeds',
    },
    {
      icon: Trophy,
      title: 'Competitive Odds',
      description: 'Best-in-class odds powered by decentralized liquidity pools',
    },
  ]

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 lg:py-32">
        {/* Background gradient orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent-secondary/10 rounded-full blur-3xl" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center space-x-2 bg-accent/10 border border-accent/20 rounded-full px-4 py-2 mb-8">
                <Sparkles className="w-4 h-4 text-accent" />
                <span className="text-sm text-accent font-medium">
                  World Cup 2026 Prediction Markets
                </span>
              </div>

              <h1 className="text-5xl lg:text-7xl font-bold text-text mb-6">
                Predict. Win.{''}
                <span className="bg-gradient-to-r from-accent to-accent-secondary bg-clip-text text-transparent">
                  {' '}Earn.
                </span>
              </h1>

              <p className="text-xl text-text-secondary max-w-2xl mx-auto mb-10">
                The most advanced decentralized prediction market for World Cup matches.
                Powered by TxLINE data receipts and Solana's lightning-fast settlement.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                {user ? (
                  <button
                    onClick={(e) => handleAction(e, '/live')}
                    className="gradient-button inline-flex items-center space-x-2 text-lg px-8 py-4"
                  >
                    <span>Start Predicting</span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    onClick={(e) => handleAction(e, '/dashboard')}
                    className="gradient-button inline-flex items-center space-x-2 text-lg px-8 py-4"
                  >
                    <span>Get Started</span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={(e) => handleAction(e, '/leaderboard')}
                  className="px-8 py-4 rounded-lg border border-white/20 text-text font-medium hover:bg-white/5 transition-colors"
                >
                  View Leaderboard
                </button>
              </div>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-20"
            >
              {[
                { value: '$2.4M', label: 'Total Volume' },
                { value: '12,450', label: 'Predictions' },
                { value: '8,230', label: 'Active Users' },
                { value: '100%', label: 'Uptime' },
              ].map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-3xl lg:text-4xl font-bold text-text mb-2">
                    {stat.value}
                  </div>
                  <div className="text-sm text-text-secondary">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-secondary/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-text mb-4">
              Why GoalChain?
            </h2>
            <p className="text-text-secondary max-w-2xl mx-auto">
              Built on Solana with TxLINE integration for the most transparent
              and efficient prediction market experience.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="glass-card p-8 hover:border-accent/30 transition-colors"
              >
                <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center mb-6">
                  <feature.icon className="w-7 h-7 text-accent" />
                </div>
                <h3 className="text-xl font-bold text-text mb-3">{feature.title}</h3>
                <p className="text-text-secondary">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="glass-card p-12"
          >
            <Trophy className="w-16 h-16 text-accent mx-auto mb-6" />
            <h2 className="text-3xl font-bold text-text mb-4">
              Ready to Start Predicting?
            </h2>
            <p className="text-text-secondary mb-8 max-w-lg mx-auto">
              Connect your Solana wallet and join thousands of users predicting
              World Cup match outcomes with real-time odds.
            </p>
            <button
              onClick={(e) => handleAction(e, '/dashboard')}
              className="gradient-button inline-flex items-center space-x-2 text-lg px-8 py-4"
            >
              <span>Get Started Now</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent-secondary flex items-center justify-center">
                <Trophy className="w-5 h-5 text-background" />
              </div>
              <span className="font-bold text-text">GoalChain</span>
            </div>
            
            <div className="flex space-x-6 mb-4 md:mb-0">
              <Link to="/terms" className="text-sm text-text-secondary hover:text-accent transition-colors">Terms & Conditions</Link>
              <Link to="/privacy" className="text-sm text-text-secondary hover:text-accent transition-colors">Privacy Policy</Link>
            </div>

            <p className="text-text-secondary text-sm">
              © 2026 GoalChain. Powered by TxLINE and Solana.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}