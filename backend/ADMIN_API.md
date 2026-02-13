# Platform Admin API

All admin endpoints require `Authorization: Bearer <token>` and the user must have `is_platform_admin: true`. Set `SUPER_ADMIN_EMAIL` in `.env` to grant platform admin to that user on signup.

## Admin Verify
- `GET /api/admin/verify` - Verify admin access

## Overview
- `GET /api/admin/overview?period_days=30` - Platform metrics
- `GET /api/admin/verification-queue` - Orgs pending verification
- `GET /api/admin/org-type-requests` - "Other" type requests
- `GET /api/admin/reports/summary` - Reports summary

## Organizations Dashboard
- `GET /api/admin/organizations?search=&verified=&suspended=&subscription=` - List all orgs
- `GET /api/admin/organizations/{org_id}` - Full org profile + admin notes + verification history

### Row Actions
- `POST /api/admin/organizations/{org_id}/verify?note=` - Verify org
- `POST /api/admin/organizations/{org_id}/unverify?note=` - Unverify org
- `POST /api/admin/organizations/{org_id}/admin-notes` - Add admin note `{"content":"..."}`
- `POST /api/admin/organizations/{org_id}/suspend?note=` - Suspend org
- `POST /api/admin/organizations/{org_id}/unsuspend` - Unsuspend org
- `DELETE /api/admin/organizations/{org_id}?hard=false` - Soft (default) or hard delete

### Billing
- `POST /api/admin/organizations/{org_id}/billing/downgrade` - Force to Free
- `POST /api/admin/organizations/{org_id}/billing/restore-pro` - Restore Pro
- `POST /api/admin/organizations/{org_id}/billing/billing-exempt` - Mark billing exempt

### Ownership & Features
- `POST /api/admin/organizations/{org_id}/transfer-ownership` - `{"new_owner_user_id":"..."}`
- `PATCH /api/admin/organizations/{org_id}/feature-overrides` - Toggle chat, directory, payments, documents, member_approvals
- `PATCH /api/admin/organizations/{org_id}/enforcement` - suspend, restrict_public_visibility, disable_event_creation, enforcement_note
- `PATCH /api/admin/organizations/{org_id}/identity` - type, cultural_identity, organization_family, lock_identifiers

### Events & Members
- `GET /api/admin/organizations/{org_id}/events` - List org events
- `POST /api/admin/organizations/{org_id}/events/{event_id}/remove-from-directory` - Remove from directory
- `POST /api/admin/organizations/{org_id}/events/{event_id}/flag?note=` - Flag event
- `GET /api/admin/organizations/{org_id}/members` - List org members

## Users
- `GET /api/admin/users?search=&suspended=&limit=100` - List users
- `GET /api/admin/users/{user_id}` - User profile
- `POST /api/admin/users/{user_id}/suspend` - Suspend user
- `POST /api/admin/users/{user_id}/activate` - Activate user
- `POST /api/admin/users/{user_id}/make-admin` - Grant platform admin
- `DELETE /api/admin/users/{user_id}` - Delete user

## Platform Admin Privileges
- Organizations created by platform admins get `platform_admin_owned: true`, `is_pro: true` (billing exempt)
- Platform admins never require payment for org creation
