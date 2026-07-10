import { config } from "./config.js";

export function txlineHeaders(extra = {}) {
  if (!config.txline.jwt || !config.txline.apiToken) {
    throw new Error("Missing TXLINE_GUEST_JWT or TXLINE_API_TOKEN");
  }

  return {
    Authorization: `Bearer ${config.txline.jwt}`,
    "x-api-token": config.txline.apiToken,
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

export async function getMarketsByFixture(fixtureId) {
  return txlineGet(`/odds/snapshot/${fixtureId}`);
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
  const mapComparison = (c) => {
    const map = { ">": "greaterThan", "<": "lessThan", "==": "equalTo", ">=": "greaterThan", "<=": "lessThan" };
    const mapped = map[c] || c || "greaterThan";
    return { [mapped]: {} };
  };

  const mapOp = (o) => {
    if (!o) return null;
    const map = { "+": "add", "-": "subtract" };
    const mapped = map[o] || o || "add";
    return { [mapped]: {} };
  };

  return {
    ts: Number(validation.ts || Date.now()),
    fixtureSummary: {
      fixtureId: Number(validation.summary.fixtureId),
      updateStats: {
        updateCount: Number(validation.summary.updateStats?.updateCount || 0),
        minTimestamp: Number(validation.summary.updateStats?.minTimestamp || 0),
        maxTimestamp: Number(validation.summary.updateStats?.maxTimestamp || 0),
      },
      eventsSubTreeRoot: toBytes32(validation.summary.eventsSubTreeRoot || validation.eventStatRoot),
    },
    fixtureProof: toProofNodes(validation.subTreeProof),
    mainTreeProof: toProofNodes(validation.mainTreeProof),
    predicate: {
      threshold: Number(validation.predicate?.threshold || 0),
      comparison: mapComparison(validation.predicate?.comparison),
    },
    statA: {
      statToProve: {
        key: Number(validation.statToProve?.statKey || validation.statKey || 0),
        value: Number(validation.statToProve?.value ?? validation.value ?? 0),
        period: Number(validation.statToProve?.period || 0),
      },
      eventStatRoot: toBytes32(validation.eventStatRoot),
      statProof: toProofNodes(validation.statProof),
    },
    statB: validation.statBToProve ? {
      statToProve: {
        key: Number(validation.statBToProve.statKey || 0),
        value: Number(validation.statBToProve.value || 0),
        period: Number(validation.statBToProve.period || 0),
      },
      eventStatRoot: toBytes32(validation.eventStatBRoot || validation.eventStatRoot),
      statProof: toProofNodes(validation.statBProof || validation.statProof),
    } : null,
    op: mapOp(validation.op),
  };
}
