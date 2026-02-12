/**
 * Risk Manager — Circuit Breakers and Position Limits
 *
 * The guardian of the vault. Every action passes through the risk manager
 * before execution. Implements multiple layers of protection:
 *
 * 1. Position Limits — No single position exceeds maxPositionPct of portfolio
 * 2. Leverage Caps — Multiply positions capped at maxLeverage
 * 3. LTV Monitoring — Alert and deleverage before liquidation
 * 4. Gas Reserve — Always keep enough SOL for emergency exits
 * 5. Slippage Guards — Reject trades with excessive price impact
 * 6. Daily Loss Circuit Breaker — Halt trading if losses exceed threshold
 * 7. Rate Validation — Sanity check yields to avoid exploits/errors
 *
 * Philosophy: It's better to miss a yield opportunity than lose capital.
 */

import Decimal from 'decimal.js';
import {
  RiskConfig,
  VaultSnapshot,
  MultiplyPosition,
  Decision,
  DecisionAction,
} from '../types';

// ─── Risk Assessment Types ──────────────────────────────────────

export interface RiskAssessment {
  /** Whether the action is approved */
  approved: boolean;
  /** Risk score 0-100 (higher = riskier) */
  riskScore: number;
  /** Human-readable reason for the decision */
  reason: string;
  /** Specific warnings (action may still be approved) */
  warnings: string[];
  /** Hard blocks (action rejected) */
  blocks: string[];
}

export interface HealthStatus {
  /** Overall health: green, yellow, red */
  status: 'green' | 'yellow' | 'red';
  /** Individual check results */
  checks: HealthCheck[];
  /** Whether any circuit breakers are active */
  circuitBreakerActive: boolean;
  /** Summary message */
  summary: string;
}

interface HealthCheck {
  name: string;
  passed: boolean;
  value: string;
  threshold: string;
  severity: 'info' | 'warning' | 'critical';
}

// ─── Daily P&L Tracking ─────────────────────────────────────────

interface DailyPnL {
  date: string; // YYYY-MM-DD
  startValueUsd: number;
  currentValueUsd: number;
  lossPct: number;
}

// ─── Risk Manager ───────────────────────────────────────────────

export class RiskManager {
  private config: RiskConfig;
  private dailyPnL: DailyPnL | null = null;
  private circuitBreakerTripped = false;
  private circuitBreakerReason = '';

  constructor(config: RiskConfig) {
    this.config = config;
  }

