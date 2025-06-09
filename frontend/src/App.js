import React, { useState, useEffect, createContext, useContext, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCustomToken
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  onSnapshot,
  updateDoc,
  arrayUnion
} from 'firebase/firestore';

// Import existing modular components from their respective files
import AddProductForm from './AddProductForm';
import ProductList from './ProductList';
import MessageDisplay from './MessageDisplay';
import SignUpModal from './SignUpModal';

// Access Html5QrcodeScanner and moment directly from window as they are loaded via CDN
const Html5QrcodeScanner = typeof window !== 'undefined' ? window.Html5QrcodeScanner : null;
const moment = typeof window !== 'undefined' ? window.moment : null;


// --- Global Variables (Provided by Canvas Environment) ---
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// --- Firebase Initialization (Using your provided config) ---
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

// Initialize Firebase only once
if (!firebaseAppInstance) {
  try {
    firebaseAppInstance = initializeApp(firebaseConfig);
    authInstance = getAuth(firebaseAppInstance);
    dbInstance = getFirestore(firebaseAppInstance);
    console.log("Firebase initialized successfully from App.js.");
  } catch (error) {
    console.error("Firebase initialization error:", error);
  }
}

// --- Auth Context for Global State Management ---
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    if (!authInstance) {
        setLoading(false);
        setIsAuthReady(true);
        console.error("Firebase Auth not initialized in AuthProvider.");
        return;
    }

    const unsubscribe = onAuthStateChanged(authInstance, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setUserId(currentUser.uid);
        console.log("User authenticated:", currentUser.uid);
      } else {
        setUser(null);
        setUserId(null);
        console.log("User not authenticated.");
      }
      setLoading(false);
      setIsAuthReady(true);
    });

    const performAuth = async () => {
      if (initialAuthToken) {
        try {
          await signInWithCustomToken(authInstance, initialAuthToken);
          console.log("Signed in with custom token.");
        } catch (error) {
          console.error("Custom token sign-in failed:", error);
        }
      } else {
        try {
          await signInAnonymously(authInstance);
          console.log("Signed in anonymously.");
        } catch (error) {
          console.error("Anonymous sign-in failed:", error);
        }
      }
    };

    if (!isAuthReady) {
      performAuth();
    }

    return () => unsubscribe();
  }, [initialAuthToken, isAuthReady]);

  const value = { user, userId, loading, isAuthReady, auth: authInstance, db: dbInstance };

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
          <p className="text-xl font-semibold text-gray-700">Loading application...</p>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};

// --- Custom Message Box Component ---
const MessageBox = ({ message, type, onClose }) => {
  if (!message) return null;

  const typeClasses = {
    success: 'bg-green-100 text-green-800 border-green-200',
    error: 'bg-red-100 text-red-800 border-red-200',
    info: 'bg-blue-100 text-blue-800 border-blue-200',
  };

  return (
    <div className={`message-box p-4 mb-4 rounded-lg shadow-md border ${typeClasses[type || 'info']} flex justify-between items-center`} role="alert">
      <span className="font-medium">{message}</span>
      {onClose && (
        <button
          onClick={onClose}
          className="ml-4 p-1 rounded-full hover:bg-opacity-75 focus:outline-none focus:ring-2 focus:ring-offset-2"
          aria-label="Close"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path>
          </svg>
        </button>
      )}
    </div>
  );
};

