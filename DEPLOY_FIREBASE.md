# Deploying MemberCore to Firebase (Hosting + Cloud Run)

**Important:** Deploy **from the MemberCore project root** (the folder that contains `firebase.json` and `frontend/`), not from inside `frontend/`. Otherwise the CLI may use the wrong Firebase project (e.g. imani-alumni instead of membercore-f0b3f).

From the project root you can run:
```bash
npm run deploy:hosting
```
That switches to `membercore-f0b3f` and deploys hosting. Or run manually:
```bash
firebase use membercore-f0b3f
firebase deploy --only hosting
```

---

MemberCore has two parts:

- **Frontend** (React/Vite) → **Firebase Hosting**
- **Backend** (FastAPI) → **Google Cloud Run** (Firebase doesn’t run Python APIs; Cloud Run is the standard choice and uses the same Firebase/GCP project)

---

## Prerequisites

- Node.js and npm (for frontend build)
- [Firebase CLI](https://firebase.google.com/docs/cli): `npm install -g firebase-tools`
- [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) (for Cloud Run)
- A Firebase / Google Cloud project with Blaze (pay-as-you-go) if you use Cloud Run

---

## 1. Frontend: Build and deploy to Firebase Hosting

From the **project root** (where `firebase.json` lives):

```bash
# Install frontend deps and build (production API URL is required)
cd frontend
npm ci
VITE_BACKEND_URL=https://YOUR-CLOUD-RUN-URL/api npm run build
cd ..
```

Replace `YOUR-CLOUD-RUN-URL` with your Cloud Run service URL (e.g. `https://membercore-api-xxxxx.run.app`). You’ll get this after deploying the backend in step 2. **Include `/api` at the end of the URL**—the backend mounts all routes under `/api`.

```bash
# Login and select project (first time only)
firebase login
firebase use YOUR_PROJECT_ID

# Deploy hosting (serves frontend/dist)
firebase deploy --only hosting
```

Your app will be at:

- `https://YOUR_PROJECT_ID.web.app`
- `https://YOUR_PROJECT_ID.firebaseapp.com`

---

## 2. Backend: Deploy to Google Cloud Run

Cloud Run runs your FastAPI app in a container. From the **project root**:

### Option A: Deploy with gcloud (recommended)

```bash
# Configure project
gcloud config set project YOUR_PROJECT_ID

# Build and push the image, then deploy (replace REGION e.g. us-central1)
gcloud run deploy membercore-api \
  --source backend \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars 'CORS_ORIGINS=https://YOUR_PROJECT_ID.web.app,https://YOUR_PROJECT_ID.firebaseapp.com'
```

`--source backend` uses Cloud Build to build the `backend/Dockerfile` and deploy. After deployment, gcloud prints the service URL (e.g. `https://membercore-api-xxxxx.run.app`).

### Option B: Build the image yourself and push to Artifact Registry

```bash
cd backend
docker build -t gcr.io/YOUR_PROJECT_ID/membercore-api .
docker push gcr.io/YOUR_PROJECT_ID/membercore-api
gcloud run deploy membercore-api \
  --image gcr.io/YOUR_PROJECT_ID/membercore-api \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars 'CORS_ORIGINS=https://YOUR_PROJECT_ID.web.app,https://YOUR_PROJECT_ID.firebaseapp.com'
```

### Backend environment variables on Cloud Run

Set these in the Cloud Run service (Console → Cloud Run → your service → Edit → Variables & Secrets), or via gcloud:

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Same secret you use in production (generate a strong random string). |
| `GOOGLE_APPLICATION_CREDENTIALS` | Leave unset on Cloud Run; the default service account is used. |
| `GCLOUD_PROJECT` | Optional; defaults to the project Cloud Run runs in. |
| `CORS_ORIGINS` | Comma-separated origins (e.g. your Firebase Hosting URLs). |

For production, do **not** rely on a local `service-account.json` in the image. Cloud Run’s service account should have “Cloud Datastore User” (or Firestore) and any other roles your app needs.

---

## 3. Wire frontend to the backend

1. Deploy the backend first and copy the Cloud Run URL.
2. Build the frontend with that URL:
   ```bash
   cd frontend
   VITE_BACKEND_URL=https://membercore-api-xxxxx.run.app/api npm run build
   ```
3. Deploy hosting again so the new build is live:
   ```bash
   firebase deploy --only hosting
   ```

---

## 4. Optional: Custom domain

- **Firebase Hosting**: Add a custom domain in Firebase Console → Hosting.
- **Cloud Run**: Map a domain in Cloud Run → your service → “Manage custom domains,” or put Cloud Run behind a load balancer and attach the domain there.

---

## Troubleshooting: Login / API 404 on the live site

If sign-in (or any API call) on the live site shows **404** in the browser console:

- The frontend is calling **membercore.io/api/...** (or your Hosting URL + `/api`). Firebase Hosting only serves static files; there is no API there, so those requests fail.
- **Cause:** The frontend was built **without** `VITE_BACKEND_URL`. In that case the app uses `/api` (same origin), which doesn’t exist on Hosting.

**Fix:**

1. **Deploy the backend** to Cloud Run (Section 2) if you haven’t, and note the service URL (e.g. `https://membercore-api-xxxxx.run.app`).
2. **Rebuild the frontend** with that URL so the app talks to Cloud Run instead of `/api`:
   ```bash
   cd frontend
   VITE_BACKEND_URL=https://membercore-api-xxxxx.run.app/api npm run build
   ```
3. **Redeploy Hosting** so the new build is live:
   ```bash
   firebase deploy --only hosting
   ```

Also ensure the backend allows your live origin in **CORS**: set `CORS_ORIGINS` on Cloud Run to include your Hosting URLs (e.g. `https://membercore.io`, `https://YOUR_PROJECT_ID.web.app`).

---

## Troubleshooting: 500 Internal Server Error / CORS blocked on login

If the live site shows **500** on `/api/auth/signin` or **CORS policy** blocking the request:

1. **Set `JWT_SECRET` on Cloud Run**  
   Cloud Run → your service (`membercore-api`) → **Edit & deploy new revision** → **Variables & Secrets** → add variable `JWT_SECRET` with a long random string (e.g. generate with `openssl rand -hex 32`). Redeploy.

2. **Grant Firestore access to the Cloud Run service account**  
   In [IAM](https://console.cloud.google.com/iam-admin/iam), find the service account used by Cloud Run (e.g. `PROJECT_NUMBER-compute@developer.gserviceaccount.com`). Add role **Cloud Datastore User** (or **Firestore** if listed). Without this, the backend cannot reach Firestore and may return 500.

3. **Confirm `CORS_ORIGINS` and `GCLOUD_PROJECT`**  
   The repo’s `backend/env.yaml` includes `CORS_ORIGINS` and `GCLOUD_PROJECT`. Redeploy the backend with `--env-vars-file=backend/env.yaml` so these are set. If you use the Console, add `GCLOUD_PROJECT` = your project ID (e.g. `membercore-f0b3f`).

4. **Check Cloud Run logs**  
   Cloud Run → **membercore-api** → **Logs**. Look for the Python traceback when the 500 occurs; it will show the exact error (e.g. permission denied, missing env).

---

## Quick reference

| What | Command / URL |
|------|----------------|
| Deploy frontend | `firebase deploy --only hosting` |
| Deploy backend | `gcloud run deploy membercore-api --source backend --region us-central1 --allow-unauthenticated` |
| Frontend URL | `https://YOUR_PROJECT_ID.web.app` |
| Backend URL | Shown after `gcloud run deploy` (e.g. `https://membercore-api-xxxxx.run.app`) |
| Build frontend for prod | `VITE_BACKEND_URL=<backend-url>/api npm run build` (in `frontend/`) |

After this, your app is “hosted on Firebase” in the sense that the UI is on Firebase Hosting and the API runs on Cloud Run in the same GCP project as Firebase/Firestore.
