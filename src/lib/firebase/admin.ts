import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function app(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  // Emulators need no credentials; on Google infra default credentials apply.
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  return initializeApp(sa ? { credential: cert(JSON.parse(sa)), projectId, storageBucket } : { projectId, storageBucket });
}

export const adminAuth = () => getAuth(app());
export const bucket = () => getStorage(app()).bucket();

// Route bundles each get their own copy of this module but share the Firestore
// instance, so remember on globalThis that settings() was already applied.
const g = globalThis as unknown as { kaniupFirestore?: FirebaseFirestore.Firestore };
export function fs() {
  if (!g.kaniupFirestore) {
    const firestore = getFirestore(app());
    try {
      firestore.settings({ ignoreUndefinedProperties: true });
    } catch {
      // Already configured by another bundle.
    }
    g.kaniupFirestore = firestore;
  }
  return g.kaniupFirestore;
}
