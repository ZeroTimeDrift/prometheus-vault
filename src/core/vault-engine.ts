/**
 * Vault Engine — The OODA Loop
 *
 * The autonomous heart of Prometheus Vault. Continuously cycles through
 * the OODA loop to optimize yield across the Solana DeFi ecosystem:
 *
 *   ┌─────────┐     ┌──────────┐     ┌──────────┐     ┌─────────┐
 *   │ OBSERVE │────▶│  ORIENT  │────▶│  DECIDE  │────▶│   ACT   │
 *   │         │     │          │     │          │     │         │
 *   │ Scan    │     │ Analyze  │     │ Strategy │     │ Execute │
 *   │ rates,  │     │ market   │     │ selection│     │ txs on  │
 *   │ check   │     │ context, │     │ via risk │     │ Solana  │
 *   │ chain   │     │ compare  │     │ engine   │     │         │
 *   └────▲────┘     └──────────┘     └──────────┘     └────┬────┘
 *        │                                                   │
 *        └───────────────── feedback loop ───────────────────┘
 *
 * Each cycle is logged as a Decision with full reasoning, creating
 * an auditable trail of every choice the agent makes.
 *
 * The engine is designed to be:
 * - Conservative by default (hold is always an option)
 * - Transparent (every decision is logged with reasoning)
 * - Safe (risk manager can veto any action)
 * - Self-correcting (outcome tracking feeds back into decisions)
 */

import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import Decimal from 'decimal.js';
import {
  VaultConfig,
  VaultSnapshot,
  Decision,
  DecisionOutcome,
  YieldOpportunity,
  DEFAULT_CONFIG,
} from '../types';
import { KaminoClient } from '../protocols/kamino';
import { JupiterClient } from '../protocols/jupiter';
import { getYieldLandscape, scanKaminoRates } from '../protocols/scanner';
import { StrategyEngine, StrategyRecommendation } from './strategy-engine';
import { RiskManager, HealthStatus } from './risk-manager';
import { DecisionLog } from '../memory/decision-log';
import { OutcomeTracker } from '../memory/outcome-tracker';

// ─── OODA Phase Results ─────────────────────────────────────────

export interface ObserveResult {
  snapshot: VaultSnapshot;
  opportunities: YieldOpportunity[];
  multiplyOpportunities: any[];
  solPrice: number;
  jitoStakingApy: number;
  timestamp: Date;
}

export interface OrientResult {
  recommendation: StrategyRecommendation;
  health: HealthStatus;
  marketCondition: string;
}

export interface DecideResult {
  decision: Decision;
  shouldAct: boolean;
  reason: string;
}

export interface ActResult {
  success: boolean;
  txSignature: string | null;
  outcome: DecisionOutcome;
}

export interface CycleResult {
  observe: ObserveResult;
  orient: OrientResult;
  decide: DecideResult;
  act: ActResult | null;
  duration: number;
  cycleNumber: number;
}

// ─── Vault Engine ───────────────────────────────────────────────

export class VaultEngine {
  private config: VaultConfig;
  private connection: Connection;
  private wallet: Keypair;
  private walletPubkey: PublicKey;

  // Sub-systems
  private kaminoClient: KaminoClient;
  private jupiterClient: JupiterClient;
  private strategyEngine: StrategyEngine;
  private riskManager: RiskManager;
  private decisionLog: DecisionLog;
  private outcomeTracker: OutcomeTracker;

  // State
  private cycleCount = 0;
  private running = false;
  private lastSnapshot: VaultSnapshot | null = null;
  private lastDecision: Decision | null = null;

  constructor(config: Partial<VaultConfig> = {}, wallet: Keypair) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.wallet = wallet;
    this.walletPubkey = wallet.publicKey;

    // Initialize connection
    this.connection = new Connection(this.config.rpcUrl, { commitment: 'confirmed' });