  /**
   * Assess whether a proposed action should be allowed.
   * This is the main gate — called before every vault action.
   */
  assessAction(
    action: DecisionAction,
    snapshot: VaultSnapshot,
    params: Record<string, any> = {}
  ): RiskAssessment {
    const warnings: string[] = [];
    const blocks: string[] = [];
    let riskScore = 0;

    // ─── Circuit Breaker Check ────────────────────────────────
    if (this.circuitBreakerTripped && action !== 'hold') {
      blocks.push(`Circuit breaker active: ${this.circuitBreakerReason}`);
      return {
        approved: false,
        riskScore: 100,
        reason: `BLOCKED — circuit breaker: ${this.circuitBreakerReason}`,
        warnings,
        blocks,
      };
    }

    // ─── Gas Reserve Check ────────────────────────────────────
    const solBalance = snapshot.solBalance.toNumber();
    if (solBalance < this.config.gasReserveSol) {
      blocks.push(
        `SOL balance (${solBalance.toFixed(4)}) below gas reserve (${this.config.gasReserveSol})`
      );
      riskScore += 30;
    }

    // ─── Position Size Check ─────────────────────────────────
    if (params.amountUsd && snapshot.totalValueUsd.gt(0)) {
      const positionPct = params.amountUsd / snapshot.totalValueUsd.toNumber();
      if (positionPct > this.config.maxPositionPct) {
        blocks.push(
          `Position size ${(positionPct * 100).toFixed(1)}% exceeds max ${(this.config.maxPositionPct * 100).toFixed(1)}%`
        );
        riskScore += 25;
      } else if (positionPct > this.config.maxPositionPct * 0.8) {
        warnings.push(`Position size ${(positionPct * 100).toFixed(1)}% approaching limit`);
        riskScore += 10;
      }
    }

    // ─── Leverage Check ──────────────────────────────────────
    if (action === 'open_multiply' || action === 'adjust_leverage') {
      const targetLeverage = params.leverage || 1;
      if (targetLeverage > this.config.maxLeverage) {
        blocks.push(
          `Leverage ${targetLeverage}x exceeds max ${this.config.maxLeverage}x`
        );
        riskScore += 30;
      } else if (targetLeverage > this.config.maxLeverage * 0.8) {
        warnings.push(`Leverage ${targetLeverage}x approaching max`);
        riskScore += 15;
      }
    }

    // ─── LTV Check for Multiply Positions ────────────────────
    for (const pos of snapshot.positions.multiply) {
      if (pos.ltv.gt(this.config.maxLtv)) {
        blocks.push(
          `Position ${pos.collateralToken} LTV ${pos.ltv.mul(100).toFixed(1)}% exceeds max ${(this.config.maxLtv * 100).toFixed(1)}%`
        );
        riskScore += 40;
      } else if (pos.ltv.gt(this.config.maxLtv * 0.9)) {
        warnings.push(
          `Position ${pos.collateralToken} LTV ${pos.ltv.mul(100).toFixed(1)}% near liquidation threshold`
        );
        riskScore += 20;
      }
    }

    // ─── Slippage Check ──────────────────────────────────────
    if (params.slippageBps) {
      if (params.slippageBps > this.config.maxSlippageBps) {
        blocks.push(
          `Slippage ${params.slippageBps}bps exceeds max ${this.config.maxSlippageBps}bps`
        );
        riskScore += 20;
      }
    }

    // ─── APY Sanity Check ────────────────────────────────────
    // Yields above 100% are almost certainly wrong or unsustainable
    if (params.targetApy && params.targetApy > 100) {
      warnings.push(`Target APY ${params.targetApy.toFixed(1)}% seems unrealistically high`);
      riskScore += 15;
    }

    // ─── Break-Even Check ────────────────────────────────────
    if (params.breakEvenDays && params.breakEvenDays > this.config.maxBreakEvenDays) {
      warnings.push(
        `Break-even period ${params.breakEvenDays.toFixed(1)} days exceeds threshold ${this.config.maxBreakEvenDays} days`
      );
      riskScore += 10;
    }

    // ─── Daily P&L Check ─────────────────────────────────────
    this.updateDailyPnL(snapshot);
    if (this.dailyPnL && this.dailyPnL.lossPct > this.config.dailyLossCircuitBreakerPct) {
      this.tripCircuitBreaker(
        `Daily loss ${this.dailyPnL.lossPct.toFixed(2)}% exceeds ${this.config.dailyLossCircuitBreakerPct}% threshold`
      );
      blocks.push(this.circuitBreakerReason);
      riskScore = 100;
    }

    const approved = blocks.length === 0;
    const reason = approved
      ? warnings.length > 0
        ? `Approved with warnings: ${warnings.join('; ')}`
        : 'Approved — all risk checks passed'
      : `BLOCKED: ${blocks.join('; ')}`;

    return {
      approved,
      riskScore: Math.min(100, riskScore),
      reason,
      warnings,
      blocks,
    };
  }

  /**
   * Get comprehensive health status of the vault.
   */
  getHealthStatus(snapshot: VaultSnapshot): HealthStatus {
    const checks: HealthCheck[] = [];
    let worstSeverity: 'info' | 'warning' | 'critical' = 'info';

    // Gas reserve
    const solBal = snapshot.solBalance.toNumber();
    const gasOk = solBal >= this.config.gasReserveSol;
    checks.push({
      name: 'Gas Reserve',
      passed: gasOk,
      value: `${solBal.toFixed(4)} SOL`,
      threshold: `≥ ${this.config.gasReserveSol} SOL`,
      severity: gasOk ? 'info' : 'critical',
    });
    if (!gasOk) worstSeverity = 'critical';

    // LTV checks
    for (const pos of snapshot.positions.multiply) {
      const ltvPct = pos.ltv.mul(100).toNumber();
      const maxPct = this.config.maxLtv * 100;
      const ltvOk = ltvPct < maxPct;
      const severity = ltvPct > maxPct ? 'critical' : ltvPct > maxPct * 0.9 ? 'warning' : 'info';
      checks.push({
        name: `${pos.collateralToken} LTV`,
        passed: ltvOk,
        value: `${ltvPct.toFixed(1)}%`,
        threshold: `< ${maxPct.toFixed(0)}%`,
        severity,
      });
      if (severity === 'critical') worstSeverity = 'critical';
      else if (severity === 'warning' && worstSeverity !== 'critical') worstSeverity = 'warning';
    }

    // Daily P&L
    this.updateDailyPnL(snapshot);
    if (this.dailyPnL) {
      const lossOk = this.dailyPnL.lossPct < this.config.dailyLossCircuitBreakerPct;
      checks.push({
        name: 'Daily P&L',
        passed: lossOk,
        value: `${this.dailyPnL.lossPct > 0 ? '-' : '+'}${Math.abs(this.dailyPnL.lossPct).toFixed(2)}%`,
        threshold: `< -${this.config.dailyLossCircuitBreakerPct}%`,
        severity: lossOk ? 'info' : 'critical',
      });
      if (!lossOk) worstSeverity = 'critical';
    }

    // Portfolio value
    checks.push({
      name: 'Portfolio Value',
      passed: true,
      value: `$${snapshot.totalValueUsd.toFixed(2)}`,
      threshold: 'n/a',
      severity: 'info',
    });

    const status = worstSeverity === 'critical' ? 'red' : worstSeverity === 'warning' ? 'yellow' : 'green';
    const statusEmoji = { green: '🟢', yellow: '🟡', red: '🔴' }[status];

    return {
      status,
      checks,
      circuitBreakerActive: this.circuitBreakerTripped,
      summary: `${statusEmoji} Vault health: ${status.toUpperCase()} — ${checks.filter(c => c.passed).length}/${checks.length} checks passed`,
    };
  }

