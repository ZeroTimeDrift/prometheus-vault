# Strategy Guide

## How Prometheus Vault Makes Decisions

Prometheus Vault is not a simple "find highest APY and ape in" optimizer. Every decision goes through a multi-stage evaluation pipeline that accounts for real-world costs, risks, and market conditions.

## Supported Strategies

### 1. K-Lend Supply (Low Risk)

**What:** Deposit tokens into Kamino's K-Lend protocol to earn supply interest.

**How it works:** Other users borrow your deposited tokens and pay interest. Rates are determined by utilization — higher demand for borrowing = higher supply APY.

**When the agent chooses this:**
- Moderate yields (3-15% APY) with very low risk
- No liquidation risk
- Best when borrow demand is high (e.g., during leverage farming surges)

**Tokens:** SOL, USDC, JitoSOL, mSOL, and 20+ other tokens

### 2. Multiply / Leveraged Staking (Medium Risk)

**What:** Use Kamino's flash loan-based Multiply to amplify LST staking yield.

**How it works:**
1. Deposit LST (e.g., pSOL) as collateral
2. Flash loan SOL → buy more LST → deposit → creates leveraged position
3. Earn: (staking_yield × leverage) - (borrow_cost × (leverage - 1))
4. Net APY = amplified staking yield minus borrow cost

**Example at 1.5x leverage:**
- pSOL staking: 8% APY
- SOL borrow cost: 5% APY
- Net APY: 8% × 1.5 - 5% × 0.5 = 12% - 2.5% = **9.5%**

**When the agent chooses this:**
- Positive spread (staking APY > borrow APY)
- Spread > 1% (minimum threshold)
- LTV stays well below liquidation threshold
- Market conditions are calm (low volatility)

**Risks:**
- Liquidation if LTV exceeds threshold (mitigated by conservative leverage)
- Borrow rate spikes can compress or invert the spread
- Requires active monitoring (the OODA loop handles this)

### 3. Hold LSTs (Lowest Risk)

**What:** Simply hold liquid staking tokens for baseline staking yield.

**When the agent chooses this:**
- All other strategies fail cost/benefit analysis
- Market is volatile (high rate variance)
- Circuit breaker is active
- Yield improvement doesn't justify switch costs

## Decision Framework

### Break-Even Analysis

Before any strategy switch, the agent calculates:

```
Switch Cost = Transaction Fees + Slippage + Opportunity Cost

Transaction Fees = ~0.0005 SOL per complex tx × number_of_txs
Slippage = position_value × estimated_slippage_rate
Opportunity Cost = current_yield × transit_time

Break-Even Days = Switch Cost / Daily Yield Improvement

Rule: Only switch if Break-Even Days < 7
```

### Risk-Adjusted Ranking

Strategies are ranked by a Sharpe-like score:

```
Score = (Strategy APY - Current APY) / (Risk Score / 100)
```

Where Risk Score incorporates:
- Position concentration risk
- Leverage level (for Multiply)
- Protocol risk (audited, TVL, track record)
- Market condition

### Market Condition Assessment

The agent categorizes markets as:

| Condition | Indicators | Agent Behavior |
|-----------|------------|---------------|
| **Calm** | Low yield variance, stable spreads | More aggressive, willing to switch |
| **Uncertain** | Moderate variance, mixed signals | Moderate, prefer safer strategies |
| **Volatile** | High variance, compressed spreads | Conservative, prefer holding |

## Real-World Example

Current position: **pSOL/SOL 1.50x Multiply** on Kamino

```
Position Details:
  Collateral: 1.5 pSOL (~$300)
  Debt: 0.5 SOL (~$100)
  Net value: ~$199
  Leverage: 1.50x
  LTV: 33%
  
Yield Breakdown:
  pSOL staking yield: ~8% × 1.5x = 12%
  SOL borrow cost: ~5% × 0.5x = -2.5%
  Net APY: ~9.5%
  
Risk Profile:
  LTV: 33% (well below 80% liquidation threshold)
  Gas reserve: 0.05 SOL maintained
  Circuit breaker: Not active
  Health status: 🟢 GREEN
```

The agent will hold this position as long as:
1. The spread (staking - borrow) remains positive
2. No significantly better opportunity justifies the switch cost
3. LTV stays within safe bounds
4. No circuit breaker conditions are triggered

## Fee Accounting

The agent tracks ALL costs, not just the obvious ones:

| Cost | Estimate | Notes |
|------|----------|-------|
| Base tx fee | 0.000005 SOL | Per signature |
| Priority fee | ~0.0005 SOL | Complex txs (Kamino, Jupiter) |
| Jupiter swap slippage | 0.3% | For SOL ↔ LST swaps < 5 SOL |
| K-Lend withdrawal | 0% | No explicit fee |
| Multiply entry | ~0.002 SOL | Multiple txs (flash loan setup) |
| Multiply exit | ~0.002 SOL | Deleverage + withdraw |
| Opportunity cost | Variable | Time not earning during transit |

These costs are baked into every break-even calculation. The agent won't switch for a 0.5% APY improvement if the switch costs eat 3 days of yield.
