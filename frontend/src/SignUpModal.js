import React, { useState } from 'react';
import { auth, db } from './firebaseConfig';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth'; // sendEmailVerification is now used
import { doc, setDoc } from 'firebase/firestore';

function SignUpModal({ onClose, onSignUpSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!email || !password || !mobileNumber) {
      setError('Please fill in all fields (email, password, mobile number).');
      setLoading(false);
      return;
    }

    // Basic mobile number validation (can be enhanced)
    const mobileRegex = /^\+?[0-9]{7,15}$/; // Simple regex for 7-15 digits, optional +
    if (!mobileRegex.test(mobileNumber)) {
      setError('Please enter a valid mobile number (e.g., +447911123456 or 07911123456).');
      setLoading(false);
      return;
    }

    try {
      // 1. Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // ENABLED: Send email verification right after account creation
      await sendEmailVerification(user);

      // 2. Store user details in Firestore with isAllowed: false
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, {
        uid: user.uid,
        email: user.email,
        mobileNumber: mobileNumber,
        isAllowed: false, // Default to false, requires admin approval
        createdAt: new Date(),
      });

      setLoading(false);
      onSignUpSuccess(); // Notify parent component of success
      // Updated message to inform user about both email verification AND admin approval
      alert('Sign up successful! Please check your email to verify your account. Your account is pending admin approval and will be activated once verified.');

    } catch (err) {
      setLoading(false);
      let errorMessage = 'Failed to sign up. Please try again.';
      if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already in use. Please sign in or use a different email.';
      } else if (err.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please use at least 6 characters.';
      } else {
        errorMessage = err.message;
      }
      setError(errorMessage);
      console.error("Error signing up:", err);
    }
  };

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalContent}>
        <h2 style={styles.h2}>Sign Up for Londis Inventory</h2>
        <form onSubmit={handleSignUp} style={styles.form}>
          <div style={styles.formGroup}>
            <label htmlFor="email" style={styles.label}>Email:</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              required
            />
          </div>
          <div style={styles.formGroup}>
            <label htmlFor="password" style={styles.label}>Password:</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              required
            />
          </div>
          <div style={styles.formGroup}>
            <label htmlFor="mobileNumber" style={styles.label}>Mobile Number:</label>
            <input
              type="tel" // Use type="tel" for mobile numbers
              id="mobileNumber"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              style={styles.input}
              placeholder="+447911123456"
              required
            />
          </div>
          {error && <p style={styles.errorText}>{error}</p>}
          <div style={styles.buttonGroup}>
            <button type="submit" style={styles.button} disabled={loading}>
              {loading ? 'Signing Up...' : 'Sign Up'}
            </button>
            <button type="button" onClick={onClose} style={styles.cancelButton} disabled={loading}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: '30px',
    borderRadius: '10px',
    boxShadow: '0 5px 15px rgba(0, 0, 0, 0.3)',
    width: '90%',
    maxWidth: '400px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  h2: {
    textAlign: 'center',
    color: '#333',
    marginBottom: '10px',
    fontSize: '1.8em',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
  },
  label: {
    marginBottom: '8px',
    fontWeight: 'bold',
    color: '#555',
    fontSize: '0.95em',
  },
  input: {
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '1em',
    width: '100%',
    boxSizing: 'border-box', // Include padding in element's total width and height
  },
  buttonGroup: {
    display: 'flex',
    gap: '15px',
    marginTop: '20px',
    justifyContent: 'center',
  },
  button: {
    padding: '12px 25px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '1.1em',
    cursor: 'pointer',
    transition: 'background-color 0.3s ease, transform 0.2s ease',
    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
    flexGrow: 1,
  },
  buttonHover: {
    backgroundColor: '#218838',
    transform: 'translateY(-2px)',
  },
  cancelButton: {
    padding: '12px 25px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '1.1em',
    cursor: 'pointer',
    transition: 'background-color 0.3s ease, transform 0.2s ease',
    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
    flexGrow: 1,
  },
  cancelButtonHover: {
    backgroundColor: '#5a6268',
    transform: 'translateY(-2px)',
  },
  errorText: {
    color: '#dc3545',
    backgroundColor: '#ffe3e6',
    padding: '10px',
    borderRadius: '5px',
    textAlign: 'center',
    fontSize: '0.9em',
    border: '1px solid #dc3545',
  },
};

// Add hover effects dynamically
Object.assign(styles.button, {
  ':hover': styles.buttonHover,
});
Object.assign(styles.cancelButton, {
  ':hover': styles.cancelButtonHover,
});

export default SignUpModal;
