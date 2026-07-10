import * as anchor from "@coral-xyz/anchor";
import idl from "./full_txline.json" with { type: "json" };
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Connection, PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import nacl from "tweetnacl";
import fs from "fs";

const rpcUrl = "https://api.devnet.solana.com";
const apiOrigin = "https://txline-dev.txodds.com";
const programId = new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");
const txlTokenMint = new PublicKey("4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG");
const apiBaseUrl = `${apiOrigin}/api`;

async function run() {
  const connection = new Connection(rpcUrl, "confirmed");
  const localPayer = Keypair.generate();

  console.log("Airdropping 1 SOL for devnet fees to", localPayer.publicKey.toBase58());
  const airdropSig = await connection.requestAirdrop(localPayer.publicKey, 1_000_000_000);
  await connection.confirmTransaction({ signature: airdropSig, ...(await connection.getLatestBlockhash()) });

  const wallet = new anchor.Wallet(localPayer);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);

  const program = new anchor.Program(idl, provider);

  const SERVICE_LEVEL_ID = 1;
  const DURATION_WEEKS = 4;
  const SELECTED_LEAGUES = [];

  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync([Buffer.from("token_treasury_v2")], program.programId);
  const tokenTreasuryVault = getAssociatedTokenAddressSync(txlTokenMint, tokenTreasuryPda, true, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
  const [pricingMatrixPda] = PublicKey.findProgramAddressSync([Buffer.from("pricing_matrix")], program.programId);
  const userTokenAccount = getAssociatedTokenAddressSync(txlTokenMint, localPayer.publicKey, false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

  console.log("Subscribing on-chain...");
  const txSig = await program.methods
    .subscribe(SERVICE_LEVEL_ID, DURATION_WEEKS)
    .accounts({
      user: localPayer.publicKey,
      pricingMatrix: pricingMatrixPda,
      tokenMint: txlTokenMint,
      userTokenAccount,
      tokenTreasuryVault,
      tokenTreasuryPda,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log("Subscription transaction:", txSig);

  console.log("Getting guest token...");
  const authResponse = await fetch(`${apiOrigin}/auth/guest/start`, { method: "POST" });
  const authData = await authResponse.json();
  const jwt = authData.token;

  const messageString = `${txSig}:${SELECTED_LEAGUES.join(",")}:${jwt}`;
  const message = new TextEncoder().encode(messageString);
  const signatureBytes = nacl.sign.detached(message, localPayer.secretKey);
  const walletSignature = Buffer.from(signatureBytes).toString("base64");

  console.log("Activating API access...");
  const activationResponse = await fetch(`${apiBaseUrl}/token/activate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify({ txSig, walletSignature, leagues: SELECTED_LEAGUES })
  });

  const actData = await activationResponse.json();
  const apiToken = actData.token || actData;

  fs.writeFileSync(".env", `TXLINE_GUEST_JWT=${jwt}\nTXLINE_API_TOKEN=${apiToken}\n`);
  console.log("SUCCESS! Credentials saved to backend/.env");
}

run().catch(console.error);
