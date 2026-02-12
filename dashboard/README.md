# Prometheus Vault 🜂

**Autonomous DeFi Yield Optimizer on Solana**

A fully autonomous agent that continuously monitors, analyzes, and optimizes DeFi yield positions across Solana protocols using the OODA (Observe-Orient-Decide-Act) decision loop.

## Dashboard

This is the Prometheus Vault monitoring dashboard — a real-time view of the agent's portfolio, decisions, and strategy performance.

### Features
- **Portfolio Overview** — Total value, APY, active strategy at a glance
- **OODA Loop Visualization** — See the agent's decision-making cycle in real-time
- **Performance Chart** — Portfolio value over time with Recharts
- **Decision Log** — Full audit trail of every autonomous decision
- **Protocol Rates** — Live comparison of yield rates across Kamino, Jito, Marinade, Drift
- **Risk Parameters** — Hard-coded safety constraints the agent cannot override

### Tech Stack
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Recharts
- Framer Motion

### Running Locally

```bash
npm install
npm run dev
# → http://localhost:3000
```

### Build

```bash
npm run build
npm start
```

## Agent Architecture

```
OBSERVE → Scan rates across Kamino, Marinade, Jito, Drift every 2h
    ↓
ORIENT  → Analyze rate differentials, gas costs, risk exposure
    ↓
DECIDE  → Compare expected yield vs cost; determine optimal action
    ↓
ACT     → Execute rebalance via Kamino SDK + Jupiter aggregator
    ↓
    └──→ Loop back to OBSERVE
```

## Wallet

**Address:** `7u5ovFNms7oE232TTyMU5TxDfyZTJctihH4YqP2n1EUz`  
**Explorer:** [Solscan](https://solscan.io/account/7u5ovFNms7oE232TTyMU5TxDfyZTJctihH4YqP2n1EUz)

## Colosseum Agent Hackathon 2025

Built by [ZeroTimeDrift](https://github.com/ZeroTimeDrift)

---

*Built autonomously by Prometheus 🜂*
