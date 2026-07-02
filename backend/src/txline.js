import { config } from "./config.js";

export function txlineHeaders(extra = {}) {
  if (!config.txline.jwt || !config.txline.apiToken) {
    throw new Error("Missing TXLINE_GUEST_JWT or TXLINE_API_TOKEN");
  }

  return {
    Authorization: `Bearer ${config.txline.jwt}`,
    "X-Api-Token": config.txline.apiToken,
    ...extra,
  };
}

export async function txlineGet(pathname, params = {}) {
  const url = new URL(`${config.txline.apiBase}${pathname}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    headers: txlineHeaders({ Accept: "application/json" }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`TxLINE ${response.status}: ${text.slice(0, 300)}`);
  }

  return response.json();
}

export async function fetchFixturesSnapshot() {
  return txlineGet("/fixtures/snapshot");
}

export async function fetchScoreSnapshot(fixtureId, asOf = Date.now()) {
  return txlineGet(`/scores/snapshot/${fixtureId}`, { asOf });
}

export async function fetchScoreValidation({ fixtureId, seq, statKey, statKey2 }) {
  return txlineGet("/scores/stat-validation", {
    fixtureId,
    seq,
    statKey,
    statKey2,
  });
}

export async function openTxlineStream(kind, signal) {
  const response = await fetch(`${config.txline.apiBase}/${kind}/stream`, {
    headers: txlineHeaders({
      Accept: "text/event-stream",
      "Cache-Control": "no-cache",
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`TxLINE stream failed with ${response.status}`);
  }

  return response;
}

export function toBytes32(value) {
  const bytes =
    Array.isArray(value)
      ? Uint8Array.from(value)
      : value instanceof Uint8Array
        ? value
        : typeof value === "string" && value.startsWith("0x")
          ? Buffer.from(value.slice(2), "hex")
          : Buffer.from(String(value), "base64");

  if (bytes.length !== 32) {
    throw new Error(`Expected 32-byte value, received ${bytes.length}`);
  }

  return Array.from(bytes);
}

export function toProofNodes(nodes = []) {
  return nodes.map((node) => ({
    hash: toBytes32(node.hash),
    isRightSibling: Boolean(node.isRightSibling),
  }));
}

export function buildSettlementProof(validation) {
  return {
    fixtureId: Number(validation.summary.fixtureId),
    seq: Number(validation.seq || validation.summary.seq || 0),
    statKey: Number(validation.statKey || validation.statToProve?.statKey || 0),
    expectedValue: Number(validation.statToProve?.value ?? validation.value ?? 0),
    eventStatRoot: toBytes32(validation.eventStatRoot),
    receiptHash: toBytes32(validation.eventStatRoot),
    proofNodes: [
      ...toProofNodes(validation.statProof),
      ...toProofNodes(validation.subTreeProof),
      ...toProofNodes(validation.mainTreeProof),
    ],
    raw: validation,
  };
}
