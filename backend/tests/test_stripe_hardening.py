import sys
import types
import json
import asyncio
from datetime import datetime, timedelta, timezone

from app.api import payments as payments_api
from app.api import billing as billing_api
from starlette.requests import Request


class _FakeDocSnapshot:
    def __init__(self, doc_id, data):
        self.id = doc_id
        self._data = data

    @property
    def exists(self):
        return self._data is not None

    def to_dict(self):
        return dict(self._data or {})


class _FakeDocumentRef:
    def __init__(self, collection, doc_id):
        self._collection = collection
        self.id = doc_id

    def get(self, transaction=None):  # noqa: ARG002 - parity with firestore API
        return _FakeDocSnapshot(self.id, self._collection._docs.get(self.id))

    def set(self, data):
        self._collection._docs[self.id] = dict(data)

    def update(self, data):
        cur = dict(self._collection._docs.get(self.id, {}))
        cur.update(dict(data))
        self._collection._docs[self.id] = cur


class _FakeQuery:
    def __init__(self, collection, filters=None, limit_n=None):
        self._collection = collection
        self._filters = filters or []
        self._limit_n = limit_n

    def where(self, field, op, value):
        return _FakeQuery(self._collection, [*self._filters, (field, op, value)], self._limit_n)

    def limit(self, n):
        return _FakeQuery(self._collection, list(self._filters), n)

    def get(self):
        return self.stream()

    def stream(self, transaction=None):  # noqa: ARG002 - parity with firestore API
        out = []
        for doc_id, data in self._collection._docs.items():
            match = True
            for field, op, value in self._filters:
                if op != "==":
                    raise AssertionError(f"Unsupported op in fake query: {op}")
                if (data or {}).get(field) != value:
                    match = False
                    break
            if match:
                out.append(_FakeDocSnapshot(doc_id, data))
        if self._limit_n is not None:
            out = out[: self._limit_n]
        return out


class _FakeCollection:
    def __init__(self):
        self._docs = {}

    def document(self, doc_id):
        return _FakeDocumentRef(self, doc_id)

    def where(self, field, op, value):
        return _FakeQuery(self, [(field, op, value)], None)


class _FakeDB:
    def __init__(self):
        self._cols = {}

    def collection(self, name):
        if name not in self._cols:
            self._cols[name] = _FakeCollection()
        return self._cols[name]

    def transaction(self):
        return _FakeTransaction()


class _FakeTransaction:
    def set(self, doc_ref, data):
        doc_ref.set(data)

    def update(self, doc_ref, data):
        doc_ref.update(data)


def _install_fake_stripe_invalid_sig(monkeypatch):
    class _SigErr(Exception):
        pass

    fake_module = types.SimpleNamespace()
    fake_module.SignatureVerificationError = _SigErr

    class _Webhook:
        @staticmethod
        def construct_event(payload, sig_header, secret):  # noqa: ARG004
            raise _SigErr("bad signature")

    fake_module.Webhook = _Webhook
    monkeypatch.setitem(sys.modules, "stripe", fake_module)


def test_checkout_status_is_idempotent_for_mock_session(monkeypatch):
    db = _FakeDB()
    monkeypatch.setattr(payments_api, "get_firestore", lambda: db)
    monkeypatch.setenv("STRIPE_SECRET_KEY", "")

    org_id = "org-1"
    user_id = "user-1"
    session_id = "mock_test_1"
    db.collection("members").document("member-1").set({"id": "member-1", "organization_id": org_id})
    db.collection("payment_sessions").document(session_id).set(
        {
            "org_id": org_id,
            "member_id": "member-1",
            "plan_id": "plan-1",
            "amount": 25.00,
            "user_id": user_id,
            "status": "pending",
        }
    )

    first = payments_api.get_checkout_status(org_id, session_id, user_id)
    second = payments_api.get_checkout_status(org_id, session_id, user_id)

    assert first["status"] == "completed"
    assert second["status"] == "completed"
    assert first["payment_id"] == second["payment_id"]

    payments = list(
        db.collection("payments")
        .where("organization_id", "==", org_id)
        .where("stripe_session_id", "==", session_id)
        .stream()
    )
    assert len(payments) == 1


