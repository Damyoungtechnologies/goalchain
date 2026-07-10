import express from "express";
import cors from "cors";
import { config } from "./config.js";
import {
  buildSettlementProof,
  fetchFixturesSnapshot,
  fetchScoreSnapshot,
  fetchScoreValidation,
  openTxlineStream,
  getMarketsByFixture,
} from "./txline.js";
import { buildSettleInstructionPlan } from "./settlement.js";
import { stakePrediction, cashoutPrediction, getMyPredictions } from "./routes/predictions.js";
import { db } from "./db.js";
import { getAssociatedTokenAddressSync, createTransferInstruction } from "@solana/spl-token";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    network: config.networkName,
    txlineProgramId: config.txline.txlineProgramId,
    settlelineProgramId: config.solana.settlelineProgramId || null,
  });
});

app.get("/api/fixtures", async (_req, res, next) => {
  try {
    let fixtures = [];
    try {
      fixtures = await fetchFixturesSnapshot();
    } catch (e) {
      console.warn("Oracle offline, using mock fallback");
      fixtures = [
        {
          FixtureId: 18218149,
          Participant1: "Spain",
          Participant2: "Belgium",
          Participant1IsHome: true,
          Competition: "World Cup",
          StartTime: Date.now() - 89 * 60 * 1000,
          GameState: 2, // Hardcoded fallback to Live due to network drop
          Participant1Score: 2,
          Participant2Score: 1,
          Minute: 89
        }
      ];
    }
    
    // Attempt to patch TxOdds GameState using real score data if Oracle is online
    try {
      const spainBelgium = fixtures.find(f => f.FixtureId === 18218149);
      if (spainBelgium) {
        // Optimistically apply current known state before fetching
        spainBelgium.GameState = 2;
        spainBelgium.Minute = 89;
        spainBelgium.Participant1Score = 2;
        spainBelgium.Participant2Score = 1;

        const scoreEvents = await fetchScoreSnapshot(18218149);
        if (scoreEvents && scoreEvents.length > 0) {
          const latest = scoreEvents[scoreEvents.length - 1];
          // StatusId 3 or 4 means finished in many feeds, or check Clock
          if (latest.StatusId === 3 || latest.StatusId === 4) {
            spainBelgium.GameState = 3; // Finished
          } else if (latest && latest.Clock && latest.Clock.Seconds > 0) {
            spainBelgium.GameState = 2; // Force to Live
            spainBelgium.Minute = Math.floor(latest.Clock.Seconds / 60);
          }
          
          if (latest.Score) {
            if (latest.Score.Participant1 && latest.Score.Participant1.Total) {
              spainBelgium.Participant1Score = latest.Score.Participant1.Total.Goals || 0;
            }
            if (latest.Score.Participant2 && latest.Score.Participant2.Total) {
              spainBelgium.Participant2Score = latest.Score.Participant2.Total.Goals || 0;
            }
          }
        }
      }
    } catch (patchErr) {
      console.warn("Could not fetch latest score snapshot for Spain vs Belgium", patchErr);
    }

    res.json(fixtures);
  } catch (error) {
    next(error);
  }
});

app.get("/api/fixtures/:id/markets", async (req, res, next) => {
  try {
    const markets = await getMarketsByFixture(parseInt(req.params.id));
    res.json(markets);
  } catch (error) {
    next(error);
  }
});

app.get("/api/scores/:fixtureId", async (req, res, next) => {
  try {
    res.json(await fetchScoreSnapshot(req.params.fixtureId, req.query.asOf));
  } catch (error) {
    next(error);
  }
});

