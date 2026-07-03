import { Injectable } from "@nestjs/common";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

@Injectable()
  export class FirebaseService {
    private readonly db: Firestore;

  constructor() {
        const existing = getApps();
        const app = existing.length
          ? existing[0]!
                : initializeApp({
                            credential: cert({
                                          projectId: process.env.FIREBASE_PROJECT_ID,
                                          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                                          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
                            }),
                });
        this.db = getFirestore(app);
  }

  get firestore(): Firestore {
        return this.db;
  }
}
