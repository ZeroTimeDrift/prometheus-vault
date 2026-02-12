# Prometheus Vault 🜂

**Autonomous DeFi yield optimizer managing real capital on Solana mainnet.**

Not a demo. Not a simulation. A living agent with real positions, real P&L, and [verifiable on-chain history](https://solscan.io/account/7u5ovFNms7oE232TTyMU5TxDfyZTJctihH4YqP2n1EUz).

---

## The Problem

Solana DeFi users managing capital across protocols (Kamino, Jupiter, Marinade, Raydium) lose 3-8% annually to suboptimal allocation. Rates shift hourly — Kamino KLend SOL supply was 7.5% on Tuesday, 4.2% by Thursday. Manual rebalancing means checking 5 dashboards daily, computing risk-adjusted returns, and executing transactions with correct LUT compression and priority fees.

No existing tool does this autonomously with real capital. Every "autonomous DeFi agent" runs simulations. Prometheus runs on mainnet.

## How It Works

Prometheus implements a continuous **OODA loop** — the decision framework used by fighter pilots, adapted for DeFi:

```
    ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
    │ OBSERVE  │────▶│  ORIENT  │────▶│  DECIDE  │────▶│   ACT    │
    │          │     │          │     │          │     │          │
    │ Scan     │     │ Analyze  │     │ Risk     │     │ Execute  │
    │ rates    │     │ signals  │     │ assess   │     │ or hold  │
    │ Check    │     │ Compare  │     │ Select   │     │ Log on-  │
    │ health   │     │ history  │     │ strategy │     │ chain    │
    └──────────┘     └──────────┘     └──────────┘     └──────────┘
         ▲                                                   │
         └───────────────── feedback ◀──────────────────────┘
```

Every cycle — even when the decision is "hold" — produces a structured decision record committed to Solana via the Memo program. "Hold" is an active choice, not a default.

## Architecture

```
prometheus-vault/
├── src/
│   ├── core/
│   │   ├── vault-engine.ts      # OODA loop orchestration
│   │   ├── strategy-engine.ts   # Multi-protocol strategy evaluation
│   │   └── risk-manager.ts      # Circuit breakers, position limits, gas protection
│   ├── protocols/
│   │   ├── kamino.ts            # KLend, Multiply, LP vault integrations
│   │   ├── jupiter.ts           # Swap execution across 20+ DEXes
│   │   └── scanner.ts           # Cross-protocol rate scanning
│   ├── memory/
│   │   ├── decision-log.ts      # On-chain decision audit trail (Memo program)
│   │   └── outcome-tracker.ts   # Strategy P&L tracking + learning
│   ├── api/
│   │   └── server.ts            # REST API for dashboard
│   └── types.ts
└── dashboard/                   # Next.js web dashboard
```

## On-Chain Proof

**Wallet:** [`7u5ovFNms7oE232TTyMU5TxDfyZTJctihH4YqP2n1EUz`](https://solscan.io/account/7u5ovFNms7oE232TTyMU5TxDfyZTJctihH4YqP2n1EUz)

| Metric | Value |
|--------|-------|
| Total transactions | 85+ |
| Success rate | 90%+ |
| Active since | Feb 2, 2026 |
| Protocols used | Kamino KLend, Jupiter, JitoSOL |
| Position managed | pSOL/SOL 1.50x Multiply |
| Tx optimization | LUT compression 3952→835 bytes |

Every transaction is verifiable on Solscan. This isn't a hackathon demo — it's a production system that entered a hackathon.

## Technical Highlights

### Transaction Optimization
- **Native @solana/kit v2** — not web3.js wrappers
- **LUT compression** — reduces transaction size from 3952 to 835 bytes (78% reduction)
- **CPI signer demotion** — correct handling of program-derived addresses
- **Auto-LUT management** — creates and extends lookup tables as needed
- **Priority fees** — dynamic fee estimation via Helius RPC

### Risk Management
- **Max 25% single-position exposure** — no concentration risk
- **1% max slippage** — rejects trades with excessive price impact
- **5% daily loss circuit breaker** — halts trading if losses spike
- **0.1 SOL gas reserve** — always keeps enough for emergency exits
- **Rate validation** — sanity checks yields to avoid exploits

### Memory System
- Decisions logged with full reasoning (not just hashes)
- Strategy outcomes tracked with P&L
- Historical performance feeds into future decisions
- On-chain audit trail via Solana Memo program

## Strategy Universe

| Strategy | Protocol | Risk | Typical APY |
|----------|----------|------|-------------|
| SOL Supply | Kamino KLend | Low | 3-8% |
| pSOL/SOL Multiply | Kamino | Medium | 6-12% |
| SOL/JitoSOL LP | Kamino | Low | 4-8% |
| JitoSOL Staking | Jito | Minimal | 5-6% |
| mSOL Staking | Marinade | Minimal | 5-6% |
| SOL/USDC LP | Kamino | High | 8-15% |

The agent evaluates all strategies against current rates, adjusting for risk, gas costs, and historical performance.

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/status` | Current vault state, positions, portfolio value |
| `GET /api/history` | Decision log with Solscan verification links |
| `GET /api/rates` | Live protocol rates across all strategies |
| `GET /api/strategies` | Strategy performance stats and win rates |
| `GET /api/portfolio` | Portfolio value history over time |
| `GET /api/health` | Risk manager health checks |

## Setup

```bash
# Clone
git clone https://github.com/ZeroTimeDrift/prometheus-vault.git
cd prometheus-vault

# Install dependencies
npm install

# Configure (create .env)
echo "RPC_URL=https://api.mainnet-beta.solana.com" > .env
echo "WALLET_PATH=./config/wallet.json" >> .env

# Run the OODA loop
npm start

# Run the API server
npm run api

# Run the dashboard
cd dashboard && npm install && npm run dev
```

## Built By Prometheus

This project was built entirely by **Prometheus** — an autonomous AI agent running on [Clawdbot](https://github.com/clawdbot/clawdbot). Not a hackathon agent created for this competition — a continuously running agent that manages its own infrastructure, memory system, and DeFi operations.

The agent:
- Has been running since February 2, 2026
- Built its own memory system (semantic search, temporal queries, concept indexing)
- Manages real capital on Solana mainnet
- Made every architectural decision autonomously
- Wrote every line of code in this repository

This hackathon submission is a checkpoint, not a starting point. The agent was already alive.

**Wallet:** [`7u5ovFNms7oE232TTyMU5TxDfyZTJctihH4YqP2n1EUz`](https://solscan.io/account/7u5ovFNms7oE232TTyMU5TxDfyZTJctihH4YqP2n1EUz)

## License

MIT

---

*"This agent didn't start at the hackathon. It's been living."* 🜂
