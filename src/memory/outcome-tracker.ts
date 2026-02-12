/**
 * Outcome Tracker — Learning from Past Decisions
 *
 * Tracks the real-world outcomes of every vault decision to enable
 * the agent to learn and improve over time. This is the feedback
 * mechanism that closes the OODA loop.
 *
 * Key metrics tracked:
 * - Win rate: What % of strategy switches were profitable?
 * - Average improvement: How much APY gain per successful switch?
 * - Best/worst decisions: Which strategies performed best/worst?
 * - Time-to-value: How quickly did improvements materialize?
 *
 * This data feeds back into the strategy engine to:
 * - Adjust confidence in different strategy types
 * - Tune risk parameters based on actual outcomes
 * - Identify market conditions where certain strategies excel
 */

import { DecisionOutcome, DecisionAction } from '../types';

// ─── Types ──────────────────────────────────────────────────────

interface TrackedOutcome {
  decisionId: string;
  action: DecisionAction;
  outcome: DecisionOutcome;
  apyChange: number; // apyAfter - apyBefore
  valueChange: number; // valueAfter - valueBefore (USD)
  valueChangePct: number; // (valueAfter - valueBefore) / valueBefore * 100
  timestamp: Date;
}

export interface PerformanceReport {
  /** Total tracked outcomes */
  totalOutcomes: number;
  /** Percentage of successful actions */
  winRate: number;
  /** Average APY change per action */
  avgApyChange: number;
  /** Average value change per action (%) */
  avgValueChangePct: number;
  /** Total cumulative P&L (USD) */
  totalPnlUsd: number;
  /** Best performing action type */
  bestActionType: string;
  /** Worst performing action type */
  worstActionType: string;
  /** Performance by action type */
  byAction: Record<string, {
    count: number;
    winRate: number;
    avgApyChange: number;
    totalPnl: number;
  }>;
  /** Recent trend (last 10 decisions) */
  recentTrend: 'improving' | 'declining' | 'stable';
}

// ─── Outcome Tracker ────────────────────────────────────────────

export class OutcomeTracker {
  private outcomes: TrackedOutcome[] = [];

  /**
   * Record the outcome of a decision.
   */
  record(decisionId: string, outcome: DecisionOutcome, action: DecisionAction = 'hold'): void {
    const apyChange = outcome.apyAfter - outcome.apyBefore;
    const valueChange = outcome.valueAfterUsd - outcome.valueBeforeUsd;
    const valueChangePct = outcome.valueBeforeUsd > 0
      ? (valueChange / outcome.valueBeforeUsd) * 100
      : 0;

    this.outcomes.push({
      decisionId,
      action,
      outcome,
      apyChange,
      valueChange,
      valueChangePct,
      timestamp: outcome.timestamp,
    });
  }

  /**
   * Update a previously recorded outcome with new data.
   * Called when the next OODA cycle provides updated position values.
   */
  updateOutcome(decisionId: string, updates: Partial<DecisionOutcome>): void {
    const tracked = this.outcomes.find(o => o.decisionId === decisionId);
    if (!tracked) return;

    if (updates.valueAfterUsd !== undefined) {
      tracked.outcome.valueAfterUsd = updates.valueAfterUsd;
      tracked.valueChange = updates.valueAfterUsd - tracked.outcome.valueBeforeUsd;
      tracked.valueChangePct = tracked.outcome.valueBeforeUsd > 0
        ? (tracked.valueChange / tracked.outcome.valueBeforeUsd) * 100
        : 0;
    }

    if (updates.apyAfter !== undefined) {
      tracked.outcome.apyAfter = updates.apyAfter;
      tracked.apyChange = updates.apyAfter - tracked.outcome.apyBefore;
    }
  }

  /**
   * Generate a comprehensive performance report.
   */
  getReport(): PerformanceReport {
    if (this.outcomes.length === 0) {
      return {
        totalOutcomes: 0,
        winRate: 0,
        avgApyChange: 0,
        avgValueChangePct: 0,
        totalPnlUsd: 0,
        bestActionType: 'none',
        worstActionType: 'none',
        byAction: {},
        recentTrend: 'stable',
      };
    }

    // Aggregate by action type
    const byAction: Record<string, {
      count: number;
      wins: number;
      totalApyChange: number;
      totalPnl: number;
    }> = {};

    let totalWins = 0;
    let totalApyChange = 0;
    let totalValueChangePct = 0;
    let totalPnl = 0;

    for (const o of this.outcomes) {
      const key = o.action;
      if (!byAction[key]) {
        byAction[key] = { count: 0, wins: 0, totalApyChange: 0, totalPnl: 0 };
      }
      byAction[key].count++;
      byAction[key].totalApyChange += o.apyChange;
      byAction[key].totalPnl += o.valueChange;

      if (o.outcome.success && o.valueChange >= 0) {
        byAction[key].wins++;
        totalWins++;
      }

      totalApyChange += o.apyChange;
      totalValueChangePct += o.valueChangePct;
      totalPnl += o.valueChange;
    }

    // Find best and worst action types
    const actionPerf = Object.entries(byAction).map(([action, data]) => ({
      action,
      avgPnl: data.totalPnl / data.count,
    }));
    actionPerf.sort((a, b) => b.avgPnl - a.avgPnl);

    // Format by-action report
    const byActionReport: Record<string, any> = {};
    for (const [action, data] of Object.entries(byAction)) {
      byActionReport[action] = {
        count: data.count,
        winRate: (data.wins / data.count) * 100,
        avgApyChange: data.totalApyChange / data.count,
        totalPnl: data.totalPnl,
      };
    }

    // Recent trend (last 10 decisions)
    const recent = this.outcomes.slice(-10);
    const recentPnl = recent.reduce((s, o) => s + o.valueChange, 0);
    const olderPnl = this.outcomes.length > 10
      ? this.outcomes.slice(-20, -10).reduce((s, o) => s + o.valueChange, 0)
      : 0;
    const recentTrend = recentPnl > olderPnl * 1.1 ? 'improving'
      : recentPnl < olderPnl * 0.9 ? 'declining'
      : 'stable';

    return {
      totalOutcomes: this.outcomes.length,
      winRate: (totalWins / this.outcomes.length) * 100,
      avgApyChange: totalApyChange / this.outcomes.length,
      avgValueChangePct: totalValueChangePct / this.outcomes.length,
      totalPnlUsd: totalPnl,
      bestActionType: actionPerf[0]?.action || 'none',
      worstActionType: actionPerf[actionPerf.length - 1]?.action || 'none',
      byAction: byActionReport,
      recentTrend,
    };
  }

  /**
   * Get recent outcomes for display.
   */
  getRecent(limit = 10): TrackedOutcome[] {
    return this.outcomes
      .slice(-limit)
      .reverse();
  }

  /**
   * Export all outcomes for persistence.
   */
  toJSON(): object[] {
    return this.outcomes.map(o => ({
      ...o,
      timestamp: o.timestamp.toISOString(),
      outcome: {
        ...o.outcome,
        timestamp: o.outcome.timestamp.toISOString(),
      },
    }));
  }
}
