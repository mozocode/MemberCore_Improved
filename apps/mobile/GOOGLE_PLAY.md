# Google Play – Build and submit with EAS

EAS (Expo Application Services) can **build** your app as an **AAB** (Android App Bundle) and **submit** it to Google Play. You don’t need Expo Go for this; EAS Build produces a standalone app.

## 1. Build for Google Play (AAB)

From the **repo root**:

```bash
npm run build:play
```

This uses the **production** profile and produces an **Android App Bundle (.aab)** — the format Google Play requires. When the build finishes, EAS will give you an artifact URL.

## 2. Submit to Google Play

After a successful build:

```bash
npm run submit:play
```

That submits the **latest** Android build to Google Play using the credentials in `eas.json` (production profile). By default it’s set to the **internal** testing track.

### Submitting to other tracks

To send a specific build to a different track (e.g. production), run from `apps/mobile`:

```bash
npx eas-cli submit --platform android --profile production --latest
# Or with a specific build ID:
npx eas-cli submit --platform android --profile production --id <BUILD_ID>
```

Edit `eas.json` → `submit.production.android` and set `"track": "internal"` | `"alpha"` | `"beta"` | `"production"` as needed.

## 3. Google Play service account (required for submit)

For EAS to upload to Google Play, you need a **Google Cloud service account** with access to the Play Developer API.

1. **Google Play Console**  
   Create your app (or use existing) at [play.google.com/console](https://play.google.com/console).

2. **Create a service account**  
   - [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → Create Credentials → Service Account.  
   - Create a key (JSON) and download it.

3. **Grant access in Play Console**  
   - Play Console → Setup → API access → Link the project (or use existing).  
   - Invite the service account email and give at least **Release to production, exclude devices, and use Play App Signing** (or the permissions you need).  
   - Accept the invite in the service account’s email if required.

4. **Put the key in the project**  
   Save the JSON key as:

   ```
   apps/mobile/google-service-account.json
   ```

   **Important:** Add `google-service-account.json` to `.gitignore` so the key is never committed.

5. **eas.json**  
   Your `submit.production.android` already points to it:

   ```json
   "android": {
     "serviceAccountKeyPath": "./google-service-account.json",
     "track": "internal"
   }
   ```

## Summary

| Goal                    | Command              |
|-------------------------|----------------------|
| Build AAB for Play      | `npm run build:play` |
| Submit latest to Play   | `npm run submit:play`|

Expo Go is only for **development** (running the app on device from your dev server). For Google Play you use **EAS Build** (build:play) and **EAS Submit** (submit:play).
