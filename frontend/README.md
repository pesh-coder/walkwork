# Tukole Frontend

Next.js 14 (App Router) + Tailwind + Leaflet + Framer Motion.

## What's in here

```
app/
├── layout.tsx                   # Root layout, fonts, metadata
├── globals.css                  # Tailwind + design tokens (cream/terracotta/forest)
├── page.tsx                     # Landing page — pitch + "Launch demo"
├── seller/[id]/page.tsx         # Sarah's dashboard (orders + ledger paper)
├── rider/[id]/page.tsx          # Moses's PWA (delivery flow + OTP + cash)
└── track/[shortCode]/page.tsx   # Customer tracking (public, no auth)

components/
├── Logo.tsx                     # Tukole wordmark
├── StatusPill.tsx               # Order status chip
└── TrackingMap.tsx              # Leaflet map (rider + customer pins)

lib/
├── api.ts                       # Typed fetch wrappers for the backend
└── format.ts                    # UGX, time, status labels
```

## Prereqs

- Node 18+ (Node 20 LTS recommended)
- The backend running on http://localhost:8000

## Run locally

```bash
cd frontend
npm install
cp .env.example .env.local   # already points at localhost:8000
npm run dev
```

Open http://localhost:3000.

Click **"Launch demo"** on the landing page — this calls `POST /admin/seed` on
the backend and gives you links to all three demo surfaces.

## Demo flow

1. Open the landing page → click **Launch demo**.
2. Right-click each demo link, **Open in new tab**:
   - Sarah's dashboard
   - Moses's rider app
   - (You'll click "Track" on any order to open the customer view)
3. Back in your terminal, send a fake WhatsApp message:
   ```bash
   curl -X POST http://localhost:8000/whatsapp/inbound \
     -H "Content-Type: application/json" \
     -d '{"From":"whatsapp:+256772123456","Body":"Order: Bukoto, 0772999888, Jane, dress UGX 85000 COD"}'
   ```
   Or use Swagger UI at http://localhost:8000/docs.
4. Watch the order appear in Sarah's dashboard within 8 seconds (auto-refresh).
5. In Moses's app, walk through: **Confirm pickup → Start delivery → I've arrived**.
6. The OTP modal will pop. Look up the OTP in the backend's mock outbox:
   ```bash
   curl http://localhost:8000/admin/outbox
   ```
   (Or in your uvicorn terminal — it prints the SMS in real time.)
7. Type the OTP → **Confirm**. Order moves to `delivered`.
8. Cash modal pops → **Yes, deposited**. Order moves to `settled`.
9. Switch to Sarah's dashboard → **Cash flow** tab → see all 4 ledger entries.
   This is the demo's emotional climax.

## Deploy to Vercel

1. Push the `frontend` folder to GitHub.
2. New project on Vercel → Import → pick the repo (root = `frontend/`).
3. Set env var: `NEXT_PUBLIC_API_BASE_URL=https://your-railway-backend.up.railway.app`.
4. Deploy.

Then on the Railway backend, also set `PUBLIC_BASE_URL=https://your-vercel-app.vercel.app`
so the WhatsApp tracking URLs are correct.

## Design tokens

Defined in `tailwind.config.js`. Inspired by Uganda red soil + forest greens +
hand-written ledger paper. Three surfaces use them differently:

- **Landing page**: cream background with terracotta + forest accents
- **Seller dashboard**: cream + ledger paper (the differentiator)
- **Rider app**: forest header + terracotta CTAs (action-focused)
- **Customer tracking**: clean cream, mobile-first, calming
