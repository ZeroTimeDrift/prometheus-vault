/**
 * Strategy Engine — Decision Intelligence
 *
 * Analyzes the full yield landscape and determines the optimal strategy.
 * This is the "brain" of the OODA loop — it takes observed data (rates,
 * positions, market conditions) and produces a ranked set of actions.
 *
 * Strategy selection criteria:
 * 1. Net yield after all costs (fees, slippage, IL)
 * 2. Risk-adjusted return (higher APY with more risk is not always better)
 * 3. Break-even analysis (is switching worth the transition cost?)
 * 4. Market condition awareness (high-volatility = conservative)
 * 5. Historical outcome learning (did similar decisions pay off before?)
 *
 * Supported strategies:
 * - K-Lend Supply: Deposit tokens to earn interest (low risk, moderate yield)
 * - Multiply: Leveraged LST staking via flash loans (medium risk, higher yield)
 * - Hold: Direct LST holding for baseline staking yield (lowest risk)
 */

import Decimal from 'decimal.js';
import {
  StrategyType,
  VaultSnapshot,
  YieldOpportunity,
  Decision,
  DecisionAction,
  RiskTolerance,
  MultiplyConfig,
} from '../types';
import { RiskManager, RiskAssessment } from './risk-manager';
import { MultiplyOpportunity } from '../protocols/kamino';

// ─── Strategy Evaluation Types ──────────────────────────────────

export interface StrategyCandidate {
  /** Unique identifier for this strategy option */
  id: string;
  /** Action to take */
  action: DecisionAction;
  /** Expected APY after all costs */
  netApy: number;
  /** Risk score 0-100 */
  riskScore: number;
  /** Risk-adjusted score (higher is better) */
  sharpeScore: number;
  /** Break-even period in days */
  breakEvenDays: number;
  /** Detailed reasoning */
  reasoning: string;
  /** Strategy-specific parameters */
  params: Record<string, any>;
  /** Risk assessment result */
  riskAssessment?: RiskAssessment;
}

export interface StrategyRecommendation {
  /** The recommended action */
  bestStrategy: StrategyCandidate;
  /** All evaluated strategies, ranked by sharpeScore */
  alternatives: StrategyCandidate[];
  /** Current effective APY */
  currentApy: number;
  /** Market condition assessment */
  marketCondition: 'calm' | 'volatile' | 'uncertain';
  /** Full reasoning for the recommendation */
  reasoning: string;
}

// ─── Risk Tolerance Parameters ──────────────────────────────────

const RISK_WEIGHTS: Record<RiskTolerance, { maxRiskScore: number; minSharpe: number; leveragePref: number }> = {
  conservative: { maxRiskScore: 30, minSharpe: 0.5, leveragePref: 1.5 },
  balanced: { maxRiskScore: 50, minSharpe: 0.3, leveragePref: 2.0 },
  aggressive: { maxRiskScore: 70, minSharpe: 0.1, leveragePref: 3.0 },
};

// ─── Strategy Engine ────────────────────────────────────────────

export class StrategyEngine {
  private riskManager: RiskManager;
  private riskTolerance: RiskTolerance;
  private multiplyConfig: MultiplyConfig;

  constructor(
    riskManager: RiskManager,
    riskTolerance: RiskTolerance = 'balanced',
    multiplyConfig: MultiplyConfig
  ) {
    this.riskManager = riskManager;
    this.riskTolerance = riskTolerance;
    this.multiplyConfig = multiplyConfig;
  }

