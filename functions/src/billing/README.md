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

## Real-time Developer Notifications

Create a Pub/Sub topic for Google Play RTDN and point Play Console to it:

```txt
splitpro-play-rtdn
```

If you use a different topic, set `PLAY_RTDN_TOPIC` before deploying functions so
`handlePlayRtdn` subscribes to the same topic. The RTDN handler treats messages
only as triggers and re-checks Google Play before updating entitlement.

`reconcileActiveSubscriptions` runs daily and re-verifies server-linked purchase
tokens. Purchase tokens are kept only in the server-owned token registry so the
scheduled job can call Google Play; subscription metadata and audit logs store
only the token hash.
