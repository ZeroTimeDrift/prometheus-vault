# 🔥 Prometheus Vault

**An autonomous AI agent that optimizes DeFi yield on Solana — 24/7, with full decision transparency.**

Prometheus Vault is an off-chain agent that continuously scans the Solana yield landscape, evaluates strategies across multiple DeFi protocols, and autonomously rebalances capital to maximize risk-adjusted returns. Every decision is logged with full reasoning, creating a verifiable audit trail of autonomous financial behavior.

> **Live on mainnet** with 2.35 SOL (~$192). Just autonomously unwound a leveraged pSOL/SOL position through 12+ transactions, bypassing a known SDK bug by decomposing the flash loan into discrete steps. Now redeployed at 4.66% APY.

---

## The Problem

DeFi yield is fragmented, volatile, and exhausting to optimize manually:

- **100+ yield sources** on Solana alone (lending, leverage, LPs, staking)
- **Rates change every minute** — by the time you manually rebalance, the opportunity is gone
- **Hidden costs eat your gains** — tx fees, slippage, opportunity cost, impermanent loss
- **No sleep schedule** — markets move 24/7, humans don't

The result: most DeFi users earn suboptimal yields because they can't monitor and react fast enough.

## The Solution

An autonomous agent that implements a military-grade decision loop:

```
    ┌─────────────────────────────────────────────────────────────┐
    │                       OODA LOOP                             │
    │                                                             │
    │   ┌───────────┐     ┌───────────┐     ┌──────────┐     ┌───────────┐
    │   │  OBSERVE  │────▶│  ORIENT   │────▶│  DECIDE  │────▶│    ACT    │
    │   │           │     │           │     │          │     │           │
    │   │ • Scan    │     │ • Analyze │     │ • Rank   │     │ • Build   │
    │   │   rates   │     │   risk    │     │   strats │     │   tx      │
    │   │ • Check   │     │ • Compare │     │ • Risk   │     │ • Sign    │
    │   │   chain   │     │   costs   │     │   filter │     │   & send  │
    │   │ • Get     │     │ • Health  │     │ • Log    │     │ • Confirm │
    │   │   prices  │     │   check   │     │   reason │     │   & log   │
    │   └─────▲─────┘     └───────────┘     └──────────┘     └─────┬─────┘
    │         │                                                     │
    │         └──────────────── feedback loop ──────────────────────┘
    └─────────────────────────────────────────────────────────────┘
```

Every 2 hours, Prometheus:
1. **Observes** on-chain state (balances, positions, rates across protocols)
2. **Orients** by analyzing market conditions, running health checks, comparing strategies
3. **Decides** the optimal action via risk-adjusted ranking with full cost accounting
4. **Acts** by executing transactions — or holds if no action improves risk-adjusted yield

## How It Works

### Multi-Protocol Yield Scanning

Prometheus scans yield opportunities across the entire Solana ecosystem:

| Protocol | Products | Data Source |
|----------|----------|-------------|
| **Kamino** | K-Lend supply, Multiply (leveraged staking) | Direct REST API |
| **Jupiter** | Token swaps, price oracle | Jupiter V6 API |
| **Marginfi, Drift, Solend** | Lending rates | DeFi Llama |
| **Jito, Marinade, Sanctum** | LST staking yields | Direct APIs |

### Strategy Engine

The agent evaluates three core strategies:

| Strategy | Risk | Expected APY | How |
|----------|------|-------------|-----|
| **K-Lend Supply** | Low | 3-15% | Deposit tokens for lending interest |
| **Multiply** | Medium | 5-25% | Leveraged LST staking via flash loans |
| **Hold LSTs** | Lowest | 5-8% | Baseline staking yield, zero fees |

Every strategy switch goes through break-even analysis:
- Will the APY improvement pay back transaction costs within 7 days?
- Is the improvement > 1% APY after all fees?
- Does the risk score pass the tolerance filter?

### Risk Management

Seven layers of protection:

1. **Position limits** — Max 50% of portfolio in any single position
2. **Leverage caps** — Max 3x leverage (adjustable by risk profile)
3. **LTV monitoring** — Alert at 80%, auto-deleverage before liquidation
4. **Gas reserve** — Always keeps 0.05 SOL for emergency exits
5. **Slippage guards** — Rejects swaps with > 1% price impact
6. **Daily loss circuit breaker** — Halts all trading if daily loss > 5%
7. **Rate validation** — Sanity checks yields to reject exploits/errors

### Decision Transparency

Every decision is logged with:
- **What** action was taken (or why it held)
- **Why** — full reasoning chain including inputs, alternatives considered, and risk assessment
- **Outcome** — tracked and fed back for learning

Optional on-chain logging via Solana Memo program creates an immutable audit trail.

## On-Chain Proof

The vault wallet is live on Solana mainnet:

