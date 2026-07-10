import * as anchor from "@coral-xyz/anchor";
import { config } from "./config.js";
import txlineIdl from "./txline.json" with { type: "json" };

async function checkPricingMatrix() {
  console.log(`Connecting to ${config.solana.rpcUrl}...`);
  const connection = new anchor.web3.Connection(config.solana.rpcUrl);
  
  const dummyWallet = {
    publicKey: anchor.web3.PublicKey.default,
    signTransaction: async (tx) => tx,
    signAllTransactions: async (txs) => txs,
  };
  
  const provider = new anchor.AnchorProvider(connection, dummyWallet, {});
  anchor.setProvider(provider);

  const txlineProgramId = new anchor.web3.PublicKey(config.txline.txlineProgramId);
  console.log(`Using TxLINE Program ID: ${txlineProgramId.toString()} on ${config.networkName}`);

  try {
    console.log("Loading TxLINE IDL locally...");
    
    // Instantiate the external TxLINE program
    const txlineProgram = new anchor.Program(txlineIdl, provider);

    // Derive the PDA for the pricing matrix
    const [pricingMatrixPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("pricing_matrix")],
      txlineProgram.programId
    );
    console.log(`Derived Pricing Matrix PDA: ${pricingMatrixPda.toString()}`);

    // Fetch the matrix data using the provided code
    const matrix = await txlineProgram.account.pricingMatrix.fetch(pricingMatrixPda);

    console.log("\n--- TxLINE Pricing Matrix ---");
    matrix.rows.forEach((row) => {
      console.log({
        serviceLevel: row.rowId,
        tokensPerWeek: row.pricePerWeekToken.toString(),
        samplingInterval: row.samplingIntervalSec,
        leagueBundle: row.leagueBundleId,
        marketBundle: row.marketBundleId
      });
      
      if (row.pricePerWeekToken.toString() === "0") {
        console.log(`^ ✨ Free bundle found! (League Bundle: ${row.leagueBundleId})`);
      }
    });

  } catch (error) {
    console.error("Error fetching pricing matrix:", error);
  }
}

checkPricingMatrix();
