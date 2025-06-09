// frontend/src/SignUpModal.js
import React, { useState } from 'react';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';

// --- Firebase Initialization (using your provided config) ---
// This is duplicated from App.js but necessary for SignUpModal to be self-contained.
const firebaseConfig = {
  apiKey: "AIzaSyCVwde47xofIaRyJQr5QjeDgKCinQ7s8_U",
  authDomain: "londisinventoryapp.firebaseapp.com",
  projectId: "londisinventoryapp",
  storageBucket: "londisinventoryapp.firebasestorage.app",
  messagingSenderId: "990186016538",
  appId: "1:990186016538:web:e69f834cb120e62e5966a3"
};

let firebaseAppInstance;
let authInstance;
let dbInstance;

if (!firebaseAppInstance) {
  try {
    firebaseAppInstance = initializeApp(firebaseConfig);
    authInstance = getAuth(firebaseAppInstance);
    dbInstance = getFirestore(firebaseAppInstance);
    console.log("SignUpModal: Firebase initialized successfully.");
  } catch (error) {
    console.error("SignUpModal: Firebase initialization error:", error);
  }
}

// Global variable for appId
const appId = typeof window.__app_id !== 'undefined' ? window.__app_id : 'default-app-id';


function SignUpModal({ onClose, onSignUpSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mobileNumber, setMobileNumber] = useState(''); // Added mobile number
  const [employeeId, setEmployeeId] = useState(''); // Added employee ID
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');

    if (!authInstance || !dbInstance) {
      setError('Firebase services not initialized. Please try again.');
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!mobileNumber || !employeeId) {
        setError("Mobile Number and Employee ID are required.");
        return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(authInstance, email, password);
      const user = userCredential.user;

      // Store user information in Firestore (private data for this user)
      // Path: /artifacts/{appId}/users/{userId}/user_details/{documentId}
      await setDoc(doc(dbInstance, `artifacts/${appId}/users/${user.uid}/user_details`, user.uid), {
        email: user.email,
        mobileNumber: mobileNumber,
        employeeId: employeeId,
        createdAt: new Date(),
        // Add any other default fields you need, e.g., role: 'user'
      });

      onSignUpSuccess(); // Call success callback from parent (App.js)
    } catch (err) {
      setError(err.message);
      console.error("Error signing up:", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex justify-center items-center z-50 p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">Create Account</h2>
        {error && <p className="text-red-600 text-center mb-4">{error}</p>}
        <form onSubmit={handleSignUp} className="space-y-4">
          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <input
            type="password"
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <input
            type="password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <input
            type="tel"
            placeholder="Mobile Number (e.g., +447911123456)"
            value={mobileNumber}
            onChange={(e) => setMobileNumber(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <input
            type="text"
            placeholder="Employee ID"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-300 ease-in-out"
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Sign Up'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-3 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50 transition duration-300 ease-in-out mt-2"
          >
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
}

export default SignUpModal;
