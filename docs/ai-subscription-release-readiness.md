# SplitPro AI Subscription Release Readiness

This checklist covers the AI spend analysis subscription release path. It is a release hardening document, not a source of entitlement truth.

## Required deploys

- Firestore rules: `firebase deploy --only firestore:rules`
- Functions: `firebase deploy --only functions:requestSpendInsight,functions:verifyGooglePlayPurchase,functions:handlePlayRtdn,functions:reconcileActiveSubscriptions,functions:sendPushOnNotificationCreate`
- Android release AAB from `android/app/build/outputs/bundle/release/app-release.aab`

## Required secrets and credentials

- `OPENAI_API_KEY` must be configured as a Firebase Functions secret.
- Google Play Developer API access must use Firebase Functions runtime Application Default Credentials.
- Do not commit service account JSON files.
- Do not commit `android/keystore.properties`, `*.jks`, `*.keystore`, or `android/app/google-services.json`.
- The Play Console service account for deployed Functions must have app-level permissions for orders/subscriptions.

## App Check plan

- Keep `SPLITPRO_ENFORCE_APP_CHECK=false` until internal testing confirms install and purchase flows.
- Enable App Check for the Android app in Firebase.
- Add debug tokens for local development devices before enforcing.
- Turn on enforcement first in monitoring mode, then set `SPLITPRO_ENFORCE_APP_CHECK=true` for callable functions after rejection rates look normal.
- App Check must not replace Firebase Auth or backend entitlement checks.

## Manual test matrix

### Analytics

- No expenses, one expense, multiple expenses, multiple categories.
- Equal, custom, percentage, and share split groups.
- Deleted or unknown payer/member fallback.
- Multiple months and large INR amount formatting.

### AI gate and OpenAI

- Unauthenticated call is rejected.
- Non-member group call is rejected.
- Free user is rejected.
- Expired/on-hold/revoked user is rejected.
- Active, grace-period, and cancelled-unexpired users are allowed.
- Usage limit reached is rejected.
- Cached request does not increment usage.
- Invalid question is rejected.
- Missing OpenAI key, API error, timeout, malformed output, and unsupported question all fall back safely.
- Prompt input contains sanitized summaries only and no private IDs/emails.

### Billing and lifecycle

- Product list loads monthly/yearly products: `splitpro_ai_monthly`, `splitpro_ai_yearly`.
- Product unavailable/error states are user-friendly.
- Cancelled purchase does not unlock AI.
- Pending purchase stays pending verification.
- Successful test purchase unlocks only after backend verification.
- Invalid token is rejected.
- Duplicate token for same user is idempotent.
- Duplicate token for another user is blocked.
- Restore active purchase re-verifies through backend.
- Expired/revoked subscription locks AI.
- RTDN test notification logs safely.
- Renewed, grace-period, cancelled, expired, and revoked RTDN events re-check Google Play before entitlement changes.

### Security rules

- Client cannot write `users/{uid}.entitlement`.
- Client cannot write `users/{uid}.aiUsage`.
- Client cannot write or read `subscriptions/{uid}`, `subscriptionTokens/{hash}`, or `subscriptionEvents/{eventId}`.
- Client cannot write `aiUsageEvents`.
- Client cannot write `groups/{groupId}/aiInsights`.
- Non-member cannot read group or expense data.
- Invalid expense amount and unexpected fields are denied.

## Monitoring checklist

Watch Firebase Functions logs for:

- `handlePlayRtdn received Pub/Sub message`
- `handlePlayRtdn decoded RTDN notification`
- `handlePlayRtdn test notification received`
- Google Play verification failures by safe error code only
- AI generation fallback rates
- Usage-limit rejections
- Firestore permission-denied spikes after rules deploy

Logs must not include raw purchase tokens, service account keys, OpenAI keys, or full RTDN payloads.

## Rollback plan

- Hide AI/upgrade entry points in a hotfix build if purchase or AI UI must be disabled.
- Keep backend entitlement checks enabled even if UI entry points are hidden.
- If OpenAI fails or costs spike, remove/disable `OPENAI_API_KEY`; the backend returns deterministic fallbacks.
- If Play verification fails widely, stop promoting the release and rely on `reconcileActiveSubscriptions` after Play permissions are fixed.
- If Firestore rules regress, redeploy the last known-good `firestore.rules` from `dev`.

## Support recovery flows

- Paid but AI did not unlock: verify Firebase Auth UID, `subscriptions/{uid}`, `subscriptionTokens/{hash}`, and Play order state. Do not trust screenshots alone.
- Cancelled but still active: check expiry. Cancelled-unexpired remains active until expiry by policy.
- Usage limit incorrect: inspect `users/{uid}.aiUsage` period, used, limit, and `aiUsageEvents`.
- Purchase verification failed: check function logs for safe error code, Play Console permissions, and Android Publisher API status.
- Subscription unknown: run/await scheduled reconciliation or ask the user to tap Restore Purchase.

## Release readiness gate

Release is ready only when:

- All automated checks pass.
- Firestore rules are deployed and tested.
- Functions are deployed to `splitpro-28405`.
- OpenAI secret is present only in Firebase Functions secrets.
- Google Play products are active in the internal testing track.
- RTDN Pub/Sub topic is configured and test notification is visible in logs.
- Signed release AAB uses the upload key, not debug signing.