  /**
   * Evaluate all available strategies and recommend the best one.
   * This is the core decision function — called during the Orient+Decide phases.
   */
  evaluate(
    snapshot: VaultSnapshot,
    opportunities: YieldOpportunity[],
    multiplyOpps: MultiplyOpportunity[]
  ): StrategyRecommendation {
    const candidates: StrategyCandidate[] = [];
    const currentApy = snapshot.blendedApy.toNumber();
    const portfolioValueSol = snapshot.totalValueUsd.div(snapshot.solPrice).toNumber();
    const riskWeights = RISK_WEIGHTS[this.riskTolerance];

    // ─── Strategy 1: Hold (do nothing) ──────────────────────
    candidates.push({
      id: 'hold',
      action: 'hold',
      netApy: currentApy,
      riskScore: 0,
      sharpeScore: currentApy > 0 ? currentApy / 1 : 0, // Zero risk = divide by 1
      breakEvenDays: 0,
      reasoning: `Continue current strategy at ${currentApy.toFixed(2)}% APY. No transaction costs.`,
      params: {},
    });

    // ─── Strategy 2: K-Lend Supply ──────────────────────────
    const lendingOpps = opportunities
      .filter(o => o.type === 'lending' && o.risk !== 'high')
      .sort((a, b) => b.apy - a.apy);

    for (const opp of lendingOpps.slice(0, 3)) {
      if (!this.riskManager.validateRate(opp.apy, 'lending')) continue;

      const switchCost = this.riskManager.calculateSwitchCost(
        currentApy, opp.apy, portfolioValueSol, 2
      );

      const riskScore = opp.risk === 'low' ? 10 : opp.risk === 'medium' ? 30 : 60;
      const netApy = opp.apy - (switchCost.costSol / portfolioValueSol * 100 * 365 / switchCost.breakEvenDays || 0);

      candidates.push({
        id: `klend_${opp.token.toLowerCase()}`,
        action: 'deposit_klend',
        netApy: switchCost.profitable ? opp.apy : currentApy,
        riskScore,
        sharpeScore: riskScore > 0 ? (opp.apy - currentApy) / (riskScore / 100) : 0,
        breakEvenDays: switchCost.breakEvenDays,
        reasoning: `Deposit to ${opp.pool} at ${opp.apy.toFixed(2)}% APY. ` +
          `Break-even: ${switchCost.breakEvenDays.toFixed(1)} days. ` +
          `${switchCost.profitable ? 'PROFITABLE' : 'Not worth switching'}. ${opp.notes}`,
        params: {
          pool: opp.pool,
          token: opp.token,
          targetApy: opp.apy,
          breakEvenDays: switchCost.breakEvenDays,
          protocol: opp.protocol,
        },
      });
    }

    // ─── Strategy 3: Multiply (Leveraged Staking) ───────────
    for (const opp of multiplyOpps.slice(0, 5)) {
      if (opp.spread < this.multiplyConfig.minSpreadPct) continue;

      // Determine optimal leverage based on risk tolerance
      const targetLeverage = Math.min(
        riskWeights.leveragePref,
        this.multiplyConfig.maxLeverage
      );

      const netApy = opp.stakingApy * targetLeverage - opp.borrowApy * (targetLeverage - 1);
      if (!this.riskManager.validateRate(netApy, 'multiply')) continue;

      const switchCost = this.riskManager.calculateSwitchCost(
        currentApy, netApy, portfolioValueSol, 4 // Multiply requires more txs
      );

      const riskScore = 25 + (targetLeverage - 1) * 15; // Higher leverage = higher risk

      candidates.push({
        id: `multiply_${opp.collateral.toLowerCase()}_${opp.market.toLowerCase()}`,
        action: 'open_multiply',
        netApy: switchCost.profitable ? netApy : currentApy,
        riskScore,
        sharpeScore: riskScore > 0 ? (netApy - currentApy) / (riskScore / 100) : 0,
        breakEvenDays: switchCost.breakEvenDays,
        reasoning:
          `Open ${opp.collateral}/${opp.debt} Multiply at ${targetLeverage.toFixed(1)}x on ${opp.market}. ` +
          `Staking: ${opp.stakingApy.toFixed(2)}%, Borrow: ${opp.borrowApy.toFixed(2)}%, ` +
          `Spread: ${opp.spread.toFixed(2)}%, Net APY: ${netApy.toFixed(2)}%. ` +
          `Break-even: ${switchCost.breakEvenDays.toFixed(1)} days.`,
        params: {
          collateral: opp.collateral,
          debt: opp.debt,
          leverage: targetLeverage,
          market: opp.market,
          marketAddress: opp.marketAddress,
          stakingApy: opp.stakingApy,
          borrowApy: opp.borrowApy,
          spread: opp.spread,
          targetApy: netApy,
        },
      });
    }

    // ─── Strategy 4: Close/Reduce Multiply if Spread Collapsed ─
    for (const pos of snapshot.positions.multiply) {
      if (pos.netApy.lt(1)) { // Net APY below 1% — not worth the risk
        candidates.push({
          id: `close_multiply_${pos.collateralToken.toLowerCase()}`,
          action: 'close_multiply',
          netApy: currentApy,
          riskScore: 5, // Low risk action (reducing exposure)
          sharpeScore: 50, // High priority when spread collapses
          breakEvenDays: 0,
          reasoning:
            `Close ${pos.collateralToken} Multiply — net APY dropped to ${pos.netApy.toFixed(2)}%. ` +
            `Current leverage: ${pos.leverage.toFixed(2)}x, LTV: ${pos.ltv.mul(100).toFixed(1)}%. ` +
            `Spread no longer justifies liquidation risk.`,
          params: {
            obligationAddress: pos.obligationAddress,
            marketAddress: pos.marketAddress,
            collateralToken: pos.collateralToken,
          },
        });
      }
    }

    // ─── Risk-filter and rank candidates ─────────────────────
    const validCandidates = candidates.filter(c => {
      // Run risk assessment
      c.riskAssessment = this.riskManager.assessAction(c.action, snapshot, c.params);

      // Filter by risk tolerance
      if (c.riskScore > riskWeights.maxRiskScore && c.action !== 'hold') return false;
      if (!c.riskAssessment.approved && c.action !== 'hold') return false;

      return true;
    });

    // Sort by sharpe score (risk-adjusted return), descending
    validCandidates.sort((a, b) => b.sharpeScore - a.sharpeScore);

    const bestStrategy = validCandidates[0] || candidates.find(c => c.action === 'hold')!;

    // Assess market condition
    const marketCondition = this.assessMarketCondition(opportunities, multiplyOpps);

    return {
      bestStrategy,
      alternatives: validCandidates.slice(1),
      currentApy,
      marketCondition,
      reasoning: this.buildRecommendationReasoning(bestStrategy, currentApy, marketCondition),
    };
  }

