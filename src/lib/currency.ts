// USD → PKR conversion helpers.
// Rate is a constant so pricing stays deterministic offline; bump it here
// (or wire to an admin setting) when the exchange rate shifts materially.
export const USD_TO_PKR = 280;

export const usdToPkr = (usd: number): number =>
  Math.round((Number(usd) || 0) * USD_TO_PKR);

const pkrFormatter = new Intl.NumberFormat('en-PK', {
  maximumFractionDigits: 0,
});

export const formatPkr = (usd: number): string =>
  `Rs ${pkrFormatter.format(usdToPkr(usd))}`;

export const formatUsdWithPkr = (usd: number): string =>
  `$${usd} (≈ ${formatPkr(usd)})`;