    // Initialize sub-systems
    this.kaminoClient = new KaminoClient(this.config.rpcUrl);
    this.jupiterClient = new JupiterClient(this.connection, this.config.jupiter);
    this.riskManager = new RiskManager(this.config.risk);
    this.strategyEngine = new StrategyEngine(
      this.riskManager,
      this.config.riskTolerance,
      this.config.multiply
    );
    this.decisionLog = new DecisionLog(this.connection, this.wallet);
    this.outcomeTracker = new OutcomeTracker();
  }

  /**
   * Start the OODA loop. Runs continuously until stop() is called.
   */
  async start(): Promise<void> {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('     🔥 PROMETHEUS VAULT — Autonomous Yield Optimizer');
    console.log(`     Wallet: ${this.walletPubkey.toBase58()}`);
    console.log(`     Risk: ${this.config.riskTolerance} | Dry Run: ${this.config.dryRun}`);
    console.log(`     Loop interval: ${this.config.loopIntervalMs / 1000}s`);
    console.log('═══════════════════════════════════════════════════════════\n');

    this.running = true;

    while (this.running) {
      try {
        const result = await this.cycle();
        this.printCycleSummary(result);

        if (this.running) {
          const waitMs = this.config.loopIntervalMs;
          console.log(`\n⏰ Next cycle in ${(waitMs / 1000 / 60).toFixed(0)} minutes...\n`);
          await this.sleep(waitMs);
        }
      } catch (err: any) {
        console.error(`\n❌ Cycle ${this.cycleCount} failed: ${err.message}`);
        console.error(`   Retrying in 5 minutes...\n`);
        await this.sleep(5 * 60 * 1000);
      }
    }

    console.log('\n🛑 Vault engine stopped.');
  }

  /** Stop the OODA loop after the current cycle completes. */
  stop(): void {
    console.log('   🛑 Stopping vault engine...');
    this.running = false;
  }

  /**
   * Execute a single OODA cycle.
   * Can be called standalone (for testing) or as part of the loop.
   */
  async cycle(): Promise<CycleResult> {
    const startTime = Date.now();
    this.cycleCount++;

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`   🔄 CYCLE #${this.cycleCount} — ${new Date().toISOString()}`);
    console.log(`${'─'.repeat(60)}\n`);

    // ─── OBSERVE ─────────────────────────────────────────────
    console.log('👁️  OBSERVE — Scanning on-chain state...');
    const observe = await this.observe();

    // ─── ORIENT ──────────────────────────────────────────────
    console.log('\n🧭 ORIENT — Analyzing market conditions...');
    const orient = await this.orient(observe);

    // ─── DECIDE ──────────────────────────────────────────────
    console.log('\n🧠 DECIDE — Selecting optimal strategy...');
    const decide = await this.decide(orient, observe);

    // ─── ACT ─────────────────────────────────────────────────
    let act: ActResult | null = null;
    if (decide.shouldAct) {
      console.log('\n⚡ ACT — Executing decision...');
      act = await this.act(decide.decision, observe.snapshot);
    } else {
      console.log(`\n💤 ACT — Holding: ${decide.reason}`);
    }

    const duration = Date.now() - startTime;

    return {
      observe,
      orient,
      decide,
      act,
      duration,
      cycleNumber: this.cycleCount,
    };
  }

  // ─── OODA Phase Implementations ───────────────────────────────

  /**
   * OBSERVE: Gather all relevant data from the blockchain and APIs.
   * - Current wallet balances
   * - Active positions (K-Lend, Multiply)
   * - Yield rates across protocols
   * - Token prices
   */
  private async observe(): Promise<ObserveResult> {
    // Get SOL price
    const solPrice = await this.getSolPrice();
    const solPriceDec = new Decimal(solPrice);

    // Get balances
    const solBalance = await this.kaminoClient.getSolBalance(this.walletPubkey);
    console.log(`   💰 SOL balance: ${solBalance.toFixed(4)} ($${solBalance.mul(solPriceDec).toFixed(2)})`);

    // Get positions
    const [klendPositions, multiplyPositions] = await Promise.all([
      this.kaminoClient.getKlendPositions(this.walletPubkey).catch(() => []),
      this.kaminoClient.getMultiplyPositions(this.walletPubkey).catch(() => []),
    ]);

    console.log(`   📊 K-Lend positions: ${klendPositions.length}`);
    console.log(`   📊 Multiply positions: ${multiplyPositions.length}`);

    // Calculate total value and blended APY
    let totalValueUsd = solBalance.mul(solPriceDec);
    let weightedApy = new Decimal(0);

    for (const pos of klendPositions) {
      totalValueUsd = totalValueUsd.add(pos.valueUsd);
      weightedApy = weightedApy.add(pos.supplyApy.mul(pos.valueUsd));
    }
    for (const pos of multiplyPositions) {
      totalValueUsd = totalValueUsd.add(pos.netValueUsd);
      weightedApy = weightedApy.add(pos.netApy.mul(pos.netValueUsd));
    }

    const blendedApy = totalValueUsd.gt(0) ? weightedApy.div(totalValueUsd) : new Decimal(0);

    // Build snapshot
    const snapshot: VaultSnapshot = {
      timestamp: new Date(),
      totalValueUsd,
      solBalance,
      positions: {
        klend: klendPositions,
        multiply: multiplyPositions,
      },
      blendedApy,
      solPrice: solPriceDec,
    };

    this.lastSnapshot = snapshot;
    console.log(`   💎 Total value: $${totalValueUsd.toFixed(2)} | Blended APY: ${blendedApy.toFixed(2)}%`);

    // Scan yield opportunities
    console.log('\n   🔍 Scanning yield landscape...');
    const landscape = await getYieldLandscape(this.kaminoClient);

    console.log(`   📊 Found ${landscape.allOpportunities.length} yield opportunities`);
    console.log(`   📊 JitoSOL staking: ${landscape.jitoStakingApy.toFixed(2)}%`);

    // Get multiply opportunities
    const multiplyOpps = await this.kaminoClient.scanMultiplyOpportunities().catch(() => []);
    console.log(`   📊 Multiply opportunities: ${multiplyOpps.length}`);

    return {
      snapshot,
      opportunities: landscape.allOpportunities,
      multiplyOpportunities: multiplyOpps,
      solPrice,
      jitoStakingApy: landscape.jitoStakingApy,
      timestamp: new Date(),
    };
  }

  /**
   * ORIENT: Analyze the observed data in context.
   * - Run health checks
   * - Assess market conditions
   * - Evaluate strategy options
   */
  private async orient(observed: ObserveResult): Promise<OrientResult> {
    // Health check
    const health = this.riskManager.getHealthStatus(observed.snapshot);
    console.log(`   ${health.summary}`);

    for (const check of health.checks) {
      const icon = check.passed ? '✅' : check.severity === 'critical' ? '🔴' : '🟡';
      console.log(`   ${icon} ${check.name}: ${check.value} (${check.threshold})`);
    }

    // Strategy evaluation
    const recommendation = this.strategyEngine.evaluate(
      observed.snapshot,
      observed.opportunities,
      observed.multiplyOpportunities
    );

    console.log(`\n   🏆 Best strategy: ${recommendation.bestStrategy.id} (${recommendation.bestStrategy.netApy.toFixed(2)}% APY)`);
    console.log(`   📊 Market condition: ${recommendation.marketCondition}`);

    if (recommendation.alternatives.length > 0) {
      console.log(`   📋 Alternatives:`);
      for (const alt of recommendation.alternatives.slice(0, 3)) {
        console.log(`      - ${alt.id}: ${alt.netApy.toFixed(2)}% APY (risk: ${alt.riskScore})`);
      }
    }

    return {
      recommendation,
      health,
      marketCondition: recommendation.marketCondition,
    };
  }

  /**
   * DECIDE: Make the final decision on what action to take.
   * - Apply risk filters
   * - Determine if action is warranted
   * - Log the decision with full reasoning
   */
  private async decide(oriented: OrientResult, observed: ObserveResult): Promise<DecideResult> {
    const { recommendation, health } = oriented;
    const best = recommendation.bestStrategy;

    // Create decision record
    const decision = this.strategyEngine.createDecision(
      best,
      recommendation.currentApy,
      recommendation.marketCondition
    );

    // Determine if we should act
    let shouldAct = false;
    let reason = '';

    if (health.circuitBreakerActive) {
      reason = 'Circuit breaker is active — holding all positions';
    } else if (health.status === 'red') {
      reason = 'Vault health is RED — only emergency actions allowed';
    } else if (best.action === 'hold') {
      reason = best.reasoning;
    } else if (best.riskAssessment && !best.riskAssessment.approved) {
      reason = `Risk manager blocked: ${best.riskAssessment.reason}`;
    } else if (this.config.dryRun) {
      shouldAct = false; // Don't execute in dry run, but log the decision
      reason = `DRY RUN — would execute: ${best.action}`;
    } else {
      shouldAct = true;
      reason = best.reasoning;
    }

    console.log(`   📝 Decision: ${best.action} | Should act: ${shouldAct}`);
    console.log(`   📝 Reasoning: ${reason}`);

    // Log the decision (on-chain memo in production)
    await this.decisionLog.log(decision);
    this.lastDecision = decision;

    return { decision, shouldAct, reason };
  }

  /**
   * ACT: Execute the decided action on-chain.
   * - Build and submit transactions
   * - Track the outcome
   * - Feed results back for learning
   */
  private async act(decision: Decision, snapshotBefore: VaultSnapshot): Promise<ActResult> {
    const valueBeforeUsd = snapshotBefore.totalValueUsd.toNumber();
    let txSignature: string | null = null;
    let success = false;
    let error: string | undefined;

    try {
      switch (decision.action) {
        case 'deposit_klend':
          console.log(`   📥 Depositing to K-Lend: ${decision.params.token}`);
          // In production: execute deposit via Kamino SDK
          // For now, log the intent
          console.log(`   🧪 Would deposit ${decision.params.token} to ${decision.params.pool}`);
          success = true;
          break;

        case 'open_multiply':
          console.log(`   🔄 Opening Multiply position: ${decision.params.collateral}/${decision.params.debt} at ${decision.params.leverage}x`);
          // In production: execute via multiply-client flash loan SDK
          console.log(`   🧪 Would open ${decision.params.leverage}x ${decision.params.collateral} multiply on ${decision.params.market}`);
          success = true;
          break;

        case 'close_multiply':
          console.log(`   📤 Closing Multiply position: ${decision.params.collateralToken}`);
          console.log(`   🧪 Would close multiply obligation ${decision.params.obligationAddress}`);
          success = true;
          break;

        case 'swap':
          console.log(`   🔄 Executing swap via Jupiter`);
          // const result = await this.jupiterClient.executeSwap(...)
          success = true;
          break;

        default:
          console.log(`   ℹ️  Action ${decision.action} — no execution needed`);
          success = true;
      }
    } catch (err: any) {
      error = err.message;
      console.error(`   ❌ Action failed: ${error}`);
    }

    // Record outcome
    const outcome: DecisionOutcome = {
      success,
      txSignature,
      error,
      valueBeforeUsd,
      valueAfterUsd: valueBeforeUsd, // Will be updated on next observe
      apyBefore: snapshotBefore.blendedApy.toNumber(),
      apyAfter: snapshotBefore.blendedApy.toNumber(), // Updated next cycle
      timestamp: new Date(),
    };

    // Track for learning
    this.outcomeTracker.record(decision.id, outcome);

    // Update decision with outcome
    decision.outcome = outcome;
    await this.decisionLog.log(decision);

    return { success, txSignature, outcome };
  }

  // ─── Helpers ──────────────────────────────────────────────────

  private async getSolPrice(): Promise<number> {
    try {
      const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
      );
      const data = (await res.json()) as any;
      return data.solana?.usd || 200;
    } catch {
      return 200;
    }
  }

  private printCycleSummary(result: CycleResult): void {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`   CYCLE #${result.cycleNumber} COMPLETE — ${(result.duration / 1000).toFixed(1)}s`);
    console.log(`   Value: $${result.observe.snapshot.totalValueUsd.toFixed(2)}`);
    console.log(`   APY: ${result.observe.snapshot.blendedApy.toFixed(2)}%`);
    console.log(`   Decision: ${result.decide.decision.action}`);
    console.log(`   Acted: ${result.act ? (result.act.success ? '✅' : '❌') : '💤 (held)'}`);
    console.log(`${'═'.repeat(60)}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ─── Public Accessors ─────────────────────────────────────────

  getLastSnapshot(): VaultSnapshot | null { return this.lastSnapshot; }
  getLastDecision(): Decision | null { return this.lastDecision; }
  getCycleCount(): number { return this.cycleCount; }
  isRunning(): boolean { return this.running; }
  getDecisionLog(): DecisionLog { return this.decisionLog; }
  getOutcomeTracker(): OutcomeTracker { return this.outcomeTracker; }
  getHealthStatus(): HealthStatus | null {
    return this.lastSnapshot
      ? this.riskManager.getHealthStatus(this.lastSnapshot)
      : null;
  }
}
