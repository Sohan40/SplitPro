# Firebase Configuration Overview

This document explains the Firebase configuration used in **SplitPro**.

## 1. `firebase.json`
The `firebase.json` file controls how Firebase tools interact with your project. Currently, it is primarily configured for **Cloud Functions**.

```json
{
  "functions": [
    {
      "source": "functions",
      "codebase": "default",
      "ignore": [
        "node_modules",
        ".git",
        "firebase-debug.log",
        "firebase-debug.*.log",
        "*.local"
      ],
      "predeploy": [
        "npm --prefix \"$RESOURCE_DIR\" run lint"
      ]
    }
  ]
}
```

### Breakdown:
- `"source": "functions"`: Tells Firebase that our Cloud Functions source code is located in the `functions/` directory.
- `"codebase": "default"`: Allows for grouping of functions in monorepos. We use the default codebase.
- `"ignore"`: Files to exclude from the deployment payload to speed up upload times to Google Cloud.
- `"predeploy"`: A script that runs automatically before `firebase deploy`. It currently runs `npm run lint` inside the `functions` directory to prevent pushing code with linting errors.

## 2. Cloud Functions (`functions/`)
The `functions/` directory contains Node.js code that runs securely on Google's servers. 
- **Trigger:** We have an FCM Push Notification trigger (`sendPushOnNotificationCreate`) that listens to the Firestore `notifications/{userId}/userNotifications/{notificationId}` path.
- **Action:** When a new document is written, it fetches the user's FCM tokens and pushes a notification payload using the `firebase-admin` SDK.

## 3. Deployment
To deploy functions to production:
```bash
firebase login
firebase use splitpro-28405
firebase deploy --only functions
```

## 4. Emulator Setup (Optional)
If you wish to test Cloud Functions locally in the future without deploying, you can initialize the Firebase Emulator Suite:
```bash
firebase init emulators
firebase emulators:start
```
*(Note: Real push notifications cannot be tested on emulators; you must deploy to test FCM).*
