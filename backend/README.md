# Tukole Backend

FastAPI + Postgres. The dispatch brain for Tukole's delivery + cash trust system.

## What's in here

```
app/
├── main.py                # FastAPI app entry point
├── config.py              # Settings loaded from .env
├── db/
│   ├── database.py        # SQLAlchemy engine + session
│   ├── models.py          # Seller, Rider, Order, LedgerEntry
│   └── schemas.py         # Pydantic request/response shapes
├── services/
│   ├── state_machine.py   # Order state transitions
│   ├── otp.py             # Delivery OTP generation
│   ├── ledger.py          # Cash trust layer ★
│   ├── notifications.py   # SMS + WhatsApp dispatcher (mock-mode capable)
│   ├── whatsapp_parser.py # Parses seller messages into orders
│   ├── short_code.py      # TK1247-style codes
│   └── assignment.py      # Picks the best rider for an order
└── routes/
    ├── sellers.py
    ├── riders.py
    ├── orders.py
    ├── whatsapp.py
    └── admin.py           # Seed data, debug outbox
```

## Run locally

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit .env if needed — defaults work with sqlite if you change DATABASE_URL=sqlite:///./tukole.db
uvicorn app.main:app --reload --port 8000
```

Open http://localhost:8000/docs for the interactive Swagger UI.

## Seed demo data

```bash
curl -X POST http://localhost:8000/admin/seed
```

This creates Sarah's Closet (seller), Moses + Grace (riders), and 4 historical orders.

## Send a test "WhatsApp" message

While the server is running:

```bash
curl -X POST http://localhost:8000/whatsapp/inbound \
  -H "Content-Type: application/json" \
  -d '{
    "From": "whatsapp:+256772123456",
    "Body": "Order: Bukoto, 0772999888, Jane Akello, kitenge dress UGX 85000 COD"
  }'
```

You'll see the bot's reply in the response, and the same message logged to the
mock outbox at `GET /admin/outbox`.

## Run the full delivery flow manually

After seeding and creating an order via `/whatsapp/inbound`:

```bash
# Get the order ID
ORDER_ID=$(curl -s http://localhost:8000/admin/orders | python -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")

curl -X POST http://localhost:8000/orders/$ORDER_ID/picked-up
curl -X POST http://localhost:8000/orders/$ORDER_ID/start-delivery
curl -X POST http://localhost:8000/orders/$ORDER_ID/arrived
# Look up the OTP that was "sent" to the customer:
curl http://localhost:8000/admin/outbox | grep -o '\*[0-9]\{4\}\*' | tail -1

# Use that OTP:
curl -X POST http://localhost:8000/orders/$ORDER_ID/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"otp_code": "1234"}'

# For COD orders, confirm cash deposit:
curl -X POST http://localhost:8000/orders/$ORDER_ID/confirm-cash \
  -H "Content-Type: application/json" \
  -d '{"confirmed": true}'
```

## Deploy to Railway

1. Push this folder to GitHub.
2. New project on Railway → Deploy from GitHub repo → pick the backend folder.
3. Add a Postgres plugin. Railway auto-injects `DATABASE_URL`.
4. Add env vars in the Railway UI:
   - `MOCK_NOTIFICATIONS=true` (until you have Twilio credits)
   - `PUBLIC_BASE_URL=https://your-vercel-app.vercel.app`
   - `SECRET_KEY=` (generate a random 32-char string)
5. Set the start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

## Twilio setup (later, when ready to send real messages)

1. Create a free Twilio account.
2. Activate the WhatsApp sandbox: Console → Messaging → Try it Out → WhatsApp.
3. Set the inbound webhook to: `https://your-railway-url/whatsapp/inbound` (form-urlencoded).
4. Set env vars:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_WHATSAPP_FROM=whatsapp:+14155238886` (sandbox number)
   - `TWILIO_SMS_FROM=` (your trial number)
   - `MOCK_NOTIFICATIONS=false`

For SMS in Uganda specifically, **Africa's Talking** is cheaper (~UGX 25/SMS).
Adapter for it lives in `services/notifications.py` — wire it in before going to
real customers.
