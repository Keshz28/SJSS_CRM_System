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

// Dark-theme-safe status badge classes (Dashdark X palette)
export function dxStatusColor(status: string) {
  switch (status) {
    case "DRAFT":
      return "bg-white/10 text-[#AEB9E1]";
    case "SENT":
      return "bg-[#00C2FF]/15 text-[#00C2FF]";
    case "ACCEPTED":
      return "bg-[#14CA74]/15 text-[#14CA74]";
    case "REJECTED":
      return "bg-[#FF5A65]/15 text-[#FF5A65]";
    default:
      return "bg-white/10 text-[#AEB9E1]";
  }
}

export function statusLabel(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}
