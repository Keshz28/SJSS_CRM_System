import { test, expect } from "@playwright/test";
import { previewLineTotal, previewQuotationTotal } from "../lib/quotation-preview";
import { lineTotal, quotationTotal } from "../lib/quotation-schema";

test("editable quotation previews match saved decimal line rounding and totals", () => {
  for (const [quantity, unitPrice, expected] of [[0.1, 0.05, 0.01], [0.35, 0.7, 0.25], [1.05, 10.1, 10.61], [1000.04, 0.25, 250.01], [1, 9999999999.99, 9999999999.99]]) {
    expect(previewLineTotal(quantity, unitPrice)).toBe(expected);
    expect(Number(lineTotal({ quantity, unitPrice }))).toBe(expected);
  }
  const items = [{ quantity: 0.1, unitPrice: 0.05 }, { quantity: 0.1, unitPrice: 0.05 }];
  expect(previewQuotationTotal(items)).toBe(0.02);
  expect(Number(quotationTotal(items))).toBe(0.02);
});
