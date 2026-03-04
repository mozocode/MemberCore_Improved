# TestFlight – Get the build file and submit

The **file** for TestFlight is an **iOS .ipa** (or the app uploaded to App Store Connect). You don’t commit this file; you generate it with EAS Build, then either submit it to App Store Connect or download it.

## 1. Prerequisites (check before building)

**From the repo root**, run the check script:

```bash
npm run ensure:eas
```

It verifies you’re logged in to EAS and that the mobile app is linked to an EAS project. If something is missing, it will tell you what to run.

**Manual steps if you prefer:**

1. **Log in to EAS:**  
   ```bash
   cd apps/mobile
   npx eas-cli login
   ```  
   (Use your Expo account; create one at [expo.dev](https://expo.dev) if needed.)  
   **Tip:** Use `npx eas-cli` from `apps/mobile` (no global install needed). If global install fails with permission errors (EACCES), stick with `npx eas-cli` from the project.

2. **Link the app to an EAS project (required for builds):**  
   ```bash
   cd apps/mobile
   npx eas-cli init
   ```  
   Choose “Create a new project” or “Link to existing project”. This writes `projectId` into `app.json` → `expo.extra.eas.projectId`.

3. **Apple credentials** are only needed when you run **submit** (upload to TestFlight). For building the .ipa, login + project link are enough.

## 2. Build the iOS app for TestFlight

From the **`apps/mobile`** directory:

```bash
cd apps/mobile
npx eas-cli build --profile testflight --platform ios
```

- This uses the **`testflight`** profile in `eas.json` (store distribution, production-like).
- When the build finishes, EAS gives you a **build URL** and you can **download the .ipa** from the Expo dashboard.

**The .ipa is the file for TestFlight** – you can upload it manually to App Store Connect if you prefer.

## 3. Submit directly to App Store Connect (recommended)

After the build succeeds, submit it so it shows up in TestFlight:

```bash
npx eas-cli submit --platform ios --profile testflight
```

When prompted, choose the **latest** TestFlight build. EAS uploads it to App Store Connect; after processing, the build appears in **TestFlight** for your app.

Before the first run, set your Apple details in `eas.json` under `submit.testflight.ios`:

- `appleId` – your Apple ID email
- `ascAppId` – App Store Connect app ID (e.g. from App Store Connect → Your App → App Information)
- `appleTeamId` – Apple Developer Team ID (from developer.apple.com)

## 4. Optional: App Store Connect API key (non-interactive submit)

For CI or headless submits, use an App Store Connect API key instead of Apple ID password:

1. In App Store Connect: **Users and Access → Keys → App Store Connect API** → generate a key (Admin or App Manager).
2. Download the **.p8** file and note **Key ID** and **Issuer ID**.
3. In `eas.json`, under `submit.testflight.ios`, add:

   ```json
   "ascApiKeyPath": "./AuthKey_XXXXXXXXXX.p8",
   "ascApiKeyIssuerId": "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX",
   "ascApiKeyId": "XXXXXXXXXX"
   ```

Then `eas submit --platform ios --profile testflight` can run without interactive Apple ID login.

## Summary

| What you need | How you get it |
|---------------|----------------|
| **The file for TestFlight** | **.ipa** from `eas build --profile testflight --platform ios` (download from EAS build page), or let **`eas submit --profile testflight`** upload that build for you |
| **Where it goes** | App Store Connect → your app → TestFlight tab (automatic after submit) |
| **Config used** | `eas.json` → `build.testflight` and `submit.testflight` |

Run builds from **`apps/mobile`** so paths and `app.json` resolve correctly.
