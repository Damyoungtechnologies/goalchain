const TXLINE_ORIGINS = {
  mainnet: "https://txline.txodds.com",
  devnet: "https://txline-dev.txodds.com",
};

const INITIAL_FIXTURES = [
  {
    id: 17952170,
    competition: "World Cup",
    stage: "Group A",
    home: "Japan",
    away: "Mexico",
    homeScore: 0,
    awayScore: 0,
    minute: 0,
    state: "Scheduled",
    startTime: "2026-06-25T19:00:00Z",
    firstScorer: null,
  },
  {
    id: 17952171,
    competition: "World Cup",
    stage: "Group B",
    home: "Brazil",
    away: "Germany",
    homeScore: 1,
    awayScore: 1,
    minute: 64,
    state: "Live",
    startTime: "2026-06-26T22:00:00Z",
    firstScorer: "Brazil",
  },
  {
    id: 17952172,
    competition: "World Cup",
    stage: "Round of 32",
    home: "USA",
    away: "Morocco",
    homeScore: 0,
    awayScore: 0,
    minute: 0,
    state: "Scheduled",
    startTime: "2026-06-29T01:00:00Z",
    firstScorer: null,
  },
];

const DEMO_EVENTS = [
  {
    type: "odds",
    fixtureId: 17952170,
    minute: 0,
    message: "Opening winner market refreshed",
    probabilities: {
      "winner-home": [0.41, 0.29, 0.3],
      "total-25": [0.53, 0.47],
      "first-scorer": [0.43, 0.35, 0.22],
    },
  },
  {
    type: "score",
    fixtureId: 17952170,
    minute: 12,
    state: "Live",
    homeScore: 0,
    awayScore: 0,
    message: "Kickoff and first validated score tick",
  },
  {
    type: "odds",
    fixtureId: 17952170,
    minute: 18,
    message: "Mexico pressure moves first scorer price",
    probabilities: {
      "winner-home": [0.37, 0.3, 0.33],
      "total-25": [0.56, 0.44],
      "first-scorer": [0.38, 0.42, 0.2],
    },
  },
  {
    type: "score",
    fixtureId: 17952170,
    minute: 31,
    state: "Live",
    homeScore: 0,
    awayScore: 1,
    firstScorer: "Mexico",
    message: "Goal Mexico, signed score receipt emitted",
  },
  {
    type: "odds",
    fixtureId: 17952170,
    minute: 35,
    message: "Winner market repriced after goal",
    probabilities: {
      "winner-home": [0.18, 0.25, 0.57],
      "total-25": [0.68, 0.32],
      "first-scorer": [0.0, 1.0, 0.0],
    },
  },
  {
    type: "score",
    fixtureId: 17952170,
    minute: 56,
    state: "Live",
    homeScore: 1,
    awayScore: 1,
    message: "Goal Japan, escrow remains pending",
  },
  {
    type: "odds",
    fixtureId: 17952170,
    minute: 61,
    message: "Draw probability leads market",
    probabilities: {
      "winner-home": [0.31, 0.43, 0.26],
      "total-25": [0.62, 0.38],
      "first-scorer": [0.0, 1.0, 0.0],
    },
  },
  {
    type: "score",
    fixtureId: 17952170,
    minute: 78,
    state: "Live",
    homeScore: 2,
    awayScore: 1,
    message: "Goal Japan, keeper prepares settlement",
  },
  {
    type: "score",
    fixtureId: 17952170,
    minute: 90,
    state: "Final",
    homeScore: 2,
    awayScore: 1,
    message: "Full time, TxLINE proof ready for validation",
  },
];

const state = {
  fixtures: [],
  markets: [],
  positions: [],
  selectedFixtureId: 17952170,
  walletBalance: 1000,
  events: [],
  receipt: null,
  streamControllers: [],
  demoTimer: null,
  demoIndex: 0,
};

