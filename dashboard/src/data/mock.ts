export const WALLET_ADDRESS = '7u5ovFNms7oE232TTyMU5TxDfyZTJctihH4YqP2n1EUz';

export const portfolioStats = {
  totalValue: 199.42,
  currentAPY: 8.1,
  activeStrategy: 'pSOL/SOL Multiply 1.50x',
  totalTransactions: 83,
  successfulTransactions: 75,
  daysActive: 10,
  solBalance: 0.34,
};

export const oodaSteps = [
  {
    id: 'observe',
    label: 'OBSERVE',
    description: 'Scan on-chain rates across Kamino, Marinade, Jito, and lending protocols every 2 hours',
    icon: '👁',
    active: false,
  },
  {
    id: 'orient',
    label: 'ORIENT',
    description: 'Analyze rate differentials, gas costs, position health, and risk exposure',
    icon: '🧭',
    active: false,
  },
  {
    id: 'decide',
    label: 'DECIDE',
    description: 'Compare expected yield vs transaction cost; determine optimal position adjustment',
    icon: '⚡',
    active: true,
  },
  {
    id: 'act',
    label: 'ACT',
    description: 'Execute rebalance: unwind, swap, or open positions via Kamino SDK + Jupiter',
    icon: '🎯',
    active: false,
  },
];

export const performanceData = [
  { date: 'Feb 2', value: 200.00, label: 'Initial Deposit' },
  { date: 'Feb 3', value: 199.85, label: '' },
  { date: 'Feb 4', value: 199.21, label: 'Gas costs' },
  { date: 'Feb 5', value: 198.64, label: '' },
  { date: 'Feb 6', value: 197.90, label: 'Strategy switch' },
  { date: 'Feb 7', value: 198.35, label: '' },
  { date: 'Feb 8', value: 198.72, label: '' },
  { date: 'Feb 9', value: 199.10, label: 'Yield accrual' },
  { date: 'Feb 10', value: 199.48, label: '' },
  { date: 'Feb 11', value: 199.15, label: 'Rebalance' },
  { date: 'Feb 12', value: 199.42, label: 'Current' },
];

export const decisions = [
  {
    time: 'Feb 12, 14:30',
    action: 'Held position',
    reasoning: 'Rates stable across protocols. No rebalance needed — estimated gas cost ($0.12) exceeds expected gain ($0.04)',
    status: 'success' as const,
    txHash: null,
  },
  {
    time: 'Feb 12, 12:30',
    action: 'Held position',
    reasoning: 'pSOL/SOL Multiply APY steady at 8.1%. Next best alternative (JitoSOL stake) at 5.6% — spread insufficient to justify switch',
    status: 'success' as const,
    txHash: null,
  },
  {
    time: 'Feb 11, 22:30',
    action: 'Rebalanced collateral',
    reasoning: 'Health factor drifted to 1.35. Added 0.02 SOL collateral to restore 1.50x target leverage',
    status: 'success' as const,
    txHash: '4xK9mZ...7pQr',
  },
  {
    time: 'Feb 11, 08:30',
    action: 'Opened pSOL/SOL 1.50x Multiply',
    reasoning: 'KLend supply rate dropped to 4.2%. Multiply position yields 8.1% — 390bps spread justifies gas + risk',
    status: 'success' as const,
    txHash: '2hNv8R...mY3x',
  },
  {
    time: 'Feb 10, 16:30',
    action: 'Unwound JitoSOL LP',
    reasoning: 'Kamino S5 incentive program ended. Base APY dropped from 11.2% to 5.6% — below KLend supply rate',
    status: 'success' as const,
    txHash: '9fWq2L...kR8v',
  },
  {
    time: 'Feb 9, 20:30',
    action: 'Held position',
    reasoning: 'JitoSOL LP still earning 11.2% with S5 incentives. No better opportunity found',
    status: 'success' as const,
    txHash: null,
  },
  {
    time: 'Feb 8, 10:30',
    action: 'Failed: Swap timeout',
    reasoning: 'Attempted SOL→JitoSOL swap via Jupiter. RPC timeout after 30s — will retry next cycle',
    status: 'failed' as const,
    txHash: '7bPm4X...nQ1w',
  },
  {
    time: 'Feb 7, 14:30',
    action: 'Entered JitoSOL LP on Kamino',
    reasoning: 'Kamino Season 5 launched with 3x point boost. Estimated effective APY: 11.2% including incentives',
    status: 'success' as const,
    txHash: '5cRt9N...hV6j',
  },
];

export const protocolRates = [
  {
    protocol: 'Kamino Multiply',
    asset: 'pSOL/SOL 1.50x',
    apy: 8.1,
    active: true,
    risk: 'Medium',
  },
  {
    protocol: 'JitoSOL Staking',
    asset: 'JitoSOL',
    apy: 5.6,
    active: false,
    risk: 'Low',
  },
  {
    protocol: 'Kamino KLend',
    asset: 'SOL Supply',
    apy: 4.2,
    active: false,
    risk: 'Low',
  },
  {
    protocol: 'Marinade',
    asset: 'mSOL Staking',
    apy: 6.8,
    active: false,
    risk: 'Low',
  },
  {
    protocol: 'Kamino Vault',
    asset: 'USDC-SOL LP',
    apy: 12.4,
    active: false,
    risk: 'High',
  },
  {
    protocol: 'Drift',
    asset: 'SOL Perp Funding',
    apy: 3.1,
    active: false,
    risk: 'High',
  },
];

export const riskParameters = [
  { label: 'Max Single Position', value: '25%', description: 'Maximum portfolio allocation to one position' },
  { label: 'Max Slippage', value: '1.0%', description: 'Maximum acceptable slippage per swap' },
  { label: 'Circuit Breaker', value: '5% daily loss', description: 'Halt all trading if daily loss exceeds threshold' },
  { label: 'Gas Reserve', value: '0.1 SOL', description: 'Minimum SOL balance reserved for transaction fees' },
  { label: 'Min Rate Spread', value: '200 bps', description: 'Minimum APY improvement to trigger rebalance' },
  { label: 'Rebalance Cooldown', value: '2 hours', description: 'Minimum time between position changes' },
];
