"""Tests for CSV import + invite flow (members import-csv endpoint and parsing)."""
import io
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.api.members import (
    _csv_has_required_member_header_order,
    _normalize_csv_headers,
    _parse_csv_row,
)
from app.main import app


# --- Unit tests: CSV parsing ---

def test_normalize_csv_headers():
    row = ["First Name", "Last Name", "Email", "Role"]
    h = _normalize_csv_headers(row)
    assert h["first name"] == 0
    assert h["last name"] == 1
    assert h["email"] == 2
    assert h["role"] == 3


def test_parse_csv_row_valid():
    headers = {"first_name": 0, "last_name": 1, "email": 2, "role": 3}
    row = ["Jane", "Doe", "jane@example.com", "member"]
    out = _parse_csv_row(row, headers)
    assert out is not None
    assert out["first_name"] == "Jane"
    assert out["last_name"] == "Doe"
    assert out["email"] == "jane@example.com"
    assert out["role"] == "member"


def test_parse_csv_row_missing_email():
    headers = {"first_name": 0, "email": 1}
    row = ["Jane", ""]
    assert _parse_csv_row(row, headers) is None


def test_parse_csv_row_invalid_email():
    headers = {"email": 0}
    assert _parse_csv_row(["not-an-email"], headers) is None
    assert _parse_csv_row(["a@b"], headers) is None  # no TLD


def test_parse_csv_row_role_normalized():
    headers = {"email": 0, "role": 1}
    assert _parse_csv_row(["a@b.co", "admin"], headers)["role"] == "admin"
    assert _parse_csv_row(["a@b.co", "ADMIN"], headers)["role"] == "admin"
    assert _parse_csv_row(["a@b.co", "unknown"], headers)["role"] == "member"


def test_parse_csv_row_nickname_and_position():
    headers = {"first_name": 0, "last_name": 1, "email": 2, "nickname": 3, "position": 4}
    row = ["Jane", "Doe", "jane@example.com", "JD", "Treasurer"]
    out = _parse_csv_row(row, headers)
    assert out is not None
    assert out["nickname"] == "JD"
    assert out["title"] == "Treasurer"
    # "title" column is also accepted as alias for position
    headers2 = {"email": 0, "title": 1}
    assert _parse_csv_row(["a@b.co", "Secretary"], headers2)["title"] == "Secretary"


def test_required_member_header_order():
    assert _csv_has_required_member_header_order(["First Name", "Last Name", "Email"])
    assert _csv_has_required_member_header_order(["first_name", "last_name", "email"])
    assert not _csv_has_required_member_header_order(["Name", "Email", "Role"])
    assert not _csv_has_required_member_header_order(["Last Name", "First Name", "Email"])


# --- Integration test: import-csv endpoint ---

def _make_mock_firestore():
    """Firestore mock: current user is admin of org; no existing users/members for new emails."""
    db = MagicMock()
    mock_member_doc = MagicMock()
    mock_member_doc.to_dict.return_value = {"role": "admin", "organization_id": "org-1"}
    mock_member_doc.id = "mem-1"

    members_get_calls = [0]

    def members_get():
        members_get_calls[0] += 1
        return [mock_member_doc] if members_get_calls[0] == 1 else []

    # Chain: collection().where().where().limit(1).get()
    members_limit = MagicMock()
    members_limit.get.side_effect = members_get
    members_where2 = MagicMock()
    members_where2.limit.return_value = members_limit
    members_where1 = MagicMock()
    members_where1.where.return_value = members_where2
    members_col = MagicMock()
    members_col.where.return_value = members_where1
    members_col.document.return_value.set = MagicMock()

    users_query = MagicMock()
    users_query.limit.return_value = users_query
    users_query.get.return_value = []
    users_col = MagicMock()
    users_col.where.return_value = users_query
    users_col.document.return_value.set = MagicMock()

    def col(name):
        if name == "members":
            return members_col
        if name == "users":
            return users_col
        return MagicMock()

    db.collection.side_effect = col
    return db


