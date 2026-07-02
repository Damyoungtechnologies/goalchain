# Technical Overview

## Core Idea

SettleLine is a prediction market and settlement dashboard for World Cup matches. It uses TxLINE as the primary data source for score events, odds movement, and settlement receipts. The project now includes a devnet Anchor program scaffold so settlement can move on-chain while the demo UI remains reliable when live match activity is limited.

## Architecture

- Static frontend in `index.html`, `styles.css`, and `app.js`.
- Backend relay in `backend/src` for TxLINE credentials, snapshots, streams, validation proof retrieval, and settlement planning.
- Anchor program in `programs/settleline` for market PDAs, position PDAs, escrow vault PDAs, settlement, and claims.
- TxLINE connector uses `fetch` with a readable stream because browser `EventSource` cannot attach the required `Authorization` and `X-Api-Token` headers.
- Market state is normalized by fixture, market, outcome, position, and receipt.

## TxLINE Integration

The live connector is wired for:

- Mainnet API origin: `https://txline.txodds.com`
- Devnet API origin: `https://txline-dev.txodds.com`
- Scores stream: `/api/scores/stream`
- Odds stream: `/api/odds/stream`

The app expects credentials from the TxLINE activation flow:

- `Authorization: Bearer <guest JWT>`
- `X-Api-Token: <activated API token>`

Production hydration should call:

- `/api/fixtures/snapshot`
- `/api/odds/snapshot/:fixtureId`
- `/api/scores/snapshot/:fixtureId`
- `/api/scores/updates/:fixtureId`

## Settlement Logic

The demo and Anchor scaffold support three initial market types:

- Match winner: home, draw, or away from final score.
- Total goals 2.5: over or under from home plus away goals.
- First scorer: first goal team or no goal.

When a receipt is ready, the validator checks fixture ID, final score, proof node presence, and local root consistency in the demo UI. On-chain, the `settle_market` instruction accepts TxLINE proof material and records the winning outcome before winners can claim escrowed funds. A production submission should replace the local on-chain gate with a Solana CPI into TxLINE `validate_stat`, passing the proof nodes and expected stat value.

## Demo Video Beats

1. Show the app open directly into the market dashboard.
2. Start the replay stream and point out score, odds, and receipt changes.
3. Place one or two positions into the escrow model.
4. Let full time arrive, validate the receipt, and show automatic settlement.
5. Briefly show the live connection controls and name the TxLINE endpoints used.

## Feedback for TxODDS

What worked well:

- The normalized schema and common streaming shape make it straightforward to build a single market state reducer.
- The split between score streams, odds streams, and snapshots maps well to dashboard hydration plus real-time updates.

Potential friction:

- Browser clients need a streaming approach that supports custom headers, so examples using `fetch` streams are more directly useful than plain `EventSource`.
- A small canonical sample payload for World Cup score and odds events would make hackathon testing faster.