def test_checkout_status_clamps_to_remaining_balance(monkeypatch):
    db = _FakeDB()
    monkeypatch.setattr(payments_api, "get_firestore", lambda: db)
    monkeypatch.setenv("STRIPE_SECRET_KEY", "")

    org_id = "org-1"
    user_id = "user-1"
    member_id = "member-1"
    plan_id = "plan-1"
    session_id = "mock_test_2"

    db.collection("members").document(member_id).set({"id": member_id, "organization_id": org_id})
    db.collection("dues_plans").document(plan_id).set(
        {"id": plan_id, "organization_id": org_id, "name": "Annual Dues", "total_amount": 100.0}
    )
    db.collection("payments").document("existing").set(
        {
            "id": "existing",
            "organization_id": org_id,
            "member_id": member_id,
            "plan_id": plan_id,
            "amount": 90.0,
        }
    )
    db.collection("payment_sessions").document(session_id).set(
        {
            "org_id": org_id,
            "member_id": member_id,
            "plan_id": plan_id,
            "amount": 25.0,
            "user_id": user_id,
            "status": "pending",
        }
    )

    res = payments_api.get_checkout_status(org_id, session_id, user_id)
    assert res["status"] == "completed"

    new_payment = list(
        db.collection("payments")
        .where("organization_id", "==", org_id)
        .where("stripe_session_id", "==", session_id)
        .limit(1)
        .stream()
    )[0].to_dict()
    assert new_payment["amount"] == 10.0

    all_plan_payments = list(
        db.collection("payments")
        .where("organization_id", "==", org_id)
        .where("member_id", "==", member_id)
        .where("plan_id", "==", plan_id)
        .stream()
    )
    total = sum(float(p.to_dict().get("amount", 0) or 0) for p in all_plan_payments)
    assert total == 100.0


def test_connect_webhook_rejects_invalid_signature(monkeypatch):
    _install_fake_stripe_invalid_sig(monkeypatch)
    monkeypatch.setenv("STRIPE_CONNECT_WEBHOOK_SECRET", "whsec_test")
    body = json.dumps(
        {"id": "evt_test", "type": "account.updated", "data": {"object": {"id": "acct_test"}}}
    ).encode("utf-8")

    async def _receive():
        return {"type": "http.request", "body": body, "more_body": False}

    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/billing/webhook/connect",
        "headers": [(b"stripe-signature", b"invalid")],
    }
    response = asyncio.run(billing_api.stripe_connect_webhook(Request(scope, _receive)))

    assert response.status_code == 400
    assert json.loads(response.body.decode("utf-8"))["detail"] == "Invalid signature"


def test_subscription_webhook_rejects_invalid_signature(monkeypatch):
    _install_fake_stripe_invalid_sig(monkeypatch)
    monkeypatch.setenv("STRIPE_SUBSCRIPTION_WEBHOOK_SECRET", "whsec_test")
    body = json.dumps({"id": "evt_test", "type": "invoice.paid", "data": {"object": {}}}).encode("utf-8")

    async def _receive():
        return {"type": "http.request", "body": body, "more_body": False}

    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/billing/webhook/subscription",
        "headers": [(b"stripe-signature", b"invalid")],
    }
    response = asyncio.run(billing_api.stripe_subscription_webhook(Request(scope, _receive)))

    assert response.status_code == 400
    assert json.loads(response.body.decode("utf-8"))["detail"] == "Invalid signature"


