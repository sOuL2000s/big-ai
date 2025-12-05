// lib/firebaseAdmin.ts
import * as admin from 'firebase-admin';

// Initialize the Admin SDK only if it hasn't been initialized already
if (!admin.apps.length) {
  try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    
    if (!serviceAccountJson) {
        throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON environment variable is not set.");
    }
    
    const serviceAccount = JSON.parse(serviceAccountJson);
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("Firebase Admin Initialized successfully.");
    
  } catch (error) {
    console.error("Firebase Admin initialization error:", error);
    // In a production environment, you might want to crash the application if initialization fails.
  }
}

const db = admin.firestore();

// Exporting both db and admin
export { db, admin }; 