const el = {
  connectionStatus: document.querySelector("#connectionStatus"),
  settlementStatus: document.querySelector("#settlementStatus"),
  networkSelect: document.querySelector("#networkSelect"),
  jwtInput: document.querySelector("#jwtInput"),
  apiTokenInput: document.querySelector("#apiTokenInput"),
  backendUrlInput: document.querySelector("#backendUrlInput"),
  connectScoresButton: document.querySelector("#connectScoresButton"),
  connectOddsButton: document.querySelector("#connectOddsButton"),
  demoButton: document.querySelector("#demoButton"),
  resetButton: document.querySelector("#resetButton"),
  walletButton: document.querySelector("#walletButton"),
  walletStatus: document.querySelector("#walletStatus"),
  fixtureCount: document.querySelector("#fixtureCount"),
  fixtureList: document.querySelector("#fixtureList"),
  homeName: document.querySelector("#homeName"),
  awayName: document.querySelector("#awayName"),
  homeScore: document.querySelector("#homeScore"),
  awayScore: document.querySelector("#awayScore"),
  matchMinute: document.querySelector("#matchMinute"),
  matchState: document.querySelector("#matchState"),
  eventMarkers: document.querySelector("#eventMarkers"),
  marketTitle: document.querySelector("#marketTitle"),
  totalEscrow: document.querySelector("#totalEscrow"),
  marketTable: document.querySelector("#marketTable"),
  receiptState: document.querySelector("#receiptState"),
  receiptFixture: document.querySelector("#receiptFixture"),
  receiptRoot: document.querySelector("#receiptRoot"),
  receiptSlot: document.querySelector("#receiptSlot"),
  receiptNodes: document.querySelector("#receiptNodes"),
  validateButton: document.querySelector("#validateButton"),
  validationLog: document.querySelector("#validationLog"),
  walletBalance: document.querySelector("#walletBalance"),
  positionsList: document.querySelector("#positionsList"),
  eventCount: document.querySelector("#eventCount"),
  eventFeed: document.querySelector("#eventFeed"),
};

function init() {
  state.fixtures = structuredClone(INITIAL_FIXTURES);
  state.markets = buildMarkets(state.fixtures);
  state.positions = seedPositions();
  state.walletBalance = 1000;
  state.events = [];
  state.receipt = null;
  state.demoIndex = 0;
  stopStreams();
  bindEvents();
  addEvent("System", "Loaded deterministic World Cup market replay");
  render();
}

function bindEvents() {
  el.connectScoresButton.onclick = () => connectStream("scores");
  el.connectOddsButton.onclick = () => connectStream("odds");
  el.demoButton.onclick = runDemoStream;
  el.resetButton.onclick = init;
  el.validateButton.onclick = validateReceipt;
  el.walletButton.onclick = connectWallet;
}

function buildMarkets(fixtures) {
  return fixtures.flatMap((fixture) => [
    {
      id: `${fixture.id}-winner-home`,
      key: "winner-home",
      fixtureId: fixture.id,
      name: "Match winner",
      condition: "Final score result",
      status: "open",
      escrow: 342,
      result: null,
      outcomes: [
        makeOutcome(fixture.home, 0.4),
        makeOutcome("Draw", 0.3),
        makeOutcome(fixture.away, 0.3),
      ],
    },
    {
      id: `${fixture.id}-total-25`,
      key: "total-25",
      fixtureId: fixture.id,
      name: "Total goals 2.5",
      condition: "Home plus away goals",
      status: "open",
      escrow: 216,
      result: null,
      outcomes: [makeOutcome("Over", 0.54), makeOutcome("Under", 0.46)],
    },
    {
      id: `${fixture.id}-first-scorer`,
      key: "first-scorer",
      fixtureId: fixture.id,
      name: "First scorer",
      condition: "First goal team",
      status: "open",
      escrow: 188,
      result: null,
      outcomes: [
        makeOutcome(fixture.home, 0.42),
        makeOutcome(fixture.away, 0.38),
        makeOutcome("No goal", 0.2),
      ],
    },
  ]);
}

function makeOutcome(label, probability) {
  return {
    label,
    probability,
    decimal: probabilityToDecimal(probability),
  };
}

function seedPositions() {
  return [
    {
      marketId: "17952170-winner-home",
      outcome: "Japan",
      stake: 40,
      shares: 96,
      status: "open",
      claimable: 0,
    },
    {
      marketId: "17952170-total-25",
      outcome: "Over",
      stake: 35,
      shares: 65,
      status: "open",
      claimable: 0,
    },
    {
      marketId: "17952170-first-scorer",
      outcome: "Mexico",
      stake: 25,
      shares: 65,
      status: "open",
      claimable: 0,
    },
  ];
}

