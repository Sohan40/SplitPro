# Google Play purchase verification setup

`verifyGooglePlayPurchase` uses Google Application Default Credentials through the deployed Firebase Functions runtime. Do not commit a service account JSON file and do not set a service account path in source code.

Before deploying this phase, invite the Firebase runtime service account to Play Console:

```txt
98378274298-compute@developer.gserviceaccount.com
```

Grant app-level permissions for the SplitPro Android app:

- View financial data, orders, and cancellation survey responses
- Manage orders and subscriptions

The Android Publisher API / Google Play Android Developer API must remain enabled in the Google Cloud project.
