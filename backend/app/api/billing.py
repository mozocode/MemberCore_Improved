"""Billing API — Stripe subscription management for organizations (web-only).

All subscription and payment actions happen through the web app or Stripe
checkout/portal.  Mobile clients read billing state but NEVER initiate
purchases — this ensures full Apple App Store / Google Play compliance.

Stripe events we handle:
  - checkout.session.completed  (subscription created)
  - invoice.paid                (recurring payment succeeded)
  - invoice.payment_failed      (payment failed → past_due)
  - customer.subscription.deleted (canceled or expired)
  - customer.subscription.updated (plan change, trial ending)
"""

import os
import logging
import hashlib
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional

from app.db.firebase import get_firestore
from app.core.security import get_current_user_id, get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

ACTIVE_STATUSES = {"active", "trial", "exempt"}

PRO_MONTHLY_PRICE_CENTS = 9900  # $99.00/month

# Plan types for Pro subscription (monthly vs annual)
PRO_PLAN_MONTHLY = "pro_monthly"
PRO_PLAN_ANNUAL = "pro_annual"


def _get_price_id_for_plan(plan: str) -> Optional[str]:
    """Return Stripe Price ID for the given plan. Uses env STRIPE_PRICE_PRO_MONTHLY / STRIPE_PRICE_PRO_ANNUAL."""
    if plan == PRO_PLAN_ANNUAL:
        return os.getenv("STRIPE_PRICE_PRO_ANNUAL")
    if plan == PRO_PLAN_MONTHLY:
        return os.getenv("STRIPE_PRICE_PRO_MONTHLY")
    return None


def _plan_from_price_id(price_id: str) -> Optional[str]:
    """Map Stripe Price ID to our plan key."""
    if not price_id:
        return None
    if price_id == os.getenv("STRIPE_PRICE_PRO_ANNUAL"):
        return PRO_PLAN_ANNUAL
    if price_id == os.getenv("STRIPE_PRICE_PRO_MONTHLY"):
        return PRO_PLAN_MONTHLY
    return None


def _get_subscription_price_id(sub) -> Optional[str]:
    """Extract the first price ID from a Stripe subscription (dict or object)."""
    try:
        items = sub.get("items") if hasattr(sub, "get") else getattr(sub, "items", None)
        if not items:
            return None
        data = items.get("data") if hasattr(items, "get") else getattr(items, "data", [])
        if not data:
            return None
        first = data[0] if isinstance(data, list) else list(data)[0]
        price = first.get("price") if hasattr(first, "get") else getattr(first, "price", None)
        if not price:
            return None
        return price.get("id") if hasattr(price, "get") else getattr(price, "id", None)
    except (IndexError, TypeError, AttributeError):
        return None


def _get_or_create_pro_price(stripe_mod) -> str:
    """Find an existing MemberCore Pro price or create one.
    Caches the price ID in Firestore so it's only created once."""
    db = get_firestore()
    config_ref = db.collection("_config").document("stripe")
    config_doc = config_ref.get()
    if config_doc.exists:
        saved = config_doc.to_dict().get("pro_price_id")
        if saved:
            return saved

    # Search for an existing product named "MemberCore Pro"
    products = stripe_mod.Product.search(query="name:'MemberCore Pro'", limit=1)
    if products.data:
        product_id = products.data[0].id
    else:
        product = stripe_mod.Product.create(
            name="MemberCore Pro",
            description="Pro subscription for MemberCore organizations — chat, events, dues, polls, analytics, and more.",
        )
        product_id = product.id

    # Search for an existing recurring price on this product
    prices = stripe_mod.Price.list(product=product_id, type="recurring", active=True, limit=1)
    if prices.data:
        price_id = prices.data[0].id
    else:
        price = stripe_mod.Price.create(
            product=product_id,
            unit_amount=PRO_MONTHLY_PRICE_CENTS,
            currency="usd",
            recurring={"interval": "month"},
        )
        price_id = price.id

    # Cache for next time
    config_ref.set({"pro_price_id": price_id}, merge=True)
    logger.info("Created/found Stripe Pro price: %s", price_id)
    return price_id


