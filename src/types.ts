/**
 * Prometheus Vault — Type Definitions
 *
 * Core types for the autonomous yield optimization engine.
 * Covers strategies, positions, risk parameters, and decision logging.
 */

import Decimal from 'decimal.js';

// ─── Strategy Types ─────────────────────────────────────────────

export enum StrategyType {
  /** Kamino K-Lend supply (earn interest on deposited tokens) */
  KLEND = 'klend',
  /** Kamino Multiply (leveraged LST staking via flash loans) */
  MULTIPLY = 'multiply',
  /** Direct LST holding (baseline staking yield) */
  HOLD = 'hold',
}

export type RiskTolerance = 'conservative' | 'balanced' | 'aggressive';

// ─── Position Types ─────────────────────────────────────────────

/** A K-Lend supply position */
export interface KlendPosition {
  reserveAddress: string;
  token: string;
  tokenMint: string;
  depositedAmount: Decimal;
  valueUsd: Decimal;
  supplyApy: Decimal;
}

/** A Multiply (leveraged staking) position */
export interface MultiplyPosition {
  obligationAddress: string;
  marketAddress: string;
  collateralToken: string;
  collateralMint: string;
  debtToken: string;
  collateralAmount: Decimal;
  debtAmount: Decimal;
  netValueUsd: Decimal;
  leverage: Decimal;
  ltv: Decimal;
  maxLtv: Decimal;
  collateralApy: Decimal;
  borrowApy: Decimal;
  netApy: Decimal;
  strategy: StrategyType.MULTIPLY;
}

/** Generic yield opportunity from any protocol */
export interface YieldOpportunity {
  protocol: string;
  pool: string;
  type: 'lending' | 'leverage' | 'staking';
  token: string;
  apy: number;
  apyBase: number;
  apyReward: number;
  tvlUsd: number;
  risk: 'low' | 'medium' | 'high';
  url: string;
  notes: string;
}

// ─── Vault State ────────────────────────────────────────────────

/** Complete snapshot of the vault's state at a point in time */
export interface VaultSnapshot {
  timestamp: Date;
  totalValueUsd: Decimal;
  solBalance: Decimal;
  positions: {
    klend: KlendPosition[];
    multiply: MultiplyPosition[];
  };
  blendedApy: Decimal;
  solPrice: Decimal;
}

// ─── Decision Types ─────────────────────────────────────────────

export type DecisionAction =
  | 'hold'
  | 'deposit_klend'
  | 'withdraw_klend'
  | 'open_multiply'
  | 'close_multiply'
  | 'adjust_leverage'
  | 'swap'
  | 'rebalance';

/** A logged decision with full reasoning */
export interface Decision {
  id: string;
  timestamp: Date;
  action: DecisionAction;
  reasoning: string;
  inputs: {
    currentApy: number;
    targetApy: number;
    riskScore: number;
    marketCondition: string;
  };
  params: Record<string, any>;
  outcome?: DecisionOutcome;
}

/** Outcome of an executed decision */
export interface DecisionOutcome {
  success: boolean;
  txSignature: string | null;
  error?: string;
  valueBeforeUsd: number;
  valueAfterUsd: number;
  apyBefore: number;
  apyAfter: number;
  timestamp: Date;
}

// ─── Configuration ──────────────────────────────────────────────

export interface VaultConfig {
  /** Solana RPC endpoint */
  rpcUrl: string;
  /** Wallet public key (never store private keys in config) */
  walletPath: string;
  /** Run in simulation mode */
  dryRun: boolean;
  /** Risk tolerance level */
  riskTolerance: RiskTolerance;
  /** OODA loop interval in milliseconds */
  loopIntervalMs: number;
  /** Risk management parameters */
  risk: RiskConfig;
  /** Jupiter swap settings */
  jupiter: JupiterConfig;
  /** Multiply strategy settings */
  multiply: MultiplyConfig;
}

export interface RiskConfig {
  /** Maximum portion of portfolio in any single position (0-1) */
  maxPositionPct: number;
  /** Maximum allowed leverage */
  maxLeverage: number;
  /** Maximum LTV before triggering deleveraging (0-1) */
  maxLtv: number;
  /** SOL reserved for gas fees (never deployed) */
  gasReserveSol: number;
  /** Maximum slippage tolerance in bps */
  maxSlippageBps: number;
  /** Daily loss threshold to trigger circuit breaker (% of portfolio) */
  dailyLossCircuitBreakerPct: number;
  /** Minimum APY improvement required to justify a rebalance */
  minApyImprovementPct: number;
  /** Maximum acceptable break-even period in days */
  maxBreakEvenDays: number;
}

export interface JupiterConfig {
  slippageBps: number;
  preferDirect: boolean;
  maxAccounts: number;
}

export interface MultiplyConfig {
  maxLeverage: number;
  /** Minimum spread (staking APY - borrow APY) to open a position */
  minSpreadPct: number;
  /** LTV threshold for warnings */
  alertLtv: number;
  preferredMarket: string;
}

// ─── Token Constants ────────────────────────────────────────────

export const TOKEN_MINTS: Record<string, string> = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  JitoSOL: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',
  mSOL: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
  bSOL: 'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1',
  JupSOL: 'jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v',
  pSOL: 'pSo1f9nQXWgXibFtKf7NWYxb5enAM4qfP6UJSiXRQfL',
  bnSOL: 'BNso1VUJnh4zcfpZa6986Ea66P6TCp59hvtNJ8b1X85',
  bbSOL: 'Bybit2vBJGhPF52GBdNaQ9UiEYtKEx3SWgEpXvGNbMSq',
  hubSOL: 'HUBsveNpjo5pWqNkH57QzxjQASdTVXcSK7bVKTSZtB3X',
};

export const TOKEN_DECIMALS: Record<string, number> = {
  SOL: 9,
  USDC: 6,
  JitoSOL: 9,
  mSOL: 9,
  bSOL: 9,
  JupSOL: 9,
  pSOL: 9,
  bnSOL: 9,
  bbSOL: 9,
  hubSOL: 9,
};

export const KAMINO_MARKETS = {
  MAIN: '7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF',
  JITO: 'DxXdAyU3kCjnyggvHmY5nAwg5cRbbmdyX3npfDMjjMek',
  ALTCOINS: 'ByYiZxp8QrdN9qbdtaAiePN8AAr3qvTPppNJDpf5DVJ5',
};

// ─── Default Configuration ──────────────────────────────────────

export const DEFAULT_CONFIG: VaultConfig = {
  rpcUrl: 'https://api.mainnet-beta.solana.com',
  walletPath: './config/wallet.json',
  dryRun: true,
  riskTolerance: 'balanced',
  loopIntervalMs: 2 * 60 * 60 * 1000, // 2 hours
  risk: {
    maxPositionPct: 0.50,
    maxLeverage: 3.0,
    maxLtv: 0.80,
    gasReserveSol: 0.05,
    maxSlippageBps: 100,
    dailyLossCircuitBreakerPct: 5.0,
    minApyImprovementPct: 1.0,
    maxBreakEvenDays: 7,
  },
  jupiter: {
    slippageBps: 50,
    preferDirect: false,
    maxAccounts: 64,
  },
  multiply: {
    maxLeverage: 3.0,
    minSpreadPct: 1.0,
    alertLtv: 0.80,
    preferredMarket: KAMINO_MARKETS.JITO,
  },
};
