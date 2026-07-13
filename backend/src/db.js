import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_FILE = path.join(__dirname, '..', 'db.json')

// Initialize DB if not exists
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], predictions: [], transactions: [], markets: [], fixtures: [] }, null, 2))
}

export function readDb() {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf-8')
    const parsed = JSON.parse(data)
    return {
      users: parsed.users || [],
      predictions: parsed.predictions || [],
      transactions: parsed.transactions || [],
      markets: parsed.markets || [],
      fixtures: parsed.fixtures || []
    }
  } catch (e) {
    return { users: [], predictions: [], transactions: [], markets: [], fixtures: [] }
  }
}

export function writeDb(data) {
  const tmp = DB_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2))
  fs.renameSync(tmp, DB_FILE)
}

export const db = {
  get user() {
    return {
      findUnique: ({ where } = {}) => readDb().users.find(u => !where || Object.keys(where).every(k => u[k] === where[k])),
      findMany: ({ where } = {}) => readDb().users.filter(u => !where || Object.keys(where).every(k => u[k] === where[k])),
      create: ({ data }) => {
        const d = readDb()
        const newUser = { id: crypto.randomUUID(), ...data, createdAt: new Date().toISOString() }
        d.users.push(newUser)
        writeDb(d)
        return newUser
      },
      update: ({ where, data }) => {
        const d = readDb()
        const index = d.users.findIndex(u => Object.keys(where).every(k => u[k] === where[k]))
        if (index > -1) {
          d.users[index] = { ...d.users[index], ...data }
          writeDb(d)
          return d.users[index]
        }
      }
    }
  },
  get prediction() {
    return {
      findMany: ({ where } = {}) => readDb().predictions.filter(p => !where || Object.keys(where).every(k => p[k] === where[k])),
      create: ({ data }) => {
        const d = readDb()
        const newPred = { id: crypto.randomUUID(), ...data, createdAt: new Date().toISOString() }
        d.predictions.push(newPred)
        writeDb(d)
        return newPred
      },
      update: ({ where, data }) => {
        const d = readDb()
        const index = d.predictions.findIndex(p => Object.keys(where).every(k => p[k] === where[k]))
        if (index > -1) {
          d.predictions[index] = { ...d.predictions[index], ...data }
          writeDb(d)
          return d.predictions[index]
        }
      }
    }
  },
  get transaction() {
    return {
      create: ({ data }) => {
        const d = readDb()
        const newTx = { id: crypto.randomUUID(), ...data, createdAt: new Date().toISOString() }
        d.transactions.push(newTx)
        writeDb(d)
        return newTx
      }
    }
  },
  get market() {
    return {
      findMany: ({ where } = {}) => (readDb().markets || []).filter(m => !where || Object.keys(where).every(k => m[k] === where[k])),
      create: ({ data }) => {
        const d = readDb()
        if (!d.markets) d.markets = []
        const newMarket = { id: crypto.randomUUID(), ...data, createdAt: new Date().toISOString() }
        d.markets.push(newMarket)
        writeDb(d)
        return newMarket
      },
      update: ({ where, data }) => {
        const d = readDb()
        if (!d.markets) return
        const index = d.markets.findIndex(m => Object.keys(where).every(k => m[k] === where[k]))
        if (index > -1) {
          d.markets[index] = { ...d.markets[index], ...data }
          writeDb(d)
          return d.markets[index]
        }
      }
    }
  },
  get fixture() {
    return {
      findUnique: ({ where } = {}) => (readDb().fixtures || []).find(f => !where || Object.keys(where).every(k => f[k] === where[k])),
      findMany: ({ where } = {}) => (readDb().fixtures || []).filter(f => !where || Object.keys(where).every(k => f[k] === where[k])),
      upsert: ({ where, update, create }) => {
        const d = readDb()
        if (!d.fixtures) d.fixtures = []
        const index = d.fixtures.findIndex(f => Object.keys(where).every(k => f[k] === where[k]))
        if (index > -1) {
          d.fixtures[index] = { ...d.fixtures[index], ...update }
          writeDb(d)
          return d.fixtures[index]
        } else {
          d.fixtures.push(create)
          writeDb(d)
          return create
        }
      }
    }
  }
}
