import { AlertCircle } from 'lucide-react'
import Footer from '../components/Footer'

export default function TermsPage() {
  return (
    <div className="w-full">
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="glass-card p-8 md:p-12">
          <div className="flex items-center space-x-4 mb-8 border-b border-white/10 pb-8">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-accent" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-text">Terms and Conditions</h1>
              <p className="text-text-secondary mt-1">Last updated: July 8, 2026</p>
            </div>
          </div>

          <div className="space-y-8 text-text-secondary leading-relaxed">
            <section>
              <h2 className="text-xl font-bold text-text mb-4">1. Acceptance of Terms</h2>
              <p>
                By accessing and using GoalChain, you agree to be bound by these Terms and Conditions. If you disagree with any part of these terms, you may not access the platform.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-text mb-4">2. Prediction Markets & Settlement</h2>
              <p className="mb-4">
                GoalChain is a decentralized prediction market running on the Solana blockchain. All predictions are settled using data provided by the <strong>TxLINE Oracle</strong>.
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>You agree that the TxLINE Oracle's data feed is the final source of truth for all match outcomes.</li>
                <li>Once a prediction is placed and staked via the smart contract or escrow, it cannot be canceled except through the authorized "Cash Out" mechanism.</li>
                <li>GoalChain is not responsible for any delays, inaccuracies, or outages in the TxLINE Oracle feed that may affect settlement timing.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-text mb-4">3. User Responsibilities</h2>
              <p>
                You are responsible for safeguarding your Solana wallet (e.g., Phantom) private keys. GoalChain does not have access to your private keys and cannot recover lost funds. You agree to use the platform only for lawful purposes and in accordance with the laws of your jurisdiction.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-text mb-4">4. Risk Disclosure</h2>
              <p>
                Prediction markets involve significant risk. Cryptocurrency values are highly volatile. You should carefully consider whether participating in prediction markets is suitable for you in light of your financial condition. GoalChain provides no guarantees of profit.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-text mb-4">5. Modifications to the Service</h2>
              <p>
                We reserve the right to modify or discontinue, temporarily or permanently, the platform (or any part thereof) with or without notice.
              </p>
            </section>
          </div>
        </div>
        
        </div>
      <Footer />
    </div>
  )
}
