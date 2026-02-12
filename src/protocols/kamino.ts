/**
 * Kamino Protocol Integration
 *
 * Handles all interactions with Kamino Finance:
 * - K-Lend: Supply/withdraw tokens to earn interest
 * - Multiply: Leveraged LST staking positions via flash loans
 * - Rate scanning: Fetch live rates across all Kamino markets
 *
 * Uses Kamino REST API for reads and SDK for transaction building.
 * This keeps RPC calls minimal while enabling full position management.
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import Decimal from 'decimal.js';
import {
  KlendPosition,
  MultiplyPosition,
  StrategyType,
  TOKEN_MINTS,
  TOKEN_DECIMALS,
  KAMINO_MARKETS,
  MultiplyConfig,
} from '../types';

// ─── Kamino REST API ────────────────────────────────────────────

const KAMINO_API = 'https://api.kamino.finance';

/** Reserve data from Kamino REST API */
export interface KaminoReserve {
  reserve: string;
  liquidityToken: string;
  liquidityTokenMint: string;
  supplyApy: number;
  borrowApy: number;
  totalSupplyUsd: number;
  totalBorrowUsd: number;
}

/** User obligation data from Kamino REST API */
export interface KaminoObligation {
  obligationAddress: string;
  tag: number;
  deposits: Array<{
    reserveAddress: string;
    mintAddress: string;
    symbol: string;
    depositedAmount: number;
    marketValue: number;
  }>;
  borrows: Array<{
    reserveAddress: string;
    mintAddress: string;
    symbol: string;
    borrowedAmount: number;
    marketValue: number;
  }>;
}

/** Multiply opportunity across LSTs and markets */
export interface MultiplyOpportunity {
  collateral: string;
  collateralMint: string;
  debt: string;
  debtMint: string;
  market: string;
  marketAddress: string;
  stakingApy: number;
  borrowApy: number;
  spread: number;
  netApyAt2x: number;
  netApyAt3x: number;
  maxLtv: number;
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

// ─── API Functions ──────────────────────────────────────────────

/** Fetch all reserves for a Kamino market */
export async function fetchReserves(marketAddress: string): Promise<KaminoReserve[]> {
  const url = `${KAMINO_API}/v2/lending/reserves?marketAddress=${marketAddress}`;
  const res = await retry(async () => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Kamino API error (${r.status}): ${await r.text()}`);
    return r.json() as Promise<any[]>;
  });

  return res.map((r: any) => ({
    reserve: r.address || r.reserve,
    liquidityToken: r.symbol || r.liquidityToken?.symbol || 'UNKNOWN',
    liquidityTokenMint: r.liquidityToken?.mint || r.mint || '',
    supplyApy: (r.metrics?.supplyInterestAPY || r.supplyApy || 0) * 100,
    borrowApy: (r.metrics?.borrowInterestAPY || r.borrowApy || 0) * 100,
    totalSupplyUsd: r.metrics?.totalSupplyUsd || r.totalSupplyUsd || 0,
    totalBorrowUsd: r.metrics?.totalBorrowUsd || r.totalBorrowUsd || 0,
  }));
}

/** Fetch user obligations (positions) for a wallet */
export async function fetchUserObligations(
  marketAddress: string,
  wallet: string
): Promise<KaminoObligation[]> {
  const url = `${KAMINO_API}/v2/lending/obligations?marketAddress=${marketAddress}&wallet=${wallet}`;
  const res = await retry(async () => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Kamino obligations API error (${r.status})`);
    return r.json() as Promise<any[]>;
  });

  return res.map((o: any) => ({
    obligationAddress: o.address || o.obligationAddress,
    tag: o.tag || 0,
    deposits: (o.deposits || []).map((d: any) => ({
      reserveAddress: d.reserveAddress || d.reserve,
      mintAddress: d.mintAddress || d.mint,
      symbol: d.symbol || 'UNKNOWN',
      depositedAmount: d.amount || d.depositedAmount || 0,
      marketValue: d.marketValueUsd || d.marketValue || 0,
    })),
    borrows: (o.borrows || []).map((b: any) => ({
      reserveAddress: b.reserveAddress || b.reserve,
      mintAddress: b.mintAddress || b.mint,
      symbol: b.symbol || 'UNKNOWN',
      borrowedAmount: b.amount || b.borrowedAmount || 0,
      marketValue: b.marketValueUsd || b.marketValue || 0,
    })),
  }));
}

