import * as web3 from '@solana/web3.js';
import fs from 'fs';
import { config } from './config.js';

async function sendRemaining() {
  try {
    const secret = JSON.parse(fs.readFileSync("houseWallet.json", "utf8"));
    const houseWallet = web3.Keypair.fromSecretKey(new Uint8Array(secret));
    const connection = new web3.Connection(config.solana.rpcUrl, "confirmed");
    const toPubkey = new web3.PublicKey("9BH833UhA8bkQjQqTDhAbn9XaTyL7PAZw7EyvL2u8FYS");
    
    const tx = new web3.Transaction();
    const lamports = Math.floor(11.80 * web3.LAMPORTS_PER_SOL);
    
    tx.add(
      web3.SystemProgram.transfer({
        fromPubkey: houseWallet.publicKey,
        toPubkey,
        lamports
      })
    );

    console.log("Sending remaining 11.80 SOL...");
    const txHash = await web3.sendAndConfirmTransaction(connection, tx, [houseWallet]);
    console.log("Successfully sent 11.80 SOL. txHash:", txHash);
  } catch (e) {
    console.error("Failed to send", e);
  }
}

sendRemaining();