def test_billing_state_refreshes_stale_connect_status(monkeypatch):
    db = _FakeDB()
    monkeypatch.setattr(billing_api, "get_firestore", lambda: db)

    org_id = "org-connect-1"
    user_id = "user-connect-1"
    old = datetime.now(timezone.utc) - timedelta(hours=1)

    db.collection("members").document("m1").set(
        {
            "id": "m1",
            "organization_id": org_id,
            "user_id": user_id,
            "status": "approved",
            "role": "owner",
        }
    )
    db.collection("organizations").document(org_id).set(
        {
            "id": org_id,
            "name": "Org",
            "is_pro": False,
            "billing_status": "inactive",
            "stripe_connected_account_id": "acct_123",
            "stripe_connect_charges_enabled": False,
            "stripe_connect_payouts_enabled": False,
            "stripe_connect_updated_at": old,
        }
    )

    class _FakeAccount:
        id = "acct_123"
        details_submitted = True
        charges_enabled = True
        payouts_enabled = True

    class _FakeStripe:
        class Account:
            @staticmethod
            def retrieve(account_id):  # noqa: ARG004
                return _FakeAccount()

    monkeypatch.setattr(billing_api, "_get_stripe", lambda: _FakeStripe())
    result = billing_api.get_billing_state(org_id, user_id)

    assert result["stripe_connect_ready"] is True
    org = db.collection("organizations").document(org_id).get().to_dict()
    assert org["stripe_connect_charges_enabled"] is True
    assert org["stripe_connect_payouts_enabled"] is True


def test_billing_state_refreshes_missing_connect_timestamp(monkeypatch):
    db = _FakeDB()
    monkeypatch.setattr(billing_api, "get_firestore", lambda: db)

    org_id = "org-connect-2"
    user_id = "user-connect-2"

    db.collection("members").document("m2").set(
        {
            "id": "m2",
            "organization_id": org_id,
            "user_id": user_id,
            "status": "approved",
            "role": "owner",
        }
    )
    db.collection("organizations").document(org_id).set(
        {
            "id": org_id,
            "name": "Org 2",
            "is_pro": False,
            "billing_status": "inactive",
            "stripe_connected_account_id": "acct_456",
            "stripe_connect_charges_enabled": False,
            "stripe_connect_payouts_enabled": False,
            # intentionally no stripe_connect_updated_at
        }
    )

    class _FakeAccount:
        id = "acct_456"
        details_submitted = True
        charges_enabled = True
        payouts_enabled = True

    class _FakeStripe:
        class Account:
            @staticmethod
            def retrieve(account_id):  # noqa: ARG004
                return _FakeAccount()

    monkeypatch.setattr(billing_api, "_get_stripe", lambda: _FakeStripe())
    result = billing_api.get_billing_state(org_id, user_id)

    assert result["stripe_connect_ready"] is True
    org = db.collection("organizations").document(org_id).get().to_dict()
    assert org["stripe_connect_charges_enabled"] is True
    assert org["stripe_connect_payouts_enabled"] is True


def _install_fake_stripe_connect_event(monkeypatch, event, *, account_obj=None):
    class _SigErr(Exception):
        pass

    class _Webhook:
        @staticmethod
        def construct_event(payload, sig_header, secret):  # noqa: ARG004
            return event

    fake_module = types.SimpleNamespace()
    fake_module.SignatureVerificationError = _SigErr
    fake_module.Webhook = _Webhook
    fake_module.api_key = ""

    class _AccountApi:
        @staticmethod
        def retrieve(account_id):  # noqa: ARG004
            return account_obj

    fake_module.Account = _AccountApi
    monkeypatch.setitem(sys.modules, "stripe", fake_module)