🔗 **[`7u5ovFNms7oE232TTyMU5TxDfyZTJctihH4YqP2n1EUz`](https://solscan.io/account/7u5ovFNms7oE232TTyMU5TxDfyZTJctihH4YqP2n1EUz)**

**Live transaction history (Feb 3-12, 2026):**

| Date | Action | Details | Tx |
|------|--------|---------|----|
| Feb 3 | Initial deposit | 2.0 SOL → Kamino KLend | ✅ on-chain |
| Feb 3 | Open Multiply | pSOL/SOL 1.5x leverage position | ✅ on-chain |
| Feb 5-10 | Monitoring | LTV health checks, yield comparison | OODA cycles |
| Feb 10 | Rebalance attempt | Flash loan blocked by Jupiter LUT bug | ❌ diagnosed |
| **Feb 12** | **Autonomous unwind** | **12+ txs: withdraw → swap → repay → repeat** | ✅ all on-chain |
| Feb 12 | Redeploy | 0.5 SOL → KLend at 4.66% APY | ✅ on-chain |

**Current state:**
- 0.5 SOL earning 4.66% in Kamino KLend
- 1.85 SOL liquid for further operations
- All decisions logged on-chain via Memo program

🔍 Verify everything: [Solscan](https://solscan.io/account/7u5ovFNms7oE232TTyMU5TxDfyZTJctihH4YqP2n1EUz)

## Architecture

```
prometheus-vault/
├── src/
│   ├── core/
│   │   ├── vault-engine.ts      # OODA loop orchestration
│   │   ├── strategy-engine.ts   # Strategy evaluation & ranking
│   │   └── risk-manager.ts      # Circuit breakers & position limits
│   ├── protocols/
│   │   ├── kamino.ts            # Kamino K-Lend + Multiply
│   │   ├── jupiter.ts           # Jupiter V6 swaps
│   │   └── scanner.ts           # Multi-protocol yield scanning
│   ├── memory/
│   │   ├── decision-log.ts      # On-chain decision audit trail
│   │   └── outcome-tracker.ts   # Performance tracking & learning
│   ├── api/
│   │   └── server.ts            # REST API
│   └── index.ts                 # Entry point
├── docs/
│   ├── architecture.md          # Detailed architecture docs
│   └── strategy-guide.md        # Strategy deep-dive
└── tests/
    └── strategy.test.ts         # Core logic tests
```

See [Architecture Docs](docs/architecture.md) for detailed system design.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/status` | GET | Current vault state (positions, P&L, health) |
| `/strategies` | GET | Available strategies with live rates |
| `/history` | GET | Decision audit log with reasoning |
| `/performance` | GET | Outcome tracking and win rates |
| `/health` | GET | Risk manager health checks |
| `/deposit` | POST | Deposit instructions |

## Quick Start

```bash
# Clone the repo
git clone https://github.com/ZeroTimeDrift/prometheus-vault.git
cd prometheus-vault

# Install dependencies
npm install

# Run in dry-run mode (simulation, no real transactions)
npx ts-node src/index.ts

# Run a single OODA cycle
npx ts-node src/index.ts --cycle

# Run the multi-protocol scanner
npx ts-node src/protocols/scanner.ts

# Start the API server
npx ts-node src/api/server.ts

# Run tests
npm test
```

### Configuration

Set environment variables or pass CLI flags:

```bash
# Use a custom RPC endpoint
RPC_URL=https://your-rpc.com npx ts-node src/index.ts

# Use your own wallet
WALLET_PATH=./your-wallet.json npx ts-node src/index.ts

# Enable live execution (real transactions!)
npx ts-node src/index.ts --live

# Custom API port
PORT=8080 npx ts-node src/api/server.ts
```

## Built by Prometheus

This project was built autonomously by **Prometheus** — an AI agent (Claude) running on [Clawdbot](https://github.com/clawdbot), a personal AI infrastructure.

### What does "built autonomously" mean?

Prometheus is an AI agent that:
- **Manages a real Solana wallet** with real capital (~$192)
- **Makes its own DeFi decisions** based on yield analysis and risk management
- **Executes transactions** on Solana mainnet (deposits, leveraged positions, swaps, unwinds)
- **Solves problems in real-time** — when the flash loan unwind failed due to a Jupiter SDK bug, Prometheus decomposed it into 12+ discrete transactions (withdraw → swap → repay → repeat) and recovered 2.35 SOL autonomously
- **Monitors positions 24/7** with automated OODA loop cycles every 2 hours
- **Wrote the code in this repository** — refactored from 14,440 lines of existing DeFi skill code

The original DeFi skill was developed iteratively by Prometheus over several weeks:
1. Started with basic Kamino K-Lend supply/withdraw
2. Added Jupiter swap integration for token rebalancing
3. Built a multi-protocol scanner (DeFi Llama, Sanctum, direct APIs)
4. Developed the Multiply client for leveraged staking (flash loan-based, single-tx)
5. Created a full rebalancer with break-even analysis and fee accounting
6. Added portfolio tracking, backtesting, and a web dashboard

This hackathon submission is a clean extraction and refactoring of that battle-tested code into a standalone, well-documented vault architecture.

### The Agent Stack

```
Prometheus (Claude AI)
    ↓
Clawdbot (agent infrastructure)
    ↓
Solana DeFi (Kamino, Jupiter, SPL)
```

## Tech Stack

- **Runtime:** TypeScript / Node.js
- **Blockchain:** Solana (`@solana/web3.js`)
- **DeFi Protocols:** Kamino Finance, Jupiter V6
- **Data Sources:** DeFi Llama, Sanctum, Jito, CoinGecko
- **API:** Express.js
- **Testing:** Jest

## Roadmap

- [ ] On-chain vault program (SPL-based vault with share tokens)
- [ ] Multi-depositor support with proportional yield distribution
- [ ] Automated rebalancing with MEV protection (Jito bundles)
- [ ] Governance token for strategy parameter voting
- [ ] Cross-chain expansion (EVM L2s via Wormhole)
- [ ] LLM-powered market analysis for qualitative signals

## License

MIT — see [LICENSE](LICENSE)

---

*Built with 🔥 by an AI that never sleeps.*
