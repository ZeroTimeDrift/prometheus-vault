/**
 * Jupiter Swap Integration
 *
 * Executes token swaps through Jupiter V6 aggregator — the primary
 * liquidity source on Solana. Used for:
 * - Rebalancing between tokens (SOL ↔ LSTs)
 * - Getting price quotes for valuation
 * - Building swap transactions for position entry/exit
 *
 * Jupiter aggregates liquidity from Orca, Raydium, Meteora, and 20+
 * other DEXs to find the best route for any token pair.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
} from '@solana/web3.js';
import Decimal from 'decimal.js';
import { TOKEN_MINTS, TOKEN_DECIMALS, JupiterConfig } from '../types';

const JUPITER_API = 'https://public.jupiterapi.com';

// ─── Types ──────────────────────────────────────────────────────

export interface JupiterQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
}

export interface SwapResult {
  signature: string | null;
  inputToken: string;
  outputToken: string;
  inputAmount: Decimal;
  outputAmount: Decimal;
  priceImpact: number;
  route: string;
}

// ─── Retry Helper ───────────────────────────────────────────────

async function retry<T>(fn: () => Promise<T>, maxRetries = 3, delayMs = 2000): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      if (i === maxRetries - 1) throw err;
      const isRateLimit = err.message?.includes('429') || err.message?.includes('Too Many');
      const wait = isRateLimit ? delayMs * (i + 2) : delayMs;
      await new Promise(r => setTimeout(r, wait));
    }
  }
  throw new Error('Max retries exceeded');
}

// ─── Jupiter Client ─────────────────────────────────────────────

export class JupiterClient {
  private connection: Connection;
  private config: JupiterConfig;

  constructor(connection: Connection, config?: Partial<JupiterConfig>) {
    this.connection = connection;
    this.config = {
      slippageBps: config?.slippageBps ?? 50,
      preferDirect: config?.preferDirect ?? false,
      maxAccounts: config?.maxAccounts ?? 64,
    };
  }

  /**
   * Get a swap quote from Jupiter V6.
   * Accepts token symbols (SOL, JitoSOL) or raw mint addresses.
   */
  async getQuote(
    inputToken: string,
    outputToken: string,
    amountUi: Decimal,
    slippageBps?: number
  ): Promise<JupiterQuote> {
    const inputMint = TOKEN_MINTS[inputToken] || inputToken;
    const outputMint = TOKEN_MINTS[outputToken] || outputToken;

    if (!inputMint || inputMint.length < 30) {
      throw new Error(`Unknown input token: ${inputToken}`);
    }
    if (!outputMint || outputMint.length < 30) {
      throw new Error(`Unknown output token: ${outputToken}`);
    }

    const decimals = TOKEN_DECIMALS[inputToken] ?? 9;
    const amountRaw = amountUi.mul(new Decimal(10).pow(decimals)).floor().toString();
    const slippage = slippageBps ?? this.config.slippageBps;

    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount: amountRaw,
      slippageBps: slippage.toString(),
      onlyDirectRoutes: this.config.preferDirect.toString(),
      maxAccounts: this.config.maxAccounts.toString(),
    });

    const url = `${JUPITER_API}/quote?${params}`;

    const quote = await retry(async () => {
      const r = await fetch(url);
      if (!r.ok) {
        const body = await r.text();
        throw new Error(`Jupiter quote failed (${r.status}): ${body}`);
      }
      return r.json() as Promise<JupiterQuote>;
    });

    return quote;
  }

  /**
   * Build a swap transaction from a Jupiter quote.
   * Returns a VersionedTransaction ready for signing.
   */
  async buildSwapTransaction(
    quote: JupiterQuote,
    walletPubkey: PublicKey
  ): Promise<VersionedTransaction> {
    const body = {
      quoteResponse: quote,
      userPublicKey: walletPubkey.toBase58(),
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: 'auto',
    };

    const response = await retry(async () => {
      const r = await fetch(`${JUPITER_API}/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const txt = await r.text();
        throw new Error(`Jupiter swap build failed (${r.status}): ${txt}`);
      }
      return r.json() as Promise<{ swapTransaction: string }>;
    });

    const txBuf = Buffer.from(response.swapTransaction, 'base64');
    return VersionedTransaction.deserialize(txBuf);
  }

  /**
   * Execute a complete swap: quote → build → sign → send → confirm.
   * Returns null signature in dryRun mode.
   */
  async executeSwap(
    inputToken: string,
    outputToken: string,
    amountUi: Decimal,
    wallet: Keypair,
    dryRun: boolean = true
  ): Promise<SwapResult> {
    const quote = await this.getQuote(inputToken, outputToken, amountUi);

    const outDecimals = TOKEN_DECIMALS[outputToken] ?? 9;
    const outputAmount = new Decimal(quote.outAmount).div(new Decimal(10).pow(outDecimals));
    const priceImpact = parseFloat(quote.priceImpactPct || '0');
    const route = quote.routePlan.map(r => r.swapInfo.label).join(' → ');

    if (dryRun) {
      console.log(`   🧪 DRY RUN — would swap ${amountUi} ${inputToken} → ${outputAmount.toFixed(6)} ${outputToken}`);
      return {
        signature: null,
        inputToken,
        outputToken,
        inputAmount: amountUi,
        outputAmount,
        priceImpact,
        route,
      };
    }

    console.log(`   ⚡ Executing swap: ${amountUi} ${inputToken} → ${outputToken}...`);
    const tx = await this.buildSwapTransaction(quote, wallet.publicKey);
    tx.sign([wallet]);

    const rawTx = tx.serialize();
    const signature = await retry(async () => {
      const sig = await this.connection.sendRawTransaction(rawTx, {
        skipPreflight: false,
        maxRetries: 2,
      });
      const latestBh = await this.connection.getLatestBlockhash();
      await this.connection.confirmTransaction(
        { signature: sig, ...latestBh },
        'confirmed'
      );
      return sig;
    });

    console.log(`   ✅ Swap confirmed: ${signature}`);
    return {
      signature,
      inputToken,
      outputToken,
      inputAmount: amountUi,
      outputAmount,
      priceImpact,
      route,
    };
  }

  /**
   * Get the price of one token in terms of another.
   * Uses a 1-unit quote to determine the exchange rate.
   */
  async getPrice(baseToken: string, quoteToken: string): Promise<Decimal> {
    try {
      const quote = await this.getQuote(baseToken, quoteToken, new Decimal(1));
      const outDecimals = TOKEN_DECIMALS[quoteToken] ?? 9;
      return new Decimal(quote.outAmount).div(new Decimal(10).pow(outDecimals));
    } catch {
      return new Decimal(0);
    }
  }
}
