// lib/firebaseAdmin.ts
import * as admin from 'firebase-admin';
import { NextRequest } from 'next/server';

// Initialize the Admin SDK only if it hasn't been initialized already
if (!admin.apps.length) {
  try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    
    if (!serviceAccountJson) {
        // This is the source of the 500s if db or admin.auth() is called before a return path.
        console.error("CRITICAL: FIREBASE_SERVICE_ACCOUNT_JSON environment variable is NOT set. Server-side persistence will fail.");
    } else {
        const serviceAccount = JSON.parse(serviceAccountJson);
        
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
        console.log("Firebase Admin Initialized successfully.");
    }
  } catch (error) {
    console.error("FATAL: Firebase Admin initialization error. Check FIREBASE_SERVICE_ACCOUNT_JSON format.", error);
    // If initialization fails here, subsequent calls to getAuthId or db will throw.
  }
}

// Check if app is initialized before accessing services
const isInitialized = admin.apps.length > 0;
const db = isInitialized ? admin.firestore() : { collection: () => ({ where: () => ({ orderBy: () => ({ limit: () => ({ get: () => Promise.resolve({ docs: [] }) }) }) }), doc: () => ({ get: () => Promise.resolve(null), set: () => Promise.resolve(), update: () => Promise.resolve() }) }) } as unknown as admin.firestore.Firestore;

// Utility function to verify the user ID from the request
export async function getAuthId(req: NextRequest): Promise<string | null> {
    if (!isInitialized) {
        console.error("Authentication failed: Firebase Admin not initialized.");
        return null;
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    const token = authHeader.split(' ')[1];
    
    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        return decodedToken.uid;
    } catch (error) {
        console.error("Token verification failed:", error);
        return null;
    }
}


// Exporting both db and admin
export { db, admin };