/** Fetch live JitoSOL staking APY from Jito API */
export async function fetchJitoStakingApy(): Promise<number> {
  try {
    const res = await fetch('https://kobe.mainnet.jito.network/api/v1/stake_pool_stats');
    const data = (await res.json()) as any;
    if (Array.isArray(data) && data.length > 0) {
      return data[data.length - 1].apy * 100;
    }
  } catch {
    // Fallback
  }
  return 7.5; // Conservative fallback
}

/** Fetch live Sanctum LST APYs */
export async function fetchLstApys(): Promise<Record<string, number>> {
  try {
    const res = await fetch('https://extra-api.sanctum.so/v1/apy/latest');
    const data = (await res.json()) as any;
    const result: Record<string, number> = {};
    if (data.apys) {
      for (const [mint, apy] of Object.entries(data.apys)) {
        // Map mint back to symbol
        for (const [symbol, m] of Object.entries(TOKEN_MINTS)) {
          if (m === mint) {
            result[symbol] = (apy as number) * 100;
            break;
          }
        }
      }
    }
    return result;
  } catch {
    return { JitoSOL: 7.5 };
  }
}

// ─── Kamino Client ──────────────────────────────────────────────

export class KaminoClient {
  private connection: Connection;
  private reserveCache: Map<string, { data: KaminoReserve[]; time: number }> = new Map();
  private readonly CACHE_TTL = 60_000; // 1 minute

  constructor(rpcUrl: string) {
    this.connection = new Connection(rpcUrl, { commitment: 'confirmed' });
  }

  /** Get SOL balance for a wallet */
  async getSolBalance(wallet: PublicKey): Promise<Decimal> {
    const lamports = await this.connection.getBalance(wallet);
    return new Decimal(lamports).div(LAMPORTS_PER_SOL);
  }

  /** Get reserves for a market (cached) */
  async getReserves(marketAddress: string = KAMINO_MARKETS.MAIN): Promise<KaminoReserve[]> {
    const cached = this.reserveCache.get(marketAddress);
    if (cached && Date.now() - cached.time < this.CACHE_TTL) {
      return cached.data;
    }
    const data = await fetchReserves(marketAddress);
    this.reserveCache.set(marketAddress, { data, time: Date.now() });
    return data;
  }

  /** Get top K-Lend supply opportunities sorted by APY */
  async getTopSupplyRates(limit = 10): Promise<KaminoReserve[]> {
    const reserves = await this.getReserves();
    return reserves
      .filter(r => r.supplyApy > 0.01)
      .sort((a, b) => b.supplyApy - a.supplyApy)
      .slice(0, limit);
  }

  /** Get user's K-Lend positions */
  async getKlendPositions(wallet: PublicKey): Promise<KlendPosition[]> {
    const obligations = await fetchUserObligations(KAMINO_MARKETS.MAIN, wallet.toBase58());
    const reserves = await this.getReserves();
    const positions: KlendPosition[] = [];

    for (const ob of obligations) {
      if (ob.tag !== 0) continue; // Skip non-vanilla obligations (multiply = tag 1)
      for (const dep of ob.deposits) {
        const reserve = reserves.find(r => r.reserve === dep.reserveAddress);
        positions.push({
          reserveAddress: dep.reserveAddress,
          token: dep.symbol,
          tokenMint: dep.mintAddress,
          depositedAmount: new Decimal(dep.depositedAmount),
          valueUsd: new Decimal(dep.marketValue),
          supplyApy: new Decimal(reserve?.supplyApy || 0),
        });
      }
    }

    return positions;
  }

