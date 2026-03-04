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
from datetime import datetime, timezone

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
    if d.get("platform_admin_owned") or d.get("billing_exempt"):
        billing_status = "exempt"

    billing_plan = d.get("billing_plan")  # 'pro_monthly' | 'pro_annual' when Pro
    return {
        "plan": "pro" if is_pro else "free",
        "billing_plan": billing_plan if is_pro else None,
        "billing_status": billing_status,
        "trial_end_date": d.get("trial_end_date"),
        "period_end": d.get("period_end"),
        "stripe_customer_id": d.get("stripe_customer_id"),
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

    success_url = os.getenv("BILLING_SUCCESS_URL", "https://membercore.io/billing/success")
    cancel_url = os.getenv("BILLING_CANCEL_URL", "https://membercore.io/billing/cancel")

    subscription_data = {"metadata": {"org_id": org_id, "plan": plan}}
    trial_days = os.getenv("STRIPE_TRIAL_DAYS")
    if trial_days and trial_days.isdigit():
        subscription_data["trial_period_days"] = int(trial_days)

    try:
        session = stripe.checkout.Session.create(
            mode="subscription",
            customer=customer_id,
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=success_url,
            cancel_url=cancel_url,
            subscription_data=subscription_data,
            metadata={"org_id": org_id, "type": "org_subscription", "plan": plan},
        )
        return {"checkout_url": session.url, "session_id": session.id}
    except Exception as e:
        logger.error("Stripe checkout session error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


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
        )
        return {"checkout_url": session.url, "session_id": session.id}
    except Exception as e:
        logger.error("Stripe checkout error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=500, detail=str(e))


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
