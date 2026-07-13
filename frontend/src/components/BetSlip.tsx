import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, AlertCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { SystemProgram, Transaction, VersionedTransaction, TransactionMessage, PublicKey, LAMPORTS_PER_SOL, Keypair } from '@solana/web3.js'
import { useNotifications } from '../contexts/NotificationContext'
import { getAssociatedTokenAddressSync, createTransferInstruction } from '@solana/spl-token'

const CURRENCIES = {
  SOL: { mint: null, decimals: 9, symbol: 'SOL' },
  USDC: { mint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', decimals: 6, symbol: 'USDC' },
  USDT: { mint: 'EJwZgeZrdC8TXTQbQBoL6bfuAnFUUy1PVCMB4EPAX1zG', decimals: 6, symbol: 'USDT' }
}

interface BetSlipProps {
  isOpen: boolean
  onClose: () => void
  fixture: any
  selectedOutcome: {
    marketId: string
    marketName: string
    outcome: string
    odds: number // Simulated decimal odds
  } | null
}

export default function BetSlip({ isOpen, onClose, fixture, selectedOutcome }: BetSlipProps) {
  const { user, signInWithGoogle } = useAuth()
  const { connected, publicKey, sendTransaction, signTransaction } = useWallet()
  const { connection } = useConnection()
  const { addNotification } = useNotifications()
  const [stake, setStake] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [currency, setCurrency] = useState<keyof typeof CURRENCIES>('SOL')

  // Reset state when outcome changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setStake('')
      setCurrency('SOL')
      setLoading(false)
    }
  }, [isOpen, selectedOutcome])

  if (!selectedOutcome || !fixture) return null

  const potentialPayout = (parseFloat(stake || '0') * selectedOutcome.odds).toFixed(2)

  const handlePlacePrediction = async () => {
    if (!user) {
      addNotification('error', 'Please sign in with Google first')
      return
    }
    if (!connected || !publicKey) {
      addNotification('error', 'Please connect your Solana wallet to fund your prediction')
      return
    }
    if (!stake || parseFloat(stake) <= 0) {
      addNotification('error', 'Please enter a valid stake amount')
      return
    }

    setLoading(true)
    try {
      addNotification('info', 'Connecting to secure House Wallet...')
      const hwRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8787'}/api/house-wallet`)
      if (!hwRes.ok) throw new Error('Could not fetch House Wallet')
      const { publicKey: houseWalletAddress } = await hwRes.json()
      
      const houseVault = new PublicKey(houseWalletAddress)
      const latestBlockhash = await connection.getLatestBlockhash('finalized')

      const instructions = []
      const selCurrency = CURRENCIES[currency]
      
      if (!selCurrency.mint) {
        instructions.push(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: houseVault,
            lamports: parseFloat(stake) * LAMPORTS_PER_SOL
          })
        )
      } else {
        const userATA = getAssociatedTokenAddressSync(new PublicKey(selCurrency.mint), publicKey)
        const houseATA = getAssociatedTokenAddressSync(new PublicKey(selCurrency.mint), houseVault)
        instructions.push(
          createTransferInstruction(
            userATA,
            houseATA,
            publicKey,
            parseFloat(stake) * (10 ** selCurrency.decimals)
          )
        )
      }

      const messageV0 = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: latestBlockhash.blockhash,
        instructions
      }).compileToV0Message()

      const transaction = new VersionedTransaction(messageV0)

      let signature = '';
      try {
        if (signTransaction) {
          addNotification('info', `Please approve the transaction in your wallet...`)
          const signedTx = await signTransaction(transaction)
          addNotification('info', 'Sending to Solana network...')
          signature = await connection.sendRawTransaction(signedTx.serialize())
        } else {
          addNotification('info', `Please approve the transaction in your wallet...`)
          signature = await sendTransaction(transaction, connection)
        }
        
        addNotification('info', 'Confirming transaction on Solana...')
        await connection.confirmTransaction({
          signature,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
        }, 'processed')
      } catch (err: any) {
        console.error("Wallet error:", err);
        throw new Error(err.message || 'Transaction failed in wallet');
      }
      
      const txHash = signature

      // Post to backend
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8787'}/api/predictions/stake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          email: user.email,
          displayName: user.displayName,
          fixtureId: fixture.id,
          marketId: selectedOutcome.marketId,
          outcome: selectedOutcome.outcome,
          stakeAmount: parseFloat(stake),
          potentialPayout: parseFloat(potentialPayout),
          currency,
          tokenMint: CURRENCIES[currency].mint,
          txHash
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to place prediction')
      }

      addNotification('success', 'Prediction placed successfully! Track it in My Predictions.')
      onClose()
      setTimeout(() => {
        window.location.href = '/predictions'
      }, 1000)
    } catch (error: any) {
      addNotification('error', error.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm pointer-events-auto"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative z-10 w-full bg-secondary rounded-t-3xl border-t border-white/10 p-6 md:w-96 md:rounded-3xl md:border pointer-events-auto"
            >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-text">Bet Slip</h2>
              <button onClick={onClose} className="p-2 text-text-secondary hover:text-text rounded-full hover:bg-white/5 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="bg-card p-4 rounded-xl border border-white/5">
                <div className="text-sm text-text-secondary mb-1">{fixture.Competitors?.Home?.Name} vs {fixture.Competitors?.Away?.Name}</div>
                <div className="font-bold text-lg text-text mb-2">{selectedOutcome.marketName}</div>
                <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg">
                  <span className="font-medium text-accent">{selectedOutcome.outcome}</span>
                  <span className="font-mono text-text">x{selectedOutcome.odds.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex space-x-4">
                <div className="w-1/3">
                  <label className="block text-sm font-medium text-text-secondary mb-2">Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as keyof typeof CURRENCIES)}
                    className="w-full bg-card border border-white/10 rounded-xl px-4 py-3 text-lg font-bold text-text focus:outline-none focus:border-accent transition-colors appearance-none"
                  >
                    <option value="SOL">SOL</option>
                    <option value="USDC">USDC (Dev)</option>
                    <option value="USDT">USDT (Dev)</option>
                  </select>
                </div>
                <div className="w-2/3">
                  <label className="block text-sm font-medium text-text-secondary mb-2">Stake Amount</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={stake}
                      onChange={(e) => setStake(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-card border border-white/10 rounded-xl px-4 py-3 text-lg font-mono text-text placeholder-text-secondary/50 focus:outline-none focus:border-accent transition-colors"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex space-x-2">
                      <button onClick={() => setStake('10')} className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-xs text-text-secondary">10</button>
                      <button onClick={() => setStake('50')} className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-xs text-text-secondary">50</button>
                      <button onClick={() => setStake('100')} className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-xs text-text-secondary">100</button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 p-4 rounded-xl flex justify-between items-center">
                <span className="text-text-secondary">Potential Payout</span>
                <span className="text-xl font-bold text-accent font-mono">{potentialPayout} {CURRENCIES[currency].symbol}</span>
              </div>

              {!user ? (
                <button
                  onClick={signInWithGoogle}
                  className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center space-x-2"
                >
                  <span>Sign in with Google to predict</span>
                </button>
              ) : !connected ? (
                <div className="w-full bg-red-500/10 text-red-400 p-4 rounded-xl flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="text-sm">Please connect your Solana wallet from the top right menu to fund your prediction.</p>
                </div>
              ) : (
                <button
                  onClick={handlePlacePrediction}
                  disabled={loading || !stake || parseFloat(stake) <= 0}
                  className="w-full gradient-button py-4 font-bold text-lg disabled:opacity-50 flex items-center justify-center"
                >
                  {loading ? (
                    <div className="w-6 h-6 border-2 border-background/20 border-t-background rounded-full animate-spin" />
                  ) : (
                    'Confirm Transaction'
                  )}
                </button>
              )}
            </div>
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
