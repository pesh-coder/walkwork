/**
 * Formatting helpers used across the UI.
 */

import type { OrderStatus, PaymentMode, LedgerEntryType } from "./api";

/** Format UGX with thousands separators and currency. */
export function ugx(amount: number): string {
  if (amount === null || amount === undefined) return "—";
  return `UGX ${amount.toLocaleString("en-UG")}`;
}

/** Short numeric form: 85,000 (no UGX prefix). */
export function num(amount: number): string {
  return amount.toLocaleString("en-UG");
}

/** Time only: 2:43 PM */
export function timeOnly(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-UG", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Date and time: Apr 29, 2:43 PM */
export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-UG", { month: "short", day: "numeric" })}, ${d.toLocaleTimeString("en-UG", { hour: "numeric", minute: "2-digit", hour12: true })}`;
}

/** Relative time: "2 minutes ago" */
export function relTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

/** Friendly status labels. */
export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pending",
  assigned: "Rider assigned",
  picked_up: "Picked up",
  delivering: "On the way",
  otp_pending: "Awaiting OTP",
  delivered: "Delivered",
  settled: "Settled",
  failed: "Failed",
};

export const STATUS_PILL_CLASS: Record<OrderStatus, string> = {
  pending: "pill-pending",
  assigned: "pill-assigned",
  picked_up: "pill-pickedup",
  delivering: "pill-delivering",
  otp_pending: "pill-otp",
  delivered: "pill-delivered",
  settled: "pill-settled",
  failed: "pill-failed",
};

export const PAYMENT_LABEL: Record<PaymentMode, string> = {
  momo: "Mobile Money",
  cod: "Cash on Delivery",
};

export const LEDGER_LABEL: Record<LedgerEntryType, string> = {
  seller_wallet_topup: "Wallet top-up",
  platform_fee: "Delivery fee",
  rider_earning: "Rider payout",
  cod_collected: "Cash collected",
  cod_deposited: "Cash deposited to MoMo",
  seller_payout: "Paid to your wallet",
  refund: "Refund",
};

/** Sign for ledger display: + means money in for the seller. */
export function ledgerSign(type: LedgerEntryType): "+" | "-" | "" {
  switch (type) {
    case "seller_wallet_topup":
    case "seller_payout":
      return "+";
    case "platform_fee":
    case "refund":
      return "-";
    case "cod_collected":
    case "cod_deposited":
      return "";
    default:
      return "";
  }
}

/** Color hint for ledger row. */
export function ledgerColor(type: LedgerEntryType): "credit" | "debit" | "neutral" {
  switch (type) {
    case "seller_wallet_topup":
    case "seller_payout":
      return "credit";
    case "platform_fee":
    case "refund":
      return "debit";
    default:
      return "neutral";
  }
}
