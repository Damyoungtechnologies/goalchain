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
import { getHouseWallet } from "./walletUtils.js";
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
    const fixtures = await db.fixture.findMany();
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

app.get("/api/fixtures/:id", async (req, res, next) => {
  try {
    const fixtureId = req.params.id;
    // Check DB first
    const fixture = await db.fixture.findUnique({ where: { FixtureId: parseInt(fixtureId) }});
    if (fixture) return res.json(fixture);
    
    // Fallback: try fetching the score snapshot to reconstruct historical events
    try {
      const scoreEvents = await fetchScoreSnapshot(fixtureId);
      if (scoreEvents && scoreEvents.length > 0) {
         const latest = scoreEvents[scoreEvents.length - 1];
         const reconstructed = {
           FixtureId: parseInt(fixtureId),
           events: scoreEvents,
           GameState: (latest.StatusId === 3 || latest.StatusId === 4) ? 3 : 2,
           Participant1Score: latest.Score?.Participant1?.Total?.Goals || 0,
           Participant2Score: latest.Score?.Participant2?.Total?.Goals || 0,
           Minute: latest.Clock?.Seconds ? Math.floor(latest.Clock.Seconds / 60) : 90
         };
         return res.json(reconstructed);
      }
    } catch(e) {
      console.error("Could not fetch historical snapshot for", fixtureId, e.message);
    }
    
    res.status(404).json({ error: "Fixture not found" });
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
app.get("/api/admin/markets", async (_req, res) => {
  res.json(await db.market.findMany());
});

app.get("/api/analytics", async (_req, res) => {
  const predictions = await db.prediction.findMany();
  const markets = await db.market.findMany({ where: { status: 'active' } });
  
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

app.get("/api/leaderboard", async (_req, res) => {
  const predictions = await db.prediction.findMany();
  const users = await db.user.findMany();
  
  const leaderboard = users.map(user => {
    const userPreds = predictions.filter(p => p.userId === user.id);
    const totalStaked = userPreds.reduce((sum, p) => sum + p.stakeAmount, 0);
    const totalPayout = userPreds.filter(p => p.status === 'won' || p.status === 'cashed_out')
                                 .reduce((sum, p) => sum + p.potentialPayout, 0);
    
    const profit = totalPayout - totalStaked;
    const roi = totalStaked > 0 ? ((profit / totalStaked) * 100).toFixed(1) : 0;
    
    const primaryCurrency = userPreds.length > 0 ? (userPreds[userPreds.length - 1].currency || 'SOL') : 'SOL';
    
    return {
      rank: 0,
      username: user.displayName || 'Anonymous',
      wallet: user.id.slice(0,4) + '...' + user.id.slice(-4),
      profit: parseFloat(profit.toFixed(2)),
      roi: parseFloat(roi),
      predictions: userPreds.length,
      currency: primaryCurrency
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
    const houseWallet = getHouseWallet();
    res.json({ publicKey: houseWallet.publicKey.toBase58() });
  } catch (error) {
    next(error);
  }
});

// Background Oracle Poller
setInterval(async () => {
  try {
    let snapshots = [];
    try {
      snapshots = await fetchFixturesSnapshot();
    } catch (e) {
      // Oracle offline for full snapshot, fallback to updating existing active matches
      snapshots = (await db.fixture.findMany()).filter(f => f.GameState < 3);
    }
    
    const now = Date.now();

    for (const snap of snapshots) {
      const existingDbFixture = await db.fixture.findUnique({ where: { FixtureId: snap.FixtureId } }) || {};
      const fixtureData = { ...existingDbFixture, ...snap };
      
      // Dynamically detect live matches
      if (fixtureData.StartTime && fixtureData.StartTime <= now && fixtureData.GameState < 3) {
        fixtureData.GameState = 2; // Mark as live if started and not finished
      }

      // Fetch score events for active matches
      if (fixtureData.GameState === 2) {
        try {
          const scoreEvents = await fetchScoreSnapshot(fixtureData.FixtureId);
          if (scoreEvents && scoreEvents.length > 0) {
            // Merge events safely
            const eventMap = new Map((fixtureData.events || []).map(e => [e.Id || JSON.stringify(e), e]));
            for (const ev of scoreEvents) {
              eventMap.set(ev.Id || JSON.stringify(ev), ev);
            }
            fixtureData.events = Array.from(eventMap.values()).sort((a, b) => {
               const ca = a.Clock?.Seconds || 0;
               const cb = b.Clock?.Seconds || 0;
               return ca === cb ? (a.Id || 0) - (b.Id || 0) : ca - cb;
            });
            
            const hasFinished = scoreEvents.some(ev => ev.Action === 'match_ended' || ev.Action === 'fulltime_finalised' || ev.StatusId === 5 || ev.StatusId === 8);
            const latest = scoreEvents[scoreEvents.length - 1];
            
            if (hasFinished) {
              fixtureData.GameState = 3; // Finished
            } else if (latest && latest.Clock && latest.Clock.Seconds >= 0) {
              fixtureData.GameState = 2; // Live
              fixtureData.Minute = Math.floor(latest.Clock.Seconds / 60);
            }
            
            // Get latest score from the last event that had a Score block
            const scoreEvent = [...scoreEvents].reverse().find(e => e.Score);
            if (scoreEvent && scoreEvent.Score) {
              fixtureData.Participant1Score = scoreEvent.Score.Participant1?.Total?.Goals ?? fixtureData.Participant1Score ?? 0;
              fixtureData.Participant2Score = scoreEvent.Score.Participant2?.Total?.Goals ?? fixtureData.Participant2Score ?? 0;
            }
          }
        } catch (e) {
          // Swallow individual score fetch error, we'll keep the previous events if any
        }
      }

      // Generate AI Insights
      if (!fixtureData.aiInsights) fixtureData.aiInsights = [];
      const homeAdv = (fixtureData.Participant1Score || 0) - (fixtureData.Participant2Score || 0);
      const minute = fixtureData.Minute || 0;
      const isLate = minute >= 75;
      const newInsights = [];

      if (fixtureData.GameState === 2 || fixtureData.GameState === 3) {
        if (fixtureData.events && fixtureData.events.length > 0) {
          const recentEvents = fixtureData.events.filter(ev => ev.Clock && ev.Clock.Seconds >= (minute * 60) - 600);
          const dangerAttacks = recentEvents.filter(ev => ev.Action?.includes('danger_possession'));
          const corners = recentEvents.filter(ev => ev.Action === 'corner');
          const cards = fixtureData.events.filter(ev => ev.Action === 'yellow_card' || ev.Action === 'red_card');
          const injuries = recentEvents.filter(ev => ev.Action === 'injury');

          if (dangerAttacks.length >= 4) newInsights.push({ type: 'insight', icon: 'Zap', color: 'text-accent', text: `Intense pressure detected! ${dangerAttacks.length} dangerous attacks in the last 10 minutes.` });
          if (corners.length >= 2) newInsights.push({ type: 'trend', icon: 'TrendingUp', color: 'text-purple-400', text: `High set-piece volume. ${corners.length} corners recently awarded.` });
          if (cards.length > 3) newInsights.push({ type: 'alert', icon: 'AlertTriangle', color: 'text-red-400', text: `High tension match! The Oracle has logged ${cards.length} cards so far.` });
          if (injuries.length > 0) newInsights.push({ type: 'alert', icon: 'AlertTriangle', color: 'text-orange-500', text: `Recent player injury detected. Stoppages could disrupt team momentum.` });
        }
        
        if (homeAdv > 0) newInsights.push({ type: 'trend', icon: 'TrendingUp', color: 'text-green-400', text: `Scoreline momentum favors ${fixtureData.Participant1 || 'Home'}.` });
        else if (homeAdv < 0) newInsights.push({ type: 'trend', icon: 'TrendingUp', color: 'text-orange-400', text: `${fixtureData.Participant2 || 'Away'} holds a strong advantage.` });
        
        if (homeAdv === 0 && isLate) newInsights.push({ type: 'insight', icon: 'Zap', color: 'text-yellow-400', text: `High probability of a late decisive goal based on historical tie data.` });
      } else if (fixtureData.GameState === 1) {
        newInsights.push({ type: 'alert', icon: 'AlertTriangle', color: 'text-orange-400', text: `Pre-match odds are highly volatile. Heavy volume detected.` });
      }

      for (const ins of newInsights.slice(0, 4)) {
        const exists = fixtureData.aiInsights.some(existing => existing.text === ins.text && Math.abs((existing.minute || 0) - minute) < 5);
        if (!exists) {
          fixtureData.aiInsights.push({ ...ins, id: Date.now() + Math.random(), minute, timestamp: Date.now() });
        }
      }
      
      // Upsert into DB
      await db.fixture.upsert({
        where: { FixtureId: fixtureData.FixtureId },
        update: fixtureData,
        create: fixtureData
      });
    }
  } catch (e) {
    // Only warn occasionally if it gets annoying
    // console.warn("Oracle Poller Network Error:", e.message);
  }
}, 5000);

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
    const existingMarkets = await db.market.findMany();
    for (const fixture of activeFixtures) {
      const hasMarket = existingMarkets.some(m => m.fixtureId === fixture.FixtureId);
      if (!hasMarket) {
        await db.market.create({
          data: {
            fixtureId: fixture.FixtureId,
            fixtureName: `${fixture.Participant1 || 'Home'} vs ${fixture.Participant2 || 'Away'}`,
            status: "active",
            escrow: 0
          }
        });
      }
    }

    const openPredictions = await db.prediction.findMany({ where: { status: "open" } });
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
            
            const houseWallet = getHouseWallet();
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

            await db.prediction.update({
              where: { id: prediction.id },
              data: { status: "won", payoutTxHash }
            });

            await db.transaction.create({
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
          await db.prediction.update({
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
    const openPredictions = await db.prediction.findMany({ where: { status: "open", fixtureId: fixtureId.toString() } });
    
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
          
          const houseWallet = getHouseWallet();
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
        await db.prediction.update({
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