def _make_mock_firestore_with_existing_user():
    """Firestore mock: current user is admin; imported email already exists as a platform user."""
    db = MagicMock()
    mock_member_doc = MagicMock()
    mock_member_doc.to_dict.return_value = {"role": "admin", "organization_id": "org-1"}
    mock_member_doc.id = "mem-1"

    members_get_calls = [0]

    def members_get():
        members_get_calls[0] += 1
        return [mock_member_doc] if members_get_calls[0] == 1 else []

    members_limit = MagicMock()
    members_limit.get.side_effect = members_get
    members_where2 = MagicMock()
    members_where2.limit.return_value = members_limit
    members_where1 = MagicMock()
    members_where1.where.return_value = members_where2
    members_col = MagicMock()
    members_col.where.return_value = members_where1
    members_col.document.return_value.set = MagicMock()

    existing_user_doc = MagicMock()
    existing_user_doc.id = "existing-user-1"
    existing_user_doc.to_dict.return_value = {"email": "jane.new@example.com", "name": "Jane Existing"}

    users_query = MagicMock()
    users_query.limit.return_value = users_query
    users_query.get.return_value = [existing_user_doc]
    users_col = MagicMock()
    users_col.where.return_value = users_query
    users_col.document.return_value.set = MagicMock()

    def col(name):
        if name == "members":
            return members_col
        if name == "users":
            return users_col
        return MagicMock()

    db.collection.side_effect = col
    return db


@patch("app.api.members.get_firestore")
def test_import_csv_endpoint_success(mock_get_firestore):
    mock_get_firestore.return_value = _make_mock_firestore()
    from app.core.security import get_current_user
    app.dependency_overrides[get_current_user] = lambda: {"id": "user-admin-1"}

    csv_content = b"first_name,last_name,email,role\nJane,Doe,jane.new@example.com,member\n"
    client = TestClient(app)
    try:
        response = client.post(
            "/api/organizations/org-1/members/import-csv",
            files={"file": ("members.csv", io.BytesIO(csv_content), "text/csv")},
        )
        assert response.status_code == 200, response.text
        data = response.json()
        assert "imported_count" in data
        assert "skipped_count" in data
        assert "rows" in data
        assert data["imported_count"] >= 1
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@patch("app.api.members.get_firestore")
def test_import_csv_skips_existing_platform_user(mock_get_firestore):
    mock_get_firestore.return_value = _make_mock_firestore_with_existing_user()
    from app.core.security import get_current_user
    app.dependency_overrides[get_current_user] = lambda: {"id": "user-admin-1"}

    csv_content = b"first_name,last_name,email,role\nJane,Doe,jane.new@example.com,member\n"
    client = TestClient(app)
    try:
        response = client.post(
            "/api/organizations/org-1/members/import-csv",
            files={"file": ("members.csv", io.BytesIO(csv_content), "text/csv")},
        )
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["imported_count"] == 0
        assert data["skipped_count"] >= 1
        assert any("already exists on membercore" in (r.get("error_message", "").lower()) for r in data.get("rows", []))
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@patch("app.api.members.get_firestore")
def test_import_csv_rejects_without_first_last_columns(mock_get_firestore):
    mock_get_firestore.return_value = _make_mock_firestore()
    from app.core.security import get_current_user
    app.dependency_overrides[get_current_user] = lambda: {"id": "user-admin-1"}

    csv_content = b"email,role\njane@example.com,member\n"
    client = TestClient(app)
    try:
        response = client.post(
            "/api/organizations/org-1/members/import-csv",
            files={"file": ("members.csv", io.BytesIO(csv_content), "text/csv")},
        )
        assert response.status_code == 400
        assert "column 1" in response.json().get("detail", "").lower()
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@patch("app.api.members.get_firestore")
def test_import_csv_rejects_wrong_first_two_columns(mock_get_firestore):
    mock_get_firestore.return_value = _make_mock_firestore()
    from app.core.security import get_current_user
    app.dependency_overrides[get_current_user] = lambda: {"id": "user-admin-1"}

    csv_content = b"name,email,first_name,last_name\nJane Doe,jane@example.com,Jane,Doe\n"
    client = TestClient(app)
    try:
        response = client.post(
            "/api/organizations/org-1/members/import-csv",
            files={"file": ("members.csv", io.BytesIO(csv_content), "text/csv")},
        )
        assert response.status_code == 400
        assert "column 1" in response.json().get("detail", "").lower()
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@patch("app.api.members.get_firestore")
def test_import_csv_rejects_non_csv(mock_get_firestore):
    mock_get_firestore.return_value = _make_mock_firestore()
    from app.core.security import get_current_user
    app.dependency_overrides[get_current_user] = lambda: {"id": "user-admin-1"}

    try:
        client = TestClient(app)
        response = client.post(
            "/api/organizations/org-1/members/import-csv",
            files={"file": ("data.txt", io.BytesIO(b"a,b\n1,2"), "text/plain")},
        )
        assert response.status_code == 400
        assert "csv" in response.json().get("detail", "").lower()
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_import_csv_requires_auth():
    client = TestClient(app)
    response = client.post(
        "/api/organizations/org-1/members/import-csv",
        files={"file": ("members.csv", io.BytesIO(b"email\na@b.com"), "text/csv")},
    )
    # No Bearer token -> 403 (Forbidden) or 401 (Unauthorized)
    assert response.status_code in (401, 403, 422)
