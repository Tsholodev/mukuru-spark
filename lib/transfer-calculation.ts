export type TransferAmounts = {
  amountMinor: number;
  feeMinor: number;
  destinationAmountMinor: number;
};

export function calculateTransferAmounts(
  amountMinor: number,
  exchangeRate: number,
  feeBasisPoints: number,
): TransferAmounts {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new Error("invalid_amount");
  if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) throw new Error("invalid_exchange_rate");
  if (!Number.isSafeInteger(feeBasisPoints) || feeBasisPoints < 0 || feeBasisPoints >= 10_000) {
    throw new Error("invalid_fee_configuration");
  }

  const feeMinor = Math.round((amountMinor * feeBasisPoints) / 10_000);
  const destinationAmountMinor = Math.floor((amountMinor - feeMinor) * exchangeRate);
  if (destinationAmountMinor <= 0) throw new Error("invalid_amount");
  return { amountMinor, feeMinor, destinationAmountMinor };
}