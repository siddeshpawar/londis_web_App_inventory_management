import React, { useState, useEffect, createContext, useContext, useRef, useCallback, useMemo } from 'react';
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
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage"; // Corrected Firebase Storage import

// Access Html5Qrcode and moment directly from window as they are loaded via CDN
const Html5Qrcode = typeof window !== 'undefined' ? window.Html5Qrcode : null;
const moment = typeof window !== 'undefined' ? window.moment : null;

// --- Global Variables (Provided by Canvas Environment) ---
const appId = typeof window.__app_id !== 'undefined' ? window.__app_id : 'default-app-id';
const initialAuthToken = typeof window.__initial_auth_token !== 'undefined' ? window.__initial_auth_token : null;

// --- Firebase Initialization (Using your provided config) ---
// IMPORTANT: Please DOUBLE-CHECK your Firebase project settings and ensure this configuration
// EXACTLY matches what is provided in your Firebase Console (Project settings -> Your apps -> Config).
// A common issue for "login failed" is a typo in the apiKey or projectId.
const firebaseConfig = {
    apiKey: "AIzaSyCVwde47xofIaRyJQr5QjeDgKCinQ7s8_U", // <-- CORRECTED API KEY HERE!
    authDomain: "londisinventoryapp.firebaseapp.com",
    projectId: "londisinventoryapp",
    storageBucket: "londisinventoryapp.firebasestorage.app",
    messagingSenderId: "990186016538",
    appId: "1:990186016538:web:e69f834cb120e62e5966a3"
};

let firebaseAppInstance;
let authInstance;
let dbInstance;
let storageInstance; // Declare storage instance

// Initialize Firebase only once
if (!firebaseAppInstance) {
  try {
    firebaseAppInstance = initializeApp(firebaseConfig);
    authInstance = getAuth(firebaseAppInstance);
    dbInstance = getFirestore(firebaseAppInstance);
    storageInstance = getStorage(firebaseAppInstance); // Initialize Firebase Storage
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
  const [employeeId, setEmployeeId] = useState(null); // New state for employee ID
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

        // Fetch user details to get employeeId
        try {
          const userDocRef = doc(dbInstance, `artifacts/${appId}/users/${currentUser.uid}/user_details`, currentUser.uid);
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            setEmployeeId(docSnap.data().employeeId || null);
          } else {
            setEmployeeId(null); // No employee ID found
            console.warn("No user details found for:", currentUser.uid);
          }
        } catch (error) {
          console.error("Error fetching employee ID:", error);
          setEmployeeId(null);
        }

      } else {
        setUser(null);
        setUserId(null);
        setEmployeeId(null); // Clear employee ID on logout
        console.log("User not authenticated.");
      }
      setLoading(false);
      setIsAuthReady(true);
    });

    const performAuth = async () => {
      if (initialAuthToken) {
        console.log("Attempting sign-in with custom token...");
        try {
          await signInWithCustomToken(authInstance, initialAuthToken);
          console.log("Signed in with custom token successfully.");
        } catch (error) {
          console.error("Custom token sign-in failed:", error.code, error.message);
        }
      } else {
        console.log("Attempting anonymous sign-in (no custom token provided)...");
        try {
          await signInAnonymously(authInstance);
          console.log("Signed in anonymously successfully.");
        } catch (error) {
          console.error("Anonymous sign-in failed:", error.code, error.message);
        }
      }
    };

    if (!isAuthReady) {
      performAuth();
    }

    return () => unsubscribe();
  }, [isAuthReady]);

  const value = { user, userId, employeeId, loading, isAuthReady, auth: authInstance, db: dbInstance, storage: storageInstance };

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

// --- SignUpModal Component ---
const SignUpModal = ({ onClose, onSignUpSuccess }) => {
  const { auth, db } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Store user information in Firestore
      // Using private data path: /artifacts/{appId}/users/{userId}/user_details/{documentId}
      await setDoc(doc(db, `artifacts/${appId}/users/${user.uid}/user_details`, user.uid), {
        email: user.email,
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
      backgroundColor: 'white',
      padding: '30px',
      borderRadius: '10px',
      boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
      width: '90%',
      maxWidth: '400px',
      textAlign: 'center',
    },
    form: {
      display: 'flex',
      flexDirection: 'column',
      gap: '15px',
      marginTop: '20px',
    },
    input: {
      padding: '12px',
      border: '1px solid #ddd',
      borderRadius: '5px',
      fontSize: '1em',
    },
    button: {
      padding: '12px 20px',
      borderRadius: '5px',
      fontSize: '1.1em',
      cursor: 'pointer',
      transition: 'background-color 0.3s ease',
      border: 'none',
    },
    signUpButton: {
      backgroundColor: '#28a745',
      color: 'white',
    },
    cancelButton: {
      backgroundColor: '#6c757d',
      color: 'white',
      marginTop: '10px',
    },
    error: {
      color: '#dc3545',
      marginTop: '10px',
      fontSize: '0.9em',
    }
  };

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalContent}>
        <h2 className="text-2xl font-bold mb-4">Sign Up</h2>
        {error && <p style={styles.error}>{error}</p>}
        <form onSubmit={handleSignUp} style={styles.form}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={styles.input}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={styles.input}
          />
          <input
            type="password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            style={styles.input}
          />
          <button type="submit" style={{ ...styles.button, ...styles.signUpButton }} disabled={loading}>
            {loading ? 'Signing Up...' : 'Sign Up'}
          </button>
          <button type="button" onClick={onClose} style={{ ...styles.button, ...styles.cancelButton }}>
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
};

