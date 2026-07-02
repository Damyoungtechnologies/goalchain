import express from "express";
import cors from "cors";
import { config } from "./config.js";
import {
  buildSettlementProof,
  fetchFixturesSnapshot,
  fetchScoreSnapshot,
  fetchScoreValidation,
  openTxlineStream,
} from "./txline.js";
import { buildSettleInstructionPlan } from "./settlement.js";

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
    res.json(await fetchFixturesSnapshot());
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

app.use((error, _req, res, _next) => {
  res.status(500).json({
    error: error.message || "Unexpected backend error",
  });
});

app.listen(config.port, () => {
  console.log(`SettleLine backend listening on http://localhost:${config.port}`);
});
