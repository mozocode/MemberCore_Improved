# Configuring Payments (Stripe) for Event Tickets

"Payments are not configured" means the API is missing Stripe keys. Configure them as below.

## 1. Get Stripe keys

1. Sign up or log in at [Stripe Dashboard](https://dashboard.stripe.com).
2. **Test mode** (recommended first): toggle "Test mode" on (top right).  
   **Live mode**: toggle off when you’re ready to charge real cards.
3. Go to **Developers → API keys**.
4. Copy:
   - **Secret key** (starts with `sk_test_` or `sk_live_`) → use as `STRIPE_SECRET_KEY`.

You do **not** need to add the Publishable key to the backend; the frontend does not call Stripe directly (it redirects to Stripe Checkout).

## 2. Local development

In **`backend/.env`** (create if needed), add:

```env
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxx
FRONTEND_URL=http://localhost:5173
# Optional: enable Cash App Pay in Stripe Checkout (dues + event tickets)
STRIPE_ENABLE_CASHAPP_PAY=true
```

Restart the backend. "Buy Ticket" should then create a checkout session and redirect to Stripe.

## 3. Production (membercore.io / Cloud Run)

Your API runs on **Google Cloud Run** as `membercore-api`. Set the same variables there.

### Option A: Google Cloud Console

1. Open [Cloud Run](https://console.cloud.google.com/run).
2. Select the **membercore-api** service.
3. Click **Edit & deploy new revision**.
4. Open the **Variables & secrets** tab.
5. Add variables:
   - **STRIPE_SECRET_KEY** = `sk_live_xxx` (or `sk_test_xxx` for testing).
   - **FRONTEND_URL** = `https://membercore.io` (no trailing slash).
   - *(Optional)* **STRIPE_ENABLE_CASHAPP_PAY** = `true` to allow Cash App Pay in Checkout.
6. Deploy the new revision.

### Option B: gcloud CLI

From the project root:

```bash
gcloud run services update membercore-api \
  --region us-central1 \
  --set-env-vars "STRIPE_SECRET_KEY=sk_live_xxx,FRONTEND_URL=https://membercore.io,STRIPE_ENABLE_CASHAPP_PAY=true"
```

Use your real secret key and your real frontend URL. For test mode, use `sk_test_xxx`.

## 4. Webhooks (optional, for production)

For Stripe to create tickets after payment, Stripe must call your API:

1. In Stripe Dashboard: **Developers → Webhooks → Add endpoint**.
2. Endpoint URL: `https://membercore-api-XXXXX.run.app/api/payments/webhook` (your real Cloud Run API URL).
3. Events to send: **checkout.session.completed**.
4. Copy the **Signing secret** (starts with `whsec_`).
5. Add to Cloud Run env (Console or CLI):
   - **STRIPE_PAYMENTS_WEBHOOK_SECRET** = `whsec_xxx` *(preferred, event-ticket webhook only)*  
   - or **STRIPE_WEBHOOK_SECRET** = `whsec_xxx` *(legacy fallback)*

Without the webhook, payments can succeed on Stripe but tickets will not be created in your app until you add this.

## Stripe subscription webhooks (Pro billing)

For Pro subscription lifecycle updates (activate, renew, cancel), use:

- Endpoint URL: `https://membercore-api-XXXXX.run.app/api/billing/webhook/subscription`
- Recommended env var: **STRIPE_SUBSCRIPTION_WEBHOOK_SECRET** = `whsec_xxx`
- Fallback env var: **STRIPE_WEBHOOK_SECRET** = `whsec_xxx`

## Summary

| Variable                 | Required for "Buy Ticket" | Required for ticket creation after payment |
|--------------------------|---------------------------|--------------------------------------------|
| **STRIPE_SECRET_KEY**    | Yes                       | Yes                                        |
| **FRONTEND_URL**         | Yes (redirect after pay)  | No                                          |
| **STRIPE_ENABLE_CASHAPP_PAY** | Optional (show Cash App Pay when available) | No |
| **STRIPE_PAYMENTS_WEBHOOK_SECRET**| No              | Yes (preferred)                            |
| **STRIPE_SUBSCRIPTION_WEBHOOK_SECRET**| No          | Yes (for Pro billing webhooks)             |
| **STRIPE_WEBHOOK_SECRET**| No                        | Yes (legacy fallback for both endpoints)   |

Set **STRIPE_SECRET_KEY** and **FRONTEND_URL** in Cloud Run to fix "Payments are not configured" in production.

## Stripe Connect payouts for clubs

MemberCore can route dues/event-ticket funds to each club's own Stripe account using Stripe Connect Express.

- Org owners/admins open **Organization Settings -> Billing -> Club Payouts**
- Click **Connect Stripe Payouts** and complete Stripe onboarding
- Once connected and fully enabled (charges + payouts), new dues/ticket checkouts send funds to that connected account

Implementation notes:
- Connect account ID is stored on the organization doc (`stripe_connected_account_id`)
- Readiness flags are stored as:
  - `stripe_connect_onboarded`
  - `stripe_connect_charges_enabled`
  - `stripe_connect_payouts_enabled`
- Optional platform fee can be configured with:
  - `STRIPE_PLATFORM_FEE_PERCENT` (example `5` for 5%)
- Optional strict connect mode:
  - `STRIPE_REQUIRE_CONNECT_FOR_ORG_PAYMENTS=true`
  - When enabled, dues/ticket checkout is blocked unless the org has a fully enabled Stripe Connect account.
