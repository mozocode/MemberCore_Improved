# MemberCore

Membership and organization management platform for clubs, fraternities, sororities, and professional organizations.

## Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS + TypeScript
- **Backend**: FastAPI (Python 3.10+)
- **Database**: Firebase Firestore

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.10+
- Firebase project with Firestore (or use the [Firestore Emulator](https://firebase.google.com/docs/emulator-suite/connect_firestore) for local dev)

### Backend

**Option A: Firebase Emulator (recommended for local dev)**

```bash
# Install Firebase CLI: npm install -g firebase-tools
firebase init emulators   # select Firestore
firebase emulators:start --only firestore   # runs on port 8080
```

In another terminal:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate   # or venv\Scripts\activate on Windows
pip install -r requirements.txt
export FIRESTORE_EMULATOR_HOST=localhost:8080
uvicorn app.main:app --reload --port 8001
```

**Option B: Real Firebase**

1. Create a Firebase project and enable Firestore.
2. Generate a service account key (JSON) and save as `backend/service-account.json`.
3. Copy `backend/.env.example` to `backend/.env` and set `JWT_SECRET`.
4. Set `GOOGLE_APPLICATION_CREDENTIALS=./service-account.json`.

```bash
cd backend
python3 -m venv venv
source venv/bin/activate   # or venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

### Frontend (web)

From the repo root (monorepo):

```bash
cd apps/web
npm install
npm run dev
```

The app runs at http://localhost:3000. The API is at http://localhost:8001.

### Environment Variables

**Backend** (`.env`):
- `JWT_SECRET` – Secret for JWT signing
- `SUPER_ADMIN_EMAIL` – Email that receives platform admin access
- `GOOGLE_APPLICATION_CREDENTIALS` – Path to Firebase service account JSON
- `GOOGLE_CLIENT_IDS` – Comma-separated allowed Google OAuth client IDs (web/iOS/android)
- `GOOGLE_OAUTH_CLIENT_ID` – Google OAuth web client ID (required for calendar auto-sync connect flow)
- `GOOGLE_OAUTH_CLIENT_SECRET` – Google OAuth web client secret (required for refresh token exchange)
- `GOOGLE_CALENDAR_OAUTH_REDIRECT_URI` – Backend callback URL for Google calendar auto-sync
- `GOOGLE_CALENDAR_SYNC_SECRET` – Shared secret for Cloud Scheduler daily sync endpoint

**Frontend** (`apps/web/.env`):
- `VITE_BACKEND_URL` – API base URL (default: `/api`; Vite proxy forwards to backend)
- `VITE_GOOGLE_WEB_CLIENT_ID` – Google OAuth web client ID for Google sign-in

**Mobile** (Expo env / EAS secrets):
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` – Google OAuth web client ID
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` – Google OAuth iOS client ID
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` – Google OAuth Android client ID
- `EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID` – Optional Expo Go client ID

## Testing

### Backend (pytest)

Run the test suite from the backend directory using the project venv:

```bash
cd backend
source venv/bin/activate   # or venv\Scripts\activate on Windows
pip install -r requirements.txt   # if not already installed
pytest tests/ -v
```

To run with shorter output: `pytest tests/ -q`

### Web (build)

Verify the web app builds without errors:

```bash
cd apps/web
npm install
npm run build
# or: npx vite build
```

## Features

- Authentication (signup, signin, Google OAuth, JWT)
- Organization creation and listing
- Role-based access (Owner, Admin, Member, Restricted)
- Member management with approval workflow
- Real-time chat (WebSockets)
- Server now auto-compresses uploaded images before DB storage.
- Events & calendar with RSVP + Google Calendar import/auto-sync
- Polls
- Dues & treasury
- Documents
- Public event directory
- Analytics
- Super admin dashboard

## Project Structure

```
MemberCore/
├── apps/
│   ├── web/           # React (Vite) app
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── contexts/
│   │   │   ├── lib/
│   │   │   └── pages/
│   │   └── ...
│   └── mobile/        # React Native / Expo (optional)
├── backend/           # FastAPI app
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   └── main.py
│   ├── tests/
│   └── requirements.txt
└── README.md
```
