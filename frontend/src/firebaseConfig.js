// frontend/src/firebaseConfig.js

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore'; // Import getFirestore
import { getAuth } from 'firebase/auth';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyCVwde47xofIaRyJQr5QjeDgKCinQ7s8_U",
  authDomain: "londisinventoryapp.firebaseapp.com",
  projectId: "londisinventoryapp",
  storageBucket: "londisinventoryapp.firebasestorage.app",
  messagingSenderId: "990186016538",
  appId: "1:990186016538:web:e69f834cb120e62e5966a3"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize and export Firebase service instances
export const auth = getAuth(app);      // For Firebase Authentication
export const db = getFirestore(app);   // For Firestore database
export const functions = getFunctions(app); // For Cloud Functions

// You can optionally export the app instance if needed elsewhere,
// but named exports for services are generally preferred.
// export default app;
