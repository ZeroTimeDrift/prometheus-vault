/**
 * Strategy Engine Tests
 *
 * Verifies the core decision-making logic of Prometheus Vault.
 * Tests cover:
 * - Strategy ranking (hold vs klend vs multiply)
 * - Risk filtering (circuit breakers, position limits)
 * - Break-even calculations
 * - Market condition assessment
 */

import Decimal from 'decimal.js';
import { StrategyEngine, StrategyCandidate } from '../src/core/strategy-engine';
import { RiskManager } from '../src/core/risk-manager';
import { OutcomeTracker } from '../src/memory/outcome-tracker';
import {
  VaultSnapshot,
  YieldOpportunity,
  RiskConfig,
  MultiplyConfig,
  StrategyType,
  MultiplyPosition,
} from '../src/types';
import { MultiplyOpportunity } from '../src/protocols/kamino';

// ─── Test Helpers ───────────────────────────────────────────────

function makeSnapshot(overrides: Partial<VaultSnapshot> = {}): VaultSnapshot {
  return {
    timestamp: new Date(),
    totalValueUsd: new Decimal(200),
    solBalance: new Decimal(0.05),
    positions: {
      klend: [],
      multiply: [{
        obligationAddress: 'test-obligation',
        marketAddress: 'test-market',
        collateralToken: 'pSOL',
        collateralMint: 'pSo1f...',
        debtToken: 'SOL',
        collateralAmount: new Decimal(1.5),
        debtAmount: new Decimal(0.5),
        netValueUsd: new Decimal(195),
        leverage: new Decimal(1.5),
        ltv: new Decimal(0.33),
        maxLtv: new Decimal(0.90),
        collateralApy: new Decimal(8),
        borrowApy: new Decimal(5),
        netApy: new Decimal(9.5),
        strategy: StrategyType.MULTIPLY,
      }],
    },
    blendedApy: new Decimal(9.5),
    solPrice: new Decimal(200),
    ...overrides,
  };
}

function makeRiskConfig(overrides: Partial<RiskConfig> = {}): RiskConfig {
  return {
    maxPositionPct: 0.50,
    maxLeverage: 3.0,
    maxLtv: 0.80,
    gasReserveSol: 0.05,
    maxSlippageBps: 100,
    dailyLossCircuitBreakerPct: 5.0,
    minApyImprovementPct: 1.0,
    maxBreakEvenDays: 7,
    ...overrides,
  };
}

function makeMultiplyConfig(): MultiplyConfig {
  return {
    maxLeverage: 3.0,
    minSpreadPct: 1.0,
    alertLtv: 0.80,
    preferredMarket: 'DxXdAyU3kCjnyggvHmY5nAwg5cRbbmdyX3npfDMjjMek',
  };
}

function makeLendingOpp(apy: number, token = 'SOL'): YieldOpportunity {
  return {
    protocol: 'kamino',
    pool: `K-Lend ${token} Supply`,
    type: 'lending',
    token,
    apy,
    apyBase: apy,
    apyReward: 0,
    tvlUsd: 50_000_000,
    risk: 'low',
    url: 'https://app.kamino.finance',
    notes: '',
  };
}

function makeMultiplyOpp(
  stakingApy: number,
  borrowApy: number,
  collateral = 'JitoSOL'
): MultiplyOpportunity {
  const spread = stakingApy - borrowApy;
  return {
    collateral,
    collateralMint: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',
    debt: 'SOL',
    debtMint: 'So11111111111111111111111111111111111111112',
    market: 'Jito',
    marketAddress: 'DxXdAyU3kCjnyggvHmY5nAwg5cRbbmdyX3npfDMjjMek',
    stakingApy,
    borrowApy,
    spread,
    netApyAt2x: stakingApy * 2 - borrowApy,
    netApyAt3x: stakingApy * 3 - borrowApy * 2,
    maxLtv: 0.90,
  };
}

// ─── Tests ──────────────────────────────────────────────────────

