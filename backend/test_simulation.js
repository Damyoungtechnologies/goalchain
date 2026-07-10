import * as anchor from "@coral-xyz/anchor";
import idl from "./full_txline.json" with { type: "json" };
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction
} from "@solana/spl-token";
import { Connection, PublicKey, SystemProgram, Keypair, TransactionMessage, VersionedTransaction } from "@solana/web3.js";

const rpcUrl = "https://api.devnet.solana.com";
const programId = new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");
const txlTokenMint = new PublicKey("4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG");

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

  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync([Buffer.from("token_treasury_v2")], program.programId);
  const tokenTreasuryVault = getAssociatedTokenAddressSync(txlTokenMint, tokenTreasuryPda, true, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
  const [pricingMatrixPda] = PublicKey.findProgramAddressSync([Buffer.from("pricing_matrix")], program.programId);
  const userTokenAccount = getAssociatedTokenAddressSync(txlTokenMint, localPayer.publicKey, false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

  const ixs = [];
  ixs.push(
    createAssociatedTokenAccountIdempotentInstruction(
      localPayer.publicKey,
      userTokenAccount,
      localPayer.publicKey,
      txlTokenMint,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  );

  const subIx = await program.methods
    .subscribe(1, 4)
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
    .instruction();
  
  ixs.push(subIx);

  const latestBlockhash = await connection.getLatestBlockhash();
  const messageV0 = new TransactionMessage({
    payerKey: localPayer.publicKey,
    recentBlockhash: latestBlockhash.blockhash,
    instructions: ixs,
  }).compileToV0Message();

  const transaction = new VersionedTransaction(messageV0);
  transaction.sign([localPayer]);

  console.log("Simulating...");
  const sim = await connection.simulateTransaction(transaction);
  console.log("Simulation Result:", JSON.stringify(sim.value, null, 2));
}

run().catch(console.error);