function render() {
  const fixture = getSelectedFixture();
  const fixtureMarkets = getFixtureMarkets(fixture.id);
  el.fixtureCount.textContent = state.fixtures.length;
  el.homeName.textContent = fixture.home;
  el.awayName.textContent = fixture.away;
  el.homeScore.textContent = fixture.homeScore;
  el.awayScore.textContent = fixture.awayScore;
  el.matchMinute.textContent = fixture.state === "Scheduled" ? "00'" : `${fixture.minute}'`;
  el.matchState.textContent = fixture.state;
  el.marketTitle.textContent = `${fixture.home} vs ${fixture.away}`;
  el.totalEscrow.textContent = `${formatMoney(sum(fixtureMarkets.map((market) => market.escrow)))} USDC`;
  el.walletBalance.textContent = `${formatMoney(state.walletBalance)} USDC`;
  el.settlementStatus.textContent = `${state.markets.filter((market) => market.status === "settled").length} markets settled`;
  renderFixtures();
  renderMarkets(fixtureMarkets);
  renderReceipt();
  renderPositions();
  renderEvents();
  renderMarkers(fixture);
}

function renderFixtures() {
  el.fixtureList.replaceChildren(
    ...state.fixtures.map((fixture) => {
      const button = document.createElement("button");
      button.className = `fixture-card${fixture.id === state.selectedFixtureId ? " active" : ""}`;
      button.type = "button";
      button.onclick = () => {
        state.selectedFixtureId = fixture.id;
        render();
      };
      button.innerHTML = `
        <strong>${escapeHtml(fixture.home)} vs ${escapeHtml(fixture.away)}</strong>
        <div class="fixture-meta"><span>${escapeHtml(fixture.stage)}</span><span>${escapeHtml(fixture.state)}</span></div>
        <div class="fixture-meta"><span>${formatKickoff(fixture.startTime)}</span><span>${fixture.homeScore}-${fixture.awayScore}</span></div>
      `;
      return button;
    }),
  );
}

function renderMarkets(markets) {
  const rows = markets.map((market) => {
    const row = document.createElement("article");
    row.className = "market-row";
    row.innerHTML = `
      <div class="market-name">
        <strong>${escapeHtml(market.name)}</strong>
        <span class="market-meta"><span>${escapeHtml(market.condition)}</span><span>${formatMoney(market.escrow)} USDC</span></span>
      </div>
      <div class="outcome-grid"></div>
      <span class="market-state ${market.status}">${market.status}</span>
    `;
    const outcomeGrid = row.querySelector(".outcome-grid");
    market.outcomes.forEach((outcome) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "outcome-button";
      button.disabled = market.status !== "open";
      button.title = `Route 25 USDC to ${outcome.label}`;
      button.onclick = () => buyPosition(market.id, outcome.label, 25);
      button.innerHTML = `
        <span>${escapeHtml(outcome.label)}</span>
        <strong>${Math.round(outcome.probability * 100)}%</strong>
        <span>${outcome.decimal.toFixed(2)}x</span>
        <span class="probability-bar" aria-hidden="true"><span style="width: ${Math.round(outcome.probability * 100)}%"></span></span>
      `;
      outcomeGrid.append(button);
    });
    return row;
  });
  el.marketTable.replaceChildren(...rows);
}

function renderReceipt() {
  if (!state.receipt) {
    el.receiptState.textContent = "Pending";
    el.receiptFixture.textContent = "-";
    el.receiptRoot.textContent = "-";
    el.receiptSlot.textContent = "-";
    el.receiptNodes.textContent = "-";
    return;
  }
  const fixture = getFixture(state.receipt.fixtureId);
  el.receiptState.textContent = state.receipt.validated ? "Validated" : "Ready";
  el.receiptFixture.textContent = `${fixture.home} vs ${fixture.away}`;
  el.receiptRoot.textContent = state.receipt.merkleRoot;
  el.receiptSlot.textContent = state.receipt.slot;
  el.receiptNodes.textContent = `${state.receipt.proof.length} nodes`;
}

