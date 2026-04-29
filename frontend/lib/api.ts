/**
 * API client for the Tukole backend.
 *
 * We intentionally keep this thin — no fancy SDK, no React Query.
 * Just typed fetch wrappers that throw on error and return JSON.
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

// -----------------------------------------------------------------------------
// Types (mirror the Pydantic schemas)
// -----------------------------------------------------------------------------
export type OrderStatus =
  | "pending"
  | "assigned"
  | "picked_up"
  | "delivering"
  | "otp_pending"
  | "delivered"
  | "settled"
  | "failed";

export type PaymentMode = "momo" | "cod";
export type CashStatus =
  | "not_applicable"
  | "awaiting_collection"
  | "collected"
  | "deposited"
  | "disputed";

export type LedgerEntryType =
  | "seller_wallet_topup"
  | "platform_fee"
  | "rider_earning"
  | "cod_collected"
  | "cod_deposited"
  | "seller_payout"
  | "refund";

export interface Seller {
  id: string;
  business_name: string;
  owner_name: string;
  phone: string;
  location_area?: string | null;
  wallet_balance_ugx: number;
  created_at: string;
}

export interface Rider {
  id: string;
  full_name: string;
  phone: string;
  plate_number?: string | null;
  stage?: string | null;
  photo_url?: string | null;
  is_available: boolean;
  current_lat?: number | null;
  current_lng?: number | null;
  cash_float_ugx: number;
}

export interface Order {
  id: string;
  short_code: string;
  seller_id: string;
  rider_id?: string | null;
  customer_name: string;
  customer_phone: string;
  customer_area: string;
  customer_address_notes?: string | null;
  customer_lat?: number | null;
  customer_lng?: number | null;
  pickup_area?: string | null;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  item_description: string;
  item_value_ugx: number;
  payment_mode: PaymentMode;
  cash_status: CashStatus;
  status: OrderStatus;
  failure_reason?: string | null;
  created_at: string;
  assigned_at?: string | null;
  picked_up_at?: string | null;
  delivered_at?: string | null;
  settled_at?: string | null;
}

export interface OrderTrack {
  short_code: string;
  status: OrderStatus;
  rider_name?: string | null;
  rider_phone?: string | null;
  rider_plate?: string | null;
  rider_lat?: number | null;
  rider_lng?: number | null;
  customer_lat?: number | null;
  customer_lng?: number | null;
  item_description: string;
  estimated_minutes?: number | null;
}

export interface LedgerEntry {
  id: string;
  entry_type: LedgerEntryType;
  amount_ugx: number;
  description: string;
  order_id?: string | null;
  external_ref?: string | null;
  created_at: string;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = await res.json();
      detail = j.detail || JSON.stringify(j);
    } catch {
      /* ignore */
    }
    throw new Error(`${res.status}: ${detail}`);
  }
  // Some endpoints return text/plain (e.g. /whatsapp/inbound)
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res.text() as unknown as T;
}

// -----------------------------------------------------------------------------
// Sellers
// -----------------------------------------------------------------------------
export const sellersApi = {
  get: (id: string) => request<Seller>(`/sellers/${id}`),
  topup: (id: string, amount_ugx: number) =>
    request<Seller>(`/sellers/${id}/wallet`, {
      method: "POST",
      body: JSON.stringify({ amount_ugx }),
    }),
  orders: (id: string) => request<Order[]>(`/sellers/${id}/orders`),
  ledger: (id: string) => request<LedgerEntry[]>(`/sellers/${id}/ledger`),
};

// -----------------------------------------------------------------------------
// Riders
// -----------------------------------------------------------------------------
export const ridersApi = {
  get: (id: string) => request<Rider>(`/riders/${id}`),
  jobs: (id: string) => request<Order[]>(`/riders/${id}/jobs`),
  earnings: (id: string) => request<LedgerEntry[]>(`/riders/${id}/earnings`),
  updateLocation: (id: string, lat: number, lng: number) =>
    request<Rider>(`/riders/${id}/location`, {
      method: "POST",
      body: JSON.stringify({ lat, lng }),
    }),
};

// -----------------------------------------------------------------------------
// Orders
// -----------------------------------------------------------------------------
export const ordersApi = {
  get: (id: string) => request<Order>(`/orders/${id}`),
  track: (shortCode: string) =>
    request<OrderTrack>(`/track/${shortCode}`),
  pickedUp: (id: string) =>
    request<Order>(`/orders/${id}/picked-up`, { method: "POST" }),
  startDelivery: (id: string) =>
    request<Order>(`/orders/${id}/start-delivery`, { method: "POST" }),
  arrived: (id: string) =>
    request<Order>(`/orders/${id}/arrived`, { method: "POST" }),
  verifyOtp: (id: string, otp_code: string) =>
    request<Order>(`/orders/${id}/verify-otp`, {
      method: "POST",
      body: JSON.stringify({ otp_code }),
    }),
  confirmCash: (id: string) =>
    request<Order>(`/orders/${id}/confirm-cash`, {
      method: "POST",
      body: JSON.stringify({ confirmed: true }),
    }),
  fail: (id: string, reason: string) =>
    request<Order>(`/orders/${id}/fail`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
};

// -----------------------------------------------------------------------------
// Admin (for the demo)
// -----------------------------------------------------------------------------
export const adminApi = {
  seed: () => request<{ seller_id: string; rider_ids: { moses: string; grace: string } }>(
    "/admin/seed",
    { method: "POST" }
  ),
  outbox: () => request<Array<{ channel: string; to: string; body: string; sent_at: string }>>(
    "/admin/outbox"
  ),
  whatsapp: (from: string, body: string) =>
    request<string>(`/whatsapp/inbound`, {
      method: "POST",
      body: JSON.stringify({ From: from, Body: body }),
    }),
};
