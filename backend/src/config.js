import "dotenv/config";

export const TXLINE_NETWORKS = {
  mainnet: {
    apiBase: "https://txline.txodds.com/api",
    authBase: "https://txline.txodds.com",
    txlineProgramId: "9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA",
  },
  devnet: {
    apiBase: "https://txline-dev.txodds.com/api",
    authBase: "https://txline-dev.txodds.com",
    txlineProgramId: "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J",
  },
};

const networkName = process.env.TXLINE_NETWORK || "devnet";
const network = TXLINE_NETWORKS[networkName] || TXLINE_NETWORKS.devnet;

export const config = {
  port: Number(process.env.PORT || 8787),
  networkName,
  txline: {
    ...network,
    jwt: process.env.TXLINE_GUEST_JWT || "",
    apiToken: process.env.TXLINE_API_TOKEN || "",
  },
  solana: {
    rpcUrl: process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
    settlelineProgramId: process.env.SETTLELINE_PROGRAM_ID || "",
    keeperKeypairPath: process.env.KEEPER_KEYPAIR_PATH || "",
  },
};