  /**
   * Build a human-readable reasoning string for the recommendation.
   */
  private buildRecommendationReasoning(
    best: StrategyCandidate,
    currentApy: number,
    condition: 'calm' | 'volatile' | 'uncertain'
  ): string {
    const parts: string[] = [];

    parts.push(`Market condition: ${condition}.`);

    if (best.action === 'hold') {
      parts.push(`Recommendation: HOLD current position at ${currentApy.toFixed(2)}% APY.`);
      parts.push(`No strategy change offers sufficient improvement after costs.`);
    } else {
      const improvement = best.netApy - currentApy;
      parts.push(`Recommendation: ${best.action} for ${improvement.toFixed(2)}% APY improvement.`);
      parts.push(best.reasoning);
    }

    return parts.join(' ');
  }

  /**
   * Assess overall market condition based on yield spread and stability.
   */
  private assessMarketCondition(
    opportunities: YieldOpportunity[],
    multiplyOpps: MultiplyOpportunity[]
  ): 'calm' | 'volatile' | 'uncertain' {
    // High variance in yields suggests volatile markets
    if (opportunities.length < 3) return 'uncertain';

    const apys = opportunities.slice(0, 10).map(o => o.apy);
    const mean = apys.reduce((a, b) => a + b, 0) / apys.length;
    const variance = apys.reduce((sum, apy) => sum + Math.pow(apy - mean, 2), 0) / apys.length;
    const stdDev = Math.sqrt(variance);

    // If multiply spreads are compressed, markets are probably volatile
    const avgSpread = multiplyOpps.length > 0
      ? multiplyOpps.reduce((s, o) => s + o.spread, 0) / multiplyOpps.length
      : 0;

    if (stdDev > mean * 0.5 || avgSpread < 1.0) return 'volatile';
    if (stdDev > mean * 0.3) return 'uncertain';
    return 'calm';
  }

  /**
   * Create a Decision record from a strategy candidate.
   * Used for logging every decision in the audit trail.
   */
  createDecision(candidate: StrategyCandidate, currentApy: number, condition: string): Decision {
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date(),
      action: candidate.action,
      reasoning: candidate.reasoning,
      inputs: {
        currentApy,
        targetApy: candidate.netApy,
        riskScore: candidate.riskScore,
        marketCondition: condition,
      },
      params: candidate.params,
    };
  }
}
