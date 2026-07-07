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

export default USDM_TOKEN;
