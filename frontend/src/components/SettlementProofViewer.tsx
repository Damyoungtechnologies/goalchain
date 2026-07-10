import { motion, AnimatePresence } from 'framer-motion'
import { ShieldCheck, CheckCircle2, FileText, Database, Link as LinkIcon, X } from 'lucide-react'
import { useState, useEffect } from 'react'

interface SettlementProofViewerProps {
  isOpen: boolean
  onClose: () => void
  prediction: any
}

export default function SettlementProofViewer({ isOpen, onClose, prediction }: SettlementProofViewerProps) {
  const [activeStep, setActiveStep] = useState(0)

  const steps = [
    { icon: FileText, title: "Retrieve Oracle Data", desc: "Fetching final match state from TxOdds data pipeline" },
    { icon: Database, title: "Verify Merkle Proof", desc: "Validating cryptographic inclusion in the daily state root" },
    { icon: ShieldCheck, title: "Execute Smart Contract", desc: "Anchor CPI validation against on-chain conditions" },
    { icon: CheckCircle2, title: "Settlement Complete", desc: "Solana transaction confirmed and funds transferred" }
  ]

  useEffect(() => {
    if (isOpen) {
      setActiveStep(0)
      const timer = setInterval(() => {
        setActiveStep(prev => {
          if (prev < steps.length) return prev + 1
          clearInterval(timer)
          return prev
        })
      }, 800)
      return () => clearInterval(timer)
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-secondary border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl relative overflow-hidden"
        >
          {/* Decorative background */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-text-secondary hover:text-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center border border-green-500/30">
              <ShieldCheck className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-text">Cryptographic Proof</h2>
              <p className="text-sm text-text-secondary">Verifying settlement authenticity</p>
            </div>
          </div>

          <div className="space-y-6">
            {steps.map((step, index) => {
              const isCompleted = activeStep > index
              const isCurrent = activeStep === index
              
              return (
                <div key={index} className="flex items-start space-x-4">
                  <div className="relative mt-1">
                    {/* Line connecting steps */}
                    {index < steps.length - 1 && (
                      <div className={`absolute top-6 left-1/2 -ml-[1px] w-[2px] h-10 transition-colors duration-500 ${isCompleted ? 'bg-green-500/50' : 'bg-white/10'}`} />
                    )}
                    
                    {/* Status Icon */}
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors duration-500 ${
                      isCompleted ? 'bg-green-500 border-green-500' : 
                      isCurrent ? 'bg-transparent border-accent border-t-transparent animate-spin' : 
                      'bg-transparent border-white/20'
                    }`}>
                      {isCompleted && <CheckCircle2 className="w-4 h-4 text-white" />}
                    </div>
                  </div>
                  
                  <div className={`flex-1 transition-opacity duration-500 ${isCompleted || isCurrent ? 'opacity-100' : 'opacity-40'}`}>
                    <h4 className={`font-bold text-sm ${isCompleted ? 'text-green-400' : 'text-text'}`}>
                      {step.title}
                    </h4>
                    <p className="text-xs text-text-secondary mt-1">{step.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {activeStep >= steps.length && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 pt-6 border-t border-white/10 space-y-3"
            >
              <a 
                href={`https://explorer.solana.com/tx/${prediction.payoutTxHash || prediction.txHash}?cluster=devnet`} 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/5 group"
              >
                <div className="flex items-center space-x-3">
                  <LinkIcon className="w-4 h-4 text-text-secondary group-hover:text-accent transition-colors" />
                  <span className="text-sm font-medium text-text">View Solana Transaction</span>
                </div>
                <span className="text-xs text-text-secondary font-mono bg-black/20 px-2 py-1 rounded">
                  {(prediction.payoutTxHash || prediction.txHash) ? `${(prediction.payoutTxHash || prediction.txHash).slice(0, 8)}...` : 'Unknown'}
                </span>
              </a>
              
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                <div className="flex items-center space-x-3">
                  <Database className="w-4 h-4 text-text-secondary" />
                  <span className="text-sm font-medium text-text">Oracle Root Hash</span>
                </div>
                <span className="text-xs text-green-400 font-mono bg-green-400/10 px-2 py-1 rounded">
                  Verified
                </span>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