  /**
   * Validate that a yield rate makes sense (anti-exploit check).
   */
  validateRate(apy: number, protocol: string): boolean {
    // Negative yields are suspicious
    if (apy < -5) return false;
    // Extremely high yields are probably bugs or exploits
    if (apy > 200) return false;
    // Multiply yields > 50% are suspicious unless at high leverage
    if (protocol === 'multiply' && apy > 50) return false;
    return true;
  }

  /**
   * Calculate the cost of switching strategies (fees, slippage, opportunity cost).
   */
  calculateSwitchCost(
    currentApy: number,
    targetApy: number,
    valueSol: number,
    txCount: number = 2
  ): { costSol: number; breakEvenDays: number; profitable: boolean } {
    // Transaction fees
    const txCostSol = txCount * 0.0005; // ~0.0005 SOL per complex tx

    // Slippage estimate (conservative 0.3% for SOL ↔ LST swaps)
    const slippageCostSol = valueSol * 0.003;

    const totalCostSol = txCostSol + slippageCostSol;

    // APY improvement as daily yield
    const apyDiff = targetApy - currentApy;
    const dailyImprovement = (apyDiff / 100) * valueSol / 365;

    // Break-even calculation
    const breakEvenDays = dailyImprovement > 0 ? totalCostSol / dailyImprovement : Infinity;

    return {
      costSol: totalCostSol,
      breakEvenDays,
      profitable: breakEvenDays < this.config.maxBreakEvenDays && apyDiff > this.config.minApyImprovementPct,
    };
  }

  // ─── Private Helpers ────────────────────────────────────────

  private updateDailyPnL(snapshot: VaultSnapshot): void {
    const today = new Date().toISOString().slice(0, 10);

    if (!this.dailyPnL || this.dailyPnL.date !== today) {
      this.dailyPnL = {
        date: today,
        startValueUsd: snapshot.totalValueUsd.toNumber(),
        currentValueUsd: snapshot.totalValueUsd.toNumber(),
        lossPct: 0,
      };
      // Reset circuit breaker at start of new day
      if (this.circuitBreakerTripped) {
        console.log('   🔄 Circuit breaker reset for new trading day');
        this.circuitBreakerTripped = false;
        this.circuitBreakerReason = '';
      }
    } else {
      this.dailyPnL.currentValueUsd = snapshot.totalValueUsd.toNumber();
      const change = this.dailyPnL.currentValueUsd - this.dailyPnL.startValueUsd;
      this.dailyPnL.lossPct = this.dailyPnL.startValueUsd > 0
        ? -(change / this.dailyPnL.startValueUsd) * 100
        : 0;
    }
  }

  private tripCircuitBreaker(reason: string): void {
    if (!this.circuitBreakerTripped) {
      console.log(`   🚨 CIRCUIT BREAKER TRIPPED: ${reason}`);
      this.circuitBreakerTripped = true;
      this.circuitBreakerReason = reason;
    }
  }

  /** Manually reset the circuit breaker (for testing or manual override) */
  resetCircuitBreaker(): void {
    this.circuitBreakerTripped = false;
    this.circuitBreakerReason = '';
    console.log('   🔄 Circuit breaker manually reset');
  }

  /** Check if circuit breaker is currently active */
  isCircuitBreakerActive(): boolean {
    return this.circuitBreakerTripped;
  }
}
