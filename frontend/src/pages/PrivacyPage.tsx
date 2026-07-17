import { ShieldCheck } from 'lucide-react'
import Footer from '../components/Footer'

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <div className="glass-card p-8 md:p-12">
        <div className="flex items-center space-x-4 mb-8 border-b border-white/10 pb-8">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center">
            <ShieldCheck className="w-8 h-8 text-accent" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-text">Privacy Policy</h1>
            <p className="text-text-secondary mt-1">Last updated: July 8, 2026</p>
          </div>
        </div>

        <div className="space-y-8 text-text-secondary leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-text mb-4">1. Information We Collect</h2>
            <p>
              When you use GoalChain, we collect information that you voluntarily provide to us, including your Google account email address (for authentication purposes), and your Solana public wallet address (for processing prediction settlements and payouts).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-text mb-4">2. How We Use Your Information</h2>
            <p>
              We use your information exclusively to operate the GoalChain platform. Your Google profile is used to maintain your prediction history and leaderboard rankings. Your Solana public address is used by our Node.js Escrow backend to securely process smart contract payouts when your predictions win. We do not sell or rent your personal information to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-text mb-4">3. Data Security</h2>
            <p>
              We implement industry-standard security measures to protect your data. All blockchain transactions are executed via secure Solana RPC endpoints, and our backend settlement engines are hosted in secure environments. However, no electronic transmission over the internet or information storage technology can be guaranteed to be 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-text mb-4">4. TxLINE Oracle Integration</h2>
            <p>
              Our platform relies on the TxLINE Oracle for match data. By using GoalChain, you acknowledge that match outcomes and scores are settled based entirely on the cryptographic data feeds provided by TxLINE.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-text mb-4">5. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at privacy@goalchain.io or open a ticket in our community Discord server.
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  )
}
