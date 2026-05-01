/**
 * Tukole API client (v2 — escrow flow).
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
export type OrderStatus =
  | "pending"
  | "awaiting_payment"
  | "paid_into_escrow"
  | "assigned"
  | "picked_up"
  | "delivering"
  | "at_customer"
  | "delivered"
  | "approved"
  | "settled"
  | "disputed"
  | "refunded"
  | "failed";

export type EscrowStatus = "none" | "held" | "released" | "refunded" | "partial";

export type PaymentMethod = "momo" | "card" | "airtel_money" | "mock";

export type LedgerEntryType =
  | "escrow_deposit"
  | "escrow_release_seller"
  | "escrow_release_rider"
  | "escrow_release_platform"
  | "escrow_refund"
  | "seller_wallet_topup"
  | "seller_wallet_withdraw"
  | "rider_wallet_withdraw"
  | "penalty";

export type DisputeReason = "different_item" | "damaged" | "not_received" | "other";
export type DisputeVerdict =
  | "pending"
  | "seller_fault"
  | "buyer_fault"
  | "rider_fault"
  | "settled_negotiated";

export type PhotoPhase = "seller_pickup" | "rider_dropoff" | "customer_dispute";

export interface Seller {
  id: string;
  business_name: string;
  owner_name: string;
  phone: string;
  email?: string | null;
  location_area?: string | null;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  pickup_notes?: string | null;
  wallet_balance_ugx: number;
  created_at: string;
}

export interface Rider {
  id: string;
  full_name: string;
  phone: string;
  nin?: string | null;
  plate_number?: string | null;
  photo_url?: string | null;
  stage?: string | null;
  is_active: boolean;
  is_available: boolean;
  current_lat?: number | null;
  current_lng?: number | null;
  last_location_at?: string | null;
  wallet_balance_ugx: number;
}

export interface Order {
  id: string;
  short_code: string;
  seller_id: string;
  rider_id?: string | null;
  customer_id?: string | null;

  customer_name: string;
  customer_phone: string;
  customer_area: string;
  customer_address_notes?: string | null;
  customer_lat?: number | null;
  customer_lng?: number | null;
  customer_plus_code?: string | null;
  customer_pin_confirmed_at?: string | null;

  pickup_area?: string | null;
  pickup_lat?: number | null;
  pickup_lng?: number | null;

  item_description: string;
  item_value_ugx: number;
  delivery_fee_ugx: number;
  commission_rate_bps: number;
  platform_fee_ugx: number;

  escrow_status: EscrowStatus;
  escrow_paid_at?: string | null;
  escrow_released_at?: string | null;
  payment_method?: PaymentMethod | null;

  status: OrderStatus;
  failure_reason?: string | null;

  created_at: string;
  assigned_at?: string | null;
  picked_up_at?: string | null;
  arrived_at?: string | null;
  delivered_at?: string | null;
  approved_at?: string | null;
  settled_at?: string | null;
}

export interface OrderTrack {
  short_code: string;
  status: OrderStatus;
  escrow_status: EscrowStatus;
  seller_business_name?: string | null;

  rider_name?: string | null;
  rider_phone?: string | null;
  rider_plate?: string | null;
  rider_lat?: number | null;
  rider_lng?: number | null;

  customer_lat?: number | null;
  customer_lng?: number | null;
  customer_plus_code?: string | null;
  customer_pin_confirmed: boolean;

  pickup_lat?: number | null;
  pickup_lng?: number | null;

  item_description: string;
  item_value_ugx: number;
  delivery_fee_ugx: number;
  total_charge_ugx: number;

  estimated_minutes?: number | null;
  otp_code?: string | null;
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

export interface Photo {
  id: string;
  phase: PhotoPhase;
  image_data: string;
  caption?: string | null;
  created_at: string;
}

// -----------------------------------------------------------------------------
// Internal helper
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
    let detail: string = res.statusText;
    try {
      const j = await res.json();
      detail = j.detail || JSON.stringify(j);
    } catch {
      /* ignore */
    }
    throw new Error(`${res.status}: ${detail}`);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res.text() as unknown as T;
}

