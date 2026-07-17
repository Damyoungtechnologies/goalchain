import { Link } from 'react-router-dom'
import { Trophy } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="border-t border-white/10 py-12 mt-12 bg-background">
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
  )
}
