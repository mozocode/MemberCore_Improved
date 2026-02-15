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
6. Deploy the new revision.

### Option B: gcloud CLI

From the project root:

```bash
gcloud run services update membercore-api \
  --region us-central1 \
  --set-env-vars "STRIPE_SECRET_KEY=sk_live_xxx,FRONTEND_URL=https://membercore.io"
```

Use your real secret key and your real frontend URL. For test mode, use `sk_test_xxx`.

## 4. Webhooks (optional, for production)

For Stripe to create tickets after payment, Stripe must call your API:

1. In Stripe Dashboard: **Developers → Webhooks → Add endpoint**.
2. Endpoint URL: `https://membercore-api-XXXXX.run.app/api/payments/webhook` (your real Cloud Run API URL).
3. Events to send: **checkout.session.completed**.
4. Copy the **Signing secret** (starts with `whsec_`).
5. Add to Cloud Run env (Console or CLI):
   - **STRIPE_WEBHOOK_SECRET** = `whsec_xxx`.

Without the webhook, payments can succeed on Stripe but tickets won’t be created in your app until you add this.

## Summary

| Variable                 | Required for "Buy Ticket" | Required for ticket creation after payment |
|--------------------------|---------------------------|--------------------------------------------|
| **STRIPE_SECRET_KEY**    | Yes                       | Yes                                        |
| **FRONTEND_URL**         | Yes (redirect after pay)  | No                                          |
| **STRIPE_WEBHOOK_SECRET**| No                        | Yes                                        |

Set **STRIPE_SECRET_KEY** and **FRONTEND_URL** in Cloud Run to fix "Payments are not configured" in production.
