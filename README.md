# SettleLine

SettleLine is a working demo for the TxODDS Prediction Markets and Settlement track. It includes a World Cup prediction market console, a TxLINE backend relay, and an Anchor/Solana escrow program scaffold for devnet settlement.

The product follows the intended Web3 split:

- Solana program: creates markets, accepts deposits, locks funds in escrow, settles winning outcomes, and pays winners.
- Backend: calls TxLINE APIs, streams odds/scores, requests Merkle proof material, and submits settlement data.
- Frontend: displays live markets, user positions, TxLINE receipts, and settlement state.

## Run

Open `index.html` in a browser for the demo UI. No install step is required for replay mode.

The app has two modes:

- `Run demo stream`: deterministic score and odds replay for the demo video and judge review.
- `Connect scores` / `Connect odds`: connects to TxLINE SSE streams when a guest JWT and activated API token are supplied.

## TxLINE Endpoints Used

- `POST /auth/guest/start` for the guest JWT, completed outside this static demo during TxLINE activation.
- `POST /api/token/activate` for the activated API token, completed outside this static demo during TxLINE activation.
- `GET /api/scores/stream` for real-time score updates.
- `GET /api/odds/stream` for real-time odds updates.
- `GET /api/fixtures/snapshot` for production fixture hydration.
- `GET /api/odds/snapshot/:fixtureId` for production odds hydration.
- `GET /api/scores/snapshot/:fixtureId` and `GET /api/scores/updates/:fixtureId` for score state and replay.

## Demo Flow

1. Open the app and click `Run demo stream`.
2. Watch the Japan vs Mexico market reprice from score and odds events.
3. Add positions by clicking outcome rows while the market is open.
4. At full time, open the receipt panel and click `Validate receipt`.
5. The settlement gate resolves winner, total goals, and first scorer markets.

## Notes

The UI includes a deterministic local receipt check so the settlement path can be demonstrated without depending on live World Cup activity. The Anchor program scaffold lives in `programs/settleline` and is designed to be deployed to Solana devnet.

## Devnet Deployment

See `docs/devnet-deployment.md`.

Short version:

```bash
solana config set -ud
solana-keygen new
solana airdrop 2
anchor keys sync
anchor build
anchor deploy
```

After deploy, replace the placeholder program ID in `Anchor.toml`, `programs/settleline/src/lib.rs`, and the UI/devnet environment with the deployed program ID.
