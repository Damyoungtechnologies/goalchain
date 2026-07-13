import { motion } from 'framer-motion'
import { Server, Activity, AlertTriangle, CheckCircle, RefreshCw, Plus } from 'lucide-react'
import { useNotifications } from '@/contexts/NotificationContext'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'

export default function AdminPage() {
  const { addNotification } = useNotifications()
  const [stats, setStats] = useState({
    apiStatus: 'checking...',
    sseConnection: 'connecting...',
    settlementQueue: 0,
    failedSettlements: 0,
  })
  const [markets, setMarkets] = useState<any[]>([])

  const { data, isError } = useQuery({
    queryKey: ['admin-markets'],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8787'}/api/admin/markets`)
      if (!res.ok) throw new Error('Network response was not ok')
      return res.json()
    },
    refetchInterval: 10000, // Check every 10 seconds
    retry: true,
  })

  useEffect(() => {
    if (data) {
      setMarkets(data.map((m: any) => ({
        id: m.fixtureId,
        fixture: m.fixtureName,
        status: m.status,
        escrow: m.escrow
      })))
      setStats(prev => ({
        ...prev,
        apiStatus: 'online',
        sseConnection: 'connected'
      }))
    }
    if (isError) {
      setStats(prev => ({
        ...prev,
        apiStatus: 'offline',
        sseConnection: 'disconnected'
      }))
    }
  }, [data, isError])


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text mb-2">Admin Dashboard</h1>
          <p className="text-text-secondary">Monitor auto-generated prediction markets and platform analytics</p>
        </div>
      </div>

      {/* System Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <div className="flex items-center space-x-3 mb-2">
            <Server className={`w-5 h-5 text-text-secondary`} />
            <span className="text-sm text-text-secondary">API Status</span>
          </div>
          <div className="font-bold text-text capitalize">{stats.apiStatus}</div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center space-x-3 mb-2">
            <Activity className="w-5 h-5 text-text-secondary" />
            <span className="text-sm text-text-secondary">SSE Connection</span>
          </div>
          <div className="font-bold text-accent">{stats.sseConnection}</div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center space-x-3 mb-2">
            <RefreshCw className="w-5 h-5 text-blue" />
            <span className="text-sm text-text-secondary">Settlement Queue</span>
          </div>
          <div className="font-bold text-text">{stats.settlementQueue}</div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center space-x-3 mb-2">
            <AlertTriangle className="w-5 h-5 text-text-secondary" />
            <span className="text-sm text-text-secondary">Failed Settlements</span>
          </div>
          <div className="font-bold text-text">{stats.failedSettlements}</div>
        </div>
      </div>

      {/* Markets Management */}
      <div className="glass-card">
        <div className="p-6 border-b border-white/10">
          <h3 className="font-bold text-text">Active Markets</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-secondary/50">
              <tr>
                <th className="text-left py-4 px-6 text-sm font-medium text-text-secondary">ID</th>
                <th className="text-left py-4 px-6 text-sm font-medium text-text-secondary">Fixture</th>
                <th className="text-left py-4 px-6 text-sm font-medium text-text-secondary">Status</th>
                <th className="text-right py-4 px-6 text-sm font-medium text-text-secondary">Escrow</th>
              </tr>
            </thead>
            <tbody>
              {markets.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-text-secondary">
                    No active markets found
                  </td>
                </tr>
              ) : (
                markets.map((market) => (
                  <tr key={market.id} className="border-t border-white/5">
                    <td className="py-4 px-6 text-text font-mono">#{market.id}</td>
                    <td className="py-4 px-6 text-text">{market.fixture}</td>
                    <td className="py-4 px-6">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        market.status === 'active' ? 'bg-accent/10 text-accent' : 'bg-blue/10 text-blue'
                      }`}>
                        {market.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right font-bold text-text">{market.escrow} SOL</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Proof Logs */}
      <div className="glass-card p-6">
        <h3 className="font-bold text-text mb-4">Recent Proof Logs</h3>
        <div className="bg-secondary rounded-lg p-4 font-mono text-sm text-text-secondary overflow-x-auto min-h-[100px] flex items-center justify-center">
          <p>No recent logs available.</p>
        </div>
      </div>
    </div>
  )
}