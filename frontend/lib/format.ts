/**
 * Formatting helpers used across the UI.
 */

import type {
  EscrowStatus,
  LedgerEntryType,
  OrderStatus,
} from "./api";

/** UGX with thousands separators and currency. */
export function ugx(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  return `UGX ${amount.toLocaleString("en-UG")}`;
}

export function num(amount: number): string {
  return amount.toLocaleString("en-UG");
}

export function timeOnly(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-UG", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-UG", {
    month: "short",
    day: "numeric",
  })}, ${d.toLocaleTimeString("en-UG", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })}`;
}

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

/** Status labels (sentence-case for the customer/seller) */
export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pending",
  awaiting_payment: "Awaiting payment",
  paid_into_escrow: "Funds secured",
  assigned: "Rider assigned",
  picked_up: "Picked up",
  delivering: "On the way",
  at_customer: "At your door",
  delivered: "Delivered",
  approved: "Approved",
  settled: "Settled",
  disputed: "Disputed",
  refunded: "Refunded",
  failed: "Failed",
};

export const STATUS_PILL_CLASS: Record<OrderStatus, string> = {
  pending: "pill-pending",
  awaiting_payment: "pill-awaiting",
  paid_into_escrow: "pill-paid",
  assigned: "pill-assigned",
  picked_up: "pill-pickedup",
  delivering: "pill-delivering",
  at_customer: "pill-atcustomer",
  delivered: "pill-delivered",
  approved: "pill-approved",
  settled: "pill-settled",
  disputed: "pill-disputed",
  refunded: "pill-refunded",
  failed: "pill-failed",
};

export const ESCROW_LABEL: Record<EscrowStatus, string> = {
  none: "Not yet paid",
  held: "Held in escrow",
  released: "Released",
  refunded: "Refunded",
  partial: "Partial",
};

export const LEDGER_LABEL: Record<LedgerEntryType, string> = {
  escrow_deposit: "Customer payment",
  escrow_release_seller: "Sale proceeds",
  escrow_release_rider: "Rider earnings",
  escrow_release_platform: "Platform fee",
  escrow_refund: "Customer refund",
  seller_wallet_topup: "Wallet top-up",
  seller_wallet_withdraw: "Withdrawal to MoMo",
  rider_wallet_withdraw: "Withdrawal to MoMo",
  penalty: "Return-delivery penalty",
};

/** + means money in for the seller, − money out, blank for transit-only entries. */
export function ledgerSign(type: LedgerEntryType): "+" | "−" | "" {
  switch (type) {
    case "seller_wallet_topup":
    case "escrow_release_seller":
      return "+";
    case "seller_wallet_withdraw":
    case "rider_wallet_withdraw":
    case "penalty":
    case "escrow_refund":
      return "−";
    default:
      return "";
  }
}

export function ledgerColor(type: LedgerEntryType): "credit" | "debit" | "neutral" {
  switch (type) {
    case "seller_wallet_topup":
    case "escrow_release_seller":
    case "escrow_release_rider":
      return "credit";
    case "seller_wallet_withdraw":
    case "rider_wallet_withdraw":
    case "penalty":
    case "escrow_refund":
      return "debit";
    default:
      return "neutral";
  }
}

/** Whether an order is "live" — moving through the flow, worth highlighting. */
export function isInFlight(status: OrderStatus): boolean {
  return [
    "awaiting_payment",
    "paid_into_escrow",
    "assigned",
    "picked_up",
    "delivering",
    "at_customer",
    "delivered",
  ].includes(status);
}

export function isTerminal(status: OrderStatus): boolean {
  return ["settled", "refunded", "failed"].includes(status);
}