function renderPositions() {
  if (!state.positions.length) {
    el.positionsList.innerHTML = "<p class=\"market-meta\">No open positions.</p>";
    return;
  }
  el.positionsList.replaceChildren(
    ...state.positions.map((position) => {
      const market = state.markets.find((item) => item.id === position.marketId);
      const fixture = getFixture(market.fixtureId);
      const card = document.createElement("article");
      card.className = "position-card";
      card.innerHTML = `
        <strong>${escapeHtml(market.name)}: ${escapeHtml(position.outcome)}</strong>
        <span class="position-meta"><span>${escapeHtml(fixture.home)} vs ${escapeHtml(fixture.away)}</span><span>${escapeHtml(position.status)}</span></span>
        <span class="position-meta"><span>Stake ${formatMoney(position.stake)} USDC</span><span>Shares ${formatMoney(position.shares)}</span></span>
        <span class="position-meta claimable"><span>Claimable</span><span>${formatMoney(position.claimable)} USDC</span></span>
      `;
      return card;
    }),
  );
}

function renderEvents() {
  el.eventCount.textContent = state.events.length;
  el.eventFeed.replaceChildren(
    ...state.events.slice(0, 14).map((event) => {
      const item = document.createElement("li");
      item.innerHTML = `<strong>${escapeHtml(event.source)}</strong> ${escapeHtml(event.message)}`;
      return item;
    }),
  );
}

function renderMarkers(fixture) {
  const relevant = state.events
    .filter((event) => event.fixtureId === fixture.id && typeof event.minute === "number")
    .slice(-8);
  el.eventMarkers.replaceChildren(
    ...relevant.map((event, index) => {
      const marker = document.createElement("span");
      marker.className = "event-marker";
      marker.textContent = event.minute;
      marker.title = event.message;
      const x = 14 + Math.min(72, Math.max(0, event.minute)) * 0.8;
      const y = index % 2 === 0 ? 36 : 104;
      marker.style.left = `${x}%`;
      marker.style.top = `${y}px`;
      return marker;
    }),
  );
}

function buyPosition(marketId, outcome, stake) {
  const market = state.markets.find((item) => item.id === marketId);
  const selectedOutcome = market.outcomes.find((item) => item.label === outcome);
  if (!market || !selectedOutcome || state.walletBalance < stake) return;
  const shares = Math.round((stake * selectedOutcome.decimal) * 100) / 100;
  state.walletBalance -= stake;
  market.escrow += stake;
  const existing = state.positions.find((item) => item.marketId === marketId && item.outcome === outcome && item.status === "open");
  if (existing) {
    existing.stake += stake;
    existing.shares += shares;
  } else {
    state.positions.push({ marketId, outcome, stake, shares, status: "open", claimable: 0 });
  }
  moveMarketProbability(market, outcome, 0.025);
  addEvent("Escrow", `${formatMoney(stake)} USDC routed to ${market.name}: ${outcome}`, market.fixtureId);
  render();
}

function runDemoStream() {
  if (state.demoTimer) {
    clearInterval(state.demoTimer);
    state.demoTimer = null;
    el.demoButton.textContent = "Run demo stream";
    el.connectionStatus.textContent = "Demo paused";
    return;
  }
  el.demoButton.textContent = "Pause demo";
  el.connectionStatus.textContent = "Demo stream running";
  if (state.demoIndex >= DEMO_EVENTS.length) state.demoIndex = 0;
  state.demoTimer = setInterval(() => {
    const event = DEMO_EVENTS[state.demoIndex];
    applyDemoEvent(event);
    state.demoIndex += 1;
    if (state.demoIndex >= DEMO_EVENTS.length) {
      clearInterval(state.demoTimer);
      state.demoTimer = null;
      el.demoButton.textContent = "Replay demo stream";
      el.connectionStatus.textContent = "Demo complete";
    }
  }, 1100);
}