describe('StrategyEngine', () => {
  let riskManager: RiskManager;
  let engine: StrategyEngine;

  beforeEach(() => {
    riskManager = new RiskManager(makeRiskConfig());
    engine = new StrategyEngine(riskManager, 'balanced', makeMultiplyConfig());
  });

  test('should always include "hold" as a strategy option', () => {
    const snapshot = makeSnapshot();
    const result = engine.evaluate(snapshot, [], []);

    // Hold should be the default when no opportunities exist
    expect(result.bestStrategy.action).toBe('hold');
    expect(result.bestStrategy.riskScore).toBe(0);
  });

  test('should recommend switching when APY improvement exceeds threshold', () => {
    const snapshot = makeSnapshot({ blendedApy: new Decimal(3) }); // Low current APY
    const opportunities = [makeLendingOpp(12)]; // High opportunity

    const result = engine.evaluate(snapshot, opportunities, []);

    // Should recommend the lending opportunity over hold
    const klendOption = result.alternatives.find(a => a.action === 'deposit_klend') ||
                        (result.bestStrategy.action === 'deposit_klend' ? result.bestStrategy : null);
    expect(klendOption).toBeTruthy();
    expect(klendOption!.netApy).toBeGreaterThan(3);
  });

  test('should not recommend switching for marginal improvements', () => {
    const snapshot = makeSnapshot({ blendedApy: new Decimal(9) }); // Already good
    const opportunities = [makeLendingOpp(9.5)]; // Marginal improvement

    const result = engine.evaluate(snapshot, opportunities, []);

    // Hold should win because the improvement doesn't justify switch costs
    expect(result.bestStrategy.action).toBe('hold');
  });

  test('should evaluate multiply opportunities with spread check', () => {
    const snapshot = makeSnapshot({ blendedApy: new Decimal(5) });
    const multiplyOpps = [makeMultiplyOpp(8, 3)]; // 5% spread — good

    const result = engine.evaluate(snapshot, [], multiplyOpps);

    // Should find a multiply candidate
    const multiplyOption = [...result.alternatives, result.bestStrategy]
      .find(a => a.action === 'open_multiply');
    expect(multiplyOption).toBeTruthy();
    expect(multiplyOption!.params.spread).toBe(5);
  });

  test('should reject multiply with spread below minimum', () => {
    const snapshot = makeSnapshot({ blendedApy: new Decimal(5) });
    const multiplyOpps = [makeMultiplyOpp(6, 5.5)]; // 0.5% spread — too thin

    const result = engine.evaluate(snapshot, [], multiplyOpps);

    // No multiply option should appear
    const multiplyOption = [...result.alternatives, result.bestStrategy]
      .find(a => a.action === 'open_multiply');
    expect(multiplyOption).toBeUndefined();
  });

  test('should recommend closing multiply when net APY collapses', () => {
    const snapshot = makeSnapshot({
      positions: {
        klend: [],
        multiply: [{
          obligationAddress: 'test-ob',
          marketAddress: 'test-mkt',
          collateralToken: 'pSOL',
          collateralMint: 'pSo1...',
          debtToken: 'SOL',
          collateralAmount: new Decimal(1),
          debtAmount: new Decimal(0.5),
          netValueUsd: new Decimal(100),
          leverage: new Decimal(2),
          ltv: new Decimal(0.5),
          maxLtv: new Decimal(0.9),
          collateralApy: new Decimal(5),
          borrowApy: new Decimal(6), // Borrow > staking!
          netApy: new Decimal(-1), // Negative net APY
          strategy: StrategyType.MULTIPLY,
        }],
      },
    });

    const result = engine.evaluate(snapshot, [], []);

    // Should recommend closing the underwater position
    const closeOption = [...result.alternatives, result.bestStrategy]
      .find(a => a.action === 'close_multiply');
    expect(closeOption).toBeTruthy();
  });
});

