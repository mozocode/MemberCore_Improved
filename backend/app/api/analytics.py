"""Analytics API - overview metrics for org admins."""
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends

from app.db.firebase import get_firestore
from app.core.security import get_current_user_id

router = APIRouter()


def _require_admin_or_owner(db, org_id: str, user_id: str):
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
        raise HTTPException(status_code=403, detail="Admin or owner access required")
    return role


def _parse_period(period: str):
    """Return (start_dt, end_dt, label). end_dt is now."""
    now = datetime.now(timezone.utc)
    end = now
    if period == "7d":
        start = now - timedelta(days=7)
        label = "last 7 days"
    elif period == "90d":
        start = now - timedelta(days=90)
        label = "last 90 days"
    elif period == "all":
        start = datetime(2020, 1, 1, tzinfo=timezone.utc)
        label = "all time"
    else:
        start = now - timedelta(days=30)
        label = "last 30 days"
    return start, end, label


def _to_dt(v):
    if v is None:
        return None
    if hasattr(v, "timestamp"):
        return v
    if isinstance(v, str):
        try:
            return datetime.fromisoformat(v.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            return None
    return None


@router.get("/{org_id}/overview")
def get_analytics_overview(
    org_id: str,
    period: str = "30d",
    user_id: str = Depends(get_current_user_id),
):
    """Full analytics for dashboard. Admin/owner only."""
    db = get_firestore()
    _require_admin_or_owner(db, org_id, user_id)
    start_dt, end_dt, period_label = _parse_period(period)

    def in_period(dt_val):
        dt = _to_dt(dt_val)
        return dt and start_dt <= dt <= end_dt if dt else False

    def on_or_before(dt_val, when):
        dt = _to_dt(dt_val)
        return dt and dt <= when if dt else False

    # Members
    member_docs = list(
        db.collection("members")
        .where("organization_id", "==", org_id)
        .where("status", "==", "approved")
        .stream()
    )
    by_role = {"owner": 0, "admin": 0, "member": 0, "restricted": 0}
    new_in_period = 0
    member_dates = []
    for m in member_docs:
        md = m.to_dict()
        r = md.get("role", "member")
        by_role[r] = by_role.get(r, 0) + 1
        dt = _to_dt(md.get("approved_at") or md.get("joined_at"))
        if dt:
            member_dates.append(dt)
            if in_period(dt):
                new_in_period += 1
    total_members = len(member_docs)

    # Growth trend: bucket by day (last N days)
    growth_trend = []
    if period != "all":
        days = 7 if period == "7d" else min(30 if period == "30d" else 90, 90)
        for i in range(days, -1, -1):
            day_end = end_dt - timedelta(days=i)
            day_start = day_end.replace(hour=0, minute=0, second=0, microsecond=0)
            count = sum(1 for d in member_dates if on_or_before(d, day_end))
            growth_trend.append({"month": day_start.strftime("%m/%d"), "count": count})
    else:
        growth_trend = [{"month": "All", "count": total_members}]

    # Events
    event_docs = list(
        db.collection("events")
        .where("organization_id", "==", org_id)
        .stream()
    )
    now = datetime.now(timezone.utc)
    upcoming = 0
    past_in_period = 0
    event_attendance = []
    for e in event_docs:
        ed = e.to_dict()
        st = _to_dt(ed.get("start_time") or ed.get("event_date"))
        if st:
            if st > now:
                upcoming += 1
            elif in_period(st):
                past_in_period += 1
        rsvps = list(db.collection("event_rsvps").where("event_id", "==", e.id).stream())
        yes_count = sum(1 for r in rsvps if r.to_dict().get("status") == "yes")
        event_attendance.append({
            "title": ed.get("title", "Event"),
            "date": st.isoformat()[:10] if st else "",
            "attendance": yes_count,
        })
    event_attendance.sort(key=lambda x: -x["attendance"])
    top_events = event_attendance[:5]
    total_attendance = sum(x["attendance"] for x in event_attendance)
    avg_attendance = (total_attendance / len(event_attendance)) if event_attendance else 0

    # Revenue: payments (dues) + event_tickets
    payment_docs = list(
        db.collection("payments")
        .where("organization_id", "==", org_id)
        .stream()
    )
    dues_revenue = 0.0
    dues_in_period = 0.0
    for p in payment_docs:
        pd = p.to_dict()
        amt = float(pd.get("amount", 0))
        dues_revenue += amt
        created = _to_dt(pd.get("created_at"))
        if created and in_period(created):
            dues_in_period += amt

    ticket_docs = list(
        db.collection("event_tickets")
        .where("organization_id", "==", org_id)
        .stream()
    )
    ticket_revenue = 0.0
    ticket_in_period = 0.0
    revenue_by_date = []
    for t in ticket_docs:
        td = t.to_dict()
        if td.get("status") == "refunded":
            continue
        amt = float(td.get("amount", 0))
        ticket_revenue += amt
        created = _to_dt(td.get("created_at"))
        if created:
            if in_period(created):
                ticket_in_period += amt
            revenue_by_date.append((created, amt))
    total_revenue = dues_revenue + ticket_revenue

    revenue_trend = []
    if period != "all" and revenue_by_date:
        days = 7 if period == "7d" else min(30 if period == "30d" else 90, 90)
        for i in range(days, -1, -1):
            day_end = end_dt - timedelta(days=i)
            day_start = day_end.replace(hour=0, minute=0, second=0, microsecond=0)
            amt = sum(a for d, a in revenue_by_date if on_or_before(d, day_end) and d >= day_start)
            revenue_trend.append({"month": day_start.strftime("%m/%d"), "amount": round(amt, 2)})
    else:
        revenue_trend = [{"month": "All", "amount": round(total_revenue, 2)}]

    # Outstanding dues: members with no or partial payment (simplified: count members who are not paid_in_full from treasury logic)
    plan_docs = list(
        db.collection("dues_plans")
        .where("organization_id", "==", org_id)
        .where("is_active", "==", True)
        .stream()
    )
    total_required = sum(
        (p.to_dict().get("total_amount") if p.to_dict().get("total_amount") is not None else p.to_dict().get("amount", 0))
        for p in plan_docs
    )
    member_paid = {}
    for p in payment_docs:
        pd = p.to_dict()
        mid = pd.get("member_id")
        if mid:
            member_paid[mid] = member_paid.get(mid, 0) + float(pd.get("amount", 0))
    outstanding_count = 0
    if total_required > 0:
        for m in member_docs:
            mid = m.id
            paid = member_paid.get(mid, 0)
            if paid < total_required and not m.to_dict().get("dues_paid_in_full"):
                outstanding_count += 1

    # Messages (messages have organization_id)
    message_docs = list(
        db.collection("messages")
        .where("organization_id", "==", org_id)
        .stream()
    )
    messages_in_period = sum(1 for m in message_docs if in_period(m.to_dict().get("created_at")))
    messages_this_week = sum(
        1 for m in message_docs
        if in_period(m.to_dict().get("created_at"))
        and _to_dt(m.to_dict().get("created_at")) >= now - timedelta(days=7)
    )

    # Channels
    channel_docs = list(
        db.collection("channels")
        .where("organization_id", "==", org_id)
        .stream()
    )
    active_channels = len(channel_docs)

    # Polls
    poll_docs = list(db.collection("polls").where("organization_id", "==", org_id).stream())
    total_polls = len(poll_docs)
    total_poll_votes = 0
    for p in poll_docs:
        votes = list(db.collection("poll_votes").where("poll_id", "==", p.id).stream())
        total_poll_votes += len(votes)

    return {
        "period": period,
        "period_label": period_label,
        "members": {
            "total": total_members,
            "by_role": by_role,
            "new_in_period": new_in_period,
            "growth_trend": growth_trend,
        },
        "events": {
            "total": len(event_docs),
            "upcoming": upcoming,
            "past_in_period": past_in_period,
            "avg_attendance": round(avg_attendance, 1),
            "total_attendance": total_attendance,
            "top_events": top_events,
        },
        "financial": {
            "total_revenue": round(total_revenue, 2),
            "dues_revenue": round(dues_revenue, 2),
            "dues_revenue_period": round(dues_in_period, 2),
            "ticket_revenue": round(ticket_revenue, 2),
            "ticket_revenue_period": round(ticket_in_period, 2),
            "outstanding_dues_count": outstanding_count,
            "revenue_trend": revenue_trend,
        },
        "engagement": {
            "messages_in_period": messages_in_period,
            "messages_this_week": messages_this_week,
            "active_channels": active_channels,
            "total_polls": total_polls,
            "total_poll_votes": total_poll_votes,
        },
    }
