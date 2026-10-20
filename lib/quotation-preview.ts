// Browser preview: quantity and price each have two decimal places. Integer
// arithmetic rounds each line before summing, matching server decimal totals.
function lineCents(quantity: number, unitPrice: number) {
  if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice) || quantity < 0 || unitPrice < 0 || quantity > 99_999_999.99 || unitPrice > 9_999_999_999.99) return BigInt(0);
  const quantityHundredths = BigInt(quantity.toFixed(2).replace(".", ""));
  const priceCents = BigInt(unitPrice.toFixed(2).replace(".", ""));
  return (quantityHundredths * priceCents + BigInt(50)) / BigInt(100);
}
export function previewLineTotal(quantity: number, unitPrice: number) {
  return Number(lineCents(quantity, unitPrice)) / 100;
}
export function previewQuotationTotal(items: { quantity: number; unitPrice: number }[]) {
  return Number(items.reduce((sum, item) => sum + lineCents(item.quantity, item.unitPrice), BigInt(0))) / 100;
}
