import { motion } from 'framer-motion'
import { CheckCircle, ExternalLink, Hash, Clock, FileText, Search } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

const statusConfig = {
  won: { color: 'text-accent', bg: 'bg-accent/10', label: 'Completed' },
  open: { color: 'text-blue', bg: 'bg-blue/10', label: 'Pending' },
  lost: { color: 'text-danger', bg: 'bg-danger/10', label: 'Failed' },
  completed: { color: 'text-accent', bg: 'bg-accent/10', label: 'Completed' },
  pending: { color: 'text-blue', bg: 'bg-blue/10', label: 'Pending' },
  failed: { color: 'text-danger', bg: 'bg-danger/10', label: 'Failed' },
}

export default function SettlementExplorerPage() {
  const { user } = useAuth()
  const [settlements, setSettlements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.uid) {
      fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8787'}/api/predictions/me?userId=${user.uid}`)
        .then(r => r.json())
        .then(data => {
          // Map predictions to settlement format
          const mapped = data.map((p: any) => ({
            id: p.id,
            fixture: p.fixtureName || `Match #${p.fixtureId}`,
            market: "Match Winner",
            outcome: p.outcome,
            amount: p.potentialPayout,
            status: p.status, // won, lost, open
            txHash: p.txHash,
            merkleRoot: p.id.replace(/-/g, '').substring(0, 32),
            timestamp: p.createdAt,
          }));
          setSettlements(mapped);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [user]);

  if (loading) return <div className="p-12 text-center text-text-secondary">Loading...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text mb-2">Settlement Explorer</h1>
        <p className="text-text-secondary">
          Verify on-chain settlement proofs and transaction receipts
        </p>
      </div>

      <div className="space-y-4">
        {settlements.length === 0 ? (
          <div className="glass-card p-12 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-accent opacity-50" />
            </div>
            <h3 className="text-xl font-bold text-text mb-2">No Settlements Found</h3>
            <p className="text-text-secondary mb-6 max-w-md">
              There are no recent market settlements to display. Once a live match completes, the outcome validation and settlement proof will appear here.
            </p>
          </div>
        ) : (
          settlements.map((settlement, index) => {
            const status = statusConfig[settlement.status as keyof typeof statusConfig]
            return (
              <motion.div
                key={settlement.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="glass-card p-6"
              >
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="font-bold text-text text-lg">
                        {settlement.fixture}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${status.bg} ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="text-text-secondary">
                      {settlement.market} → {settlement.outcome}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-accent">
                      {settlement.amount} SOL
                    </div>
                    <div className="text-sm text-text-secondary">Payout</div>
                  </div>
                </div>

                {settlement.status === 'won' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-white/10">
                    <div>
                      <div className="flex items-center space-x-2 text-sm text-text-secondary mb-1">
                        <Hash className="w-4 h-4" />
                        <span>Transaction</span>
                      </div>
                      <a
                        href={`https://solscan.io/tx/${settlement.txHash}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-1 text-accent hover:underline"
                      >
                        <span className="font-mono text-sm">
                          {settlement.txHash?.slice(0, 8)}...{settlement.txHash?.slice(-6)}
                        </span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <div>
                      <div className="flex items-center space-x-2 text-sm text-text-secondary mb-1">
                        <FileText className="w-4 h-4" />
                        <span>Merkle Root</span>
                      </div>
                      <div className="font-mono text-sm text-text">
                        {settlement.merkleRoot?.slice(0, 16)}...
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center space-x-2 text-sm text-text-secondary mb-1">
                        <Clock className="w-4 h-4" />
                        <span>Settled</span>
                      </div>
                      <div className="text-text">
                        {new Date(settlement.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                )}

                {settlement.status === 'open' && (
                  <div className="flex items-center space-x-2 text-blue pt-4 border-t border-white/10">
                    <Clock className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Waiting for match finalization and proof generation</span>
                  </div>
                )}
              </motion.div>
            )
          })
        )}
      </div>
    </div>
  )
}