import { PublicKey } from "@solana/web3.js";
import pkg from "@coral-xyz/anchor";
const { BN } = pkg;
import { config } from "./config.js";

export function deriveDailyScoresPda(targetTimestampMs) {
  const epochDay = Math.floor(Number(targetTimestampMs) / 86400000);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("daily_scores_roots"), new BN(epochDay).toArrayLike(Buffer, "le", 2)],
    new PublicKey(config.txline.txlineProgramId),
  )[0];
}

export function resolveWinnerIndex({ marketKind, homeScore, awayScore, firstScorer, outcomes }) {
  if (marketKind === "match_winner") {
    if (homeScore > awayScore) return outcomes.findIndex((item) => item.type === "home");
    if (awayScore > homeScore) return outcomes.findIndex((item) => item.type === "away");
    return outcomes.findIndex((item) => item.type === "draw");
  }

  if (marketKind === "total_goals_25") {
    return outcomes.findIndex((item) => item.type === (homeScore + awayScore > 2.5 ? "over" : "under"));
  }

  if (marketKind === "first_scorer") {
    return outcomes.findIndex((item) => item.label === firstScorer || item.type === "no_goal");
  }

  throw new Error(`Unsupported market kind: ${marketKind}`);
}

export function buildSettleInstructionPlan({ market, validation, settlementProof, winningOutcome }) {
  const targetTimestamp = validation.summary?.updateStats?.minTimestamp || Date.now();
  const dailyScoresMerkleRoots = deriveDailyScoresPda(targetTimestamp);

  return {
    programId: config.solana.settlelineProgramId || "DEPLOY_SETTLELINE_PROGRAM_FIRST",
    method: "settle_market",
    accounts: {
      market: market.address,
      txlineProgram: config.txline.txlineProgramId,
      dailyScoresMerkleRoots: dailyScoresMerkleRoots.toBase58(),
    },
    args: {
      winningOutcome,
      payload: settlementProof,
    },
  };
}