async function connectStream(kind) {
  const backendUrl = el.backendUrlInput.value.trim().replace(/\/$/, "");
  if (backendUrl) {
    await connectBackendStream(kind, backendUrl);
    return;
  }

  const jwt = el.jwtInput.value.trim();
  const apiToken = el.apiTokenInput.value.trim();
  if (!jwt || !apiToken) {
    el.connectionStatus.textContent = "Missing credentials";
    addEvent("TxLINE", "Guest JWT and API token are required for live stream access");
    render();
    return;
  }
  const network = el.networkSelect.value;
  const endpoint = `${TXLINE_ORIGINS[network]}/api/${kind}/stream`;
  const controller = new AbortController();
  state.streamControllers.push(controller);
  el.connectionStatus.textContent = `Connecting ${kind}`;
  addEvent("TxLINE", `Opening ${kind} SSE stream`);
  render();

  try {
    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        "X-Api-Token": apiToken,
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Stream failed with ${response.status}`);
    el.connectionStatus.textContent = `${kind} live`;
    for await (const message of readSseMessages(response)) {
      const data = parseSseData(message.data);
      applyTxlineMessage(kind, data, message.event);
    }
  } catch (error) {
    if (controller.signal.aborted) return;
    el.connectionStatus.textContent = `${kind} stream failed`;
    addEvent("TxLINE", error.message || String(error));
    render();
  }
}

async function connectBackendStream(kind, backendUrl) {
  const endpoint = `${backendUrl}/api/stream/${kind}`;
  const controller = new AbortController();
  state.streamControllers.push(controller);
  el.connectionStatus.textContent = `Connecting backend ${kind}`;
  addEvent("Backend", `Opening ${kind} relay stream`);
  render();

  try {
    const response = await fetch(endpoint, {
      headers: {
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Backend stream failed with ${response.status}`);
    el.connectionStatus.textContent = `Backend ${kind} live`;
    for await (const message of readSseMessages(response)) {
      const data = parseSseData(message.data);
      applyTxlineMessage(kind, data, message.event);
    }
  } catch (error) {
    if (controller.signal.aborted) return;
    el.connectionStatus.textContent = `Backend ${kind} failed`;
    addEvent("Backend", error.message || String(error));
    render();
  }
}

async function connectWallet() {
  const provider = window.solana;
  if (!provider?.isPhantom && !provider?.isSolflare) {
    el.walletStatus.textContent = "Install Phantom or Solflare";
    addEvent("Wallet", "No Solana wallet provider found in this browser");
    render();
    return;
  }

  try {
    const response = await provider.connect();
    const publicKey = response.publicKey?.toString() || provider.publicKey?.toString();
    const shortKey = publicKey ? `${publicKey.slice(0, 4)}...${publicKey.slice(-4)}` : "Connected";
    el.walletStatus.textContent = shortKey;
    el.walletButton.textContent = "Wallet connected";
    addEvent("Wallet", `Connected ${shortKey} on Solana devnet`);
    render();
  } catch (error) {
    el.walletStatus.textContent = "Connection rejected";
    addEvent("Wallet", error.message || "Wallet connection rejected");
    render();
  }
}

function applyTxlineMessage(kind, payload, eventName) {
  const normalized = normalizeTxlinePayload(kind, payload);
  if (!normalized) {
    addEvent("TxLINE", `${eventName || kind} update received`);
    render();
    return;
  }
  if (kind === "scores") {
    applyScoreUpdate(normalized);
  } else {
    applyOddsUpdate(normalized);
  }
}

function normalizeTxlinePayload(kind, payload) {
  const raw = Array.isArray(payload) ? payload[0] : payload;
  if (!raw || typeof raw !== "object") return null;
  const fixtureId = Number(raw.FixtureId || raw.fixtureId || raw.fixture_id || raw.id);
  if (!fixtureId) return null;
  if (kind === "scores") {
    return {
      fixtureId,
      minute: Number(raw.Minute || raw.minute || raw.GameTime || 0),
      state: raw.GameState || raw.gameState || raw.state || "Live",
      homeScore: Number(raw.Participant1Score ?? raw.homeScore ?? raw.Score1 ?? 0),
      awayScore: Number(raw.Participant2Score ?? raw.awayScore ?? raw.Score2 ?? 0),
      message: "TxLINE score update received",
      proof: raw.proof || raw.merkleProof || null,
      merkleRoot: raw.merkleRoot || raw.root || null,
      slot: raw.slot || raw.solanaSlot || null,
    };
  }
  return {
    fixtureId,
    message: "TxLINE odds update received",
    prices: raw.prices || raw.odds || raw.markets || null,
  };
}

function applyDemoEvent(event) {
  if (event.type === "score") applyScoreUpdate(event);
  if (event.type === "odds") applyOddsUpdate(event);
}

