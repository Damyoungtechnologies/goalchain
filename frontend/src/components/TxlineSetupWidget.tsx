import { useState } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { PublicKey, SystemProgram, Transaction, TransactionMessage, VersionedTransaction } from '@solana/web3.js'
import * as anchor from '@coral-xyz/anchor'
import { getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token'
import txoracleIdl from '../txline.json'
import { useNotifications } from '../contexts/NotificationContext'

export function TxlineSetupWidget() {
  const { publicKey, signMessage, sendTransaction } = useWallet()
  const { connection } = useConnection()
  const { addNotification } = useNotifications()
  
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  const handleSetup = async () => {
    if (!publicKey || !signMessage) {
      addNotification('error', 'Please connect your Phantom wallet first!')
      return
    }

    try {
      setLoading(true)
      setStatus('Building on-chain subscription...')
      setError('')

      const provider = new anchor.AnchorProvider(connection, {} as anchor.Wallet, { commitment: 'confirmed' })
      anchor.setProvider(provider)
      
      const programId = new PublicKey('9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA')
      const txlTokenMint = new PublicKey('4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG')
      const program = new anchor.Program(txoracleIdl as anchor.Idl, provider)

      const [tokenTreasuryPda] = PublicKey.findProgramAddressSync([new TextEncoder().encode('token_treasury_v2')], program.programId)
      const tokenTreasuryVault = getAssociatedTokenAddressSync(txlTokenMint, tokenTreasuryPda, true, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)
      const [pricingMatrixPda] = PublicKey.findProgramAddressSync([new TextEncoder().encode('pricing_matrix')], program.programId)
      const userTokenAccount = getAssociatedTokenAddressSync(txlTokenMint, publicKey, false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)

      const userAtaInfo = await connection.getAccountInfo(userTokenAccount)
      const ixs = []

      if (!userAtaInfo) {
        setStatus('Adding token account creation...')
        ixs.push(
          createAssociatedTokenAccountIdempotentInstruction(
            publicKey,
            userTokenAccount,
            publicKey,
            txlTokenMint,
            TOKEN_2022_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        )
      }

      // 1. Send Subscription Transaction
      const subIx = await program.methods
        .subscribe(1, 4) // Service level 1, 4 weeks
        .accounts({
          user: publicKey,
          pricingMatrix: pricingMatrixPda,
          tokenMint: txlTokenMint,
          userTokenAccount,
          tokenTreasuryVault,
          tokenTreasuryPda,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .instruction()

      ixs.push(subIx)

      const latestBlockhash = await connection.getLatestBlockhash()
      const transaction = new Transaction({
        feePayer: publicKey,
        recentBlockhash: latestBlockhash.blockhash
      }).add(...ixs)

      setStatus('Simulating transaction...')
      const sim = await connection.simulateTransaction(transaction)
      if (sim.value.err) {
        console.error("Simulation logs:", sim.value.logs)
        throw new Error(`Simulation failed: ${JSON.stringify(sim.value.err)}\nLogs: ${sim.value.logs?.join('\n')}`)
      }

      setStatus('Please approve the free subscription transaction in Phantom...')
      const txSig = await sendTransaction(transaction, connection)
      addNotification('info', 'Transaction submitted to blockchain. Waiting for confirmation...')
      
      setStatus('Confirming transaction...')
      await connection.confirmTransaction(txSig, 'confirmed')
      addNotification('success', 'Smart contract subscription confirmed on-chain!')

      // 2. Get Guest JWT
      setStatus('Fetching Guest Token...')
      const apiOrigin = 'https://txline.txodds.com'
      const authRes = await fetch(`${apiOrigin}/auth/guest/start`, { method: 'POST' })
      const { token: jwt } = await authRes.json()

      // 3. Sign message
      setStatus('Please sign the activation message in Phantom...')
      const messageString = `${txSig}::${jwt}`
      const message = new TextEncoder().encode(messageString)
      const signatureBytes = await signMessage(message)
      const walletSignature = btoa(String.fromCharCode(...signatureBytes))

      // 4. Activate API Token
      setStatus('Activating API Token...')
      const actRes = await fetch(`${apiOrigin}/api/token/activate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ txSig, walletSignature, leagues: [] })
      })
      const actText = await actRes.text()
      let apiToken = actText
      try {
        const parsed = JSON.parse(actText)
        apiToken = parsed.token || parsed
      } catch (e) {
        // It's a raw string token
      }

      // 5. Send to backend
      setStatus('Saving credentials to backend...')
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8787'}/api/setup-env`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jwt, apiToken })
      })

      addNotification('success', 'TxLINE Credentials claimed successfully! Refreshing app...')
      setStatus('Success! Reloading page...')
      setTimeout(() => window.location.reload(), 1500)
    } catch (err: any) {
      console.error(err)
      setStatus('')
      const errMsg = err.message || 'An unknown error occurred'
      setError(errMsg)
      addNotification('error', `TxLINE Setup Failed: ${errMsg}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="glass-card p-6 text-center space-y-4 border border-accent">
      <h2 className="text-xl font-bold text-accent">Missing TxLINE Live Data Credentials</h2>
      <p className="text-text-secondary">Your backend needs the TxLINE API tokens to fetch live World Cup data.</p>
      
      {!publicKey ? (
        <p className="text-red-400 font-medium">Please connect your Phantom Wallet using the button in the top right to claim the free tier.</p>
      ) : (
        <div className="space-y-4">
          <button 
            onClick={handleSetup} 
            disabled={loading}
            className="gradient-button px-6 py-3 font-semibold"
          >
            {loading ? status : 'Claim Free API Keys (Requires 0.000005 SOL)'}
          </button>
          
          {error && (
            <div className="bg-red-500/10 text-red-400 p-4 rounded-lg text-sm text-left font-mono whitespace-pre-wrap overflow-y-auto max-h-48 border border-red-500/20">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
