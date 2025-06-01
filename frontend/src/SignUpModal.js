// frontend/src/App.js
import React, { useState, useEffect } from 'react';
import { auth, db } from './firebaseConfig';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth'; // Removed createUserWithEmailAndPassword
import { doc, onSnapshot } from 'firebase/firestore';
import AddProductForm from './AddProductForm';
import ProductList from './ProductList';
import MessageDisplay from './MessageDisplay';
import SignUpModal from './SignUpModal'; // Import the SignUpModal component

function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState('');
  const [appMessage, setAppMessage] = useState('');
  const [showSignUpModal, setShowSignUpModal] = useState(false); // New state to control modal visibility

  // Listen for authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthError('');
    });
    return () => unsubscribe();
  }, []);

  // Listen for app message changes from Firestore
  useEffect(() => {
    const messageDocRef = doc(db, 'appSettings', 'messages');
    const unsubscribe = onSnapshot(messageDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setAppMessage(docSnap.data().currentMessage || '');
      } else {
        setAppMessage('');
      }
    }, (err) => {
      console.error("Error fetching app message:", err);
    });
    return () => unsubscribe();
  }, []);

  // Removed handleSignUp from here, as it will be handled by the modal.

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

  const ownerEmail = 'siddeshpawar622.sp@gmail.com';
  const isOwner = user && user.email === ownerEmail;

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
            {/* Modified: This button now opens the modal */}
            <button onClick={() => setShowSignUpModal(true)} style={styles.authButton}>Sign Up</button>
            {authError && <p style={styles.authError}>{authError}</p>}
          </div>
        )}
      </header>

      <main style={styles.mainContent}>
        {appMessage && (
          <div style={styles.globalMessage}>
            <p><strong>Announcement:</strong> {appMessage}</p>
          </div>
        )}

        {user ? (
          <>
            {isOwner && (
              <MessageDisplay currentMessage={appMessage} db={db} />
            )}
            <AddProductForm />
            <ProductList />
          </>
        ) : (
          <p style={styles.loginPrompt}>Please sign in to manage inventory.</p>
        )}
      </main>

      {/* Conditionally render the SignUpModal */}
      {showSignUpModal && (
        <SignUpModal
          onClose={() => setShowSignUpModal(false)}
          onSignUpSuccess={() => {
            setShowSignUpModal(false);
            // Optionally clear email/password fields on main page after modal success
            setEmail('');
            setPassword('');
          }}
        />
      )}
    </div>
  );
}

// Basic Inline Styles (rest of the styles are the same)
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
  globalMessage: {
    backgroundColor: '#ffeeba',
    color: '#856404',
    padding: '10px 15px',
    borderRadius: '5px',
    marginBottom: '20px',
    border: '1px solid #ffc107',
    textAlign: 'center',
    fontWeight: 'bold',
  }
};

export default App;