import { Keypair } from "@solana/web3.js";
import fs from "fs";
import bs58 from "bs58"; // bs58 is a dependency of @coral-xyz/anchor and @solana/web3.js

const privateKeyBase58 = "3bwnNoZVqa86p1aDqkto1ZXXfQo6sR41q77Uv9vueTLJFkWYns8ym5rE8sPWAi7axL8JdYDwTyoDSvEfiZSSgiHc";
const secretKey = bs58.decode(privateKeyBase58);

// Verify it's a valid keypair
const keypair = Keypair.fromSecretKey(secretKey);
console.log("Wallet public key:", keypair.publicKey.toBase58());

fs.writeFileSync("id.json", JSON.stringify(Array.from(secretKey)));
console.log("Saved to id.json successfully!");