def _get_stripe():
    """Lazy-import stripe and set key."""
    key = os.getenv("STRIPE_SECRET_KEY")
    if not key:
        raise HTTPException(status_code=503, detail="Stripe is not configured")
    import stripe
    stripe.api_key = key
    return stripe


def _stripe_checkout_error_response(context: str, exc: Exception):
    """Log full Stripe error internally, return sanitized user-safe message."""
    logger.error("%s: %s", context, exc)
    raise HTTPException(
        status_code=500,
        detail="Could not start Stripe checkout. Please verify billing configuration and try again.",
    )


def _stripe_idempotency_key(prefix: str, *parts: object, window_minutes: int = 5) -> str:
    """Build a deterministic Stripe idempotency key within a short time window."""
    now = datetime.now(timezone.utc)
    bucket = int(now.timestamp() // (window_minutes * 60))
    payload = "|".join([prefix, str(bucket), *[str(p or "") for p in parts]])
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()[:48]
    return f"{prefix}_{digest}"


def _require_org_owner_or_admin(db, org_id: str, user_id: str):
    """Return member doc if user is owner/admin of org; raise otherwise."""
    members = list(
        db.collection("members")
        .where("user_id", "==", user_id)
        .where("organization_id", "==", org_id)
        .where("status", "==", "approved")
        .limit(1)
        .get()
    )
    if not members:
        raise HTTPException(status_code=404, detail="Organization not found")
    role = members[0].to_dict().get("role", "member")
    if role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owners and admins can manage billing")
    return members[0]


def _sync_billing_to_org(db, org_id: str, updates: dict):
    """Write billing fields to the organization document."""
    org_ref = db.collection("organizations").document(org_id)
    org_ref.update({**updates, "billing_updated_at": datetime.now(timezone.utc)})


def _compute_billing_status(sub_status: str, is_exempt: bool = False) -> str:
    """Map Stripe subscription.status → our billing_status."""
    if is_exempt:
        return "exempt"
    mapping = {
        "active": "active",
        "trialing": "trial",
        "past_due": "past_due",
        "canceled": "canceled",
        "incomplete": "inactive",
        "incomplete_expired": "inactive",
        "unpaid": "inactive",
        "paused": "inactive",
    }
    return mapping.get(sub_status, "inactive")


# ---------------------------------------------------------------------------
# Read endpoints (available to all authenticated org members)
# ---------------------------------------------------------------------------


@router.get("/{org_id}/billing")
def get_billing_state(
    org_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """Return billing/subscription state for the org.  Any member can read."""
    db = get_firestore()
    # Verify membership
    members = list(
        db.collection("members")
        .where("user_id", "==", user_id)
        .where("organization_id", "==", org_id)
        .where("status", "==", "approved")
        .limit(1)
        .get()
    )
    if not members:
        raise HTTPException(status_code=404, detail="Organization not found")

    org_doc = db.collection("organizations").document(org_id).get()
    if not org_doc.exists:
        raise HTTPException(status_code=404, detail="Organization not found")
    d = org_doc.to_dict()

    is_pro = d.get("is_pro", False)
    billing_status = d.get("billing_status", "inactive")
    trial_end_date = d.get("trial_end_date")
    trial_start_date = d.get("trial_start_date")
    pending_updates = {}
    if d.get("platform_admin_owned") or d.get("billing_exempt"):
        billing_status = "exempt"
        if d.get("billing_status") != "exempt":
            pending_updates["billing_status"] = "exempt"
        if not d.get("billing_exempt"):
            pending_updates["billing_exempt"] = True
    elif not is_pro:
        # Backward-compatible fallback for orgs created before explicit billing_status
        # initialization: active trial is determined per-organization from trial dates.
        def _to_dt(val):
            if val is None:
                return None
            if isinstance(val, datetime):
                return val if val.tzinfo else val.replace(tzinfo=timezone.utc)
            if isinstance(val, str):
                try:
                    dt = datetime.fromisoformat(val.replace("Z", "+00:00"))
                    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
                except Exception:
                    return None
            if isinstance(val, dict) and "_seconds" in val:
                try:
                    return datetime.fromtimestamp(float(val["_seconds"]), tz=timezone.utc)
                except Exception:
                    return None
            return None

        trial_end_dt = _to_dt(trial_end_date)
        trial_start_dt = _to_dt(trial_start_date)
        if trial_start_dt is None:
            trial_start_dt = _to_dt(d.get("created_at"))
            if trial_start_dt is not None:
                trial_start_date = trial_start_dt
                pending_updates["trial_start_date"] = trial_start_dt
        if trial_end_dt is None:
            if trial_start_dt is not None:
                trial_end_dt = trial_start_dt + timedelta(days=30)
                trial_end_date = trial_end_dt
                pending_updates["trial_end_date"] = trial_end_dt
        status_norm = str(d.get("billing_status") or "").strip().lower()
        has_stripe_history = bool(d.get("stripe_subscription_id") or d.get("stripe_customer_id"))
        if trial_end_dt is not None and trial_end_dt > datetime.now(timezone.utc):
            if not status_norm or (status_norm == "inactive" and not has_stripe_history):
                billing_status = "trial"
                if status_norm != "trial":
                    pending_updates["billing_status"] = "trial"
        elif not status_norm:
            billing_status = "inactive"
            pending_updates["billing_status"] = "inactive"
    elif is_pro and not d.get("billing_status"):
        billing_status = "active"
        pending_updates["billing_status"] = "active"

    if pending_updates:
        _sync_billing_to_org(db, org_id, pending_updates)
        d = {**d, **pending_updates}

    d = _refresh_connect_state_if_stale(db, org_id, d)

    billing_plan = d.get("billing_plan")  # 'pro_monthly' | 'pro_annual' when Pro
    stripe_connected_account_id = d.get("stripe_connected_account_id")
    stripe_connect_charges_enabled = bool(d.get("stripe_connect_charges_enabled"))
    stripe_connect_payouts_enabled = bool(d.get("stripe_connect_payouts_enabled"))
    stripe_connect_ready = bool(
        stripe_connected_account_id
        and stripe_connect_charges_enabled
        and stripe_connect_payouts_enabled
    )
    return {
        "plan": "pro" if is_pro else "free",
        "billing_plan": billing_plan if is_pro else None,
        "billing_status": billing_status,
        "trial_end_date": trial_end_date,
        "period_end": d.get("period_end"),
        "stripe_customer_id": d.get("stripe_customer_id"),
        "stripe_connected_account_id": stripe_connected_account_id,
        "stripe_connect_onboarded": bool(d.get("stripe_connect_onboarded")),
        "stripe_connect_charges_enabled": stripe_connect_charges_enabled,
        "stripe_connect_payouts_enabled": stripe_connect_payouts_enabled,
        "stripe_connect_ready": stripe_connect_ready,
        "is_billing_exempt": bool(d.get("platform_admin_owned") or d.get("billing_exempt")),
    }


# ---------------------------------------------------------------------------
# Write endpoints — WEB ONLY (owner/admin)
# ---------------------------------------------------------------------------


class CreateCheckoutRequest(BaseModel):
    success_url: str
    cancel_url: str
    plan: str = "pro"


class CreateCheckoutSessionRequest(BaseModel):
    """Used by mobile (and optionally web) to start checkout without passing URLs."""
    plan: str  # 'pro_monthly' | 'pro_annual'


class ConnectOnboardingRequest(BaseModel):
    refresh_url: str
    return_url: str


class ConnectLoginLinkRequest(BaseModel):
    redirect_url: Optional[str] = None


def _upsert_connect_state(db, org_id: str, account) -> dict:
    """Persist Stripe Connect account status fields on the organization."""
    data = {
        "stripe_connected_account_id": account.id,
        "stripe_connect_onboarded": bool(getattr(account, "details_submitted", False)),
        "stripe_connect_charges_enabled": bool(getattr(account, "charges_enabled", False)),
        "stripe_connect_payouts_enabled": bool(getattr(account, "payouts_enabled", False)),
        "stripe_connect_updated_at": datetime.now(timezone.utc),
    }
    db.collection("organizations").document(org_id).update(data)
    return data


def _find_org_by_connected_account(db, account_id: str) -> Optional[str]:
    orgs = list(
        db.collection("organizations")
        .where("stripe_connected_account_id", "==", account_id)
        .limit(1)
        .stream()
    )
    if orgs:
        return orgs[0].id
    return None


def _refresh_connect_state_if_stale(db, org_id: str, org_data: dict) -> dict:
    """Refresh Stripe Connect capability flags when missing or stale."""
    account_id = org_data.get("stripe_connected_account_id")
    if not account_id:
        return org_data

    should_refresh = False
    updated_at = org_data.get("stripe_connect_updated_at")
    if not updated_at:
        should_refresh = True
    elif isinstance(updated_at, datetime):
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=10)
        dt = updated_at if updated_at.tzinfo else updated_at.replace(tzinfo=timezone.utc)
        should_refresh = dt < cutoff
    else:
        should_refresh = True

    if not should_refresh:
        return org_data

    try:
        stripe = _get_stripe()
        account = stripe.Account.retrieve(account_id)
        fresh = _upsert_connect_state(db, org_id, account)
        return {**org_data, **fresh}
    except Exception as e:
        logger.warning("Could not refresh Stripe Connect state for org %s: %s", org_id, e)
        return org_data


@router.post("/{org_id}/billing/connect/onboarding")
def create_connect_onboarding_link(
    org_id: str,
    req: ConnectOnboardingRequest,
    user: dict = Depends(get_current_user),
):
    """Create/reuse Stripe Express account and return onboarding link for org payouts."""
    db = get_firestore()
    _require_org_owner_or_admin(db, org_id, user["id"])

    org_doc = db.collection("organizations").document(org_id).get()
    if not org_doc.exists:
        raise HTTPException(status_code=404, detail="Organization not found")
    od = org_doc.to_dict()

    stripe = _get_stripe()
    try:
        account_id = od.get("stripe_connected_account_id")
        account = None
        if account_id:
            try:
                account = stripe.Account.retrieve(account_id)
            except Exception:
                account = None

        if not account:
            account = stripe.Account.create(
                type="express",
                country=os.getenv("STRIPE_CONNECT_COUNTRY", "US"),
                email=user.get("email"),
                business_type="company",
                metadata={"org_id": org_id, "owner_user_id": user["id"]},
                capabilities={
                    "card_payments": {"requested": True},
                    "transfers": {"requested": True},
                },
            )

        _upsert_connect_state(db, org_id, account)
        link = stripe.AccountLink.create(
            account=account.id,
            refresh_url=req.refresh_url,
            return_url=req.return_url,
            type="account_onboarding",
        )
        return {"url": link.url}
    except Exception as e:
        logger.error("Stripe Connect onboarding error for org %s: %s", org_id, e)
        raise HTTPException(
            status_code=500,
            detail=f"Could not start Stripe payouts onboarding: {str(e)}",
        )


@router.post("/{org_id}/billing/connect/login-link")
def create_connect_login_link(
    org_id: str,
    req: ConnectLoginLinkRequest,
    user: dict = Depends(get_current_user),
):
    """Create Stripe Express dashboard login link for connected org account."""
    db = get_firestore()
    _require_org_owner_or_admin(db, org_id, user["id"])

    org_doc = db.collection("organizations").document(org_id).get()
    if not org_doc.exists:
        raise HTTPException(status_code=404, detail="Organization not found")
    od = org_doc.to_dict()
    account_id = od.get("stripe_connected_account_id")
    if not account_id:
        raise HTTPException(status_code=400, detail="Stripe payouts are not connected for this organization")

    stripe = _get_stripe()
    try:
        account = stripe.Account.retrieve(account_id)
        _upsert_connect_state(db, org_id, account)

        params = {"account": account_id}
        if req.redirect_url:
            params["redirect_url"] = req.redirect_url
        link = stripe.Account.create_login_link(**params)
        return {"url": link.url}
    except Exception as e:
        logger.error("Stripe Connect login-link error for org %s: %s", org_id, e)
        raise HTTPException(
            status_code=500,
            detail=f"Could not open Stripe payouts dashboard: {str(e)}",
        )


@router.post("/{org_id}/billing/connect/sync")
def sync_connect_status(
    org_id: str,
    user: dict = Depends(get_current_user),
):
    """Force-refresh Stripe Connect flags from Stripe account capabilities."""
    db = get_firestore()
    _require_org_owner_or_admin(db, org_id, user["id"])

    org_doc = db.collection("organizations").document(org_id).get()
    if not org_doc.exists:
        raise HTTPException(status_code=404, detail="Organization not found")
    od = org_doc.to_dict() or {}
    account_id = od.get("stripe_connected_account_id")
    if not account_id:
        raise HTTPException(status_code=400, detail="Stripe payouts are not connected for this organization")

    stripe = _get_stripe()
    try:
        account = stripe.Account.retrieve(account_id)
        data = _upsert_connect_state(db, org_id, account)
        return {"ok": True, **data}
    except Exception as e:
        logger.error("Stripe Connect sync error for org %s: %s", org_id, e)
        raise HTTPException(status_code=500, detail="Could not refresh Stripe payouts status. Please try again.")


@router.post("/{org_id}/billing/create-checkout-session")
def create_checkout_session(
    org_id: str,
    req: CreateCheckoutSessionRequest,
    user: dict = Depends(get_current_user),
):
    """Create a Stripe Checkout Session for Pro subscription. Returns checkout_url for redirect (e.g. mobile WebBrowser).
    success_url and cancel_url come from env BILLING_SUCCESS_URL / BILLING_CANCEL_URL."""
    db = get_firestore()
    _require_org_owner_or_admin(db, org_id, user["id"])

    plan = (req.plan or "").strip().lower()
    if plan not in (PRO_PLAN_MONTHLY, PRO_PLAN_ANNUAL):
        raise HTTPException(status_code=400, detail="plan must be pro_monthly or pro_annual")

    price_id = _get_price_id_for_plan(plan)
    if not price_id:
        raise HTTPException(
            status_code=503,
            detail="Stripe price not configured. Set STRIPE_PRICE_PRO_MONTHLY and STRIPE_PRICE_PRO_ANNUAL.",
        )

    org_doc = db.collection("organizations").document(org_id).get()
    if not org_doc.exists:
        raise HTTPException(status_code=404, detail="Organization not found")
    od = org_doc.to_dict()

    stripe = _get_stripe()
    customer_id = od.get("stripe_customer_id")
    if not customer_id:
        customer = stripe.Customer.create(
            email=user.get("email"),
            name=od.get("name", ""),
            metadata={"org_id": org_id, "user_id": user["id"]},
        )
        customer_id = customer.id
        db.collection("organizations").document(org_id).update({
            "stripe_customer_id": customer_id,
        })

    frontend_url = os.getenv("FRONTEND_URL", "https://membercore.io").rstrip("/")
    default_success_url = f"{frontend_url}/org/{org_id}/settings?tab=club&billing=success"
    default_cancel_url = f"{frontend_url}/org/{org_id}/settings?tab=club&billing=cancel"
    success_url = os.getenv("BILLING_SUCCESS_URL", default_success_url)
    cancel_url = os.getenv("BILLING_CANCEL_URL", default_cancel_url)

    subscription_data = {"metadata": {"org_id": org_id, "plan": plan}}
    trial_days = os.getenv("STRIPE_TRIAL_DAYS")
    if trial_days and trial_days.isdigit():
        subscription_data["trial_period_days"] = int(trial_days)

    try:
        idempotency_key = _stripe_idempotency_key(
            "billing_checkout_mobile",
            org_id,
            user["id"],
            customer_id,
            plan,
            price_id,
        )
        session = stripe.checkout.Session.create(
            mode="subscription",
            customer=customer_id,
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=success_url,
            cancel_url=cancel_url,
            subscription_data=subscription_data,
            metadata={"org_id": org_id, "type": "org_subscription", "plan": plan},
            idempotency_key=idempotency_key,
        )
        return {"checkout_url": session.url, "session_id": session.id}
    except Exception as e:
        _stripe_checkout_error_response("Stripe checkout session error", e)


@router.post("/{org_id}/billing/checkout")
def create_subscription_checkout(
    org_id: str,
    req: CreateCheckoutRequest,
    user: dict = Depends(get_current_user),
):
    """Create a Stripe Checkout Session for a new Pro subscription.
    This endpoint is called from the WEB APP ONLY — never from mobile.
    """
    db = get_firestore()
    _require_org_owner_or_admin(db, org_id, user["id"])

    org_doc = db.collection("organizations").document(org_id).get()
    if not org_doc.exists:
        raise HTTPException(status_code=404, detail="Organization not found")
    od = org_doc.to_dict()

    stripe = _get_stripe()

    # Reuse existing Stripe customer or create a new one
    customer_id = od.get("stripe_customer_id")
    if not customer_id:
        customer = stripe.Customer.create(
            email=user.get("email"),
            name=od.get("name", ""),
            metadata={"org_id": org_id, "user_id": user["id"]},
        )
        customer_id = customer.id
        db.collection("organizations").document(org_id).update({
            "stripe_customer_id": customer_id,
        })

    # Get or create the Pro price in Stripe
    price_id = os.getenv("STRIPE_PRO_PRICE_ID")
    if not price_id:
        price_id = _get_or_create_pro_price(stripe)

    try:
        idempotency_key = _stripe_idempotency_key(
            "billing_checkout_web",
            org_id,
            user["id"],
            customer_id,
            price_id,
            req.success_url,
            req.cancel_url,
        )
        session = stripe.checkout.Session.create(
            mode="subscription",
            customer=customer_id,
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=req.success_url,
            cancel_url=req.cancel_url,
            subscription_data={
                "metadata": {"org_id": org_id},
                "trial_period_days": int(os.getenv("STRIPE_TRIAL_DAYS", "14")),
            },
            metadata={"org_id": org_id, "type": "org_subscription"},
            idempotency_key=idempotency_key,
        )
        return {"checkout_url": session.url, "session_id": session.id}
    except Exception as e:
        _stripe_checkout_error_response("Stripe checkout error", e)


@router.post("/{org_id}/billing/portal")
def create_billing_portal(
    org_id: str,
    return_url: str,
    user: dict = Depends(get_current_user),
):
    """Create a Stripe Customer Portal session for managing subscription,
    updating payment method, viewing invoices, and canceling.
    WEB ONLY — never called from mobile.
    """
    db = get_firestore()
    _require_org_owner_or_admin(db, org_id, user["id"])

    org_doc = db.collection("organizations").document(org_id).get()
    if not org_doc.exists:
        raise HTTPException(status_code=404, detail="Organization not found")
    od = org_doc.to_dict()
    customer_id = od.get("stripe_customer_id")
    if not customer_id:
        raise HTTPException(status_code=400, detail="No billing account found. Subscribe first.")

    stripe = _get_stripe()

    try:
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=return_url,
        )
        return {"portal_url": session.url}
    except Exception as e:
        logger.error("Stripe portal error: %s", e)
        raise HTTPException(status_code=500, detail="Could not open billing portal. Please try again.")


