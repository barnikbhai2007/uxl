import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut } from "firebase/auth";

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY || "";
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || "";
const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "";
const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "";
const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "";
const appId = import.meta.env.VITE_FIREBASE_APP_ID || "";
const measurementId = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "";

const firebaseConfig = {
  apiKey,
  authDomain,
  projectId,
  storageBucket,
  messagingSenderId,
  appId,
  measurementId
};

let app: any;
let auth: any;
let googleProvider: any;

try {
  if (apiKey && apiKey !== "MY_API_KEY") {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
  }
} catch (e) {
  console.warn("Failed to initialize Firebase:", e);
}

export { app, auth, googleProvider, signInWithPopup, firebaseSignOut };
