import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string) {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 2,
  }).format(num);
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function statusColor(status: string) {
  switch (status) {
    case "DRAFT":
      return "bg-gray-100 text-gray-600";
    case "SENT":
      return "bg-blue-100 text-blue-700";
    case "ACCEPTED":
      return "bg-green-100 text-green-700";
    case "REJECTED":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

// Status colours remain legible in both light and dark mode.
export function dxStatusColor(status: string) {
  switch (status) {
    case "DRAFT":
      return "bg-dx-line/30 text-dx-ink-muted";
    case "SENT":
      return "bg-dx-accent/10 text-dx-accent";
    case "ACCEPTED":
      return "bg-dx-success/10 text-dx-success";
    case "REJECTED":
      return "bg-dx-danger/10 text-dx-danger";
    default:
      return "bg-dx-line/30 text-dx-ink-muted";
  }
}

export function statusLabel(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}
