/**
 * Prometheus Vault — REST API Server
 *
 * Exposes the vault's state and controls via a clean HTTP API.
 * Designed for integration with dashboards, bots, and external systems.
 *
 * Endpoints:
 *   GET  /status      — Current vault state (positions, P&L, health)
 *   GET  /strategies  — Available yield strategies with live rates
 *   GET  /history     — Decision audit log
 *   GET  /performance — Outcome tracking and win rates
 *   GET  /health      — Risk manager health checks
 *   POST /deposit     — Generate deposit instructions
 *
 * Security note: This is a read-heavy API. Deposit endpoint returns
 * unsigned transaction instructions — the user signs with their own wallet.
 */

import express from 'express';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import Decimal from 'decimal.js';
import { VaultEngine } from '../core/vault-engine';
import { VaultConfig, DEFAULT_CONFIG } from '../types';

const app = express();
app.use(express.json());

// ─── CORS ───────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  next();
});

// ─── Vault Reference ────────────────────────────────────────────
// The engine is initialized when the server starts

let engine: VaultEngine | null = null;

function getEngine(): VaultEngine {
  if (!engine) throw new Error('Vault engine not initialized');
  return engine;
}

// ─── Routes ─────────────────────────────────────────────────────

/**
 * GET /status — Current vault state
 * Returns positions, balances, P&L, and blended APY.
 */