def test_connect_webhook_syncs_capability_updates(monkeypatch):
    db = _FakeDB()
    monkeypatch.setattr(billing_api, "get_firestore", lambda: db)
    monkeypatch.setenv("STRIPE_CONNECT_WEBHOOK_SECRET", "whsec_test")
    org_id = "org-cap-1"
    acct_id = "acct_cap_1"

    db.collection("organizations").document(org_id).set(
        {
            "id": org_id,
            "name": "Cap Org",
            "stripe_connected_account_id": acct_id,
            "stripe_connect_charges_enabled": False,
            "stripe_connect_payouts_enabled": False,
        }
    )

    event = {
        "id": "evt_cap_1",
        "type": "capability.updated",
        "data": {"object": {"id": "ca_123", "account": acct_id, "status": "active"}},
    }

    class _Account:
        id = acct_id
        details_submitted = True
        charges_enabled = True
        payouts_enabled = True
        capabilities = {"card_payments": "active", "transfers": "active"}
        requirements = {"currently_due": []}

        def to_dict(self):
            return {
                "id": self.id,
                "details_submitted": self.details_submitted,
                "charges_enabled": self.charges_enabled,
                "payouts_enabled": self.payouts_enabled,
                "capabilities": self.capabilities,
                "requirements": self.requirements,
            }

    _install_fake_stripe_connect_event(monkeypatch, event, account_obj=_Account())
    body = json.dumps(event).encode("utf-8")

    async def _receive():
        return {"type": "http.request", "body": body, "more_body": False}

    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/billing/webhook/connect",
        "headers": [(b"stripe-signature", b"valid")],
    }
    result = asyncio.run(billing_api.stripe_connect_webhook(Request(scope, _receive)))
    assert result == {"status": "ok"}

    org = db.collection("organizations").document(org_id).get().to_dict()
    assert org["stripe_connect_charges_enabled"] is True
    assert org["stripe_connect_payouts_enabled"] is True
    assert org["stripe_connect_capabilities"]["card_payments"] == "active"


def test_connect_webhook_records_latest_payout_event(monkeypatch):
    db = _FakeDB()
    monkeypatch.setattr(billing_api, "get_firestore", lambda: db)
    monkeypatch.setenv("STRIPE_CONNECT_WEBHOOK_SECRET", "whsec_test")
    org_id = "org-payout-1"
    acct_id = "acct_pay_1"

    db.collection("organizations").document(org_id).set(
        {
            "id": org_id,
            "name": "Payout Org",
            "stripe_connected_account_id": acct_id,
            "stripe_connect_charges_enabled": True,
            "stripe_connect_payouts_enabled": True,
        }
    )

    event = {
        "id": "evt_pay_1",
        "type": "payout.paid",
        "account": acct_id,
        "data": {
            "object": {
                "id": "po_123",
                "amount": 12500,
                "currency": "usd",
                "status": "paid",
                "arrival_date": int(datetime.now(timezone.utc).timestamp()),
            }
        },
    }

    class _Account:
        id = acct_id
        details_submitted = True
        charges_enabled = True
        payouts_enabled = True
        capabilities = {"card_payments": "active", "transfers": "active"}
        requirements = {"currently_due": []}

        def to_dict(self):
            return {
                "id": self.id,
                "details_submitted": self.details_submitted,
                "charges_enabled": self.charges_enabled,
                "payouts_enabled": self.payouts_enabled,
                "capabilities": self.capabilities,
                "requirements": self.requirements,
            }

    _install_fake_stripe_connect_event(monkeypatch, event, account_obj=_Account())
    body = json.dumps(event).encode("utf-8")

    async def _receive():
        return {"type": "http.request", "body": body, "more_body": False}

    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/billing/webhook/connect",
        "headers": [(b"stripe-signature", b"valid")],
    }
    result = asyncio.run(billing_api.stripe_connect_webhook(Request(scope, _receive)))
    assert result == {"status": "ok"}

    org = db.collection("organizations").document(org_id).get().to_dict()
    assert org["stripe_connect_last_payout_id"] == "po_123"
    assert org["stripe_connect_last_payout_status"] == "paid"
    assert org["stripe_connect_last_payout_amount_cents"] == 12500
    assert org["stripe_connect_last_payout_currency"] == "usd"
    assert org["stripe_connect_last_payout_event_type"] == "payout.paid"