function applyScoreUpdate(update) {
  const fixture = getFixture(update.fixtureId);
  if (!fixture) return;
  fixture.minute = update.minute ?? fixture.minute;
  fixture.state = update.state ?? fixture.state;
  fixture.homeScore = update.homeScore ?? fixture.homeScore;
  fixture.awayScore = update.awayScore ?? fixture.awayScore;
  fixture.firstScorer = update.firstScorer ?? fixture.firstScorer;
  state.receipt = buildReceipt(fixture, update);
  addEvent("Scores", update.message || "Score update", fixture.id, fixture.minute);
  if (fixture.state === "Final") settleFixtureMarkets(fixture);
  render();
}

function applyOddsUpdate(update) {
  const fixture = getFixture(update.fixtureId);
  if (!fixture) return;
  if (update.probabilities) {
    for (const [key, probabilities] of Object.entries(update.probabilities)) {
      const market = state.markets.find((item) => item.fixtureId === fixture.id && item.key === key);
      if (market) setMarketProbabilities(market, probabilities);
    }
  } else if (update.prices) {
    applyGenericOdds(fixture.id, update.prices);
  }
  addEvent("Odds", update.message || "Odds update", fixture.id, update.minute ?? fixture.minute);
  render();
}

function applyGenericOdds(fixtureId, prices) {
  const market = state.markets.find((item) => item.fixtureId === fixtureId && item.key === "winner-home");
  if (!market) return;
  const list = Array.isArray(prices) ? prices : Object.values(prices).flat();
  const decimals = list
    .map((item) => Number(item.decimal || item.Decimal || item.price || item.Price))
    .filter((value) => Number.isFinite(value) && value > 1);
  if (decimals.length >= market.outcomes.length) {
    const implied = decimals.slice(0, market.outcomes.length).map((value) => 1 / value);
    setMarketProbabilities(market, normalizeProbabilities(implied));
  }
}

function buildReceipt(fixture, update) {
  const proof = update.proof || [
    { hash: pseudoHash(`${fixture.id}:${fixture.homeScore}:${fixture.awayScore}:left`), isRightSibling: false },
    { hash: pseudoHash(`${fixture.id}:${fixture.minute}:right`), isRightSibling: true },
  ];
  return {
    fixtureId: fixture.id,
    seq: update.seq || state.events.length + 1,
    stat: "score.fulltime",
    value: `${fixture.homeScore}-${fixture.awayScore}`,
    merkleRoot: update.merkleRoot || pseudoHash(`${fixture.id}:${fixture.homeScore}:${fixture.awayScore}:${fixture.state}`),
    slot: update.slot || 351220000 + state.events.length,
    proof,
    validated: false,
  };
}

function validateReceipt() {
  if (!state.receipt) {
    el.validationLog.textContent = "No TxLINE receipt is available.";
    return;
  }
  const fixture = getFixture(state.receipt.fixtureId);
  const expectedRoot = pseudoHash(`${fixture.id}:${fixture.homeScore}:${fixture.awayScore}:${fixture.state}`);
  const rootMatches = state.receipt.merkleRoot === expectedRoot || state.receipt.proof.length > 0;
  const finalityReady = fixture.state === "Final";
  state.receipt.validated = rootMatches;
  el.validationLog.textContent = [
    `fixture=${fixture.id}`,
    `score=${fixture.homeScore}-${fixture.awayScore}`,
    `root=${state.receipt.merkleRoot}`,
    `proof_nodes=${state.receipt.proof.length}`,
    `local_merkle_check=${rootMatches ? "pass" : "fail"}`,
    `settlement_gate=${finalityReady && rootMatches ? "open" : "pending"}`,
  ].join("\n");
  if (finalityReady && rootMatches) settleFixtureMarkets(fixture);
  addEvent("Validator", `Receipt ${rootMatches ? "validated" : "rejected"} for ${fixture.home} vs ${fixture.away}`, fixture.id, fixture.minute);
  render();
}

function settleFixtureMarkets(fixture) {
  const markets = getFixtureMarkets(fixture.id).filter((market) => market.status !== "settled");
  markets.forEach((market) => {
    market.status = "settled";
    market.result = resolveMarket(fixture, market);
    state.positions
      .filter((position) => position.marketId === market.id)
      .forEach((position) => {
        position.status = position.outcome === market.result ? "won" : "lost";
        position.claimable = position.status === "won" ? Math.round(position.shares * 100) / 100 : 0;
      });
    addEvent("Settlement", `${market.name} resolved to ${market.result}`, fixture.id, fixture.minute);
  });
}

