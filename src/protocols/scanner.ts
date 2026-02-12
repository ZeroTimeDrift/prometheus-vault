/**
 * Multi-Protocol Yield Scanner
 *
 * Scans yield opportunities across the entire Solana DeFi ecosystem:
 * - Kamino K-Lend (multiple markets)
 * - Kamino Multiply (leveraged LST staking)
 * - Marginfi, Drift, Solend (via DeFi Llama)
 * - LST staking yields (via Sanctum)
 *
 * Uses DeFi Llama's yield aggregator API as the primary data source
 * for cross-protocol comparison, supplemented by direct Kamino API
 * calls for more detailed reserve data.
 *
 * Run standalone: npx ts-node src/protocols/scanner.ts
 */

import Decimal from 'decimal.js';
import { YieldOpportunity, TOKEN_MINTS, KAMINO_MARKETS } from '../types';
import { KaminoClient, fetchJitoStakingApy, fetchLstApys } from './kamino';

// ─── DeFi Llama Integration ─────────────────────────────────────

const DEFILLAMA_API = 'https://yields.llama.fi/pools';

interface DefiLlamaPool {
  chain: string;
  project: string;
  symbol: string;
  pool: string;
  apy: number;
  apyBase: number;
  apyReward: number;
  tvlUsd: number;
  exposure?: string;
  il7d?: number;
  predictions?: {
    predictedClass: string;
    predictedProbability: number;
  };
}

// Risk assessment based on protocol track record and audit status
const PROTOCOL_RISK: Record<string, 'low' | 'medium' | 'high'> = {
  'kamino-lending': 'low',
  'kamino-clmm': 'low',
  'solend': 'low',
  'marginfi': 'medium',
  'drift': 'medium',
  'meteora': 'medium',
  'raydium': 'low',
  'orca': 'low',
  'marinade-finance': 'low',
  'jito': 'low',
};

const PROTOCOL_URLS: Record<string, string> = {
  'kamino-lending': 'https://app.kamino.finance/lending',
  'kamino-clmm': 'https://app.kamino.finance/liquidity',
  'solend': 'https://solend.fi/dashboard',
  'marginfi': 'https://app.marginfi.com/',
  'drift': 'https://app.drift.trade/',
  'meteora': 'https://app.meteora.ag/vaults',
  'raydium': 'https://raydium.io/clmm/',
  'orca': 'https://www.orca.so/pools',
  'marinade-finance': 'https://marinade.finance/',
  'jito': 'https://stake.jito.network/',
};

// Tokens we're interested in for yield farming
const TARGET_TOKENS = new Set([
  'SOL', 'USDC', 'USDT', 'JITOSOL', 'MSOL', 'BSOL', 'JUPSOL',
  'JITOSOL-SOL', 'SOL-USDC', 'PSOL',
]);

/**
 * Scan all Solana DeFi protocols via DeFi Llama.
 * Returns normalized yield opportunities sorted by APY.
 */
export async function scanAllProtocols(): Promise<YieldOpportunity[]> {
  console.log('🔍 Scanning Solana DeFi ecosystem via DeFi Llama...');

  const res = await fetch(DEFILLAMA_API);
  if (!res.ok) throw new Error(`DeFi Llama API error: ${res.status}`);
  const data = (await res.json()) as { data: DefiLlamaPool[] };

  // Filter for Solana pools with our target tokens
  const solanaPools = data.data.filter(p => {
    if (p.chain !== 'Solana') return false;
    if (p.tvlUsd < 100_000) return false; // Skip tiny pools
    const symbol = p.symbol.toUpperCase();
    return TARGET_TOKENS.has(symbol) || symbol.includes('SOL') || symbol.includes('USDC');
  });

  const opportunities: YieldOpportunity[] = solanaPools.map(p => ({
    protocol: p.project,
    pool: `${p.symbol} (${p.project})`,
    type: p.project.includes('lend') || p.project.includes('marginfi') || p.project.includes('solend')
      ? 'lending' as const
      : p.project.includes('jito') || p.project.includes('marinade')
      ? 'staking' as const
      : 'lending' as const,
    token: p.symbol.split('-')[0],
    apy: p.apy || 0,
    apyBase: p.apyBase || 0,
    apyReward: p.apyReward || 0,
    tvlUsd: p.tvlUsd,
    risk: PROTOCOL_RISK[p.project] || 'medium',
    url: PROTOCOL_URLS[p.project] || '',
    notes: p.il7d ? `IL 7d: ${p.il7d.toFixed(2)}%` : '',
  }));

  // Sort by APY descending
  opportunities.sort((a, b) => b.apy - a.apy);

  console.log(`   Found ${opportunities.length} Solana yield opportunities`);
  return opportunities;
}

/**
 * Scan Kamino-specific rates with detailed market data.
 * More granular than DeFi Llama — includes per-reserve and multiply data.
 */