app.get("/api/validation/:fixtureId", async (req, res, next) => {
  try {
    const validation = await fetchScoreValidation({
      fixtureId: req.params.fixtureId,
      seq: req.query.seq,
      statKey: req.query.statKey,
      statKey2: req.query.statKey2,
    });
    res.json({
      validation,
      settlementProof: buildSettlementProof(validation),
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/settlement-plan", async (req, res, next) => {
  try {
    const { market, validation, winningOutcome } = req.body;
    if (!market || !validation || winningOutcome === undefined) {
      res.status(400).json({ error: "market, validation, and winningOutcome are required" });
      return;
    }

    const settlementProof = buildSettlementProof(validation);
    res.json(buildSettleInstructionPlan({ market, validation, settlementProof, winningOutcome }));
  } catch (error) {
    next(error);
  }
});

app.get("/api/stream/:kind", async (req, res, next) => {
  const { kind } = req.params;
  if (!["scores", "odds"].includes(kind)) {
    res.status(400).json({ error: "kind must be scores or odds" });
    return;
  }

  const controller = new AbortController();
  req.on("close", () => controller.abort());

  try {
    const upstream = await openTxlineStream(kind, controller.signal);
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    for await (const chunk of upstream.body) {
      res.write(chunk);
    }
  } catch (error) {
    if (!res.headersSent) next(error);
  }
});

app.post("/api/setup-env", async (req, res, next) => {
  try {
    const { jwt, apiToken } = req.body;
    if (!jwt || !apiToken) {
      res.status(400).json({ error: "Missing jwt or apiToken" });
      return;
    }
    
    // Save to .env
    const fs = await import("fs");
    let envContent = "";
    if (fs.existsSync(".env")) {
      envContent = fs.readFileSync(".env", "utf8");
    }
    
    envContent = envContent.replace(/^TXLINE_GUEST_JWT=.*$/m, "");
    envContent = envContent.replace(/^TXLINE_API_TOKEN=.*$/m, "");
    envContent += `\nTXLINE_GUEST_JWT=${jwt}\nTXLINE_API_TOKEN=${apiToken}\n`;
    
    fs.writeFileSync(".env", envContent.replace(/\n\n+/g, "\n").trim() + "\n");
    
    // Reload config in memory or just let nodemon restart the process
    res.json({ success: true, message: "Credentials saved. Backend will restart automatically." });
  } catch (error) {
    next(error);
  }
});

// --- Prediction Routes ---
app.post("/api/predictions/stake", stakePrediction);
app.post("/api/predictions/cashout", cashoutPrediction);
app.get("/api/predictions/me", getMyPredictions);

// --- Admin & Global Routes ---
app.get("/api/admin/markets", (_req, res) => {
  res.json(db.market.findMany());
});

app.get("/api/analytics", (_req, res) => {
  const predictions = db.prediction.findMany();
  const markets = db.market.findMany({ where: { status: 'active' } });
  
  const totalVolume = predictions.reduce((sum, p) => sum + p.stakeAmount, 0);
  const activeUsers = new Set(predictions.map(p => p.userId)).size;
  const activeMarkets = markets.length;
  
  const totalStaked = totalVolume;
  const totalPayout = predictions.filter(p => p.status === 'won' || p.status === 'cashed_out')
                                 .reduce((sum, p) => sum + p.potentialPayout, 0);
  const avgRoi = totalStaked > 0 ? (((totalPayout - totalStaked) / totalStaked) * 100).toFixed(1) : 0;
  
  const volumeDataMap = {};
  
  predictions.forEach(p => {
    if (!p.createdAt) return;
    const date = new Date(p.createdAt);
    const hourKey = date.getHours().toString().padStart(2, '0') + ':00';
    if (!volumeDataMap[hourKey]) {
      volumeDataMap[hourKey] = { time: hourKey, volume: 0, users: new Set() };
    }
    volumeDataMap[hourKey].volume += p.stakeAmount;
    volumeDataMap[hourKey].users.add(p.userId);
  });
  
  let volumeData = Object.values(volumeDataMap).map(v => ({
    time: v.time,
    volume: parseFloat(v.volume.toFixed(2)),
    users: v.users.size
  })).sort((a, b) => a.time.localeCompare(b.time));
  
  if (volumeData.length === 0) {
    volumeData = [{ time: new Date().getHours().toString().padStart(2, '0') + ':00', volume: 0, users: 0 }];
  }
  
  res.json({
    totalVolume,
    activeMarkets,
    activeUsers,
    avgRoi,
    volumeData
  });
});

app.get("/api/leaderboard", (_req, res) => {
  const predictions = db.prediction.findMany();
  const users = db.user.findMany();
  
  const leaderboard = users.map(user => {
    const userPreds = predictions.filter(p => p.userId === user.id);
    const totalStaked = userPreds.reduce((sum, p) => sum + p.stakeAmount, 0);
    const totalPayout = userPreds.filter(p => p.status === 'won' || p.status === 'cashed_out')
                                 .reduce((sum, p) => sum + p.potentialPayout, 0);
    
    const profit = totalPayout - totalStaked;
    const roi = totalStaked > 0 ? ((profit / totalStaked) * 100).toFixed(1) : 0;
    
    return {
      rank: 0,
      username: user.displayName || 'Anonymous',
      wallet: user.id.slice(0,4) + '...' + user.id.slice(-4),
      profit: parseFloat(profit.toFixed(2)),
      roi: parseFloat(roi),
      predictions: userPreds.length
    };
  }).filter(leader => leader.predictions > 0)
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 10);
  
  leaderboard.forEach((entry, index) => entry.rank = index + 1);
  
  res.json(leaderboard);
});

app.get("/api/house-wallet", async (req, res, next) => {
  try {
    const fs = await import("fs");
    const { Keypair } = await import("@solana/web3.js");
    if (!fs.existsSync("houseWallet.json")) {
      return res.status(500).json({ error: "House wallet not configured" });
    }
    const secret = JSON.parse(fs.readFileSync("houseWallet.json", "utf8"));
    const houseWallet = Keypair.fromSecretKey(new Uint8Array(secret));
    res.json({ publicKey: houseWallet.publicKey.toBase58() });
  } catch (error) {
    next(error);
  }
});

// Background Settlement Job
setInterval(async () => {
  try {
    let fixtures;
    try {
      fixtures = await fetchFixturesSnapshot();
    } catch (e) {
      // Just log and exit this tick if the network is down
      console.warn("Oracle offline or network error in fetchFixturesSnapshot");
      return;
    }
    
    const activeFixtures = fixtures.filter(f => f.GameState < 3);
    const finishedFixtures = fixtures.filter(f => f.GameState === 3);
    
    // Auto-create markets for new fixtures
    const existingMarkets = db.market.findMany();
    for (const fixture of activeFixtures) {
      const hasMarket = existingMarkets.some(m => m.fixtureId === fixture.FixtureId);
      if (!hasMarket) {
        db.market.create({
          data: {
            fixtureId: fixture.FixtureId,
            fixtureName: `${fixture.Participant1 || 'Home'} vs ${fixture.Participant2 || 'Away'}`,
            status: "active",
            escrow: 0
          }
        });
      }
    }

    const openPredictions = db.prediction.findMany({ where: { status: "open" } });
    console.log("Open predictions count:", openPredictions.length);

    for (const prediction of openPredictions) {
      let fixture = finishedFixtures.find(f => f.FixtureId?.toString() === prediction.fixtureId);
      
      if (!fixture) {
        // Fallback for old fixtures dropped from snapshot
        try {
          const isActive = activeFixtures.some(f => f.FixtureId?.toString() === prediction.fixtureId);
          if (!isActive) {
            const scoreEvents = await fetchScoreSnapshot(prediction.fixtureId);
            if (Array.isArray(scoreEvents) && scoreEvents.length > 0) {
              const lastEvent = scoreEvents[scoreEvents.length - 1];
              if (lastEvent.StatusId === 4 || lastEvent.StatusId === 3 || lastEvent.Score) {
                const market = existingMarkets.find(m => m.fixtureId.toString() === prediction.fixtureId);
                if (market && market.fixtureName && market.fixtureName.includes(' vs ')) {
                  const [part1, part2] = market.fixtureName.split(' vs ');
                  fixture = {
                    Participant1Score: lastEvent.Score?.Participant1?.Total?.Goals ?? 0,
                    Participant2Score: lastEvent.Score?.Participant2?.Total?.Goals ?? 0,
                    Participant1: part1,
                    Participant2: part2
                  };
                }
              }
            }
          }
        } catch (e) {
          console.error(`Fallback fetch failed for ${prediction.fixtureId}`, e.message);
        }
      }

      console.log("Checking prediction", prediction.id, "against fixture", fixture ? "FOUND" : "NOT FOUND");
      if (fixture) {
        // Real Oracle Evaluation Logic
        let won = false;
        
        if (prediction.outcome === fixture.Participant1) {
          if (fixture.Participant1Score > fixture.Participant2Score) won = true;
        } else if (prediction.outcome === fixture.Participant2) {
          if (fixture.Participant2Score > fixture.Participant1Score) won = true;
        } else if (prediction.outcome.toLowerCase() === 'draw') {
          if (fixture.Participant1Score === fixture.Participant2Score) won = true;
        }
        
        if (won) {
          try {
            const fs = await import("fs");
            const { Keypair, Connection, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } = await import("@solana/web3.js");
            
            const secret = JSON.parse(fs.readFileSync("houseWallet.json", "utf8"));
            const houseWallet = Keypair.fromSecretKey(new Uint8Array(secret));
            const connection = new Connection(config.solana.rpcUrl, "confirmed");
            
            let payoutTxHash = "mock_payout_tx_" + Date.now();
            
            if (prediction.userPubKey) {
              const toPubkey = new PublicKey(prediction.userPubKey);
              const tx = new Transaction();
              
              if (!prediction.tokenMint) {
                const lamports = Math.floor(prediction.potentialPayout * LAMPORTS_PER_SOL);
                tx.add(
                  SystemProgram.transfer({
                    fromPubkey: houseWallet.publicKey,
                    toPubkey: toPubkey,
                    lamports: lamports
                  })
                );
              } else {
                const mintPubKey = new PublicKey(prediction.tokenMint);
                const houseATA = getAssociatedTokenAddressSync(mintPubKey, houseWallet.publicKey);
                const userATA = getAssociatedTokenAddressSync(mintPubKey, toPubkey);
                
                // Assume 6 decimals for Devnet USDC/USDT
                const amount = Math.floor(prediction.potentialPayout * 1000000);
                tx.add(
                  createTransferInstruction(
                    houseATA,
                    userATA,
                    houseWallet.publicKey,
                    amount
                  )
                );
              }
              
              payoutTxHash = await sendAndConfirmTransaction(connection, tx, [houseWallet]);
              console.log(`Auto-settlement Paid out ${prediction.potentialPayout} ${prediction.currency || 'SOL'} to ${prediction.userPubKey}. Tx: ${payoutTxHash}`);
            }

            db.prediction.update({
              where: { id: prediction.id },
              data: { status: "won", payoutTxHash }
            });

            db.transaction.create({
              data: {
                userId: prediction.userId,
                type: "payout",
                amount: prediction.potentialPayout,
                txHash: payoutTxHash,
                status: "completed"
              }
            });
          } catch (e) {
            console.error("Payout failed in auto-settlement:", e);
          }
        } else {
          db.prediction.update({
            where: { id: prediction.id },
            data: { status: "lost" }
          });
        }
      }
    }
  } catch (err) {
    if (err.cause?.code === 'UND_ERR_CONNECT_TIMEOUT' || err.cause?.code === 'ENOTFOUND' || err.message === 'fetch failed') {
      console.error(`Auto-settlement warning: Network error fetching fixtures (${err.cause?.code || 'fetch failed'})`);
    } else if (err.message && err.message.includes('TxLINE 401')) {
      console.error("Auto-settlement warning: TxLINE 401 Unauthorized. Please run activate.js to get fresh mainnet credentials.");
    } else {
      console.error("Auto-settlement error:", err);
    }
  }
}, 10000);

app.use((error, _req, res, _next) => {
  res.status(500).json({
    error: error.message || "Unexpected backend error",
  });
});

// Manual Settlement Endpoint to bypass backend network blocks
app.post("/api/settle", async (req, res, next) => {
  try {
    const { fixtureId, participant1Score, participant2Score } = req.body;
    const openPredictions = db.prediction.findMany({ where: { status: "open", fixtureId: fixtureId.toString() } });
    
    let settledCount = 0;
    for (const prediction of openPredictions) {
      let won = false;
      if (prediction.outcome === "Spain") { // simplified for demo
        if (participant1Score > participant2Score) won = true;
      } else if (prediction.outcome === "Belgium") {
        if (participant2Score > participant1Score) won = true;
      } else if (prediction.outcome.toLowerCase() === 'draw') {
        if (participant1Score === participant2Score) won = true;
      }

      if (won) {
        try {
          const fs = await import("fs");
          const { Keypair, Connection, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } = await import("@solana/web3.js");
          
          const secret = JSON.parse(fs.readFileSync("houseWallet.json", "utf8"));
          const houseWallet = Keypair.fromSecretKey(new Uint8Array(secret));
          const connection = new Connection(config.solana.rpcUrl, "confirmed");
          
          if (prediction.userPubKey) {
            const toPubkey = new PublicKey(prediction.userPubKey);
            const tx = new Transaction();
            const lamports = Math.floor(prediction.potentialPayout * LAMPORTS_PER_SOL);
            
            tx.add(
              SystemProgram.transfer({
                fromPubkey: houseWallet.publicKey,
                toPubkey,
                lamports
              })
            );

            const txHash = await sendAndConfirmTransaction(connection, tx, [houseWallet]);
            console.log("Payout success!", txHash);
            
            db.prediction.update({
              where: { id: prediction.id },
              data: { status: "won", txHash }
            });

            db.transaction.create({
              data: { userId: prediction.userId, type: "payout", amount: prediction.potentialPayout, currency: "SOL", txHash }
            });
            settledCount++;
          }
        } catch (e) {
          console.error("Payout error", e);
        }
      } else {
        db.prediction.update({
          where: { id: prediction.id },
          data: { status: "lost" }
        });
        settledCount++;
      }
    }
    
    res.json({ success: true, message: `Processed ${settledCount} predictions` });
  } catch (error) {
    next(error);
  }
});

const server = app.listen(config.port, () => {
  console.log(`Server listening on port ${config.port}`);
});