// --- AddProductForm Component ---
const AddProductForm = ({
  scannedBarcode,
  setScannedBarcode,
  productName,
  setProductName,
  category,
  setCategory,
  quantity,
  setQuantity,
  expiryDate,
  setExpiryDate,
  isExistingProduct,
  handleAddInventoryItem,
  categories,
  productImage,
  setProductImage,
  imagePreviewUrl,
  setImagePreviewUrl,
  uploadingImage,
  imageUploadError
}) => {
  // Local state for messages, as the parent Dashboard will also manage messages.
  const [localMessage, setLocalMessage] = useState('');
  const [localMessageType, setLocalMessageType] = useState('');

  // This effect will react to changes in isExistingProduct, productName, scannedBarcode
  useEffect(() => {
    if (isExistingProduct) {
      setLocalMessage(`Product "${productName}" already exists. Add new stock/expiry date.`);
      setLocalMessageType('info');
    } else if (scannedBarcode && !productName) {
      setLocalMessage('New product barcode. Please fill in details.');
      setLocalMessageType('info');
    } else {
      setLocalMessage('');
      setLocalMessageType('');
    }
  }, [scannedBarcode, isExistingProduct, productName]);


  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalMessage('');
    setLocalMessageType('');
    // Call the parent's handler and let it manage global messages
    await handleAddInventoryItem();
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProductImage(file);
      // Create a preview URL for the selected image
      setImagePreviewUrl(URL.createObjectURL(file));
    } else {
      setProductImage(null);
      setImagePreviewUrl(null);
    }
  };


  const styles = {
    container: {
      maxWidth: '600px',
      margin: '20px auto',
      padding: '20px',
      border: '1px solid #ddd',
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      backgroundColor: '#fff',
    },
    h2: {
      textAlign: 'center',
      color: '#333',
      marginBottom: '20px',
    },
    form: {
      display: 'flex',
      flexDirection: 'column',
      gap: '15px',
      marginTop: '20px',
    },
    input: {
      padding: '10px',
      border: '1px solid #ccc',
      borderRadius: '4px',
      fontSize: '1em',
    },
    select: {
      padding: '10px',
      border: '1px solid #ccc',
      borderRadius: '4px',
      fontSize: '1em',
      backgroundColor: '#fff',
    },
    button: {
      padding: '12px 20px',
      backgroundColor: '#007bff',
      color: 'white',
      border: 'none',
      borderRadius: '5px',
      fontSize: '1.1em',
      cursor: 'pointer',
      transition: 'background-color 0.3s ease',
    },
    imagePreview: {
        marginTop: '10px',
        maxWidth: '100px',
        maxHeight: '100px',
        objectFit: 'contain',
        borderRadius: '4px',
        border: '1px solid #ddd',
    },
    uploadingMessage: {
        fontSize: '0.9em',
        color: '#007bff',
        marginTop: '5px',
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
      <h3 className="text-2xl font-semibold text-gray-800 mb-4">{isExistingProduct ? 'Update Product Stock' : 'Add New Product'}</h3>
      <MessageBox message={localMessage} type={localMessageType} onClose={() => { setLocalMessage(''); setLocalMessageType(''); }} />
      {imageUploadError && <MessageBox message={imageUploadError} type="error" onClose={() => { }} />} /* Display image upload error */

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="barcode" className="block text-gray-700 text-sm font-bold mb-2">Barcode:</label>
          <input
            type="text"
            id="barcode"
            className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Scan or enter barcode"
            value={scannedBarcode}
            onChange={(e) => setScannedBarcode(e.target.value)}
            required
            // Note: Removed `readOnly` to allow manual barcode input even if scanner is off
          />
        </div>

        <div>
          <label htmlFor="productName" className="block text-gray-700 text-sm font-bold mb-2">Product Name:</label>
          <input
            type="text"
            id="productName"
            className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Dairy Milk"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            required={!isExistingProduct} // Required only for new products
            readOnly={isExistingProduct} // Read-only if product exists
          />
        </div>

        <div>
          <label htmlFor="category" className="block text-gray-700 text-sm font-bold mb-2">Category:</label>
          <select
            id="category"
            className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
            disabled={isExistingProduct} // Disabled if product exists
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="quantity" className="block text-gray-700 text-sm font-bold mb-2">Quantity (for this batch):</label>
          <input
            type="number"
            id="quantity"
            className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., 10"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
            min="1"
          />
        </div>

        <div>
          <label htmlFor="expiryDate" className="block text-gray-700 text-sm font-bold mb-2">Expiry Date:</label>
          <input
            type="date"
            id="expiryDate"
            className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            required
          />
        </div>

        {/* Product Photo Upload */}
        <div>
            <label htmlFor="productImage" className="block text-gray-700 text-sm font-bold mb-2">Product Photo (Optional):</label>
            <input
                type="file"
                id="productImage"
                accept="image/*"
                capture="environment" // Suggests front or rear camera on mobile
                onChange={handleImageChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                disabled={uploadingImage}
            />
            {imagePreviewUrl && (
                <img src={imagePreviewUrl} alt="Product Preview" style={styles.imagePreview} className="mt-2" />
            )}
            {uploadingImage && <p className="text-blue-600 text-sm mt-1">Uploading image...</p>}
        </div>

        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-300 ease-in-out"
          disabled={uploadingImage}
        >
          {isExistingProduct ? 'Add New Stock' : 'Add Product'}
        </button>
      </form>
    </div>
  );
}

// --- ProductList Component ---
const ProductList = ({ db, userId, employeeId }) => { // Added employeeId prop
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updateMessage, setUpdateMessage] = useState({ type: '', text: '' });

  // Filter and Sort States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterExpiryStatus, setFilterExpiryStatus] = useState('All'); // 'All', 'Expired', 'Expiring Soon', 'Not Expired'
  const [sortBy, setSortBy] = useState('name_asc'); // 'name_asc', 'name_desc', 'expiry_asc', 'expiry_desc'

  // Categories for product dropdown - Memoized to prevent unnecessary re-renders
  const categories = useMemo(() => ['All', 'Chocolates', 'Alcohol', 'Wines', 'Cigarettes', 'Soft Drinks', 'Crisps', 'Other'], []);


  useEffect(() => {
    if (!db || !userId) {
      setLoading(false);
      return;
    }

    const productsCollectionRef = collection(db, 'products');
    const q = query(productsCollectionRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProducts(productsData);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching products:", err);
      setError("Failed to load products. Please try again.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, userId]);

  const handleMarkAsRemoved = async (productId, expiryDateIndex) => {
    setUpdateMessage({ type: '', text: '' });
    setError('');
    if (!db) {
      setError('Database not ready.');
      return;
    }

    try {
      const productDocRef = doc(db, 'products', productId);
      const productToUpdate = products.find(p => p.id === productId);

      if (!productToUpdate) {
        setError('Product not found for update.');
        return;
      }

      // Create a deep copy of the expiryDates array to avoid direct mutation
      const updatedExpiryDates = productToUpdate.expiryDates.map((batch, idx) => {
        if (idx === expiryDateIndex) {
          return { ...batch, isRemoved: true, removedBy: employeeId }; // Mark as removed and add removedBy (employeeId)
        }
        return batch;
      });

      // Calculate new total quantity based on non-removed batches
      const newTotalQuantity = updatedExpiryDates
        .filter(batch => !batch.isRemoved)
        .reduce((sum, batch) => sum + (batch.quantity || 0), 0);

      await updateDoc(productDocRef, {
        expiryDates: updatedExpiryDates,
        quantity: newTotalQuantity,
        lastUpdated: new Date()
      });

      setUpdateMessage({ type: 'success', text: 'Item marked as removed successfully!' });
      setTimeout(() => setUpdateMessage({ type: '', text: '' }), 3000); // Clear message after 3 seconds
    } catch (err) {
      console.error("Error marking item as removed:", err);
      setError('Failed to mark item as removed. Please try again.');
    }
  };

  // --- Filtering Logic ---
  const filteredProducts = useMemo(() => {
    let currentProducts = [...products];

    // 1. Search Term Filter (Name or Barcode)
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      currentProducts = currentProducts.filter(product =>
        (product.name || '').toLowerCase().includes(lowerCaseSearchTerm) ||
        (product.barcode || '').toLowerCase().includes(lowerCaseSearchTerm)
      );
    }

    // 2. Category Filter
    if (filterCategory !== 'All') {
      currentProducts = currentProducts.filter(product => product.category === filterCategory);
    }

    // 3. Expiry Status Filter
    if (filterExpiryStatus !== 'All') {
      const today = moment().startOf('day');
      currentProducts = currentProducts.filter(product => {
        // Only consider active (non-removed) batches for expiry status
        const activeBatches = (product.expiryDates || []).filter(batch => !batch.isRemoved);

        if (filterExpiryStatus === 'Expired') {
          return activeBatches.some(batch => moment(batch.date).isBefore(today));
        } else if (filterExpiryStatus === 'Expiring Soon') {
          return activeBatches.some(batch => {
            const expiry = moment(batch.date);
            const daysDiff = expiry.diff(today, 'days');
            return daysDiff >= 0 && daysDiff <= 7; // Expires today or within 7 days
          });
        } else if (filterExpiryStatus === 'Not Expired') {
          // A product is "Not Expired" if it has at least one active batch
          // and ALL its active batches are not expired and not expiring soon.
          // Or, more simply, if it has at least one batch with a future expiry date beyond 7 days.
          return activeBatches.some(batch => moment(batch.date).isAfter(today.clone().add(7, 'days')));
        }
        return true; // Should not reach here if filterExpiryStatus is handled
      });
    }

    // 4. Sort Logic
    currentProducts.sort((a, b) => {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();

      // Helper to get the earliest active expiry date for a product
      const getEarliestExpiry = (product) => {
        const activeBatches = (product.expiryDates || []).filter(batch => !batch.isRemoved);
        if (activeBatches.length === 0) return moment().add(100, 'years'); // Very distant future for products with no active batches
        return moment.min(activeBatches.map(batch => moment(batch.date)));
      };

      const expiryA = getEarliestExpiry(a);
      const expiryB = getEarliestExpiry(b);

      switch (sortBy) {
        case 'name_asc':
          return nameA.localeCompare(nameB);
        case 'name_desc':
          return nameB.localeCompare(nameA);
        case 'expiry_asc':
          return expiryA.diff(expiryB);
        case 'expiry_desc':
          return expiryB.diff(expiryA);
        default:
          return 0;
      }
    });

    return currentProducts;
  }, [products, searchTerm, filterCategory, filterExpiryStatus, sortBy]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterCategory('All');
    setFilterExpiryStatus('All');
    setSortBy('name_asc');
  };


  const styles = {
    container: {
      maxWidth: '1200px',
      margin: '20px auto',
      padding: '20px',
      border: '1px solid #ddd',
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      backgroundColor: '#fff',
    },
    h2: {
      textAlign: 'center',
      color: '#333',
      marginBottom: '20px',
    },
    loading: {
      textAlign: 'center',
      fontSize: '1.2em',
      color: '#666',
    },
    error: {
      color: '#dc3545',
      textAlign: 'center',
      fontSize: '1.1em',
    },
    successMessage: {
      marginTop: '15px',
      backgroundColor: '#d4edda',
      color: '#155724',
      padding: '10px',
      borderRadius: '4px',
      textAlign: 'center',
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
      gap: '20px',
    },
    productCard: {
      border: '1px solid #eee',
      borderRadius: '8px',
      padding: '15px',
      backgroundColor: '#f9f9f9',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    },
    productImage: { // New style for product image
        width: '80px',
        height: '80px',
        objectFit: 'cover',
        borderRadius: '4px',
        marginRight: '15px',
        border: '1px solid #eee',
    },
    productHeader: {
        display: 'flex',
        alignItems: 'center',
        marginBottom: '10px',
    },
    expiryList: {
      listStyle: 'none',
      padding: '0',
      margin: '10px 0 0 0',
    },
    expiryItem: {
      backgroundColor: '#e9f7ef',
      borderLeft: '4px solid #28a745',
      padding: '8px',
      marginBottom: '5px',
      borderRadius: '4px',
      fontSize: '0.9em',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    expiredItem: {
      backgroundColor: '#f8d7da',
      borderLeft: '4px solid #dc3545',
    },
    expiringSoonItem: {
      backgroundColor: '#fff3cd',
      borderLeft: '4px solid #ffc107',
    },
    removedItem: {
        backgroundColor: '#e0e0e0',
        borderLeft: '4px solid #9e9e9e',
        textDecoration: 'line-through',
        color: '#777',
    },
    expiryDate: {
      fontWeight: 'bold',
      color: '#007bff',
    },
    removeButton: {
      backgroundColor: '#ffc107',
      color: '#333',
      border: 'none',
      borderRadius: '4px',
      padding: '5px 10px',
      cursor: 'pointer',
      fontSize: '0.8em',
      transition: 'background-color 0.2s ease',
    },
  };

  // Helper function to determine style based on expiry date
  const getExpiryItemStyle = (expiryDate, isRemoved) => {
    if (isRemoved) return styles.removedItem;

    const today = moment();
    const expiry = moment(expiryDate);
    const daysDiff = expiry.diff(today, 'days');

    if (daysDiff < 0) {
      return styles.expiredItem;
    } else if (daysDiff <= 7) { // within 7 days
      return styles.expiringSoonItem;
    }
    return styles.expiryItem;
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">Current Inventory</h2>
      {loading && <p className="text-center text-gray-600">Loading products...</p>}
      {error && <MessageBox message={error} type="error" onClose={() => setError('')} />}
      {updateMessage.text && <MessageBox message={updateMessage.text} type={updateMessage.type} onClose={() => setUpdateMessage({ type: '', text: '' })} />}

      {/* Filter and Sort Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 items-end">
        {/* Search Input */}
        <div>
          <label htmlFor="search-term" className="block text-gray-700 text-sm font-bold mb-2">Search Name/Barcode:</label>
          <input
            type="text"
            id="search-term"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
          />
        </div>

        {/* Category Filter */}
        <div>
          <label htmlFor="filter-category" className="block text-gray-700 text-sm font-bold mb-2">Filter by Category:</label>
          <select
            id="filter-category"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full bg-white"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Expiry Status Filter */}
        <div>
          <label htmlFor="filter-expiry" className="block text-gray-700 text-sm font-bold mb-2">Filter by Expiry Status:</label>
          <select
            id="filter-expiry"
            value={filterExpiryStatus}
            onChange={(e) => setFilterExpiryStatus(e.target.value)}
            className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full bg-white"
          >
            <option value="All">All</option>
            <option value="Expired">Expired</option>
            <option value="Expiring Soon">Expiring Soon (7 days)</option>
            <option value="Not Expired">Not Expired</option>
          </select>
        </div>

        {/* Sort By */}
        <div>
          <label htmlFor="sort-by" className="block text-gray-700 text-sm font-bold mb-2">Sort By:</label>
          <select
            id="sort-by"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full bg-white"
          >
            <option value="name_asc">Product Name (A-Z)</option>
            <option value="name_desc">Product Name (Z-A)</option>
            <option value="expiry_asc">Earliest Expiry Date (Asc)</option>
            <option value="expiry_desc">Earliest Expiry Date (Desc)</option>
          </select>
        </div>

        {/* Clear Filters Button */}
        <div className="col-span-1 md:col-span-2 lg:col-span-4 flex justify-end">
          <button
            onClick={handleClearFilters}
            className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-50 transition duration-300 ease-in-out"
          >
            Clear Filters & Sort
          </button>
        </div>
      </div>

      {!loading && !error && filteredProducts.length === 0 && (
        <p className="text-center text-gray-600">No products found matching your criteria. Try adjusting your filters.</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {!loading && !error && filteredProducts.map(product => {
          // Separate active and removed batches for display
          const activeBatches = (product.expiryDates || []).filter(batch => !batch.isRemoved);
          const removedBatches = (product.expiryDates || [])
            .filter(batch => batch.isRemoved)
            .sort((a, b) => moment(b.addedAt).diff(moment(a.addedAt))); // Sort by most recent removal first

          // Display up to the latest 3 removed batches
          const displayRemovedBatches = removedBatches.slice(0, 3);
          const moreRemovedCount = removedBatches.length - displayRemovedBatches.length;

          return (
            <div key={product.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50 shadow-sm">
              <div className="flex items-center mb-3">
                  {product.imageUrl && (
                      <img src={product.imageUrl} alt={product.name} className="w-20 h-20 object-cover rounded-md mr-4 border border-gray-200" onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/80x80/cccccc/000000?text=No+Image'; }} />
                  )}
                  <h3 className="text-xl font-semibold text-gray-900">{product.name} <span className="text-gray-500 text-base">({product.barcode})</span></h3>
              </div>
              <p className="text-gray-700 mb-2">Category: {product.category || 'N/A'}</p>
              <p className="text-700 font-bold mb-3">Total Quantity: {product.quantity || 0}</p>
              <h4 className="font-medium text-gray-800 mb-2">Expiry Batches:</h4>
              <ul className="list-none p-0 m-0">
                {activeBatches.length > 0 ? (
                  activeBatches.sort((a, b) => moment(a.date).diff(moment(b.date))).map((expiry, index) => ( // Sort active batches by date
                    <li key={index} style={{ ...styles.expiryItem, ...getExpiryItemStyle(expiry.date, expiry.isRemoved) }}>
                      <span className="font-semibold">
                        Expiry: {moment(expiry.date).format('DD/MM/YYYY')} (Qty: {expiry.quantity || 'N/A'})
                        {expiry.addedBy && <span className="text-gray-500 text-xs ml-2"> (Added by: {expiry.addedBy})</span>}
                      </span>
                      <button
                        onClick={() => handleMarkAsRemoved(product.id, product.expiryDates.indexOf(expiry))} // Pass original index
                        className="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-1.5 px-3 rounded-md text-sm transition duration-200"
                      >
                        Mark as Removed
                      </button>
                    </li>
                  ))
                ) : (
                  <li className="text-gray-600">No active expiry batches.</li>
                )}

                {/* Display removed batches */}
                {displayRemovedBatches.map((expiry, index) => (
                  <li key={`removed-${index}`} style={{ ...styles.expiryItem, ...styles.removedItem }}>
                    <span className="font-semibold line-through">
                      Expiry: {moment(expiry.date).format('DD/MM/YYYY')} (Qty: {expiry.quantity || 'N/A'})
                    </span>
                    {expiry.removedBy && <span className="text-gray-500 text-xs ml-2"> (Removed by: {expiry.removedBy})</span>}
                  </li>
                ))}
                {moreRemovedCount > 0 && (
                  <li className="text-gray-600 text-sm mt-1">
                    ...and {moreRemovedCount} more removed {moreRemovedCount === 1 ? 'batch' : 'batches'}.
                  </li>
                )}

              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- MessageDisplay Component ---
function MessageDisplay({ currentMessage, db }) {
  const [newMessageText, setNewMessageText] = useState(currentMessage);
  const [postMessageError, setPostMessageError] = useState('');
  const [postMessageSuccess, setPostMessageSuccess] = useState('');

  // Update newMessageText when currentMessage changes (e.g., another admin updates it)
  useEffect(() => {
    setNewMessageText(currentMessage);
  }, [currentMessage]);

  const handlePostMessage = async () => {
    setPostMessageError('');
    setPostMessageSuccess('');
    if (newMessageText.trim() === '') {
      setPostMessageError('Message cannot be empty.');
      return;
    }
    try {
      // Public data path: /appSettings/messages (globally accessible announcement)
      const messageDocRef = doc(db, 'appSettings', 'messages');
      await setDoc(messageDocRef, { currentMessage: newMessageText.trim() }, { merge: true });
      setPostMessageSuccess('Message posted successfully!');
      setTimeout(() => setPostMessageSuccess(''), 3000); // Clear success message after 3 seconds
    } catch (error) {
      console.error("Error posting message:", error);
      setPostMessageError('Failed to post message. Please try again.');
    }
  };

  return (
    <div className="bg-blue-100 p-6 rounded-lg shadow-lg mb-8 border border-blue-200">
      <h3 className="text-xl font-semibold text-blue-800 mb-4">Post Global Announcement (Owner Only)</h3>
      <textarea
        value={newMessageText}
        onChange={(e) => setNewMessageText(e.target.value)}
        placeholder="Write your announcement here..."
        className="w-full min-h-[80px] p-3 rounded-lg border border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
      />
      <button
        onClick={handlePostMessage}
        className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-300 ease-in-out"
      >
        Post Message
      </button>
      {postMessageError && <p className="text-red-600 text-sm mt-2">{postMessageError}</p>}
      {postMessageSuccess && <p className="text-green-600 text-sm mt-2">{postMessageSuccess}</p>}
    </div>
  );
}


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
            <label htmlFor="email" className="block text-gray-700 text-sm font-bold mb-2">
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
            <label htmlFor="password" className="block text-gray-700 text-sm font-bold mb-2">
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
            <label htmlFor="mobileNumber" className="block text-gray-700 text-sm font-bold mb-2">
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
            <label htmlFor="employeeId" className="block text-gray-700 text-sm font-bold mb-2">
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
          <button
            type="button"
            onClick={() => setCurrentPage('login')} // Changed to navigate to login page
            className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50 transition duration-300 ease-in-out mt-4" // Using Tailwind for styling
          >
            Cancel
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
      // AuthProvider's onAuthStateChanged will handle redirection to Dashboard
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
            <label htmlFor="email" className="block text-gray-700 text-sm font-bold mb-2">
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
            <label htmlFor="password" className="block text-gray-700 text-sm font-bold mb-2">
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
  const { user, userId, employeeId, auth, db, storage, isAuthReady } = useAuth(); // Added employeeId
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

  // New states for image upload
  const [productImage, setProductImage] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState('');

  // Camera selection states
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');

  // Ref for the Html5Qrcode scanner instance. Will point to the div where scanner renders.
  const qrCodeReaderRef = useRef(null);
  const html5QrcodeScannerInstanceRef = useRef(null); // Ref to store the scanner object

  // Categories for product dropdown - Memoized to prevent unnecessary re-renders of useEffect
  const categories = useMemo(() => ['Chocolates', 'Alcohol', 'Wines', 'Cigarettes', 'Soft Drinks', 'Crisps', 'Other'], []);

  // Utility to get current date as ഉൾപ്പെടുത്തി-MM-DD
  const getTodayDate = useCallback(() => {
    if (moment) {
        return moment().format('YYYY-MM-DD');
    }
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  // --- Effect to check barcode existence whenever it changes (for form) ---
  // This logic is critical for the category selection and overall form behavior.
  useEffect(() => {
    const checkBarcode = async () => {
      setMessage({ type: '', text: '' }); // Clear message
      if (!db) return;

      if (scannedBarcode) {
        const productDocRef = doc(db, 'products', scannedBarcode);
        try {
          const docSnap = await getDoc(productDocRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setProductName(data.name || '');
            setCategory(data.category || categories[0]); // Set category to existing product's category, or first default
            setIsExistingProduct(true);
            setMessage({ type: 'info', text: `Product "${data.name}" already exists. Add new stock/expiry date.` });
            if (data.imageUrl) {
                setImagePreviewUrl(data.imageUrl);
            } else {
                setImagePreviewUrl(null);
            }
          } else {
            setProductName('');
            // For a NEW product, always reset category to default when a new barcode is entered.
            // User can then select their desired category.
            setCategory(categories[0]);
            setIsExistingProduct(false);
            setImagePreviewUrl(null); // Clear image preview for new product
            setMessage({ type: 'info', text: 'New product barcode. Please fill in details.' });
          }
        } catch (err) {
          console.error("Error checking barcode:", err);
          setMessage({ type: 'error', text: `Error checking barcode: ${err.message}` });
          setProductName('');
          setCategory(categories[0]);
          setIsExistingProduct(false);
          setImagePreviewUrl(null);
        }
      } else {
        // When barcode is cleared, reset all related states
        setProductName('');
        setCategory(categories[0]);
        setQuantity('');
        setExpiryDate(getTodayDate());
        setIsExistingProduct(false);
        setProductImage(null);
        setImagePreviewUrl(null);
        setMessage({ type: '', text: '' });
      }
    };

    // Debounce the barcode check to avoid excessive Firestore reads
    const debounceTimeout = setTimeout(() => {
      checkBarcode();
    }, 500);

    return () => clearTimeout(debounceTimeout); // Cleanup debounce timer
  }, [scannedBarcode, db, getTodayDate, categories]); // Removed setters from dependencies for stability if they don't change frequently


  // --- Firebase Data Listeners (User Details & App Message) ---
  useEffect(() => {
    if (!isAuthReady || !userId || !db) {
      console.log("Dashboard useEffect: Auth not ready or userId/db missing.");
      return;
    }

    // Fetch user details from Firestore
    const fetchUserDetails = async () => {
      try {
        setMessage({ type: 'info', text: 'Loading user details...' }); // Set loading message
        // Use appId in the path to adhere to Firestore security rules for private data
        const userDocRef = doc(db, `artifacts/${appId}/users/${userId}/user_details`, userId);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          setUserDetails(docSnap.data());
          setMessage({ type: 'success', text: 'Welcome back to your dashboard!' }); // Set success message
        } else {
          setMessage({ type: 'error', text: 'User details not found. Please contact support.' });
          console.warn("No user details found for:", userId);
        }
      } catch (error) {
        console.error("Error fetching user details:", error);
        setMessage({ type: 'error', text: 'Error loading user details.' });
      }
    };

    fetchUserDetails(); // Call immediately on mount/dependency change

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
  }, [userId, db, isAuthReady]); // appId is a global constant, so it's not a dependency here

  // --- Barcode Scanner Logic ---
  useEffect(() => {
    let html5QrcodeScanner = null;
    const scannerElementId = "qr-code-reader"; // The ID of the div where the scanner will render

    // Fetch available cameras once the component mounts or when Html5Qrcode is ready
    if (typeof Html5Qrcode === 'function' && availableCameras.length === 0) {
        Html5Qrcode.getCameras().then(devices => {
            if (devices && devices.length > 0) {
                setAvailableCameras(devices);
                // Attempt to select a default camera: environment (back) first, then first available
                const environmentCamera = devices.find(device => device.kind === 'videoinput' && device.facingMode === 'environment');
                if (environmentCamera) {
                    setSelectedDeviceId(environmentCamera.id);
                } else {
                    setSelectedDeviceId(devices[0].id); // Fallback to first camera
                }
            } else {
                setMessage({ type: 'error', text: 'No camera devices found. Please ensure a camera is connected or enabled.' });
            }
        }).catch(err => {
            console.error("Error getting camera devices:", err);
            setMessage({ type: 'error', text: `Error accessing camera devices: ${err.message}. Please allow camera access.` });
        });
    }


    // Logic to start and stop the scanner
    if (isScanning && isAuthReady && selectedDeviceId) {
      // Ensure the Html5Qrcode library is loaded
      if (typeof Html5Qrcode === 'undefined' || Html5Qrcode === null) {
          setMessage({ type: 'error', text: 'Barcode scanner library (Html5Qrcode) not loaded. Please check your HTML file or CDN.' });
          setIsScanning(false);
          return;
      }

      // If an old scanner instance exists, try to stop it gracefully
      if (html5QrcodeScannerInstanceRef.current) {
        html5QrcodeScannerInstanceRef.current.stop().catch(e => console.warn("Old scanner stop failed (silent):", e));
        html5QrcodeScannerInstanceRef.current = null; // Clear the ref
      }

      // Initialize Html5Qrcode using the fixed ID
      html5QrcodeScanner = new Html5Qrcode(
        scannerElementId, // Use the fixed ID here
        { fps: 10, qrbox: { width: 250, height: 250 }, disableFlip: false },
        false // Verbose logging: set to true for debugging in console
      );

      const onScanSuccess = (decodedText, decodedResult) => {
        console.log(`Code matched = ${decodedText}`, decodedResult);
        setScannedBarcode(decodedText);
        setMessage({ type: 'success', text: `Barcode scanned: ${decodedText}` });
        stopScanner(); // Stop scanner after successful scan
      };

      const onScanError = (errorMessage) => {
        // console.warn(`Code scan error = ${errorMessage}`); // Keep silent unless debugging
      };

      // Start the scanner with the selectedDeviceId
      html5QrcodeScanner.start(selectedDeviceId, { fps: 10, qrbox: { width: 250, height: 250 } }, onScanSuccess, onScanError)
        .then(() => {
          console.log("Scanner started successfully with device:", selectedDeviceId);
          html5QrcodeScannerInstanceRef.current = html5QrcodeScanner; // Store instance
        })
        .catch(err => {
          console.error("Failed to start scanner:", err);
          setMessage({ type: 'error', text: `Failed to start scanner: ${err.message}. Ensure camera permissions are granted and select a valid camera.` });
          setIsScanning(false); // Reset scanning state on error
        });
    } else if (!isScanning && html5QrcodeScannerInstanceRef.current) {
        // If `isScanning` becomes false, and there's an active scanner instance, stop it.
        html5QrcodeScannerInstanceRef.current.stop().then(() => {
            console.log("Scanner stopped due to isScanning being false.");
            html5QrcodeScannerInstanceRef.current = null;
        }).catch(e => console.warn("Scanner stop failed on isScanning change (silent):", e));
    }

    // Cleanup function: This runs when the component unmounts or when dependencies change and the effect re-runs.
    return () => {
      if (html5QrcodeScannerInstanceRef.current) {
        html5QrcodeScannerInstanceRef.current.stop().then(() => {
          console.log("Scanner cleanup stopped.");
          html5QrcodeScannerInstanceRef.current = null;
        }).catch(error => {
          console.error("Failed to stop html5QrcodeScanner on cleanup:", error);
        });
      }
    };
  }, [isScanning, isAuthReady, selectedDeviceId, availableCameras.length]); // Add selectedDeviceId and availableCameras.length as dependencies

  const stopScanner = () => {
    if (html5QrcodeScannerInstanceRef.current) {
      html5QrcodeScannerInstanceRef.current.stop().then(() => {
        console.log("Scanner stopped manually.");
        html5QrcodeScannerInstanceRef.current = null;
        setIsScanning(false); // Ensure state is reset
      }).catch(error => {
        console.error("Failed to stop html5QrcodeScanner on manual stop:", error);
        setIsScanning(false); // Ensure state is reset even on error
      });
    } else {
      setIsScanning(false); // If no instance, just reset state
    }
  };

  // --- Handle Add/Update Inventory Item ---
  const handleAddInventoryItem = async () => {
    setMessage({ type: '', text: '' });
    setImageUploadError(''); // Clear previous image upload errors

    if (!db || !userId || !employeeId) { // Ensure employeeId is available
      setMessage({ type: 'error', text: "Database or employee ID not ready. Please wait." });
      return;
    }

    if (!scannedBarcode || !quantity || !expiryDate) {
      setMessage({ type: 'error', text: 'Please scan/enter barcode, enter quantity, and expiry date.' });
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

    let itemImageUrl = imagePreviewUrl; // Start with current preview URL if any, or existing product's image

    // Handle image upload if a new file is selected and storage is available
    if (productImage && storage) {
        setUploadingImage(true);
        try {
            const imageRef = ref(storage, `product_images/${scannedBarcode}-${Date.now()}-${productImage.name}`);
            await uploadBytes(imageRef, productImage);
            itemImageUrl = await getDownloadURL(imageRef);
            setMessage({ type: 'info', text: 'Image uploaded successfully!' });
        } catch (uploadError) {
            console.error("Error uploading image:", uploadError);
            setImageUploadError('Failed to upload product image. Please try again or proceed without an image.');
            setUploadingImage(false);
            // DO NOT return here, allow the product save to proceed even if image upload fails.
            // The image URL will simply be null or the previous one.
        } finally {
            setUploadingImage(false);
        }
    }


    try {
      const productDocRef = doc(db, 'products', scannedBarcode);

      const newExpiryBatch = {
        date: expiryDate,
        quantity: parseInt(quantity),
        addedAt: new Date().toISOString(), // Store as ISO string for consistent sorting
        addedBy: employeeId, // Store the employee ID who added this batch
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
          lastUpdated: new Date().toISOString(),
          // Use the newly uploaded image URL, or keep the existing one if no new image was uploaded
          imageUrl: itemImageUrl || existingProductData.imageUrl || null
        });
        setMessage({ type: 'success', text: `Product "${existingProductData.name}" (Barcode: ${scannedBarcode}) updated with new stock of ${quantity}.` });
      } else {
        await setDoc(productDocRef, {
          barcode: scannedBarcode,
          name: productName,
          category: category,
          quantity: parseInt(quantity),
          expiryDates: [newExpiryBatch],
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          imageUrl: itemImageUrl || null // Store image URL for new product
        });
        setMessage({ type: 'success', text: `New product "${productName}" (Barcode: ${scannedBarcode}) added successfully.` });
      }

      // Reset form states after successful operation
      setScannedBarcode('');
      setProductName('');
      setCategory(categories[0]); // Always reset to default after successful add/update
      setQuantity('');
      setExpiryDate(getTodayDate());
      setIsExistingProduct(false);
      setProductImage(null); // Clear selected image file
      setImagePreviewUrl(null); // Clear image preview
      stopScanner(); // Stop scanner if it was running
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

  const ownerEmail = 'siddeshpawar622.sp@gmail.com'; // Define the owner's email
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
            {/* Barcode Scanner/Input Toggle and Camera Selector */}
            <div className="flex flex-col sm:flex-row items-center sm:space-x-4 space-y-4 sm:space-y-0 mb-4">
              <button
                onClick={() => setIsScanning(!isScanning)}
                className={`py-2 px-4 rounded-lg font-semibold transition duration-300 w-full sm:w-auto ${isScanning ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'}`}
              >
                {isScanning ? 'Stop Scanner' : 'Start Barcode Scanner'}
              </button>

              {/* Camera Selection Dropdown */}
              {availableCameras.length > 0 && ( // Show even if only one camera, for consistency
                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <label htmlFor="camera-select" className="text-gray-700 text-sm font-bold">Camera:</label>
                  <select
                    id="camera-select"
                    value={selectedDeviceId}
                    onChange={(e) => setSelectedDeviceId(e.target.value)}
                    className="shadow appearance-none border rounded-lg py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 flex-grow"
                    disabled={isScanning} // Disable changing camera while scanning
                  >
                    {availableCameras.map(device => (
                      <option key={device.id} value={device.id}>
                        {device.label || `Camera ${device.id.substring(0, 8)}...`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
                {availableCameras.length === 0 && !isScanning && (
                    <span className="text-red-500 text-sm">No cameras found.</span>
                )}

              <span className="text-gray-700">OR</span>
              <input
                type="text"
                className="shadow appearance-none border rounded-lg py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:flex-grow"
                placeholder="Enter Barcode Manually"
                value={scannedBarcode}
                onChange={(e) => setScannedBarcode(e.target.value)}
                disabled={isScanning} // Disable manual input when scanning is active
              />
            </div>

            {/* Scanner Area / Placeholder */}
            {isScanning ? (
              <div id="qr-code-reader" ref={qrCodeReaderRef} className="w-full max-w-md mx-auto border-4 border-blue-500 rounded-lg overflow-hidden">
                {/* Html5Qrcode will render here */}
              </div>
            ) : (
              <div className="w-full max-w-md mx-auto h-64 flex items-center justify-center bg-gray-200 rounded-lg border-2 border-gray-300 text-gray-600 font-medium">
                Click "Start Barcode Scanner" to activate camera.
              </div>
            )}


            {/* Barcode Display */}
            {scannedBarcode && (
              <div className="bg-blue-100 text-blue-800 p-3 rounded-lg font-semibold">
                Current Barcode: <span className="font-mono break-all">{scannedBarcode}</span>
              </div>
            )}

            {/* Item Details Input (using AddProductForm component) */}
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
              productImage={productImage}
              setProductImage={setProductImage}
              imagePreviewUrl={imagePreviewUrl}
              setImagePreviewUrl={setImagePreviewUrl}
              uploadingImage={uploadingImage}
              imageUploadError={imageUploadError}
            />
          </div>
        </div>

        {/* Existing Inventory Overview Section */}
        <ProductList db={db} userId={userId} employeeId={employeeId} /> {/* Pass employeeId */}
      </main>

      {/* Footer (Optional) */}
      <footer className="bg-gray-800 text-white text-center p-4 mt-auto rounded-t-lg">
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
    // This effect ensures that the correct page is shown once authentication state is ready.
    if (isAuthReady && !loading) {
      if (user) {
        setCurrentPage('dashboard');
      } else {
        setCurrentPage('login');
      }
    }
  }, [user, loading, isAuthReady]); // Dependencies: user object, loading status, auth readiness

  const handleCloseSignUpModal = () => setShowSignUpModal(false);


  // Display a loading screen while authentication is in progress
  if (loading || !isAuthReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
          <p className="text-xl font-semibold text-gray-700">Loading application...</p>
      </div>
    );
  }

  let content;
  if (user) {
    // If a user is logged in, show the Dashboard
    content = <DashboardPage setCurrentPage={setCurrentPage} />;
  } else {
    // Otherwise, show Login or Signup based on currentPage state
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

      {/* SignUp Modal, conditionally rendered */}
      {showSignUpModal && (
        <SignUpModal
          onClose={handleCloseSignUpModal}
          onSignUpSuccess={() => {
            handleCloseSignUpModal();
            setCurrentPage('login'); // rRedirect to login after successful signup
          }}
        />
      )}
    </div >
  );
}

// Wrap the main App component with AuthProvider for global Firebase access
export const AppWithProvider = () => (
  <AuthProvider>
    <App />
  </AuthProvider>
);
