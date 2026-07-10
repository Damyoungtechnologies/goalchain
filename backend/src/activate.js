import * as anchor from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Connection, PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import axios from "axios";
import nacl from "tweetnacl";
import fs from "fs";
import os from "os";
import path from "path";
import "dotenv/config";

// Mainnet Config
const NETWORK = "mainnet";
const rpcUrl = "https://api.mainnet-beta.solana.com";
const apiOrigin = "https://txline.txodds.com";
const programId = new PublicKey("9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA");
const txlTokenMint = new PublicKey("Zhw9TVKp68a1QrftncMSd6ELXKDtpVMNuMGr1jNwdeL");
const apiBaseUrl = `${apiOrigin}/api`;

const SERVICE_LEVEL_ID = 12; // Real-time World Cup free tier (Mainnet)
const DURATION_WEEKS = 4;
const SELECTED_LEAGUES = [];

async function main() {
  const connection = new Connection(rpcUrl, "confirmed");
  
  // Load wallet
  const keypairPath = path.join(process.cwd(), "houseWallet.json");
  if (!fs.existsSync(keypairPath)) {
    console.error("Wallet keypair not found at", keypairPath);
    process.exit(1);
  }
  const secretKeyString = fs.readFileSync(keypairPath, "utf-8");
  const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
  const payer = Keypair.fromSecretKey(secretKey);
  const wallet = new anchor.Wallet(payer);
  
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);
  
  const idlString = fs.readFileSync(path.join(process.cwd(), "src", "txline.min.json"), "utf8");
  const idl = JSON.parse(idlString);
  const program = new anchor.Program(idl, provider);
  
  console.log("Subscribing to Free Tier (Service Level 1)...");
  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync([Buffer.from("token_treasury_v2")], program.programId);
  const tokenTreasuryVault = getAssociatedTokenAddressSync(txlTokenMint, tokenTreasuryPda, true, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
  const [pricingMatrixPda] = PublicKey.findProgramAddressSync([Buffer.from("pricing_matrix")], program.programId);
  
  console.log("Checking/creating user token account...");
  const { getOrCreateAssociatedTokenAccount } = await import("@solana/spl-token");
  
  const userTokenAccountObj = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    txlTokenMint,
    payer.publicKey,
    false,
    "confirmed",
    { commitment: "confirmed" },
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  
  const userTokenAccount = userTokenAccountObj.address;
  console.log("User token account:", userTokenAccount.toBase58());
  
  try {
    const txSig = await program.methods
      .subscribe(SERVICE_LEVEL_ID, DURATION_WEEKS)
      .accounts({
        user: payer.publicKey,
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
    
    console.log("Getting guest JWT...");
    const authResponse = await axios.post(`${apiOrigin}/auth/guest/start`);
    const jwt = authResponse.data.token;
    
    console.log("Signing activation message...");
    const messageString = `${txSig}:${SELECTED_LEAGUES.join(",")}:${jwt}`;
    const message = new TextEncoder().encode(messageString);
    const signatureBytes = nacl.sign.detached(message, payer.secretKey);
    const walletSignature = Buffer.from(signatureBytes).toString("base64");
    
    console.log("Activating API access...");
    const activationResponse = await axios.post(
      `${apiBaseUrl}/token/activate`,
      {
        txSig,
        walletSignature,
        leagues: SELECTED_LEAGUES,
      },
      {
        headers: { Authorization: `Bearer ${jwt}` }
      }
    );
    
    const apiToken = activationResponse.data.token || activationResponse.data;
    console.log("API Token activated successfully!");
    
    console.log("Updating .env...");
    const envPath = path.join(process.cwd(), ".env");
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
    envContent = envContent.replace(/^TXLINE_GUEST_JWT=.*$/gm, "");
    envContent = envContent.replace(/^TXLINE_API_TOKEN=.*$/gm, "");
    envContent = envContent.replace(/^TXLINE_NETWORK=.*$/gm, "");
    envContent += `\nTXLINE_NETWORK=mainnet\nTXLINE_GUEST_JWT=${jwt}\nTXLINE_API_TOKEN=${apiToken}\n`;
    fs.writeFileSync(envPath, envContent.replace(/\n\n+/g, "\n").trim() + "\n");
    console.log("Saved credentials to .env. Restart your backend to start fetching World Cup data!");
  } catch (err) {
    console.error("Activation failed:", err.message);
    if (err.response) {
      console.error("API Error details:", err.response.data);
    }
  }
}

main().catch(console.error);
