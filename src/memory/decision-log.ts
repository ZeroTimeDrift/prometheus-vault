/**
 * Decision Log — On-Chain Audit Trail
 *
 * Every decision the vault agent makes is logged with full reasoning.
 * This creates a transparent, verifiable record of autonomous behavior.
 *
 * Two storage layers:
 * 1. Local: JSON file for fast access and querying
 * 2. On-chain: Solana memo program for immutability (optional)
 *
 * The on-chain memo contains a compact hash of the decision, linking
 * the verifiable on-chain record to the detailed off-chain log.
 *
 * Why this matters:
 * - Auditability: Anyone can verify what the agent decided and why
 * - Learning: Historical decisions feed back into strategy selection
 * - Trust: Users can inspect the agent's reasoning before depositing
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import * as crypto from 'crypto';
import { Decision, DecisionOutcome } from '../types';

// Solana Memo Program
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

// ─── Decision Log ───────────────────────────────────────────────

export class DecisionLog {
  private connection: Connection;
  private wallet: Keypair;
  private decisions: Decision[] = [];
  private onChainEnabled: boolean;

  constructor(connection: Connection, wallet: Keypair, onChainEnabled = false) {
    this.connection = connection;
    this.wallet = wallet;
    this.onChainEnabled = onChainEnabled;
  }

  /**
   * Log a decision. Stores locally and optionally writes a memo on-chain.
   */
  async log(decision: Decision): Promise<string | null> {
    // Store locally
    const existing = this.decisions.findIndex(d => d.id === decision.id);
    if (existing >= 0) {
      this.decisions[existing] = decision;
    } else {
      this.decisions.push(decision);
    }

    // Optionally write on-chain memo
    if (this.onChainEnabled) {
      try {
        return await this.writeMemo(decision);
      } catch (err: any) {
        console.log(`   ⚠️  On-chain memo failed: ${err.message}`);
      }
    }

    return null;
  }

  /**
   * Write a compact decision memo to the Solana blockchain.
   * Format: "PV:{action}:{hash}:{apy}:{risk}"
   */
  private async writeMemo(decision: Decision): Promise<string> {
    const hash = this.hashDecision(decision);
    const memo = `PV:${decision.action}:${hash}:${decision.inputs.targetApy.toFixed(1)}:${decision.inputs.riskScore}`;

    const instruction = new TransactionInstruction({
      keys: [{ pubkey: this.wallet.publicKey, isSigner: true, isWritable: false }],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(memo),
    });

    const tx = new Transaction().add(instruction);
    const signature = await sendAndConfirmTransaction(this.connection, tx, [this.wallet]);

    console.log(`   📝 Decision logged on-chain: ${signature}`);
    return signature;
  }

  /**
   * Create a compact hash of a decision for on-chain reference.
   * The full decision details are stored off-chain, with this hash
   * serving as a verifiable link.
   */
  private hashDecision(decision: Decision): string {
    const content = JSON.stringify({
      id: decision.id,
      action: decision.action,
      timestamp: decision.timestamp.toISOString(),
      inputs: decision.inputs,
      reasoning: decision.reasoning,
    });
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 12);
  }

  /**
   * Get all logged decisions, optionally filtered.
   */
  getDecisions(filter?: {
    action?: string;
    since?: Date;
    limit?: number;
  }): Decision[] {
    let results = [...this.decisions];

    if (filter?.action) {
      results = results.filter(d => d.action === filter.action);
    }
    if (filter?.since) {
      results = results.filter(d => d.timestamp >= filter.since!);
    }

    // Sort by timestamp descending (newest first)
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (filter?.limit) {
      results = results.slice(0, filter.limit);
    }

    return results;
  }

  /**
   * Get statistics about decision history.
   */
  getStats(): {
    totalDecisions: number;
    actionBreakdown: Record<string, number>;
    avgRiskScore: number;
    successRate: number;
    decisionsToday: number;
  } {
    const today = new Date().toISOString().slice(0, 10);
    const actionBreakdown: Record<string, number> = {};
    let totalRisk = 0;
    let withOutcome = 0;
    let successful = 0;
    let todayCount = 0;

    for (const d of this.decisions) {
      actionBreakdown[d.action] = (actionBreakdown[d.action] || 0) + 1;
      totalRisk += d.inputs.riskScore;

      if (d.outcome) {
        withOutcome++;
        if (d.outcome.success) successful++;
      }

      if (d.timestamp.toISOString().slice(0, 10) === today) todayCount++;
    }

    return {
      totalDecisions: this.decisions.length,
      actionBreakdown,
      avgRiskScore: this.decisions.length > 0 ? totalRisk / this.decisions.length : 0,
      successRate: withOutcome > 0 ? (successful / withOutcome) * 100 : 0,
      decisionsToday: todayCount,
    };
  }

  /**
   * Export all decisions as JSON (for API responses).
   */
  toJSON(): object[] {
    return this.decisions.map(d => ({
      ...d,
      timestamp: d.timestamp.toISOString(),
      outcome: d.outcome ? {
        ...d.outcome,
        timestamp: d.outcome.timestamp.toISOString(),
      } : undefined,
    }));
  }
}
