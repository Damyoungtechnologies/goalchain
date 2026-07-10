import { db } from './db.js';
import * as web3 from '@solana/web3.js';
import fs from 'fs';
import { config } from './config.js';

async function settle() {
  const fixtureId = "18218149";
  const participant1Score = 2; // Spain
  const participant2Score = 1; // Belgium

  console.log("Settling match: Spain 2 - 1 Belgium");

  const openPredictions = await db.prediction.findMany({ 
    where: { status: "open", fixtureId } 
  });
  
  console.log(`Found ${openPredictions.length} open predictions.`);

  let settledCount = 0;
  for (const prediction of openPredictions) {
    let won = false;
    const totalGoals = participant1Score + participant2Score;
    if (prediction.outcome === "Spain") {
      if (participant1Score > participant2Score) won = true;
    } else if (prediction.outcome === "Belgium") {
      if (participant2Score > participant1Score) won = true;
    } else if (prediction.outcome.toLowerCase() === 'draw') {
      if (participant1Score === participant2Score) won = true;
    } else if (prediction.outcome === "Over") {
      if (totalGoals > 2) won = true;
    } else if (prediction.outcome === "Under") {
      if (totalGoals < 3) won = true;
    }

    if (won) {
      console.log(`Prediction ${prediction.id} WON! Processing payout...`);
      try {
        const secret = JSON.parse(fs.readFileSync("houseWallet.json", "utf8"));
        const houseWallet = web3.Keypair.fromSecretKey(new Uint8Array(secret));
        const connection = new web3.Connection(config.solana.rpcUrl, "confirmed");
        
        if (prediction.userPubKey) {
          const toPubkey = new web3.PublicKey(prediction.userPubKey);
          const tx = new web3.Transaction();
          const lamports = Math.floor(prediction.potentialPayout * web3.LAMPORTS_PER_SOL);
          
          tx.add(
            web3.SystemProgram.transfer({
              fromPubkey: houseWallet.publicKey,
              toPubkey,
              lamports
            })
          );

          console.log(`Sending ${prediction.potentialPayout} SOL to ${prediction.userPubKey}...`);
          const txHash = await web3.sendAndConfirmTransaction(connection, tx, [houseWallet]);
          console.log("Payout success on Solana devnet!", txHash);
          
          await db.prediction.update({
            where: { id: prediction.id },
            data: { status: "won", txHash }
          });

          await db.transaction.create({
            data: { userId: prediction.userId, type: "payout", amount: prediction.potentialPayout, currency: "SOL", txHash }
          });
          settledCount++;
        }
      } catch (e) {
        console.error("Payout error", e);
      }
    } else {
      console.log(`Prediction ${prediction.id} LOST.`);
      await db.prediction.update({
        where: { id: prediction.id },
        data: { status: "lost" }
      });
      settledCount++;
    }
  }
  
  console.log(`Successfully settled ${settledCount} predictions!`);
}

settle().catch(console.error);
