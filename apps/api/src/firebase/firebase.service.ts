import { Injectable } from "@nestjs/common";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

function loadCredential() {
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

  return {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  };
}

@Injectable()
export class FirebaseService {
  private readonly db: Firestore;

  constructor() {
    const existing = getApps();
    const app = existing.length
      ? existing[0]!
      : initializeApp({
          credential: cert(loadCredential()),
        });
    this.db = getFirestore(app);
  }

  get firestore(): Firestore {
    return this.db;
  }
}
