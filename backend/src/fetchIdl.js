import * as anchor from "@coral-xyz/anchor";
import { config } from "./config.js";
import fs from "fs";

async function fetchAndSaveIdl() {
  const connection = new anchor.web3.Connection(config.solana.rpcUrl);
  const provider = new anchor.AnchorProvider(connection, { publicKey: anchor.web3.PublicKey.default }, {});
  const txlineProgramId = new anchor.web3.PublicKey(config.txline.txlineProgramId);

  console.log("Fetching original IDL...");
  const idl = await anchor.Program.fetchIdl(txlineProgramId, provider);
  
  if (idl) {
    // Modify the IDL to ONLY include PricingMatrix and ServiceRow to prevent parsing crashes
    idl.accounts = idl.accounts.filter(a => a.name === "PricingMatrix");
    idl.types = idl.types.filter(t => t.name === "PricingMatrix" || t.name === "ServiceRow");
    idl.instructions = []; // Remove instructions as we don't need them for fetching
    idl.events = [];
    idl.errors = [];
    
    // Make sure the address is present
    idl.address = txlineProgramId.toString();

    fs.writeFileSync("src/txline.json", JSON.stringify(idl, null, 2));
    console.log("Saved minimal IDL to src/txline.json!");
  } else {
    console.log("IDL not found on chain.");
  }
}

fetchAndSaveIdl();
