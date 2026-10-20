export function positiveInteger(value: string | null | undefined, fallback: number, maximum = 1_000_000) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? Math.min(number, maximum) : fallback;
}

export const quotationStatuses = ["DRAFT", "SENT", "ACCEPTED", "REJECTED"] as const;
export function quotationStatus(value?: string | null) {
  return quotationStatuses.includes(value as typeof quotationStatuses[number])
    ? value as typeof quotationStatuses[number] : undefined;
}
