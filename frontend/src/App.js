// frontend/src/App.js
import React, { useState, useEffect } from 'react';
import { auth } from './firebaseConfig';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import AddProductForm from './AddProductForm';
import ProductList from './ProductList';

function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState(null); // Firebase User object
  const [authError, setAuthError] = useState('');

  // Listen for authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthError('');
    });
    return () => unsubscribe(); // Cleanup subscription on unmount
  }, []);

  const handleSignUp = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      setAuthError(error.message);
      console.error("Error signing up:", error.message);
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      setAuthError(error.message);
      console.error("Error signing in:", error.message);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      setAuthError(error.message);
      console.error("Error signing out:", error.message);
    }
  };

  return (
    <div style={styles.appContainer}>
      <header style={styles.header}>
        <h1 style={styles.h1}>Londis Inventory Management</h1>
        {user ? (
          <div style={styles.authStatus}>
            <p>Logged in as: <strong>{user.email}</strong></p>
            <button onClick={handleSignOut} style={styles.logoutButton}>Logout</button>
          </div>
        ) : (
          <div style={styles.authForm}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.authInput}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.authInput}
            />
            <button onClick={handleSignIn} style={styles.authButton}>Sign In</button>
            <button onClick={handleSignUp} style={styles.authButton}>Sign Up</button>
            {authError && <p style={styles.authError}>{authError}</p>}
          </div>
        )}
      </header>

      <main style={styles.mainContent}>
        {user ? (
          <>
            <AddProductForm />
            <ProductList />
          </>
        ) : (
          <p style={styles.loginPrompt}>Please sign in to manage inventory.</p>
        )}
      </main>
    </div>
  );
}

// Basic Inline Styles
const styles = {
  appContainer: {
    fontFamily: 'Arial, sans-serif',
    backgroundColor: '#f4f7f6',
    minHeight: '100vh',
    padding: '20px',
  },
  header: {
    backgroundColor: '#282c34',
    padding: '20px',
    color: 'white',
    textAlign: 'center',
    borderRadius: '8px',
    marginBottom: '30px',
  },
  h1: {
    margin: '0 0 15px 0',
  },
  authStatus: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '15px',
  },
  authForm: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  authInput: {
    padding: '8px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '1em',
  },
  authButton: {
    padding: '8px 15px',
    backgroundColor: '#61dafb',
    color: '#282c34',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '1em',
    transition: 'background-color 0.3s ease',
  },
  authButtonHover: {
    backgroundColor: '#a2edff',
  },
  logoutButton: {
    padding: '8px 15px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '1em',
    transition: 'background-color 0.3s ease',
  },
  logoutButtonHover: {
    backgroundColor: '#c82333',
  },
  authError: {
    color: '#ffc107',
    marginTop: '10px',
    width: '100%',
    textAlign: 'center',
  },
  mainContent: {
    padding: '20px 0',
  },
  loginPrompt: {
    textAlign: 'center',
    fontSize: '1.2em',
    color: '#666',
    padding: '50px',
    backgroundColor: '#fff',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
  },
};

export default App;