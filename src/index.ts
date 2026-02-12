/**
 * Prometheus Vault — Entry Point
 *
 * An autonomous DeFi yield optimizer running on Solana.
 * Continuously scans the yield landscape, evaluates strategies,
 * and executes rebalances to maximize risk-adjusted returns.
 *
 * Architecture:
 *   - OODA Loop: Observe → Orient → Decide → Act
 *   - Risk Manager: Circuit breakers, position limits, gas reserves
 *   - Decision Log: Every action logged with reasoning for transparency
 *   - REST API: External visibility into vault state and decisions
 *
 * Usage:
 *   npx ts-node src/index.ts                    # Start the vault (dry run)
 *   npx ts-node src/index.ts --live              # Live mode (real transactions)
 *   npx ts-node src/index.ts --cycle             # Run one OODA cycle and exit
 *   WALLET_PATH=./wallet.json npx ts-node src/index.ts  # Custom wallet
 *
 * Environment variables:
 *   RPC_URL       — Solana RPC endpoint (default: mainnet-beta)
 *   WALLET_PATH   — Path to wallet keypair JSON
 *   PORT          — API server port (default: 3000)
 *   DRY_RUN       — Set to "false" for live execution
 */

import { Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

import { VaultEngine } from './core/vault-engine';
import { VaultConfig, DEFAULT_CONFIG } from './types';
import { startServer } from './api/server';

// ─── Configuration ──────────────────────────────────────────────

function loadConfig(): VaultConfig {
  const config = { ...DEFAULT_CONFIG };

  // Override from environment
  if (process.env.RPC_URL) config.rpcUrl = process.env.RPC_URL;
  if (process.env.DRY_RUN === 'false') config.dryRun = false;
  if (process.env.WALLET_PATH) config.walletPath = process.env.WALLET_PATH;

  // Override from CLI args
  if (process.argv.includes('--live')) config.dryRun = false;

  return config;
}

function loadWallet(walletPath: string): Keypair {
  try {
    const fullPath = path.resolve(walletPath);
    const secretKey = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    return Keypair.fromSecretKey(Uint8Array.from(secretKey));
  } catch (err: any) {
    console.log('⚠️  No wallet found. Generating ephemeral wallet for dry run...');
    console.log('   To use a real wallet, set WALLET_PATH or place wallet.json in ./config/\n');
    return Keypair.generate();
  }
}

// ─── Banner ─────────────────────────────────────────────────────

function printBanner() {
  console.log(`
    ██████╗ ██████╗  ██████╗ ███╗   ███╗███████╗████████╗██╗  ██╗███████╗██╗   ██╗███████╗
    ██╔══██╗██╔══██╗██╔═══██╗████╗ ████║██╔════╝╚══██╔══╝██║  ██║██╔════╝██║   ██║██╔════╝
    ██████╔╝██████╔╝██║   ██║██╔████╔██║█████╗     ██║   ███████║█████╗  ██║   ██║███████╗
    ██╔═══╝ ██╔══██╗██║   ██║██║╚██╔╝██║██╔══╝     ██║   ██╔══██║██╔══╝  ██║   ██║╚══════║
    ██║     ██║  ██║╚██████╔╝██║ ╚═╝ ██║███████╗   ██║   ██║  ██║███████╗╚██████╔╝███████║
    ╚═╝     ╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚══════╝
                                                                                          
    ██╗   ██╗ █████╗ ██╗   ██╗██╗  ████████╗
    ██║   ██║██╔══██╗██║   ██║██║  ╚══██╔══╝
    ██║   ██║███████║██║   ██║██║     ██║   
    ╚██╗ ██╔╝██╔══██║██║   ██║██║     ██║   
     ╚████╔╝ ██║  ██║╚██████╔╝███████╗██║   
      ╚═══╝  ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝   
    
    Autonomous DeFi Yield Optimizer on Solana
    Built by Prometheus — an AI agent that never sleeps
  `);
}

// ─── Main ───────────────────────────────────────────────────────

async function main() {
  printBanner();

  const config = loadConfig();
  const wallet = loadWallet(config.walletPath);
  const port = parseInt(process.env.PORT || '3000');

  console.log(`📋 Configuration:`);
  console.log(`   RPC: ${config.rpcUrl.slice(0, 40)}...`);
  console.log(`   Wallet: ${wallet.publicKey.toBase58()}`);
  console.log(`   Mode: ${config.dryRun ? 'DRY RUN (simulation)' : '🔴 LIVE (real transactions)'}`);
  console.log(`   Risk: ${config.riskTolerance}`);
  console.log(`   API: http://localhost:${port}\n`);

  // Initialize vault engine
  const engine = new VaultEngine(config, wallet);

  // Start API server
  startServer(engine, port);

  // Check for single-cycle mode
  if (process.argv.includes('--cycle')) {
    console.log('🔄 Running single OODA cycle...\n');
    const result = await engine.cycle();
    console.log(`\n✅ Cycle complete in ${(result.duration / 1000).toFixed(1)}s`);
    console.log(`   Decision: ${result.decide.decision.action}`);
    console.log(`   Reasoning: ${result.decide.reason}`);
    process.exit(0);
  }

  // Start the OODA loop
  console.log('🚀 Starting OODA loop...\n');
  await engine.start();
}

// ─── Error Handling ─────────────────────────────────────────────

process.on('unhandledRejection', (err: any) => {
  console.error('❌ Unhandled rejection:', err.message || err);
});

process.on('SIGINT', () => {
  console.log('\n\n🛑 Received SIGINT — shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Received SIGTERM — shutting down...');
  process.exit(0);
});

// ─── Run ────────────────────────────────────────────────────────

main().catch(err => {
  console.error('💀 Fatal error:', err);
  process.exit(1);
});
