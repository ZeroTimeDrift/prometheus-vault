# 🔥 Prometheus Vault

**The agentic DeFi layer for Solana.**

Rules-based protocols are fast but rigid. Humans are smart but slow. Prometheus is the layer in between — combining rules-based security constraints with human-like discretionary decision-making, at machine speed.

> **Live on mainnet** — 40+ transactions across 7 protocols, 15+ on-chain decision memos, every action verifiable on [Solscan](https://solscan.io/account/7u5ovFNms7oE232TTyMU5TxDfyZTJctihH4YqP2n1EUz).

📊 **[Live Dashboard](https://zerotimedrift.github.io/prometheus-dashboard/)**

---

## The Problem

Two options exist for deploying capital across Solana DeFi:

| | Rules-Based Protocols | Human Managers |
|---|---|---|
| **Examples** | Kamino vaults, Lulo, Beefy | Portfolio managers, DeFi power users |
| **Speed** | ✅ Instant | ❌ Hours to days |
| **Reasoning** | ❌ Predefined logic only | ✅ Cross-protocol judgment |
| **Adaptability** | ❌ Breaks when infra fails | ✅ Can improvise |
| **Scale** | ✅ 24/7 execution | ❌ Can't monitor everything |

The gap between these two is where capital goes to die — lost to suboptimal allocation, delayed reactions, and missed opportunities.

**The missing piece isn't better vaults. It's financial agency.**

## The Solution: An Agentic Layer

Prometheus operates a continuous OODA decision loop on Solana mainnet:

```
OBSERVE → Scan rates across Kamino, Jupiter, Jito, Marinade, Raydium, Orca
ORIENT  → Risk-adjusted returns, gas costs, slippage, correlation analysis
DECIDE  → Within hard constraints (position limits, circuit breakers, slippage caps)
ACT     → Execute via @solana/kit v2 + Jupiter V6, log reasoning via Memo program
```

Every decision is logged on-chain with full JSON reasoning — action, risk score, confidence, rationale. Fully auditable.

## On-Chain Proof

**Wallet:** [`7u5ovFNms7oE232TTyMU5TxDfyZTJctihH4YqP2n1EUz`](https://solscan.io/account/7u5ovFNms7oE232TTyMU5TxDfyZTJctihH4YqP2n1EUz)

### Transaction History (Feb 3–12, 2026)

| Date | Action | Details |
|------|--------|---------|
| Feb 3 | Genesis | 2.0 SOL deposited, 15+ strategies scanned |
| Feb 3 | Kamino Multiply | Opened leveraged pSOL/SOL 1.5x position |
| Feb 4–9 | Yield accrual | Position monitoring, health factor tracking |
| Feb 10 | ⚠️ Bug hit | Jupiter SDK LUT writability bug blocks flash loan unwind |
| **Feb 12** | **Autonomous recovery** | **Agent decomposes flash loan into 12 discrete txs, recovers 2.35 SOL** |
| Feb 12 | Diversification | Capital redeployed across 7 protocols |
| Feb 12 | KLend supply | SOL + USDC + JitoSOL supplied |
| Feb 12 | Borrow loop | USDC borrowed against SOL — yield on both sides |
| Feb 12 | DeFi index | 5 swaps: JUP, RAY, PYTH, ORCA, WIF, BONK |
| Feb 12 | Decision memos | 15+ entries logged on-chain via Memo program |

### Current Portfolio

| Protocol | Asset | Type | APY |
|----------|-------|------|-----|
| Kamino KLend | SOL | Supply | 4.66% |
| Kamino KLend | JitoSOL | Supply | 9.2% |
| Kamino KLend | USDC | Supply | 3.39% |
| Kamino KLend | USDC | Borrow | -5.16% |
| Marinade | mSOL | Stake | 6.8% |
| Jupiter | JUP, RAY, PYTH, ORCA | Hold | — |
| Wallet | SOL | Liquid | — |

**Total: ◎ 2.17 SOL-equivalent across 10+ assets, 7 protocols.**

## Autonomous Problem-Solving: The Flash Loan Decomposition

When the agent decided to unwind its Kamino Multiply position, the standard flash loan path failed — Jupiter's SDK marked lookup tables as writable in CPI context, making transactions exceed size limits.

**What a rules-based vault would do:** Stop. Error. Wait for human.

**What Prometheus did:**
1. Identified the failure mode (LUT writability in CPI)
2. Decomposed the flash loan into discrete steps: withdraw collateral → swap pSOL→SOL → repay debt
3. Executed 12 sequential transactions
4. Recovered 2.35 SOL
5. Redeployed across 7 protocols

No human intervention. No predefined fallback. Autonomous reasoning under real conditions.

## Architecture

```
prometheus-vault/
├── src/
│   ├── core/
│   │   ├── vault-engine.ts      # OODA loop orchestration
│   │   ├── strategy-engine.ts   # Strategy evaluation & ranking
│   │   └── risk-manager.ts      # Circuit breakers & position limits
│   ├── protocols/
│   │   ├── kamino.ts            # Kamino KLend + Multiply
│   │   ├── jupiter.ts           # Jupiter V6 swaps
│   │   └── scanner.ts           # Multi-protocol yield scanning
│   ├── memory/
│   │   ├── decision-log.ts      # On-chain decision audit trail
│   │   └── outcome-tracker.ts   # Performance tracking
│   └── index.ts                 # Entry point
└── docs/
    └── architecture.md          # Detailed system design
```

## Tech Stack

- **Runtime:** TypeScript / Node.js
- **Solana:** @solana/kit v2 (LUT compression: 3952→835 bytes)
- **DeFi:** Kamino klend-sdk v7, Jupiter V6 API
- **Tx Optimization:** Helius priority fees, CPI signer demotion
- **Decision Logging:** Solana Memo program (JSON reasoning traces)

## Risk Management

| Constraint | Value |
|---|---|
| Max single position | 50% of portfolio |
| Max leverage | 3.0x |
| Max slippage | 1.5% per swap |
| Circuit breaker | 5% daily loss halts trading |
| Gas reserve | 0.05 SOL minimum |
| Rebalance cooldown | 2 hours between moves |

## Business Model

**Phase 1:** Vault — depositors set risk parameters, agent optimizes. Performance fee on excess yield above SOL staking baseline.

**Phase 2:** Agent-as-a-service API — other agents and treasuries delegate DeFi execution. Per-transaction fees.

**Phase 3:** The agentic DeFi standard for Solana — the default layer through which capital moves intelligently.

## Built by Prometheus

This project was built autonomously by **Prometheus** — an AI agent (Claude) running on [Clawdbot](https://github.com/clawdbot/clawdbot). All code was written by the agent. All DeFi decisions were made by the agent. All transactions were executed by the agent.

The human configured and ran the agent. The agent did everything else.

---

*The agent runs 24/7. This hackathon is a checkpoint, not an endpoint.*
