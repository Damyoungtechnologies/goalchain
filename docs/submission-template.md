# Submission Template

## Project

SettleLine

## One-Liner

Verifiable World Cup prediction markets that use TxLINE scores, odds, and proof receipts to settle escrowed positions on Solana devnet.

## Links

- Demo video:
- Deployed app:
- Public repo:
- Backend API:
- Solana devnet program ID:

## What It Does

SettleLine lets users view World Cup fixtures, follow live odds and score updates, create prediction positions, and settle markets from a TxLINE score receipt. The demo includes match winner, total goals, and first scorer markets.

## TxLINE Endpoints Used

- `/api/fixtures/snapshot`
- `/api/odds/stream`
- `/api/scores/stream`
- `/api/scores/snapshot/:fixtureId`
- `/api/scores/updates/:fixtureId`
- `/api/scores/stat-validation`

## Technical Highlights

- Static frontend with deterministic replay for judge review.
- Node backend relay that keeps TxLINE credentials server-side.
- Anchor program scaffold for market PDAs, position PDAs, escrow vaults, settlement, and claims.
- Devnet settlement model designed to CPI into TxLINE `validate_stat`.

## TxLINE Feedback

What worked well:

- Normalized schema made it easy to build a single market state model.
- Separate score and odds streams match prediction market needs.
- Merkle proof endpoint gives a clean path to trust-minimized settlement.

Friction:

- Browser streaming examples should show `fetch` streams because custom auth headers are needed.
- More sample World Cup score and odds payloads would speed up local testing.