# ---------------------------------------------------------------------------
# Stripe Webhook — subscription lifecycle events
# ---------------------------------------------------------------------------


@router.post("/webhook/subscription")
async def stripe_subscription_webhook(request: Request):
    """Handle Stripe subscription lifecycle webhooks.

    Events:
      - checkout.session.completed (subscription created)
      - invoice.paid              (recurring success)
      - invoice.payment_failed    (payment failed)
      - customer.subscription.deleted (canceled)
      - customer.subscription.updated (plan/trial change)
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    webhook_secret = os.getenv("STRIPE_SUBSCRIPTION_WEBHOOK_SECRET")
    if not webhook_secret:
        # Fall back to general webhook secret
        webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    if not webhook_secret:
        return JSONResponse(content={"detail": "Webhook not configured"}, status_code=503)

    import stripe
    stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
    except ValueError:
        return JSONResponse(content={"detail": "Invalid payload"}, status_code=400)
    except stripe.SignatureVerificationError:
        return JSONResponse(content={"detail": "Invalid signature"}, status_code=400)

    db = get_firestore()
    event_type = event["type"]
    obj = event["data"]["object"]

    logger.info("Stripe subscription webhook: %s", event_type)

    if event_type == "checkout.session.completed":
        _handle_checkout_completed(db, obj)
    elif event_type == "customer.subscription.created":
        _handle_subscription_updated(db, obj)
    elif event_type == "invoice.paid":
        _handle_invoice_paid(db, obj)
    elif event_type == "invoice.payment_failed":
        _handle_invoice_failed(db, obj)
    elif event_type == "customer.subscription.deleted":
        _handle_subscription_deleted(db, obj)
    elif event_type == "customer.subscription.updated":
        _handle_subscription_updated(db, obj)

    return {"status": "ok"}


@router.post("/webhook/connect")
async def stripe_connect_webhook(request: Request):
    """Handle Stripe Connect account capability updates (account.updated)."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    webhook_secret = os.getenv("STRIPE_CONNECT_WEBHOOK_SECRET")
    if not webhook_secret:
        webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    if not webhook_secret:
        return JSONResponse(content={"detail": "Webhook not configured"}, status_code=503)

    import stripe
    stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
    except ValueError:
        return JSONResponse(content={"detail": "Invalid payload"}, status_code=400)
    except stripe.SignatureVerificationError:
        return JSONResponse(content={"detail": "Invalid signature"}, status_code=400)

    if event.get("type") != "account.updated":
        return {"status": "ok"}

    account = event["data"]["object"]
    account_id = account.get("id")
    if not account_id:
        return {"status": "ok"}

    db = get_firestore()
    org_id = _find_org_by_connected_account(db, account_id)
    if not org_id:
        return {"status": "ok"}

    _upsert_connect_state(db, org_id, account)
    logger.info("Stripe connect webhook synced org %s account %s", org_id, account_id)
    return {"status": "ok"}