describe('RiskManager', () => {
  let riskManager: RiskManager;

  beforeEach(() => {
    riskManager = new RiskManager(makeRiskConfig());
  });

  test('should approve low-risk actions', () => {
    const snapshot = makeSnapshot();
    const assessment = riskManager.assessAction('hold', snapshot);

    expect(assessment.approved).toBe(true);
    expect(assessment.riskScore).toBe(0);
    expect(assessment.blocks).toHaveLength(0);
  });

  test('should block when gas reserve is insufficient', () => {
    const snapshot = makeSnapshot({ solBalance: new Decimal(0.01) }); // Below 0.05 reserve
    const assessment = riskManager.assessAction('deposit_klend', snapshot);

    expect(assessment.approved).toBe(false);
    expect(assessment.blocks.length).toBeGreaterThan(0);
    expect(assessment.blocks[0]).toContain('gas reserve');
  });

  test('should block excessive leverage', () => {
    const snapshot = makeSnapshot();
    const assessment = riskManager.assessAction('open_multiply', snapshot, {
      leverage: 5.0, // Above 3.0 max
    });

    expect(assessment.approved).toBe(false);
    expect(assessment.blocks.some(b => b.includes('Leverage'))).toBe(true);
  });

  test('should block excessive position size', () => {
    const snapshot = makeSnapshot({ totalValueUsd: new Decimal(100) });
    const assessment = riskManager.assessAction('deposit_klend', snapshot, {
      amountUsd: 60, // 60% > 50% max
    });

    expect(assessment.approved).toBe(false);
    expect(assessment.blocks.some(b => b.includes('Position size'))).toBe(true);
  });

  test('should calculate switch costs correctly', () => {
    const cost = riskManager.calculateSwitchCost(5, 10, 1.0, 2);

    expect(cost.costSol).toBeGreaterThan(0);
    expect(cost.breakEvenDays).toBeGreaterThan(0);
    expect(cost.breakEvenDays).toBeLessThan(365); // Reasonable break-even
    expect(cost.profitable).toBe(true); // 5% improvement should be profitable
  });

  test('should not flag unprofitable tiny improvements', () => {
    const cost = riskManager.calculateSwitchCost(9.0, 9.5, 1.0, 2);

    // 0.5% improvement might not break even within 7 days
    expect(cost.profitable).toBe(false);
  });

  test('should validate reasonable rates', () => {
    expect(riskManager.validateRate(10, 'lending')).toBe(true);
    expect(riskManager.validateRate(250, 'lending')).toBe(false); // Too high
    expect(riskManager.validateRate(-10, 'lending')).toBe(false); // Negative
    expect(riskManager.validateRate(60, 'multiply')).toBe(false); // Suspicious for multiply
  });

  test('should provide comprehensive health status', () => {
    const snapshot = makeSnapshot();
    const health = riskManager.getHealthStatus(snapshot);

    expect(health.status).toBe('green');
    expect(health.checks.length).toBeGreaterThan(0);
    expect(health.circuitBreakerActive).toBe(false);
  });
});

describe('OutcomeTracker', () => {
  let tracker: OutcomeTracker;

  beforeEach(() => {
    tracker = new OutcomeTracker();
  });

  test('should record and report outcomes', () => {
    tracker.record('dec-1', {
      success: true,
      txSignature: 'sig1',
      valueBeforeUsd: 100,
      valueAfterUsd: 105,
      apyBefore: 5,
      apyAfter: 8,
      timestamp: new Date(),
    }, 'deposit_klend');

    const report = tracker.getReport();
    expect(report.totalOutcomes).toBe(1);
    expect(report.winRate).toBe(100);
    expect(report.totalPnlUsd).toBe(5);
  });

  test('should calculate correct win rate with mixed outcomes', () => {
    tracker.record('dec-1', {
      success: true,
      txSignature: 'sig1',
      valueBeforeUsd: 100,
      valueAfterUsd: 110,
      apyBefore: 5,
      apyAfter: 10,
      timestamp: new Date(),
    }, 'deposit_klend');

    tracker.record('dec-2', {
      success: true,
      txSignature: 'sig2',
      valueBeforeUsd: 110,
      valueAfterUsd: 105,
      apyBefore: 10,
      apyAfter: 7,
      timestamp: new Date(),
    }, 'swap');

    const report = tracker.getReport();
    expect(report.totalOutcomes).toBe(2);
    expect(report.winRate).toBe(50); // 1 out of 2
    expect(report.totalPnlUsd).toBe(5); // +10 - 5
  });

  test('should track performance by action type', () => {
    tracker.record('dec-1', {
      success: true, txSignature: null,
      valueBeforeUsd: 100, valueAfterUsd: 108,
      apyBefore: 5, apyAfter: 8, timestamp: new Date(),
    }, 'deposit_klend');

    tracker.record('dec-2', {
      success: true, txSignature: null,
      valueBeforeUsd: 108, valueAfterUsd: 115,
      apyBefore: 8, apyAfter: 12, timestamp: new Date(),
    }, 'open_multiply');

    const report = tracker.getReport();
    expect(report.byAction['deposit_klend']).toBeDefined();
    expect(report.byAction['open_multiply']).toBeDefined();
    expect(report.bestActionType).toBe('open_multiply'); // Higher avg PnL
  });
});