// --- Signup Page Component ---
const SignupPage = ({ setCurrentPage }) => {
  const { auth, db } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e) => {
    e.preventDefault();
    setMessage('');
    setLoading(true);

    if (!email || !password || !mobileNumber || !employeeId) {
      setMessage('All fields are required.');
      setMessageType('error');
      setLoading(false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const userDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/user_details`, user.uid);
      await setDoc(userDocRef, {
        email: user.email,
        mobileNumber: mobileNumber,
        employeeId: employeeId,
        createdAt: new Date(),
      });

      setMessage('Signup successful! You can now log in.');
      setMessageType('success');
      setEmail('');
      setPassword('');
      setMobileNumber('');
      setEmployeeId('');
      setCurrentPage('login');
    } catch (error) {
      console.error("Signup error:", error);
      let errorMessage = 'Signup failed. Please try again.';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Email already in use. Please use a different email.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please use at least 6 characters.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      }
      setMessage(errorMessage);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">Sign Up</h2>
        <MessageBox message={message} type={messageType} onClose={() => setMessage('')} />
        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
              Password
            </label>
            <input
              type="password"
              id="password"
              className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 mb-3 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="mobileNumber">
              Mobile Number
            </label>
            <input
              type="tel"
              id="mobileNumber"
              className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., +447911123456"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="employeeId">
              Employee ID
            </label>
            <input
              type="text"
              id="employeeId"
              className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., EMP12345"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-300 ease-in-out"
            disabled={loading}
          >
            {loading ? 'Signing Up...' : 'Sign Up'}
          </button>
        </form>
        <p className="text-center text-gray-600 text-sm mt-6">
          Already have an account?{' '}
          <button
            onClick={() => setCurrentPage('login')}
            className="text-blue-600 hover:text-blue-800 font-semibold focus:outline-none"
          >
            Log In
          </button>
        </p>
      </div>
    </div>
  );
};

// --- Login Page Component ---
const LoginPage = ({ setCurrentPage }) => {
  const { auth } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage('');
    setLoading(true);

    if (!email || !password) {
      setMessage('Email and password are required.');
      setMessageType('error');
      setLoading(false);
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      setMessage('Login successful!');
      setMessageType('success');
    } catch (error) {
      console.error("Login error:", error);
      let errorMessage = 'Login failed. Please check your credentials.';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMessage = 'Invalid email or password.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address format.';
      }
      setMessage(errorMessage);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">Log In</h2>
        <MessageBox message={message} type={messageType} onClose={() => setMessage('')} />
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
              Password
            </label>
            <input
              type="password"
              id="password"
              className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 mb-3 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-300 ease-in-out"
            disabled={loading}
          >
            {loading ? 'Logging In...' : 'Log In'}
          </button>
        </form>
        <p className="text-center text-gray-600 text-sm mt-6">
          Don't have an account?{' '}
          <button
            onClick={() => setCurrentPage('signup')}
            className="text-blue-600 hover:text-blue-800 font-semibold focus:outline-none"
          >
            Sign Up
          </button>
        </p>
      </div>
    </div>
  );
};

// --- Dashboard Page Component ---
const DashboardPage = ({ setCurrentPage }) => {
  const { user, userId, auth, db, isAuthReady } = useAuth();
  const [userDetails, setUserDetails] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' }); // Unified message state
  const [appMessage, setAppMessage] = useState(''); // State for global announcements

  // States for Barcode Scanning and Add/Update Product Form
  const [isScanning, setIsScanning] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState('Chocolates'); // Default category
  const [quantity, setQuantity] = useState(''); // Quantity for new batch
  const [expiryDate, setExpiryDate] = useState(moment ? moment().format('YYYY-MM-DD') : '');

  const [isExistingProduct, setIsExistingProduct] = useState(false); // New state to track if product exists

  // Ref for the HTML5-QRCode scanner instance
  const html5QrcodeScannerRef = useRef(null);

  // Categories for product dropdown
  const categories = ['Chocolates', 'Alcohol', 'Wines', 'Cigarettes', 'Soft Drinks', 'Crisps', 'Other'];

  // Utility to get current date as YYYY-MM-DD
  const getTodayDate = useCallback(() => {
    if (moment) {
        return moment().format('YYYY-MM-DD');
    }
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  // --- Effect to check barcode existence whenever it changes (for form) ---
  useEffect(() => {
    const checkBarcode = async () => {
      setMessage({ type: '', text: '' }); // Clear message
      if (!db) return;

      if (scannedBarcode) {
        const productDocRef = doc(db, `artifacts/${appId}/public/data/inventory_items`, scannedBarcode);
        try {
          const docSnap = await getDoc(productDocRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setProductName(data.name || '');
            setCategory(data.category || 'Chocolates');
            setIsExistingProduct(true);
            setMessage({ type: 'info', text: `Product "${data.name}" already exists. Add new stock/expiry date.` });
          } else {
            setProductName('');
            setCategory('Chocolates');
            setIsExistingProduct(false);
            setMessage({ type: 'info', text: 'New product barcode. Please fill in details.' });
          }
        } catch (err) {
          console.error("Error checking barcode:", err);
          setMessage({ type: 'error', text: `Error checking barcode: ${err.message}` });
          setProductName('');
          setCategory('Chocolates');
          setIsExistingProduct(false);
        }
      } else {
        setProductName('');
        setCategory('Chocolates');
        setQuantity('');
        setExpiryDate(getTodayDate());
        setIsExistingProduct(false);
        setMessage({ type: '', text: '' });
      }
    };

    const debounceTimeout = setTimeout(() => {
      checkBarcode();
    }, 500);

    return () => clearTimeout(debounceTimeout);
  }, [scannedBarcode, db, getTodayDate, appId]);

  // --- Firebase Data Listeners ---
  useEffect(() => {
    if (!isAuthReady || !userId || !db) {
      console.log("Dashboard useEffect: Auth not ready or userId/db missing.");
      return;
    }

    // Fetch user details from Firestore
    const fetchUserDetails = async () => {
      try {
        const userDocRef = doc(db, `artifacts/${appId}/users/${userId}/user_details`, userId);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          setUserDetails(docSnap.data());
          setMessage(prev => ({ ...prev, type: 'success', text: 'Welcome back to your dashboard!' }));
        } else {
          setMessage(prev => ({ ...prev, type: 'error', text: 'User details not found. Please contact support.' }));
          console.warn("No user details found for:", userId);
        }
      } catch (error) {
        console.error("Error fetching user details:", error);
        setMessage(prev => ({ ...prev, type: 'error', text: 'Error loading user details.' }));
      }
    };

    fetchUserDetails();

    // Listen for app message changes from Firestore (for global announcements)
    const messageDocRef = doc(db, 'appSettings', 'messages');
    const unsubscribeMessage = onSnapshot(messageDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setAppMessage(docSnap.data().currentMessage || '');
      } else {
        setAppMessage('');
      }
    }, (err) => {
      console.error("Error fetching app message:", err);
    });

    return () => unsubscribeMessage();
  }, [userId, db, isAuthReady, appId]);

  // --- Barcode Scanner Logic ---
  useEffect(() => {
    let html5QrcodeScannerInstance;
    if (isScanning && isAuthReady && Html5QrcodeScanner) {
      const qrCodeScannerId = "qr-code-reader";
      html5QrcodeScannerInstance = new Html5QrcodeScanner(
        qrCodeScannerId,
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );

      const onScanSuccess = (decodedText, decodedResult) => {
        console.log(`Code matched = ${decodedText}`, decodedResult);
        setScannedBarcode(decodedText);
        setMessage({ type: 'success', text: `Barcode scanned: ${decodedText}` });
      };

      const onScanError = (errorMessage) => {
        // console.warn(`Code scan error = ${errorMessage}`);
      };

      html5QrcodeScannerInstance.render(onScanSuccess, onScanError);
      html5QrcodeScannerRef.current = html5QrcodeScannerInstance;
    }

    return () => {
      if (html5QrcodeScannerRef.current) {
        try {
          html5QrcodeScannerRef.current.clear().catch(error => {
            console.error("Failed to clear html5QrcodeScanner on cleanup:", error);
          });
        } catch (error) {
          console.error("Error during scanner cleanup:", error);
        }
      }
    };
  }, [isScanning, isAuthReady]);

  const stopScanner = () => {
    if (html5QrcodeScannerRef.current) {
      html5QrcodeScannerRef.current.clear().catch(error => {
        console.error("Failed to clear html5QrcodeScanner. If it's already stopped, ignore this error.", error);
      });
      setIsScanning(false);
    }
  };

  // --- Handle Add/Update Inventory Item ---
  const handleAddInventoryItem = async () => {
    setMessage({ type: '', text: '' });
    if (!db || !userId) {
      setMessage({ type: 'error', text: "Database not ready. Please wait." });
      return;
    }

    if (!scannedBarcode || !quantity || !expiryDate) {
      setMessage({ type: 'error', text: 'Please scan a barcode, enter quantity, and expiry date.' });
      return;
    }

    if (!isExistingProduct && (!productName || !category)) {
        setMessage({ type: 'error', text: 'For new products, please fill in Product Name and Category.' });
        return;
    }

    if (isNaN(quantity) || parseInt(quantity) <= 0) {
      setMessage({ type: 'error', text: 'Quantity must be a positive number.' });
      return;
    }

    try {
      const itemsCollectionRef = collection(db, `artifacts/${appId}/public/data/inventory_items`);
      const productDocRef = doc(itemsCollectionRef, scannedBarcode);

      const newExpiryBatch = {
        date: expiryDate,
        quantity: parseInt(quantity),
        addedAt: new Date(),
        isRemoved: false
      };

      const docSnap = await getDoc(productDocRef);
      if (docSnap.exists()) {
        const existingProductData = docSnap.data();
        const updatedExpiryDates = [...(existingProductData.expiryDates || []), newExpiryBatch];
        const newTotalQuantity = updatedExpiryDates
            .filter(batch => !batch.isRemoved)
            .reduce((sum, batch) => sum + (batch.quantity || 0), 0);

        await updateDoc(productDocRef, {
          expiryDates: updatedExpiryDates,
          quantity: newTotalQuantity,
          lastUpdated: new Date()
        });
        setMessage({ type: 'success', text: `Product "${existingProductData.name}" (Barcode: ${scannedBarcode}) updated with new stock of ${quantity}.` });
      } else {
        await setDoc(productDocRef, {
          barcode: scannedBarcode,
          name: productName,
          category: category,
          quantity: parseInt(quantity),
          expiryDates: [newExpiryBatch],
          createdAt: new Date(),
          lastUpdated: new Date()
        });
        setMessage({ type: 'success', text: `New product "${productName}" (Barcode: ${scannedBarcode}) added successfully.` });
      }

      setScannedBarcode('');
      setProductName('');
      setCategory('Chocolates');
      setQuantity('');
      setExpiryDate(getTodayDate());
      setIsExistingProduct(false);
      stopScanner();
    } catch (error) {
      console.error("Error adding/updating inventory item:", error);
      setMessage({ type: 'error', text: `Failed to add/update item: ${error.message}` });
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setCurrentPage('login');
      setMessage({ type: 'info', text: 'Logged out successfully.' });
    } catch (error) {
      console.error("Logout error:", error);
      setMessage({ type: 'error', text: 'Logout failed. Please try again.' });
    }
  };

  const ownerEmail = 'siddeshpawar622.sp@gmail.com';
  const isOwner = user && user.email === ownerEmail;

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Navbar */}
      <nav className="bg-blue-700 p-4 shadow-md flex flex-col sm:flex-row justify-between items-center rounded-b-lg">
        <h1 className="text-white text-2xl font-bold mb-2 sm:mb-0">Londis Dashboard</h1>
        <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4">
          {user && (
            <span className="text-white text-sm text-center sm:text-left">
              Logged in as: <span className="font-semibold">{user.email}</span> <br className="sm:hidden" />
              (User ID: <span className="font-mono text-xs break-all">{userId}</span>)
            </span>
          )}
          <button
            onClick={handleLogout}
            className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-opacity-50 transition duration-300 ease-in-out"
          >
            Logout
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow container mx-auto p-6">
        {appMessage && (
          <div className="bg-yellow-100 text-yellow-800 p-4 rounded-lg mb-4 text-center font-medium">
            <strong>Announcement:</strong> {appMessage}
          </div>
        )}
        <MessageBox message={message.text} type={message.type} onClose={() => setMessage({ type: '', text: '' })} />

        {/* User Profile Section */}
        {userDetails ? (
          <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
            <h3 className="text-2xl font-semibold text-gray-800 mb-4">Your Profile</h3>
            <p className="text-lg text-gray-700 mb-2">
              <span className="font-medium">Email:</span> {userDetails.email}
            </p>
            <p className="text-lg text-gray-700 mb-2">
              <span className="font-medium">Mobile:</span> {userDetails.mobileNumber}
            </p>
            <p className="text-lg text-gray-700">
              <span className="font-medium">Employee ID:</span> {userDetails.employeeId}
            </p>
          </div>
        ) : (
          <div className="bg-yellow-100 text-yellow-800 p-4 rounded-lg shadow-md border border-yellow-200">
            <p>Loading user details...</p>
          </div>
        )}

        {/* Global Announcement Editor (Owner Only) */}
        {isOwner && <MessageDisplay currentMessage={appMessage} db={db} />}

        {/* Barcode Scanner and Add/Update Product Form */}
        <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
          <h3 className="text-2xl font-semibold text-gray-800 mb-4">Add/Update Inventory Item</h3>
          <div className="space-y-4">
            {/* Barcode Scanner/Input Toggle */}
            <div className="flex flex-col sm:flex-row items-center sm:space-x-4 space-y-4 sm:space-y-0 mb-4">
              <button
                onClick={() => setIsScanning(!isScanning)}
                className={`py-2 px-4 rounded-lg font-semibold transition duration-300 w-full sm:w-auto ${isScanning ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'}`}
              >
                {isScanning ? 'Stop Scanner' : 'Start Barcode Scanner'}
              </button>
              <span className="text-gray-700">OR</span>
              <input
                type="text"
                className="shadow appearance-none border rounded-lg py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:flex-grow"
                placeholder="Enter Barcode Manually"
                value={scannedBarcode}
                onChange={(e) => setScannedBarcode(e.target.value)}
                disabled={isScanning}
              />
            </div>

            {/* Scanner Area */}
            {isScanning && (
              <div id="qr-code-reader" className="w-full max-w-md mx-auto border-4 border-blue-500 rounded-lg overflow-hidden">
                {/* HTML5-QRCode will render here */}
              </div>
            )}

            {/* Barcode Display */}
            {scannedBarcode && (
              <div className="bg-blue-100 text-blue-800 p-3 rounded-lg font-semibold">
                Current Barcode: <span className="font-mono break-all">{scannedBarcode}</span>
              </div>
            )}

            {/* Item Details Input */}
            <AddProductForm
              scannedBarcode={scannedBarcode}
              setScannedBarcode={setScannedBarcode}
              productName={productName}
              setProductName={setProductName}
              category={category}
              setCategory={setCategory}
              quantity={quantity}
              setQuantity={setQuantity}
              expiryDate={expiryDate}
              setExpiryDate={setExpiryDate}
              isExistingProduct={isExistingProduct}
              handleAddInventoryItem={handleAddInventoryItem}
              categories={categories}
            />
          </div>
        </div>

        {/* Existing Inventory Overview Section */}
        <ProductList />
      </main>

      {/* Footer (Optional) */}
      <footer className="bg-gray-800 text-white text-center p-4 mt-auto">
        <p>&copy; {new Date().getFullYear()} Londis Inventory Manager. All rights reserved.</p>
      </footer>
    </div>
  );
};


// --- Main App Component (Authentication and Routing) ---
export default function App() {
  const { user, loading, isAuthReady } = useAuth();
  const [currentPage, setCurrentPage] = useState('login');
  const [showSignUpModal, setShowSignUpModal] = useState(false);


  useEffect(() => {
    if (isAuthReady && !loading) {
      if (user) {
        setCurrentPage('dashboard');
      } else {
        setCurrentPage('login');
      }
    }
  }, [user, loading, isAuthReady]);

  const handleCloseSignUpModal = () => setShowSignUpModal(false);


  if (loading || !isAuthReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <p className="text-xl font-semibold text-gray-700">Loading application...</p>
      </div>
    );
  }

  let content;
  if (user) {
    content = <DashboardPage setCurrentPage={setCurrentPage} />;
  } else {
    switch (currentPage) {
      case 'signup':
        content = <SignupPage setCurrentPage={setCurrentPage} />;
        break;
      case 'login':
      default:
        content = <LoginPage setCurrentPage={setCurrentPage} />;
        break;
    }
  }

  return (
    <div className="App">
      {content}

      {showSignUpModal && (
        <SignUpModal
          onClose={handleCloseSignUpModal}
          onSignUpSuccess={() => {
            handleCloseSignUpModal();
            setCurrentPage('login');
          }}
        />
      )}
    </div>
  );
}

// Wrap the main App component with AuthProvider for global Firebase access
export const AppWithProvider = () => (
  <AuthProvider>
    <App />
  </AuthProvider>
);