def _find_org_by_subscription(db, subscription_id: str) -> Optional[str]:
    """Find organization ID by Stripe subscription ID."""
    orgs = list(
        db.collection("organizations")
        .where("stripe_subscription_id", "==", subscription_id)
        .limit(1)
        .stream()
    )
    if orgs:
        return orgs[0].id
    return None


def _find_org_by_customer(db, customer_id: str) -> Optional[str]:
    """Find organization ID by Stripe customer ID."""
    orgs = list(
        db.collection("organizations")
        .where("stripe_customer_id", "==", customer_id)
        .limit(1)
        .stream()
    )
    if orgs:
        return orgs[0].id
    return None


def _handle_checkout_completed(db, session: dict):
    """New subscription created via checkout."""
    metadata = session.get("metadata") or {}
    if metadata.get("type") != "org_subscription":
        return

    org_id = metadata.get("org_id")
    if not org_id:
        return

    subscription_id = session.get("subscription")
    customer_id = session.get("customer")

    now = datetime.now(timezone.utc)

    updates = {
        "is_pro": True,
        "billing_status": "active",
        "stripe_customer_id": customer_id,
        "stripe_subscription_id": subscription_id,
        "last_payment_date": now,
    }

    # If there's a subscription, fetch its details for trial/period info and plan
    if subscription_id:
        try:
            import stripe
            stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")
            sub = stripe.Subscription.retrieve(subscription_id)
            updates["billing_status"] = _compute_billing_status(sub.status)
            if sub.trial_end:
                updates["trial_end_date"] = datetime.fromtimestamp(sub.trial_end, tz=timezone.utc)
            if sub.current_period_end:
                updates["period_end"] = datetime.fromtimestamp(sub.current_period_end, tz=timezone.utc)
            # Set billing_plan from subscription's price
            price_id = _get_subscription_price_id(sub)
            plan = _plan_from_price_id(price_id)
            if plan:
                updates["billing_plan"] = plan
        except Exception as e:
            logger.warning("Could not fetch subscription details: %s", e)

    _sync_billing_to_org(db, org_id, updates)
    logger.info("Org %s subscribed (checkout.session.completed)", org_id)


