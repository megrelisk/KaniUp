"use client";

import { getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const emulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";

export function firebaseApp() {
  return getApps()[0] ?? initializeApp(config);
}

let authReady = false;
export function clientAuth() {
  const auth = getAuth(firebaseApp());
  if (emulators && !authReady) connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  authReady = true;
  return auth;
}

let dbReady = false;
export function clientDb() {
  const db = getFirestore(firebaseApp());
  if (emulators && !dbReady) connectFirestoreEmulator(db, "127.0.0.1", 8080);
  dbReady = true;
  return db;
}
