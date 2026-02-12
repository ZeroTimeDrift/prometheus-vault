# Architecture

## System Overview

Prometheus Vault is an autonomous DeFi yield optimizer that runs as an off-chain agent, interacting with Solana programs (Kamino, Jupiter) to maximize yield on deposited capital.

```
┌─────────────────────────────────────────────────────────────┐
│                    PROMETHEUS VAULT                          │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   OODA LOOP ENGINE                    │  │
│  │                                                       │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌────────┐ │  │
│  │  │ OBSERVE │→ │ ORIENT  │→ │ DECIDE  │→ │  ACT   │ │  │
│  │  │         │  │         │  │         │  │        │ │  │
│  │  │ • Rates │  │ • Risk  │  │ • Rank  │  │ • Sign │ │  │
│  │  │ • Chain │  │ • Cost  │  │ • Filter│  │ • Send │ │  │
│  │  │ • Price │  │ • Health│  │ • Log   │  │ • Log  │ │  │
│  │  └────▲────┘  └─────────┘  └─────────┘  └───┬────┘ │  │
│  │       │                                       │      │  │
│  │       └───────── feedback loop ───────────────┘      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │   RISK     │  │   DECISION   │  │     OUTCOME       │  │
│  │  MANAGER   │  │     LOG      │  │    TRACKER         │  │
│  │            │  │              │  │                     │  │
│  │ • Limits   │  │ • Reasoning  │  │ • Win rate          │  │
│  │ • Breakers │  │ • On-chain   │  │ • P&L tracking      │  │
│  │ • Gas guard│  │ • Audit trail│  │ • Learning loop     │  │
│  └────────────┘  └──────────────┘  └───────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                  REST API (Express)                   │  │
│  │   /status  /strategies  /history  /performance       │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    SOLANA BLOCKCHAIN                         │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  Kamino   │  │ Jupiter  │  │   Memo   │  │  Token   │  │
│  │  K-Lend   │  │ V6 Swap  │  │ Program  │  │ Program  │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Module Breakdown

### Core (`src/core/`)

| Module | Purpose |
|--------|---------|
| `vault-engine.ts` | OODA loop orchestration, lifecycle management |
| `strategy-engine.ts` | Strategy evaluation, ranking, and selection |
| `risk-manager.ts` | Circuit breakers, position limits, health checks |

### Protocols (`src/protocols/`)

| Module | Purpose |
|--------|---------|
| `kamino.ts` | Kamino K-Lend and Multiply position management |
| `jupiter.ts` | Jupiter V6 swap execution and pricing |
| `scanner.ts` | Multi-protocol yield scanning (DeFi Llama + direct APIs) |

### Memory (`src/memory/`)

| Module | Purpose |
|--------|---------|
| `decision-log.ts` | Audit trail with on-chain memo logging |
| `outcome-tracker.ts` | Performance tracking and learning |

### API (`src/api/`)

| Module | Purpose |
|--------|---------|
| `server.ts` | REST endpoints for external visibility |

## OODA Loop Detail

### 1. Observe
- Fetch wallet SOL balance
- Load K-Lend positions via Kamino REST API
- Load Multiply positions across all markets
- Scan yield rates (Kamino, DeFi Llama, Sanctum)
- Get SOL price from CoinGecko

### 2. Orient
- Run health checks (gas, LTV, daily P&L)
- Evaluate all strategy candidates
- Apply risk tolerance filters
- Assess market condition (calm/volatile/uncertain)

### 3. Decide
- Rank strategies by risk-adjusted return (Sharpe-like score)
- Apply break-even analysis
- Risk manager veto gate
- Log decision with full reasoning

### 4. Act
- Build transaction(s) via protocol SDKs
- Sign with vault wallet
- Submit to Solana with confirmation
- Record outcome for learning

## Risk Management Layers

1. **Position limits** — Max 50% in any single position
2. **Leverage caps** — Max 3x (configurable by risk tolerance)
3. **LTV monitoring** — Alert at 80%, auto-deleverage near liquidation
4. **Gas reserve** — Always keep 0.05 SOL for emergency exits
5. **Slippage guards** — Reject swaps > 100bps slippage
6. **Circuit breaker** — Halt trading if daily loss > 5%
7. **Rate validation** — Sanity check yields (reject > 200% APY)

## Data Flow

```
Solana RPC ─→ Kamino API ─→ Observe ─→ Snapshot
                                          │
Jupiter API ─→ Price quotes ─────────────→│
                                          ▼
DeFi Llama ──→ Cross-protocol yields ─→ Orient ─→ Strategy candidates
                                          │
Sanctum API ─→ LST staking APYs ────────→│
                                          ▼
                                      Decide ─→ Decision + Log
                                          │
                                          ▼
                                        Act ─→ Solana Tx ─→ Outcome
```
