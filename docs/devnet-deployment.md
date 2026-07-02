# Devnet Deployment Guide

This project is prepared for Solana devnet, but deployment must happen from a terminal with a wallet/keypair and devnet SOL.

## 1. Install Tooling

On Windows, use WSL/Ubuntu for the Solana and Anchor toolchain.

```bash
curl --proto '=https' --tlsv1.2 -sSfL https://solana-install.solana.workers.dev | bash
```

Verify:

```bash
rustc --version
solana --version
anchor --version
node --version
yarn --version
```

## 2. Create and Fund a Devnet Wallet

```bash
solana config set -ud
solana-keygen new
solana address
solana airdrop 2
solana balance
```

Devnet SOL has no real monetary value. It only pays test transaction fees.

## 3. Install Dependencies

```bash
npm install
npm --prefix backend install
```

## 4. Generate Program ID and Build

```bash
anchor keys sync
anchor build
```

`anchor keys sync` replaces the placeholder program ID with the generated deploy keypair. Commit the resulting `Anchor.toml` and `declare_id!` changes before submitting.

## 5. Deploy to Devnet

```bash
anchor deploy
```

Copy the deployed program ID into:

- `Anchor.toml`
- `programs/settleline/src/lib.rs`
- `backend/.env` as `SETTLELINE_PROGRAM_ID`
- `index.html` if you want the demo UI to display it

## 6. Configure TxLINE Backend

Create `backend/.env` from `backend/.env.example`:

```bash
TXLINE_NETWORK=devnet
TXLINE_GUEST_JWT=your_guest_jwt
TXLINE_API_TOKEN=your_activated_api_token
SOLANA_RPC_URL=https://api.devnet.solana.com
SETTLELINE_PROGRAM_ID=your_deployed_program_id
```

Start it:

```bash
npm --prefix backend run dev
```

## 7. Production Settlement Upgrade

The current Anchor scaffold accepts TxLINE proof material and enforces deterministic escrow settlement. For the strongest hackathon submission, replace the local receipt check in `settle_market` with a CPI into TxLINE devnet `validate_stat`.

TxLINE proof flow:

1. Backend requests `/api/scores/stat-validation`.
2. Backend converts returned roots/proofs into Anchor byte arrays.
3. Keeper submits `settle_market`.
4. SettleLine program CPIs into TxLINE `validate_stat`.
5. If validation passes, SettleLine records the winning outcome.
6. Winning users call `claim`.
