# Admin Test Entitlement Scripts

These scripts are local terminal tools for development and QA only. They use the Firebase Admin SDK and are not imported by React Native or exported from Cloud Functions.

## Commands

```sh
npm run admin:grant-ai-test -- <firebase-auth-uid>
npm run admin:grant-ai-test -- <firebase-auth-uid> --hours 2
npm run admin:revoke-ai-test -- <firebase-auth-uid>
```

## Authentication

Run them only from a trusted local terminal with Admin SDK credentials:

- Application Default Credentials, or
- `GOOGLE_APPLICATION_CREDENTIALS` pointing to a local service account file outside the repo, or
- Firestore emulator credentials with `FIRESTORE_EMULATOR_HOST`.

Set a project id with `GCLOUD_PROJECT`, `GOOGLE_CLOUD_PROJECT`, or `FIREBASE_PROJECT_ID`. The scripts do not hardcode UIDs, project IDs, API keys, or service account paths.

## Fields Written

Grant writes only:

- `users/{uid}.entitlement.ai.active`
- `users/{uid}.entitlement.ai.plan`
- `users/{uid}.entitlement.ai.status`
- `users/{uid}.entitlement.ai.provider`
- `users/{uid}.entitlement.ai.expiresAt`
- `users/{uid}.entitlement.ai.updatedAt`

Revoke writes the same nested entitlement object back to a revoked/free state. Usage counters, billing fields, subscriptions, purchases, prompts, and client UI are not modified.

For deployed manual-test entitlement to be accepted by the backend gate, the function environment must intentionally allow it. Emulator/test mode accepts `manual_test` automatically.
