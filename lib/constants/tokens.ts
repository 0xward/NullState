/**
 * Token Configuration
 * USDm (Mento Dollar) - Official Celo Mainnet Token
 * Formerly known as cUSD
 */

export const USDM_TOKEN = {
  name: 'USDm',
  symbol: 'USDm',
  fullName: 'Mento Dollar',
  description: 'Official stablecoin on Celo network',
  
  // Contract Details
  address: '0x765DE816845861e75A25fCA122bb6898B8B1282a',
  decimals: 18,
  
  // Logo & Branding - Official Mento/Celo logo
  logo: 'https://token-logos-static.s3.amazonaws.com/USDm.png',
  logoFallback: '/assets/tokens/usdm-logo.png', // Local fallback if API fails
  
  // Network
  chainId: 42220, // Celo Mainnet
  chainName: 'Celo Mainnet',
  
  // Verification
  verified: true,
  source: 'https://docs.celo.org/tooling/contracts/token-contracts',
  historicalName: 'cUSD (Celo Dollar)',
  migratedTo: 'USDm (Mento Dollar)',
} as const;

/**
 * Format USDm amount for display
 * @param amount - Amount in smallest unit (wei)
 * @param decimals - Decimal places to show (default: 2)
 */
export function formatUSDm(amount: bigint | number, decimals: number = 2): string {
  const numAmount = typeof amount === 'bigint' ? Number(amount) : amount;
  const actualDecimals = USDM_TOKEN.decimals;
  const divisor = Math.pow(10, actualDecimals);
  const value = numAmount / divisor;
  
  return `${value.toFixed(decimals)} USDm`;
}

/**
 * Parse USDm string to smallest unit (wei)
 * @param amount - Amount in USDm (e.g., "1.5")
 */
export function parseUSDm(amount: string): bigint {
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount)) throw new Error('Invalid USDm amount');
  
  const actualDecimals = USDM_TOKEN.decimals;
  const multiplier = Math.pow(10, actualDecimals);
  
  return BigInt(Math.floor(numAmount * multiplier));
}

/**
 * Parse USDm wei to human-readable format
 */
export function parseUSDmReadable(amountInWei: bigint | number): number {
  const numAmount = typeof amountInWei === 'bigint' ? Number(amountInWei) : amountInWei;
  const actualDecimals = USDM_TOKEN.decimals;
  const divisor = Math.pow(10, actualDecimals);
  
  return numAmount / divisor;
}

/**
 * Marketplace-accepted stablecoins on Celo Mainnet (42220).
 * All purchases are a plain ERC20 transfer() to the treasury wallet — no
 * smart contract required (confirmed by MiniPay docs). NOTE the decimals:
 * USDC/USDT are 6, USDm is 18 — always use parseUnits(amount, decimals).
 */
export const TREASURY_WALLET = '0xAb73e0E942ecAAF634216EFb78786fa0F92f2eb6' as const;

// `feeCurrency` (CIP-64 Celo Dynamic Fee v2) lets a MiniPay user pay gas in a
// stablecoin instead of native CELO. Per docs.minipay.xyz/technical-references/
// send-transaction.html, SOME tokens need a separate "fee adapter" contract
// address instead of the token address itself — using the raw token address
// as feeCurrency for an adapter-token is WRONG and MiniPay will reject/ignore
// it. `feeCurrency` below is the address to actually pass; for adapter-less
// tokens (USDm) it's identical to `address`.
export const MARKETPLACE_TOKENS = {
  USDm: { symbol: 'USDm', address: '0x765DE816845861e75A25fCA122bb6898B8B1282a', decimals: 18, feeCurrency: '0x765DE816845861e75A25fCA122bb6898B8B1282a' },
  USDC: { symbol: 'USDC', address: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C', decimals: 6,  feeCurrency: '0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B' }, // USDC fee ADAPTER, not the USDC token address
  USDT: { symbol: 'USDT', address: '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e', decimals: 6,  feeCurrency: '0x0E2A3e05bc9A16F5292A6170456A710cb89C6f72' }, // USD₮ fee ADAPTER, not the USDT token address
} as const;

export type MarketplaceTokenSymbol = keyof typeof MARKETPLACE_TOKENS;

/**
 * Default feeCurrency to attach to non-marketplace transactions (contract
 * writes paid in native CELO, e.g. register()/executeAction()/mintFreePass()).
 * MiniPay users mostly hold stablecoins, not CELO, so letting them pay GAS in
 * USDm (even when the tx `value`/payload is native CELO or a different token)
 * avoids "insufficient funds for gas" when their CELO balance is wafer-thin.
 * MiniPay "may ignore feeCurrency and choose the token the user has the most
 * of" (per docs) — this is a best-effort hint, not a guarantee, and passing it
 * is documented as correct behavior for a MiniPay submission either way.
 */
export const DEFAULT_FEE_CURRENCY = '0x765DE816845861e75A25fCA122bb6898B8B1282a' as `0x${string}`; // USDm, no adapter needed

/** Look up the correct feeCurrency address for a marketplace token symbol. */
export function getFeeCurrency(symbol: MarketplaceTokenSymbol): `0x${string}` {
  return MARKETPLACE_TOKENS[symbol].feeCurrency as `0x${string}`;
}

/** Parse a human amount (e.g. "2.5") into smallest units for a given token. */
export function parseTokenAmount(amount: string, symbol: MarketplaceTokenSymbol): bigint {
  const num = parseFloat(amount);
  if (isNaN(num)) throw new Error('Invalid token amount');
  const decimals = MARKETPLACE_TOKENS[symbol].decimals;
  // Avoid float precision loss for 18-decimal tokens by scaling via string.
  const [whole, frac = ''] = num.toFixed(decimals).split('.');
  const fracPadded = (frac + '0'.repeat(decimals)).slice(0, decimals);
  return BigInt(whole + fracPadded);
}

export default USDM_TOKEN;