def _handle_invoice_paid(db, invoice: dict):
    """Recurring payment succeeded."""
    sub_id = invoice.get("subscription")
    customer_id = invoice.get("customer")

    org_id = None
    if sub_id:
        org_id = _find_org_by_subscription(db, sub_id)
    if not org_id and customer_id:
        org_id = _find_org_by_customer(db, customer_id)
    if not org_id:
        return

    now = datetime.now(timezone.utc)
    updates = {
        "is_pro": True,
        "billing_status": "active",
        "last_payment_date": now,
    }

    # Update period_end and billing_plan from the subscription
    if sub_id:
        try:
            import stripe
            stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")
            sub = stripe.Subscription.retrieve(sub_id)
            if sub.current_period_end:
                updates["period_end"] = datetime.fromtimestamp(sub.current_period_end, tz=timezone.utc)
            price_id = _get_subscription_price_id(sub)
            plan = _plan_from_price_id(price_id)
            if plan:
                updates["billing_plan"] = plan
        except Exception:
            pass

    _sync_billing_to_org(db, org_id, updates)
    logger.info("Org %s invoice.paid — billing active", org_id)


def _handle_invoice_failed(db, invoice: dict):
    """Payment failed → mark org as past_due."""
    sub_id = invoice.get("subscription")
    customer_id = invoice.get("customer")

    org_id = None
    if sub_id:
        org_id = _find_org_by_subscription(db, sub_id)
    if not org_id and customer_id:
        org_id = _find_org_by_customer(db, customer_id)
    if not org_id:
        return

    _sync_billing_to_org(db, org_id, {"billing_status": "past_due"})
    logger.warning("Org %s invoice.payment_failed — past_due", org_id)


