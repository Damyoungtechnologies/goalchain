import * as anchor from "@coral-xyz/anchor";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Connection, PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import axios from "axios";
import nacl from "tweetnacl";
import fs from "fs";
import bs58 from "bs58";
import path from "path";

const NETWORK = "mainnet";
const rpcUrl = "https://api.mainnet-beta.solana.com";
const apiOrigin = "https://txline.txodds.com";
const programId = new PublicKey("9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA");
const txlTokenMint = new PublicKey("Zhw9TVKp68a1QrftncMSd6ELXKDtpVMNuMGr1jNwdeL");
const apiBaseUrl = `${apiOrigin}/api`;

const SERVICE_LEVEL_ID = 12; 
const DURATION_WEEKS = 4;
const SELECTED_LEAGUES = [];

async function main() {
  const privateKeyBase58 = "3bwnNoZVqa86p1aDqkto1ZXXfQo6sR41q77Uv9vueTLJFkWYns8ym5rE8sPWAi7axL8JdYDwTyoDSvEfiZSSgiHc";
  const secretKey = bs58.decode(privateKeyBase58);
  const payer = Keypair.fromSecretKey(secretKey);
  const wallet = new anchor.Wallet(payer);

  console.log("Using provided wallet:", payer.publicKey.toBase58());
  const connection = new Connection(rpcUrl, "confirmed");
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);

  console.log("Fetching IDL from chain...");
  const idl = await anchor.Program.fetchIdl(programId, provider);
  const program = new anchor.Program(idl, provider);

  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync([Buffer.from("token_treasury_v2")], program.programId);
  const tokenTreasuryVault = getAssociatedTokenAddressSync(txlTokenMint, tokenTreasuryPda, true, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
  const [pricingMatrixPda] = PublicKey.findProgramAddressSync([Buffer.from("pricing_matrix")], program.programId);
  const userTokenAccount = getAssociatedTokenAddressSync(txlTokenMint, payer.publicKey, false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

  try {
    console.log("Subscribing to Free Tier (Mainnet - Service Level 12)...");
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
      { txSig, walletSignature, leagues: SELECTED_LEAGUES },
      { headers: { Authorization: `Bearer ${jwt}` } }
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
    console.error("Error:", err.message);
  }
}

main().catch(console.error);
