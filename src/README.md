# Source Code Structure (`src/`)

Welcome to the `src/` directory of **SplitPro**. This document outlines the architectural structure of the application to help new developers quickly navigate the codebase.

## Directory Overview

```text
src/
├── components/    # Reusable UI components (buttons, cards, inputs)
├── context/       # React Context providers (Auth, Global Error Handling)
├── hooks/         # Custom React Hooks (e.g., useNotificationHandler)
├── models/        # TypeScript interfaces and types for data structures
├── navigation/    # React Navigation configuration and stack definitions
├── screens/       # Full-page screen components, organized by feature
├── services/      # Service layer for all Firebase/Firestore operations
└── utils/         # Helper functions (e.g., split calculations, formatting)
```

## Architecture Guidelines

### 1. The Services Layer (`src/services/`)
We enforce a strict separation of concerns where **all data fetching and writing** must go through the `services` layer. 

- **No raw Firestore calls** (`db.collection(...)`) should exist inside `src/screens/` or `src/components/`.
- Services (e.g., `expenseService`, `groupService`, `userService`) handle interactions with Firebase and return fully typed models defined in `src/models/`.
- Real-time listeners (`onSnapshot`) should also be encapsulated within services and expose an unsubscribe function.

### 2. Global Error Handling (`src/context/ErrorContext.tsx`)
Any unhandled or global error that needs to be shown to the user should utilize the `useError` hook.

```tsx
import { useError } from '../context/ErrorContext';

const MyComponent = () => {
  const { showError } = useError();

  const handleAction = async () => {
    try {
      await someServiceCall();
    } catch (err) {
      showError('Failed to perform action.');
    }
  };
};
```

### 3. Models and Split Logic
The `models/` folder contains pure TypeScript interfaces (`Expense`, `Group`, `User`). 
The logic for dividing expenses (equal, custom, percentage, shares) is heavily tested and abstracted inside `src/utils/splitCalculator.ts`. Do not duplicate split logic in components.

### 4. Navigation
The `navigation/` folder uses React Navigation. To handle deep-linking from background push notifications without needing the `useNavigation` hook inside components, we use a global `navigationRef.ts`.

## Testing
We use Jest for unit testing. Test files are typically co-located in `__tests__` directories or suffixed with `.test.ts`. 
Run tests via:
```bash
npm test
```