def _handle_subscription_deleted(db, subscription: dict):
    """Subscription canceled or expired → downgrade to free."""
    org_id = _find_org_by_subscription(db, subscription.get("id"))
    if not org_id:
        customer_id = subscription.get("customer")
        if customer_id:
            org_id = _find_org_by_customer(db, customer_id)
    if not org_id:
        return

    _sync_billing_to_org(db, org_id, {
        "is_pro": False,
        "billing_status": "canceled",
        "stripe_subscription_id": None,
        "billing_plan": None,
    })
    logger.info("Org %s subscription.deleted — downgraded to free", org_id)


def _handle_subscription_updated(db, subscription: dict):
    """Subscription updated (plan change, trial ending, etc.)."""
    org_id = _find_org_by_subscription(db, subscription.get("id"))
    if not org_id:
        customer_id = subscription.get("customer")
        if customer_id:
            org_id = _find_org_by_customer(db, customer_id)
    if not org_id:
        return

    status = _compute_billing_status(subscription.get("status", "inactive"))
    updates = {"billing_status": status}

    if subscription.get("trial_end"):
        updates["trial_end_date"] = datetime.fromtimestamp(
            subscription["trial_end"], tz=timezone.utc
        )
    if subscription.get("current_period_end"):
        updates["period_end"] = datetime.fromtimestamp(
            subscription["current_period_end"], tz=timezone.utc
        )

    # Set billing_plan from subscription price
    price_id = _get_subscription_price_id(subscription)
    plan = _plan_from_price_id(price_id)
    if plan:
        updates["billing_plan"] = plan

    # If status goes to active, ensure is_pro is True
    if status in ("active", "trial"):
        updates["is_pro"] = True
    elif status in ("canceled", "inactive"):
        updates["is_pro"] = False
        updates["billing_plan"] = None

    _sync_billing_to_org(db, org_id, updates)
    logger.info("Org %s subscription.updated — status=%s", org_id, status)
