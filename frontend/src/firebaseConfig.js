// frontend/src/firebaseConfig.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCVwde47xofIaRyJQr5QjeDgKCinQ7s8_U", // Replace with your actual API Key
  authDomain: "londisinventoryapp.firebaseapp.com", // Replace with your actual Auth Domain
  projectId: "londisinventoryapp", // Replace with your actual Project ID
  storageBucket: "londisinventoryapp.firebasestorage.app", // Replace with your actual Storage Bucket
  messagingSenderId: "990186016538", // Replace with your actual Sender ID
  appId: "1:990186016538:web:e69f834cb120e62e5966a3" // Replace with your actual App ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Get service instances
export const db = getFirestore(app); // For Firestore database
export const auth = getAuth(app); // For Firebase Authentication

// You can optionally export the app instance if needed elsewhere
export default app;