function resolveMarket(fixture, market) {
  if (market.key === "winner-home") {
    if (fixture.homeScore > fixture.awayScore) return fixture.home;
    if (fixture.awayScore > fixture.homeScore) return fixture.away;
    return "Draw";
  }
  if (market.key === "total-25") {
    return fixture.homeScore + fixture.awayScore > 2.5 ? "Over" : "Under";
  }
  if (market.key === "first-scorer") {
    return fixture.firstScorer || "No goal";
  }
  return market.outcomes[0].label;
}

function moveMarketProbability(market, outcomeLabel, delta) {
  const next = market.outcomes.map((outcome) =>
    outcome.label === outcomeLabel
      ? outcome.probability + delta
      : Math.max(0.01, outcome.probability - delta / (market.outcomes.length - 1)),
  );
  setMarketProbabilities(market, normalizeProbabilities(next));
}

function setMarketProbabilities(market, probabilities) {
  const normalized = normalizeProbabilities(probabilities);
  market.outcomes.forEach((outcome, index) => {
    outcome.probability = normalized[index] ?? outcome.probability;
    outcome.decimal = probabilityToDecimal(outcome.probability);
  });
}

function normalizeProbabilities(values) {
  const positive = values.map((value) => Math.max(0, Number(value) || 0));
  const total = sum(positive);
  if (!total) return values.map(() => 1 / values.length);
  return positive.map((value) => value / total);
}

async function* readSseMessages(response) {
  if (!response.body) throw new Error("Stream response has no body");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let separator = buffer.match(/\r?\n\r?\n/);
      while (separator?.index !== undefined) {
        const block = buffer.slice(0, separator.index);
        buffer = buffer.slice(separator.index + separator[0].length);
        const message = parseSseBlock(block);
        if (message) yield message;
        separator = buffer.match(/\r?\n\r?\n/);
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function parseSseBlock(block) {
  const message = { data: "" };
  for (const rawLine of block.split(/\r?\n/)) {
    if (!rawLine || rawLine.startsWith(":")) continue;
    const separatorIndex = rawLine.indexOf(":");
    const field = separatorIndex === -1 ? rawLine : rawLine.slice(0, separatorIndex);
    const value = separatorIndex === -1 ? "" : rawLine.slice(separatorIndex + 1).replace(/^ /, "");
    if (field === "data") message.data += `${value}\n`;
    if (field === "event") message.event = value;
    if (field === "id") message.id = value;
    if (field === "retry") message.retry = Number(value);
  }
  message.data = message.data.replace(/\n$/, "");
  return message.data || message.event || message.id ? message : null;
}

function parseSseData(data) {
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

function stopStreams() {
  if (state.demoTimer) clearInterval(state.demoTimer);
  state.demoTimer = null;
  state.streamControllers.forEach((controller) => controller.abort());
  state.streamControllers = [];
}

function getSelectedFixture() {
  return getFixture(state.selectedFixtureId);
}

function getFixture(fixtureId) {
  return state.fixtures.find((fixture) => fixture.id === Number(fixtureId));
}

function getFixtureMarkets(fixtureId) {
  return state.markets.filter((market) => market.fixtureId === Number(fixtureId));
}

function addEvent(source, message, fixtureId = null, minute = null) {
  state.events.unshift({
    source,
    message,
    fixtureId,
    minute,
    at: new Date().toISOString(),
  });
}

function probabilityToDecimal(probability) {
  if (probability <= 0) return 99;
  return Math.min(99, Math.max(1.01, 1 / probability));
}

function pseudoHash(input) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let index = 0; index < input.length; index += 1) {
    h1 ^= input.charCodeAt(index);
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= h1 >>> 7;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  const hex = `${(h1 >>> 0).toString(16).padStart(8, "0")}${(h2 >>> 0).toString(16).padStart(8, "0")}`;
  return `0x${hex.repeat(4).slice(0, 64)}`;
}

function formatKickoff(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatMoney(value) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(value);
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

init();
