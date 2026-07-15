import { db } from '../db.js'
import fs from 'fs'
import { Connection, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { getAssociatedTokenAddressSync, createTransferInstruction } from '@solana/spl-token'
import { getHouseWallet } from '../walletUtils.js'

export async function stakePrediction(req, res) {
  try {
    const { userId, fixtureId, marketId, outcome, stakeAmount, potentialPayout, txHash, currency, tokenMint, userPubKey } = req.body

    // Ensure user exists (Mock for now, normally would check Auth token)
    let user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      user = await db.user.create({ data: { id: userId, email: req.body.email || 'user@example.com', displayName: req.body.displayName || 'Anonymous User' } })
    } else if (req.body.displayName) {
      user = await db.user.update({ where: { id: userId }, data: { displayName: req.body.displayName } })
    }

    // Enforce one active prediction per match
    const existingPredictions = await db.prediction.findMany({ where: { userId, fixtureId, status: 'open' } })
    if (existingPredictions.length > 0) {
      return res.status(400).json({ error: 'You already have an active prediction for this match. Please wait for it to settle or cash it out first.' })
    }

    // Enforce match hasn't started yet
    const fixture = await db.fixture.findUnique({ where: { FixtureId: parseInt(fixtureId) } })
    if (fixture && (fixture.GameState === 2 || fixture.GameState === 3 || fixture.StartTime <= Date.now())) {
      return res.status(400).json({ error: 'Predictions are locked. This match has already started or finished.' })
    }

    const prediction = await db.prediction.create({
      data: {
        userId: user.id,
        fixtureId,
        marketId,
        outcome,
        stakeAmount,
        potentialPayout,
        status: 'open',
        txHash,
        currency: currency || 'SOL',
        tokenMint: tokenMint || null,
        userPubKey: userPubKey || null
      }
    })

    // Update global market escrow
    const markets = await db.market.findMany();
    let market = markets.find(m => m.fixtureId?.toString() === fixtureId?.toString());
    
    if (!market) {
      market = await db.market.create({
        data: {
          fixtureId: parseInt(fixtureId) || 0,
          fixtureName: `Match #${fixtureId}`,
          status: 'active',
          escrow: 0
        }
      });
    }

    await db.market.update({
      where: { id: market.id },
      data: { escrow: (market.escrow || 0) + stakeAmount }
    });

    await db.transaction.create({
      data: {
        userId: user.id,
        type: 'stake',
        amount: stakeAmount,
        txHash,
        status: 'completed'
      }
    })

    res.json(prediction)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Failed to place prediction' })
  }
}

export async function retryPayout(req, res) {
  try {
    const predictionId = req.params.id;
    const { userPubKey } = req.body;

    const prediction = await db.prediction.findUnique({ where: { id: predictionId } });
    if (!prediction) return res.status(404).json({ error: 'Prediction not found' });
    if (prediction.status !== 'won') return res.status(400).json({ error: 'Prediction has not won' });
    if (!prediction.payoutTxHash?.startsWith('mock_payout_tx')) return res.status(400).json({ error: 'Already paid out on-chain' });
    if (!userPubKey) return res.status(400).json({ error: 'Missing user pubkey' });

    let payoutTxHash;
    try {
      const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
      const houseWallet = getHouseWallet();
      const toPubkey = new PublicKey(userPubKey);
      const tx = new Transaction();

      if (!prediction.tokenMint) {
        const lamports = Math.floor(prediction.potentialPayout * LAMPORTS_PER_SOL);
        tx.add(SystemProgram.transfer({ fromPubkey: houseWallet.publicKey, toPubkey, lamports }));
      } else {
        const mintPubKey = new PublicKey(prediction.tokenMint);
        const houseATA = getAssociatedTokenAddressSync(mintPubKey, houseWallet.publicKey);
        const userATA = getAssociatedTokenAddressSync(mintPubKey, toPubkey);
        const amount = Math.floor(prediction.potentialPayout * 1000000);
        tx.add(createTransferInstruction(houseATA, userATA, houseWallet.publicKey, amount));
      }

      payoutTxHash = await sendAndConfirmTransaction(connection, tx, [houseWallet]);
    } catch (e) {
      console.error("Payout retry failed:", e);
      return res.status(500).json({ error: 'Blockchain transfer failed: ' + e.message });
    }

    await db.prediction.update({
      where: { id: predictionId },
      data: { payoutTxHash, userPubKey }
    });

    res.json({ message: 'Payout claimed successfully', txHash: payoutTxHash });
  } catch (error) {
    console.error("Retry payout error:", error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function cashoutPrediction(req, res) {
  try {
    const { predictionId, cashoutAmount, userPubKey } = req.body

    if (!userPubKey) {
      return res.status(400).json({ error: 'Missing user public key for payout' })
    }

    const prediction = await db.prediction.findMany({ where: { id: predictionId } })[0]
    if (!prediction) {
      return res.status(404).json({ error: 'Prediction not found' })
    }

    let payoutTxHash = 'mock_tx_' + Date.now()

    // Real Solana Payout from House Wallet
    try {
      const connection = new Connection('https://api.devnet.solana.com', 'confirmed')
      const houseWallet = getHouseWallet()
      
      const transaction = new Transaction()
      
      if (!prediction.tokenMint) {
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: houseWallet.publicKey,
            toPubkey: new PublicKey(userPubKey),
            lamports: Math.floor(cashoutAmount * LAMPORTS_PER_SOL)
          })
        )
      } else {
        const mintPubKey = new PublicKey(prediction.tokenMint)
        const userATA = getAssociatedTokenAddressSync(mintPubKey, new PublicKey(userPubKey))
        const houseATA = getAssociatedTokenAddressSync(mintPubKey, houseWallet.publicKey)
        
        // Assume 6 decimals for Devnet USDC/USDT 
        const amount = Math.floor(cashoutAmount * 1000000)
        transaction.add(
          createTransferInstruction(
            houseATA,
            userATA,
            houseWallet.publicKey,
            amount
          )
        )
      }

      payoutTxHash = await sendAndConfirmTransaction(connection, transaction, [houseWallet])
    } catch (txError) {
      console.error("Solana payout failed:", txError)
      return res.status(500).json({ error: 'Smart contract payout failed: ' + txError.message })
    }

    const updatedPrediction = await db.prediction.update({
      where: { id: predictionId },
      data: { status: 'cashed_out' }
    })

    await db.transaction.create({
      data: {
        userId: updatedPrediction.userId,
        type: 'cashout',
        amount: cashoutAmount,
        txHash: payoutTxHash,
        status: 'completed'
      }
    })

    res.json({ ...updatedPrediction, payoutTxHash })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Failed to cash out' })
  }
}

export async function getMyPredictions(req, res) {
  try {
    const { userId } = req.query
    const predictions = await db.prediction.findMany({ where: { userId } })
    const markets = await db.market.findMany()
    const enriched = predictions.map(p => {
      const m = markets.find(m => m.fixtureId?.toString() === p.fixtureId?.toString())
      return {
        ...p,
        fixtureName: m ? m.fixtureName : `Match #${p.fixtureId}`
      }
    })
    res.json(enriched)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Failed to fetch predictions' })
  }
}