// -----------------------------------------------------------------------------
// Sellers
// -----------------------------------------------------------------------------
export const sellersApi = {
  signup: (data: {
    business_name: string;
    owner_name: string;
    phone: string;
    location_area?: string;
    pickup_lat?: number;
    pickup_lng?: number;
    pickup_notes?: string;
  }) => request<Seller>("/sellers", { method: "POST", body: JSON.stringify(data) }),

  get: (id: string) => request<Seller>(`/sellers/${id}`),
  byPhone: (phone: string) => request<Seller>(`/sellers/by-phone/${encodeURIComponent(phone)}`),

  update: (id: string, patch: Partial<Seller>) =>
    request<Seller>(`/sellers/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),

  topup: (id: string, amount_ugx: number) =>
    request<Seller>(`/sellers/${id}/wallet`, {
      method: "POST",
      body: JSON.stringify({ amount_ugx }),
    }),

  orders: (id: string) => request<Order[]>(`/sellers/${id}/orders`),
  ledger: (id: string) => request<LedgerEntry[]>(`/sellers/${id}/ledger`),

  createOrder: (
    sellerId: string,
    data: {
      customer_name: string;
      customer_phone: string;
      customer_area: string;
      customer_address_notes?: string;
      item_description: string;
      item_value_ugx: number;
      delivery_fee_ugx?: number;
    }
  ) =>
    request<Order>(`/sellers/${sellerId}/orders`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// -----------------------------------------------------------------------------
// Riders
// -----------------------------------------------------------------------------
export const ridersApi = {
  signup: (data: {
    full_name: string;
    phone: string;
    nin?: string;
    plate_number?: string;
    stage?: string;
    chairman_reference?: string;
    photo_url?: string;
  }) => request<Rider>("/riders", { method: "POST", body: JSON.stringify(data) }),

  get: (id: string) => request<Rider>(`/riders/${id}`),
  byPhone: (phone: string) => request<Rider>(`/riders/by-phone/${encodeURIComponent(phone)}`),

  jobs: (id: string) => request<Order[]>(`/riders/${id}/jobs`),
  history: (id: string) => request<Order[]>(`/riders/${id}/history`),
  earnings: (id: string) => request<LedgerEntry[]>(`/riders/${id}/earnings`),

  updateLocation: (id: string, lat: number, lng: number) =>
    request<Rider>(`/riders/${id}/location`, {
      method: "POST",
      body: JSON.stringify({ lat, lng }),
    }),

  listAll: () => request<Rider[]>("/riders"),
};

// -----------------------------------------------------------------------------
// Orders (rider-side state machine + photos)
// -----------------------------------------------------------------------------
export const ordersApi = {
  get: (id: string) => request<Order>(`/orders/${id}`),

  pickedUp: (id: string) => request<Order>(`/orders/${id}/picked-up`, { method: "POST" }),
  startDelivery: (id: string) =>
    request<Order>(`/orders/${id}/start-delivery`, { method: "POST" }),
  arrived: (id: string) => request<Order>(`/orders/${id}/arrived`, { method: "POST" }),
  verifyOtp: (id: string, otp_code: string) =>
    request<Order>(`/orders/${id}/verify-otp`, {
      method: "POST",
      body: JSON.stringify({ otp_code }),
    }),
  fail: (id: string, reason: string) =>
    request<Order>(`/orders/${id}/fail`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  uploadPhoto: (
    id: string,
    data: { phase: PhotoPhase; image_data: string; caption?: string }
  ) =>
    request<Photo>(`/orders/${id}/photos`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listPhotos: (id: string) => request<Photo[]>(`/orders/${id}/photos`),
};

// -----------------------------------------------------------------------------
// Customer-facing tracking page
// -----------------------------------------------------------------------------
export const trackingApi = {
  get: (shortCode: string) => request<OrderTrack>(`/track/${shortCode}`),

  confirmPin: (
    shortCode: string,
    data: {
      lat: number;
      lng: number;
      plus_code?: string;
      landmark_photo?: string;
      landmark_notes?: string;
    }
  ) =>
    request<OrderTrack>(`/track/${shortCode}/pin`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  pay: (shortCode: string, method: PaymentMethod = "mock") =>
    request<OrderTrack>(`/track/${shortCode}/pay`, {
      method: "POST",
      body: JSON.stringify({ method }),
    }),

  approve: (shortCode: string) =>
    request<OrderTrack>(`/track/${shortCode}/approve`, {
      method: "POST",
      body: JSON.stringify({ approved: true }),
    }),

  dispute: (shortCode: string, reason: DisputeReason, message?: string) =>
    request<{ id: string; verdict: DisputeVerdict }>(`/track/${shortCode}/dispute`, {
      method: "POST",
      body: JSON.stringify({ reason, customer_message: message }),
    }),
};

// -----------------------------------------------------------------------------
// Admin
// -----------------------------------------------------------------------------
export const adminApi = {
  seedRiders: () =>
    request<{ ok: boolean; rider_ids: { moses: string; grace: string } }>(
      "/admin/seed",
      { method: "POST" }
    ),
  reset: () => request<{ ok: boolean }>("/admin/reset", { method: "POST" }),
  outbox: () =>
    request<Array<{ channel: string; to: string; body: string; sent_at: string }>>(
      "/admin/outbox"
    ),
};
