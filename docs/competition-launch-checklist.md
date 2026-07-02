# Competition Launch Checklist

Use this as the exact order for getting SettleLine ready for judges.

## 1. Create GitHub Repo

You do this part because it requires your GitHub account.

1. Create a public GitHub repo named `settleline` or `txline-settleline`.
2. From this project folder, run:

```bash
git init
git add .
git commit -m "Initial SettleLine TxLINE submission"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

Submission requirement satisfied: public repo link.

## 2. Deploy Frontend

The fastest path is Netlify or Vercel.

### Vercel

1. Import the GitHub repo into Vercel.
2. Framework preset: `Other`.
3. Build command: leave empty.
4. Output directory: `.`.
5. Deploy.

### Netlify

1. Import the GitHub repo into Netlify.
2. Build command: leave empty.
3. Publish directory: `.`.
4. Deploy.

Submission requirement satisfied: public application URL.

## 3. Deploy Backend

Use Render, Railway, Fly.io, or another Node host.

Recommended simple Render settings:

- Root directory: `backend`
- Build command: `npm install`
- Start command: `npm start`

Environment variables:

```bash
PORT=8787
TXLINE_NETWORK=devnet
TXLINE_GUEST_JWT=your_guest_jwt
TXLINE_API_TOKEN=your_activated_api_token
SOLANA_RPC_URL=https://api.devnet.solana.com
SETTLELINE_PROGRAM_ID=your_deployed_program_id
```

After deploy, put the backend URL into the app's `Backend URL` field.

## 4. Deploy Solana Program To Devnet

Do this from WSL Ubuntu or a Linux/macOS terminal:

```bash
cd "/mnt/c/Users/cindy bae/OneDrive/Documents/TxLine"
solana config set -ud
solana-keygen new
solana airdrop 2
anchor keys sync
anchor build
anchor deploy
```

Save the deployed program ID in:

- `Anchor.toml`
- `programs/settleline/src/lib.rs`
- backend env var `SETTLELINE_PROGRAM_ID`
- submission form technical notes

Submission requirement satisfied: devnet program ID.

## 5. Connect Wallet

1. Install Phantom or Solflare.
2. Switch wallet network to Solana devnet.
3. Open the deployed frontend.
4. Click `Connect wallet`.
5. Confirm the wallet address appears in the Solana devnet band.

## 6. Confirm TxLINE Works

1. Add your deployed backend URL in the UI.
2. Click `Connect scores`.
3. Click `Connect odds`.
4. If live streams are quiet, click `Run demo stream` for the deterministic replay.

Submission requirement satisfied: TxLINE data is the primary data source.

## 7. Record Demo Video

Keep it under 5 minutes.

Show:

1. Problem: soccer prediction markets need verifiable settlement.
2. App walkthrough: fixtures, odds, positions, receipt panel.
3. TxLINE: streams and proof endpoint power the backend.
4. Solana: devnet program handles escrow and settlement.
5. Demo: run replay, validate receipt, settle markets.

Submission requirement satisfied: demo video link.

## 8. Submit

Include:

- Demo video link.
- Public GitHub repo.
- Deployed frontend URL.
- Backend URL, if public.
- Solana devnet program ID.
- TxLINE endpoints used.
- Short technical overview.
- Feedback on TxLINE API.