  /** Get user's Multiply positions across all markets */
  async getMultiplyPositions(wallet: PublicKey): Promise<MultiplyPosition[]> {
    const positions: MultiplyPosition[] = [];
    const markets = [
      { name: 'Main', address: KAMINO_MARKETS.MAIN },
      { name: 'Jito', address: KAMINO_MARKETS.JITO },
    ];

    for (const market of markets) {
      const obligations = await fetchUserObligations(market.address, wallet.toBase58());
      const reserves = await this.getReserves(market.address);

      for (const ob of obligations) {
        if (ob.tag !== 1) continue; // Multiply = tag 1

        const totalDeposit = ob.deposits.reduce((s, d) => s + d.marketValue, 0);
        const totalBorrow = ob.borrows.reduce((s, b) => s + b.marketValue, 0);
        const netValue = totalDeposit - totalBorrow;
        const leverage = netValue > 0 ? totalDeposit / netValue : 0;
        const ltv = totalDeposit > 0 ? totalBorrow / totalDeposit : 0;

        const collateral = ob.deposits[0];
        const debt = ob.borrows[0];
        if (!collateral || !debt) continue;

        const collateralReserve = reserves.find(r => r.reserve === collateral.reserveAddress);
        const debtReserve = reserves.find(r => r.reserve === debt.reserveAddress);

        const collateralApy = new Decimal(collateralReserve?.supplyApy || 7.5);
        const borrowApy = new Decimal(debtReserve?.borrowApy || 5);
        const netApy = collateralApy.mul(leverage).minus(borrowApy.mul(leverage - 1));

        positions.push({
          obligationAddress: ob.obligationAddress,
          marketAddress: market.address,
          collateralToken: collateral.symbol,
          collateralMint: collateral.mintAddress,
          debtToken: debt.symbol,
          collateralAmount: new Decimal(collateral.depositedAmount),
          debtAmount: new Decimal(debt.borrowedAmount),
          netValueUsd: new Decimal(netValue),
          leverage: new Decimal(leverage),
          ltv: new Decimal(ltv),
          maxLtv: new Decimal(0.90),
          collateralApy,
          borrowApy,
          netApy,
          strategy: StrategyType.MULTIPLY,
        });
      }
    }

    return positions;
  }

  /**
   * Scan multiply opportunities across all markets and LSTs.
   * Returns the best spread opportunities for leveraged staking.
   */
  async scanMultiplyOpportunities(): Promise<MultiplyOpportunity[]> {
    const lstApys = await fetchLstApys();
    const opportunities: MultiplyOpportunity[] = [];

    const markets = [
      { name: 'Main', address: KAMINO_MARKETS.MAIN },
      { name: 'Jito', address: KAMINO_MARKETS.JITO },
    ];

    for (const market of markets) {
      const reserves = await this.getReserves(market.address);
      const solReserve = reserves.find(r => r.liquidityTokenMint === TOKEN_MINTS.SOL);
      if (!solReserve) continue;

      const solBorrowApy = solReserve.borrowApy;

      // Check each LST as potential collateral
      for (const [symbol, mint] of Object.entries(TOKEN_MINTS)) {
        if (symbol === 'SOL' || symbol === 'USDC') continue;
        const stakingApy = lstApys[symbol];
        if (!stakingApy) continue;

        const reserve = reserves.find(r => r.liquidityTokenMint === mint);
        if (!reserve) continue;

        const spread = stakingApy - solBorrowApy;
        if (spread <= 0) continue;

        opportunities.push({
          collateral: symbol,
          collateralMint: mint,
          debt: 'SOL',
          debtMint: TOKEN_MINTS.SOL,
          market: market.name,
          marketAddress: market.address,
          stakingApy,
          borrowApy: solBorrowApy,
          spread,
          netApyAt2x: stakingApy * 2 - solBorrowApy * 1,
          netApyAt3x: stakingApy * 3 - solBorrowApy * 2,
          maxLtv: 0.90,
        });
      }
    }

    // Sort by spread descending
    opportunities.sort((a, b) => b.spread - a.spread);
    return opportunities;
  }
}