app.get('/status', async (req, res) => {
  try {
    const vault = getEngine();
    const snapshot = vault.getLastSnapshot();

    if (!snapshot) {
      return res.json({
        status: 'initializing',
        message: 'Vault engine is starting up — no data yet',
      });
    }

    const response = {
      status: 'active',
      timestamp: snapshot.timestamp.toISOString(),
      wallet: '7u5ovFNms7oE232TTyMU5TxDfyZTJctihH4YqP2n1EUz',
      overview: {
        totalValueUsd: snapshot.totalValueUsd.toFixed(2),
        solBalance: snapshot.solBalance.toFixed(4),
        blendedApy: snapshot.blendedApy.toFixed(2),
        solPrice: snapshot.solPrice.toFixed(2),
      },
      positions: {
        klend: snapshot.positions.klend.map(p => ({
          token: p.token,
          amount: p.depositedAmount.toFixed(6),
          valueUsd: p.valueUsd.toFixed(2),
          apy: p.supplyApy.toFixed(2),
        })),
        multiply: snapshot.positions.multiply.map(p => ({
          collateral: p.collateralToken,
          debt: p.debtToken,
          netValueUsd: p.netValueUsd.toFixed(2),
          leverage: p.leverage.toFixed(2),
          ltv: p.ltv.mul(100).toFixed(1),
          netApy: p.netApy.toFixed(2),
        })),
      },
      engine: {
        cycleCount: vault.getCycleCount(),
        running: vault.isRunning(),
        lastDecision: vault.getLastDecision()?.action || null,
      },
    };

    res.json(response);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /strategies — Available yield strategies with live rates
 */
app.get('/strategies', async (req, res) => {
  try {
    const vault = getEngine();
    const snapshot = vault.getLastSnapshot();
    const decision = vault.getLastDecision();

    res.json({
      currentStrategy: decision?.action || 'initializing',
      currentApy: snapshot?.blendedApy.toFixed(2) || '0',
      // Strategy catalog
      availableStrategies: [
        {
          id: 'klend_supply',
          name: 'K-Lend Supply',
          description: 'Deposit tokens to Kamino K-Lend to earn supply interest',
          risk: 'low',
          expectedApy: '3-15%',
          tokens: ['SOL', 'USDC', 'JitoSOL', 'mSOL'],
        },
        {
          id: 'multiply',
          name: 'Multiply (Leveraged Staking)',
          description: 'Leverage LST staking yield via Kamino flash loans. Borrow SOL → buy LST → earn amplified staking rewards.',
          risk: 'medium',
          expectedApy: '5-25%',
          tokens: ['JitoSOL', 'pSOL', 'bSOL', 'mSOL', 'JupSOL'],
        },
        {
          id: 'hold',
          name: 'Hold LSTs',
          description: 'Direct LST holding for baseline staking yield. Zero fees, zero risk.',
          risk: 'low',
          expectedApy: '5-8%',
          tokens: ['JitoSOL', 'mSOL', 'bSOL'],
        },
      ],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /history — Decision audit log
 * Shows every decision the agent made with full reasoning.
 */
app.get('/history', async (req, res) => {
  try {
    const vault = getEngine();
    const log = vault.getDecisionLog();
    const limit = parseInt(req.query.limit as string) || 50;
    const action = req.query.action as string;

    const decisions = log.getDecisions({
      action,
      limit,
    });

    const stats = log.getStats();

    res.json({
      stats,
      decisions: decisions.map(d => ({
        id: d.id,
        timestamp: d.timestamp.toISOString(),
        action: d.action,
        reasoning: d.reasoning,
        inputs: d.inputs,
        params: d.params,
        outcome: d.outcome ? {
          success: d.outcome.success,
          txSignature: d.outcome.txSignature,
          valueChange: d.outcome.valueAfterUsd - d.outcome.valueBeforeUsd,
          apyChange: d.outcome.apyAfter - d.outcome.apyBefore,
        } : null,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /performance — Outcome tracking and learning metrics
 */
app.get('/performance', async (req, res) => {
  try {
    const vault = getEngine();
    const report = vault.getOutcomeTracker().getReport();
    const recent = vault.getOutcomeTracker().getRecent(10);

    res.json({
      report,
      recentOutcomes: recent.map(o => ({
        decisionId: o.decisionId,
        action: o.action,
        apyChange: o.apyChange.toFixed(2),
        valueChange: o.valueChange.toFixed(2),
        success: o.outcome.success,
        timestamp: o.timestamp.toISOString(),
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /health — Risk manager health checks
 */
app.get('/health', async (req, res) => {
  try {
    const vault = getEngine();
    const health = vault.getHealthStatus();

    if (!health) {
      return res.json({ status: 'initializing' });
    }

    res.json({
      status: health.status,
      summary: health.summary,
      circuitBreakerActive: health.circuitBreakerActive,
      checks: health.checks.map(c => ({
        name: c.name,
        passed: c.passed,
        value: c.value,
        threshold: c.threshold,
        severity: c.severity,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /deposit — Generate deposit instructions
 * Returns the vault wallet address for SOL deposits.
 * In a production vault, this would return unsigned transaction
 * instructions for the user to sign.
 */
app.post('/deposit', async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // For the hackathon, return the deposit address
    // A production vault would use a Solana program (SPL vault)
    res.json({
      vaultAddress: '7u5ovFNms7oE232TTyMU5TxDfyZTJctihH4YqP2n1EUz',
      amount,
      message: 'Send SOL to the vault address. The agent will automatically deploy it to the highest-yield strategy.',
      note: 'In production, this would return unsigned transaction instructions for a proper on-chain vault program.',
      explorerUrl: `https://solscan.io/account/7u5ovFNms7oE232TTyMU5TxDfyZTJctihH4YqP2n1EUz`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET / — API info
 */
app.get('/', (req, res) => {
  res.json({
    name: 'Prometheus Vault API',
    version: '0.1.0',
    description: 'Autonomous DeFi yield optimizer on Solana',
    endpoints: {
      'GET /status': 'Current vault state',
      'GET /strategies': 'Available yield strategies',
      'GET /history': 'Decision audit log',
      'GET /performance': 'Outcome tracking',
      'GET /health': 'Risk health checks',
      'POST /deposit': 'Deposit instructions',
    },
    wallet: '7u5ovFNms7oE232TTyMU5TxDfyZTJctihH4YqP2n1EUz',
    explorer: 'https://solscan.io/account/7u5ovFNms7oE232TTyMU5TxDfyZTJctihH4YqP2n1EUz',
  });
});

// ─── Server Startup ─────────────────────────────────────────────

export function startServer(vaultEngine: VaultEngine, port = 3000): void {
  engine = vaultEngine;

  app.listen(port, () => {
    console.log(`\n🌐 Prometheus Vault API running on http://localhost:${port}`);
    console.log(`   Endpoints: /status /strategies /history /performance /health /deposit\n`);
  });
}

// Standalone mode
if (require.main === module) {
  const port = parseInt(process.env.PORT || '3000');
  console.log('⚠️  Starting API server in standalone mode (no vault engine)');
  console.log('   Run the full vault with: npx ts-node src/index.ts\n');

  // Create a minimal engine for standalone mode
  const dummyWallet = Keypair.generate();
  engine = new VaultEngine({ dryRun: true }, dummyWallet);
  
  app.listen(port, () => {
    console.log(`🌐 API server listening on port ${port}`);
  });
}

export default app;
