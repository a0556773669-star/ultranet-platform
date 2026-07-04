import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

function loadCredential() {
  // Preferred: paste the whole downloaded service-account JSON file as one
  // secret named FIREBASE_SERVICE_ACCOUNT_JSON - no manual splitting needed.
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON) as {
      project_id: string;
      client_email: string;
      private_key: string;
    };
    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key,
    };
  }

  // Fallback: three separate env vars (legacy).
  return {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  };
}

export function getAdminFirestore(): Firestore {
  const existing = getApps();
  const app = existing.length
    ? existing[0]!
    : initializeApp({
        credential: cert(loadCredential()),
      });
  return getFirestore(app);
}