export async function scanKaminoRates(kaminoClient: KaminoClient): Promise<{
  supplyRates: YieldOpportunity[];
  multiplyRates: YieldOpportunity[];
}> {
  console.log('🔍 Scanning Kamino rates across all markets...');

  // Get supply rates
  const topRates = await kaminoClient.getTopSupplyRates(15);
  const supplyRates: YieldOpportunity[] = topRates.map(r => ({
    protocol: 'kamino',
    pool: `K-Lend ${r.liquidityToken} Supply`,
    type: 'lending' as const,
    token: r.liquidityToken,
    apy: r.supplyApy,
    apyBase: r.supplyApy,
    apyReward: 0,
    tvlUsd: r.totalSupplyUsd,
    risk: 'low' as const,
    url: 'https://app.kamino.finance/lending',
    notes: `Borrow APY: ${r.borrowApy.toFixed(2)}%`,
  }));

  // Get multiply opportunities
  const multiplyOpps = await kaminoClient.scanMultiplyOpportunities();
  const multiplyRates: YieldOpportunity[] = multiplyOpps.slice(0, 10).map(m => ({
    protocol: 'kamino',
    pool: `Multiply ${m.collateral}/${m.debt} (${m.market})`,
    type: 'leverage' as const,
    token: m.collateral,
    apy: m.netApyAt2x,
    apyBase: m.stakingApy,
    apyReward: 0,
    tvlUsd: 0,
    risk: 'medium' as const,
    url: 'https://app.kamino.finance/lending/multiply',
    notes: `Spread: ${m.spread.toFixed(2)}% | 3x: ${m.netApyAt3x.toFixed(2)}% | Max LTV: ${(m.maxLtv * 100).toFixed(0)}%`,
  }));

  return { supplyRates, multiplyRates };
}

/**
 * Get a comprehensive yield landscape combining all sources.
 */
export async function getYieldLandscape(kaminoClient: KaminoClient): Promise<{
  allOpportunities: YieldOpportunity[];
  bestLending: YieldOpportunity | null;
  bestMultiply: YieldOpportunity | null;
  jitoStakingApy: number;
}> {
  const [defiLlama, kamino, jitoApy] = await Promise.all([
    scanAllProtocols().catch(() => [] as YieldOpportunity[]),
    scanKaminoRates(kaminoClient),
    fetchJitoStakingApy(),
  ]);

  const allOpportunities = [
    ...kamino.supplyRates,
    ...kamino.multiplyRates,
    ...defiLlama,
  ].sort((a, b) => b.apy - a.apy);

  // Deduplicate by pool name (prefer Kamino direct over DeFi Llama)
  const seen = new Set<string>();
  const unique = allOpportunities.filter(o => {
    const key = `${o.protocol}-${o.token}-${o.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    allOpportunities: unique,
    bestLending: kamino.supplyRates[0] || null,
    bestMultiply: kamino.multiplyRates[0] || null,
    jitoStakingApy: jitoApy,
  };
}

// ─── Standalone Runner ──────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('     🔭 PROMETHEUS YIELD SCANNER — Multi-Protocol');
  console.log(`     ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  const kaminoClient = new KaminoClient('https://api.mainnet-beta.solana.com');

  const landscape = await getYieldLandscape(kaminoClient);

  console.log('\n┌────────────────────────────────────────────────────────────────────┐');
  console.log('│                    📊 TOP YIELD OPPORTUNITIES                       │');
  console.log('├──────────────┬────────────────────────────────────┬─────────┬───────┤');
  console.log('│   Protocol   │              Pool                  │   APY   │ Risk  │');
  console.log('├──────────────┼────────────────────────────────────┼─────────┼───────┤');

  for (const opp of landscape.allOpportunities.slice(0, 20)) {
    const proto = opp.protocol.padEnd(12).slice(0, 12);
    const pool = opp.pool.padEnd(34).slice(0, 34);
    const apy = `${opp.apy.toFixed(2)}%`.padStart(7);
    const risk = opp.risk.padEnd(5);
    console.log(`│ ${proto} │ ${pool} │ ${apy} │ ${risk} │`);
  }

  console.log('└──────────────┴────────────────────────────────────┴─────────┴───────┘');
  console.log(`\n📊 JitoSOL staking APY: ${landscape.jitoStakingApy.toFixed(2)}%`);
  console.log(`📊 Total opportunities scanned: ${landscape.allOpportunities.length}`);

  if (landscape.bestLending) {
    console.log(`\n🏆 Best lending: ${landscape.bestLending.pool} @ ${landscape.bestLending.apy.toFixed(2)}%`);
  }
  if (landscape.bestMultiply) {
    console.log(`🏆 Best multiply: ${landscape.bestMultiply.pool} @ ${landscape.bestMultiply.apy.toFixed(2)}%`);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
