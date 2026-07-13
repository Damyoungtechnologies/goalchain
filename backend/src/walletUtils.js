import fs from 'fs';
import { Keypair } from '@solana/web3.js';

export function getHouseWallet() {
  if (process.env.HOUSE_WALLET_PRIVATE_KEY) {
    try {
      const secret = JSON.parse(process.env.HOUSE_WALLET_PRIVATE_KEY);
      return Keypair.fromSecretKey(new Uint8Array(secret));
    } catch (e) {
      console.error("Error parsing HOUSE_WALLET_PRIVATE_KEY env var:", e.message);
    }
  }

  if (fs.existsSync('houseWallet.json')) {
    const secret = JSON.parse(fs.readFileSync('houseWallet.json', 'utf8'));
    return Keypair.fromSecretKey(new Uint8Array(secret));
  }

  throw new Error("House wallet not configured. Please set HOUSE_WALLET_PRIVATE_KEY in environment variables.");
}
