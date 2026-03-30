// src/firebase.ts
// ─────────────────────────────────────────────────────────────────────────────
// Single Firebase initialisation — imported by every service file.
//
// SETUP (two options):
//
//  Option A — .env file at project root (recommended, keeps secrets out of git):
//    VITE_FIREBASE_API_KEY=AIzaSy...
//    VITE_FIREBASE_AUTH_DOMAIN=yourproject.firebaseapp.com
//    VITE_FIREBASE_DATABASE_URL=https://yourproject-default-rtdb.firebaseio.com
//    VITE_FIREBASE_PROJECT_ID=yourproject
//    VITE_FIREBASE_STORAGE_BUCKET=yourproject.appspot.com
//    VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
//    VITE_FIREBASE_APP_ID=1:123456789:web:abc123
//
//  Option B — paste values directly into firebaseConfig below.
//
// Get these values from: Firebase Console → Project Settings → Your apps → Web
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY             || 'PASTE_API_KEY_HERE',
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN         || 'PASTE_AUTH_DOMAIN_HERE',
  databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL        || '',   // optional – only if using RTDB
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID          || 'PASTE_PROJECT_ID_HERE',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET      || 'PASTE_STORAGE_BUCKET_HERE',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || 'PASTE_SENDER_ID_HERE',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID              || 'PASTE_APP_ID_HERE',
};

// Prevent double-initialisation in hot-module-reload (Vite/React) environments
const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth:      Auth            = getAuth(app);
export const firestore: Firestore       = getFirestore(app);
export const storage:   FirebaseStorage = getStorage(app);

export default app;