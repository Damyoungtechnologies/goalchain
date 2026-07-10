export interface Fixture {
  id: number
  competition: string
  stage: string
  home: string
  away: string
  homeScore: number
  awayScore: number
  minute: number
  state: 'Scheduled' | 'Live' | 'Final' | 'Postponed' | 'Cancelled'
  startTime: string
  firstScorer: string | null
}

export interface Outcome {
  label: string
  probability: number
  decimal: number
}

export interface Market {
  id: string
  key: string
  fixtureId: number
  name: string
  condition: string
  status: 'open' | 'settled' | 'cancelled'
  escrow: number
  result: string | null
  outcomes: Outcome[]
}

export interface Position {
  marketId: string
  outcome: string
  stake: number
  shares: number
  status: 'open' | 'won' | 'lost'
  claimable: number
}

export interface Receipt {
  fixtureId: number
  seq: number
  stat: string
  value: string
  merkleRoot: string
  slot: number
  proof: ProofNode[]
  validated: boolean
}

export interface ProofNode {
  hash: string
  isRightSibling: boolean
}

export interface StreamEvent {
  source: string
  message: string
  fixtureId: number | null
  minute: number | null
  at: string
}

export interface User {
  wallet: string
  balance: number
  totalPredictions: number
  wonPredictions: number
  roi: number
}

export interface LeaderboardEntry {
  rank: number
  wallet: string
  username?: string
  profit: number
  roi: number
  predictions: number
}