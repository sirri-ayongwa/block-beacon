import { initializeApp, getApps, type FirebaseOptions } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// TODO(developer): keep these values in .env.local locally and in your host's
// environment variables in production. The fallback keeps production from
// hard-crashing if Vercel/Lovable has not been configured yet.
const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAcpVuTUgtv9phUC99u9mQvoEuV7hHUEaU",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "blockbeacon-app.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "blockbeacon-app",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "blockbeacon-app.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "159983612997",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:159983612997:web:3c5c7aa2551d5c22b9df2c",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-57XCLBH9C3",
};

export const firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
export const googleProvider = new GoogleAuthProvider();

export function waitForFirebaseUser(): Promise<User | null> {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);

  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}
