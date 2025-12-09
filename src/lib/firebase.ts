import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, GithubAuthProvider, OAuthProvider } from "firebase/auth";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";

/**
 * Firebase Client Configuration
 * 
 * CROSS-PROJECT ARCHITECTURE:
 * - Firebase (Auth + Firestore + Firebase Storage for avatars): automl-dc494
 * - GCP (Vertex AI + GCS for ML training): fluent-cable-480715-c8
 * 
 * IMPORTANT: Firebase Storage for user assets (avatars/banners) uses the
 * Firebase project's default bucket, NOT the ML training GCS bucket.
 */

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  // Use Firebase Storage bucket for user assets (avatars, banners)
  // This is the OLD Firebase project's storage, not the new GCS bucket
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_USER_STORAGE_BUCKET || 'automl-dc494.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

// Initialize Firestore with offline persistence
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

// Firebase Storage for user assets (avatars, banners) - uses Firebase bucket
const storage = getStorage(app);

// Auth Providers
const googleProvider = new GoogleAuthProvider();
const githubProvider = new GithubAuthProvider();
const microsoftProvider = new OAuthProvider('microsoft.com');
const appleProvider = new OAuthProvider('apple.com');

export { app, auth, db, storage, googleProvider, githubProvider, microsoftProvider, appleProvider };

