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
  arrayUnion, // Keep arrayUnion if needed for expiryDates
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'; // Import Firebase Storage functions

// Access Html5QrcodeScanner and moment directly from window as they are loaded via CDN
const Html5QrcodeScanner = typeof window !== 'undefined' ? window.Html5QrcodeScanner : null;
const moment = typeof window !== 'undefined' ? window.moment : null;

// --- Global Variables (Provided by Canvas Environment) ---
const appId = typeof window.__app_id !== 'undefined' ? window.__app_id : 'default-app-id';
const initialAuthToken = typeof window.__initial_auth_token !== 'undefined' ? window.__initial_auth_token : null;

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
  }, [isAuthReady]);

  const value = { user, userId, loading, isAuthReady, auth: authInstance, db: dbInstance, storage: storageInstance };

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

// --- SignUpModal Component (formerly SignUpModal.js) ---
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

// --- AddProductForm Component (formerly AddProductForm.js) ---
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
  db,
  userId,
  productImage, // New prop for image file
  setProductImage, // New prop setter for image file
  imagePreviewUrl, // New prop for image preview URL
  setImagePreviewUrl, // New prop setter for image preview URL
  uploadingImage, // New prop for image upload status
  imageUploadError // New prop for image upload error
}) => {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Effect to check barcode existence whenever it changes
  useEffect(() => {
    const checkBarcode = async () => {
      setMessage('');
      setError('');
      if (!db || !scannedBarcode) return; // Only check if barcode is not empty and db is ready

      const productDocRef = doc(db, 'products', scannedBarcode);
      try {
        const docSnap = await getDoc(productDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProductName(data.name || '');
          setCategory(data.category || categories[0]);
          setMessage(`Product "${data.name}" already exists. Add new stock/expiry date.`);
          // If existing product has an image, load it for preview
          if (data.imageUrl) {
              setImagePreviewUrl(data.imageUrl);
          } else {
              setImagePreviewUrl(null);
          }
        } else {
          setProductName('');
          setCategory(categories[0]);
          setMessage('New product barcode. Please fill in details.');
        }
      } catch (err) {
        console.error("Error checking barcode:", err);
        setError(`Error checking barcode: ${err.message}`);
        setProductName('');
        setCategory(categories[0]);
      }
    };

    const debounceTimeout = setTimeout(() => {
      checkBarcode();
    }, 500);

    return () => clearTimeout(debounceTimeout);
  }, [scannedBarcode, db, setProductName, setCategory, categories, setImagePreviewUrl]); // Added setImagePreviewUrl as dependency

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    await handleAddInventoryItem(); // Call the parent's handler
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProductImage(file);
      setImagePreviewUrl(URL.createObjectURL(file)); // Create a preview URL
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
    },
    formGroup: {
      display: 'flex',
      flexDirection: 'column',
    },
    label: {
      marginBottom: '5px',
      fontWeight: 'bold',
      color: '#555',
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
    buttonHover: { // For demonstration, actual hover handled by Tailwind
      backgroundColor: '#0056b3',
    },
    message: {
      backgroundColor: '#d4edda',
      color: '#155724',
      padding: '10px',
      borderRadius: '4px',
      marginBottom: '10px',
      textAlign: 'center',
    },
    error: {
      backgroundColor: '#f8d7da',
      color: '#721c24',
      padding: '10px',
      borderRadius: '4px',
      marginBottom: '10px',
      textAlign: 'center',
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
    <div style={styles.container}>
      <h2 style={styles.h2}>{isExistingProduct ? 'Update Product Stock' : 'Add New Product'}</h2>
      {message && <div style={styles.message}>{message}</div>}
      {error && <div style={styles.error}>{error}</div>}
      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.formGroup}>
          <label htmlFor="barcode" style={styles.label}>Barcode:</label>
          <input
            type="text"
            id="barcode"
            value={scannedBarcode}
            onChange={(e) => setScannedBarcode(e.target.value)}
            placeholder="Scan or enter barcode"
            required
            readOnly={false} // Allow manual input
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label htmlFor="productName" style={styles.label}>Product Name:</label>
          <input
            type="text"
            id="productName"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="e.g., Dairy Milk"
            required={!isExistingProduct}
            readOnly={isExistingProduct} // Read-only if product exists
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label htmlFor="category" style={styles.label}>Category:</label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
            disabled={isExistingProduct} // Disabled if product exists
            style={styles.select}
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div style={styles.formGroup}>
          <label htmlFor="quantity" style={styles.label}>Quantity (for this batch):</label>
          <input
            type="number"
            id="quantity"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="e.g., 10"
            required
            min="1"
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label htmlFor="expiryDate" style={styles.label}>Expiry Date:</label>
          <input
            type="date"
            id="expiryDate"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            required
            style={styles.input}
          />
        </div>

        {/* Product Photo Upload */}
        <div style={styles.formGroup}>
            <label htmlFor="productImage" style={styles.label}>Product Photo (Optional):</label>
            <input
                type="file"
                id="productImage"
                accept="image/*"
                capture="camera" // Hint to open camera on mobile
                onChange={handleImageChange}
                style={styles.input}
                disabled={uploadingImage}
            />
            {imagePreviewUrl && (
                <img src={imagePreviewUrl} alt="Product Preview" style={styles.imagePreview} />
            )}
            {uploadingImage && <p style={styles.uploadingMessage}>Uploading image...</p>}
            {imageUploadError && <p style={styles.error}>{imageUploadError}</p>}
        </div>


        <button type="submit" style={styles.button} disabled={uploadingImage}>
          {isExistingProduct ? 'Add New Stock' : 'Add Product'}
        </button>
      </form>
    </div>
  );
}

// --- ProductList Component (formerly ProductList.js) ---
const ProductList = ({ db, userId }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updateMessage, setUpdateMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState(''); // New state for search term

  useEffect(() => {
    if (!db || !userId) {
      setLoading(false);
      return;
    }

    const productsCollectionRef = collection(db, 'products'); // Use root collection
    // NOTE: orderBy() is removed as per previous instructions to avoid index issues.
    // Sorting will be done in-memory.
    const q = query(productsCollectionRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort products by name and then their expiry dates in memory
      const sortedProducts = productsData.map(product => ({
        ...product,
        expiryDates: product.expiryDates ? product.expiryDates.sort((a, b) => moment(a.date).diff(moment(b.date))) : []
      })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      setProducts(sortedProducts);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching products:", err);
      setError("Failed to load products. Please try again.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, userId]);

  const handleMarkAsRemoved = async (productId, expiryDateIndex) => {
    setUpdateMessage('');
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
          return { ...batch, isRemoved: true }; // Mark as removed
        }
        return batch;
      });

      // Calculate new total quantity based on non-removed batches
      const newTotalQuantity = updatedExpiryDates
        .filter(batch => !batch.isRemoved)
        .reduce((sum, batch) => sum + (batch.quantity || 0), 0);

      await updateDoc(productDocRef, {
        expiryDates: updatedExpiryDates,
        quantity: newTotalQuantity, // Update the overall quantity
        lastUpdated: new Date()
      });

      setUpdateMessage('Item marked as removed successfully!');
      setTimeout(() => setUpdateMessage(''), 3000); // Clear message after 3 seconds
    } catch (err) {
      console.error("Error marking item as removed:", err);
      setError('Failed to mark item as removed. Please try again.');
    }
  };

  // Filtered products based on search term
  const filteredProducts = products.filter(product =>
    product.barcode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );


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
    removeButtonHover: {
      backgroundColor: '#e0a800',
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
    <div style={styles.container}>
      <h2 style={styles.h2}>Current Inventory</h2>
      {loading && <p style={styles.loading}>Loading products...</p>}
      {error && <p style={styles.error}>{error}</p>}
      {updateMessage && <p style={styles.successMessage}>{updateMessage}</p>}

      {/* Search Input for Product List */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by barcode or name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
        />
      </div>

      {!loading && !error && filteredProducts.length === 0 && (
        <p style={{ textAlign: 'center', color: '#666' }}>No products found matching your search. Add some using the "Add Product" section.</p>
      )}

      <div style={styles.grid}>
        {!loading && !error && filteredProducts.map(product => (
          <div key={product.id} style={styles.productCard}>
            <div style={styles.productHeader}>
                {product.imageUrl && (
                    <img src={product.imageUrl} alt={product.name} style={styles.productImage} onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/80x80/cccccc/000000?text=No+Image'; }} />
                )}
                <h3 className="text-xl font-semibold text-gray-900">{product.name} <span className="text-gray-500 text-base">({product.barcode})</span></h3>
            </div>
            <p className="text-gray-700 mb-3">Category: {product.category || 'N/A'}</p>
            <p className="text-gray-700 font-bold mb-2">Total Quantity: {product.quantity || 0}</p>
            <h4 className="font-medium text-gray-800 mb-2">Expiry Batches:</h4>
            <ul style={styles.expiryList}>
              {product.expiryDates && product.expiryDates.length > 0 ? (
                product.expiryDates.map((expiry, index) => (
                  <li key={index} style={{ ...styles.expiryItem, ...getExpiryItemStyle(expiry.date, expiry.isRemoved) }}>
                    <span style={styles.expiryDate}>
                      {expiry.isRemoved ? 'Removed' : `Expiry: ${moment(expiry.date).format('DD/MM/YYYY')}`}
                      {expiry.isRemoved ? '' : ` (Qty: ${expiry.quantity || 'N/A'})`}
                    </span>
                    {!expiry.isRemoved && (
                      <button
                        onClick={() => handleMarkAsRemoved(product.id, index)}
                        style={styles.removeButton}
                      >
                        Mark as Removed
                      </button>
                    )}
                  </li>
                ))
              ) : (
                <li className="text-gray-600">No expiry batches recorded.</li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- MessageDisplay Component (formerly MessageDisplay.js) ---
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

  const styles = {
    messageEditorContainer: {
      backgroundColor: '#e7f3ff',
      padding: '20px',
      borderRadius: '8px',
      marginBottom: '30px',
      border: '1px solid #b3d9ff',
    },
    messageTextarea: {
      width: '100%',
      minHeight: '80px',
      padding: '10px',
      borderRadius: '4px',
      border: '1px solid #ccc',
      marginBottom: '10px',
      fontSize: '1em',
      boxSizing: 'border-box',
    },
    postButton: {
      padding: '10px 20px',
      backgroundColor: '#007bff',
      color: 'white',
      border: 'none',
      borderRadius: '5px',
      cursor: 'pointer',
      fontSize: '1em',
      transition: 'background-color 0.3s ease',
    },
    postButtonHover: {
      backgroundColor: '#0056b3',
    },
    errorText: {
      color: '#dc3545',
      marginTop: '10px',
    },
    successText: {
      color: '#28a745',
      marginTop: '10px',
    }
  };

  return (
    <div style={styles.messageEditorContainer}>
      <h3>Post Global Announcement (Owner Only)</h3>
      <textarea
        value={newMessageText}
        onChange={(e) => setNewMessageText(e.target.value)}
        placeholder="Write your announcement here..."
        style={styles.messageTextarea}
      />
      <button onClick={handlePostMessage} style={styles.postButton}>
        Post Message
      </button>
      {postMessageError && <p style={styles.errorText}>{postMessageError}</p>}
      {postMessageSuccess && <p style={styles.successText}>{postMessageSuccess}</p>}
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
  const { user, userId, auth, db, storage, isAuthReady } = useAuth(); // Destructure storage
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

  // Ref for the HTML5-QRCode scanner instance. Will point to the div where scanner renders.
  const qrCodeReaderRef = useRef(null);
  const html5QrcodeScannerInstanceRef = useRef(null); // Ref to store the scanner object

  // Categories for product dropdown
  const categories = ['Chocolates', 'Alcohol', 'Wines', 'Cigarettes', 'Soft Drinks', 'Crisps', 'Other'];

  // Utility to get current date asYYYY-MM-DD
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
        const productDocRef = doc(db, 'products', scannedBarcode);
        try {
          const docSnap = await getDoc(productDocRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setProductName(data.name || '');
            setCategory(data.category || 'Chocolates');
            setIsExistingProduct(true);
            setMessage({ type: 'info', text: `Product "${data.name}" already exists. Add new stock/expiry date.` });
            // If existing product has an image, load it for preview
            if (data.imageUrl) {
                setImagePreviewUrl(data.imageUrl);
            } else {
                setImagePreviewUrl(null);
            }
          } else {
            setProductName('');
            setCategory('Chocolates');
            setIsExistingProduct(false);
            setImagePreviewUrl(null); // Clear image preview for new product
            setMessage({ type: 'info', text: 'New product barcode. Please fill in details.' });
          }
        } catch (err) {
          console.error("Error checking barcode:", err);
          setMessage({ type: 'error', text: `Error checking barcode: ${err.message}` });
          setProductName('');
          setCategory('Chocolates');
          setIsExistingProduct(false);
          setImagePreviewUrl(null);
        }
      } else {
        setProductName('');
        setCategory('Chocolates');
        setQuantity('');
        setExpiryDate(getTodayDate());
        setIsExistingProduct(false);
        setProductImage(null); // Clear selected file
        setImagePreviewUrl(null); // Clear image preview
        setMessage({ type: '', text: '' });
      }
    };

    const debounceTimeout = setTimeout(() => {
      checkBarcode();
    }, 500);

    return () => clearTimeout(debounceTimeout);
  }, [scannedBarcode, db, getTodayDate, setProductName, setCategory, setImagePreviewUrl]); // Added setImagePreviewUrl as dependency

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
    // Only attempt to start scanner if isScanning is true AND the DOM element is available
    if (isScanning && isAuthReady && Html5QrcodeScanner && qrCodeReaderRef.current) {
      // Ensure the scanner is stopped before trying to start it again if it was previously running
      if (html5QrcodeScannerInstanceRef.current) {
        html5QrcodeScannerInstanceRef.current.stop().catch(e => console.warn("Old scanner stop failed:", e));
      }

      // Initialize Html5QrcodeScanner
      const html5QrcodeScanner = new Html5QrcodeScanner(
        qrCodeReaderRef.current.id, // Use the ref's ID
        { fps: 10, qrbox: { width: 250, height: 250 }, disableFlip: false }, // Added disableFlip: false for better scanning
        false // Verbose logging
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

      // Request camera permissions explicitly before rendering
      Html5QrcodeScanner.getCameras().then(devices => {
        if (devices && devices.length) {
          // Use the first available camera ID
          const cameraId = devices[0].id;
          html5QrcodeScanner.start(cameraId, { fps: 10, qrbox: { width: 250, height: 250 } }, onScanSuccess, onScanError)
            .then(() => {
              console.log("Scanner started successfully.");
              html5QrcodeScannerInstanceRef.current = html5QrcodeScanner; // Store instance
            })
            .catch(err => {
              console.error("Failed to start scanner:", err);
              setMessage({ type: 'error', text: `Failed to start scanner: ${err.message}. Please check camera permissions and ensure only one camera is trying to operate.` });
              setIsScanning(false); // Turn off scanning state
            });
        } else {
          setMessage({ type: 'error', text: 'No camera devices found.' });
          setIsScanning(false); // Turn off scanning state
        }
      }).catch(err => {
        console.error("Error getting camera devices:", err);
        setMessage({ type: 'error', text: `Error accessing camera: ${err.message}. Please check browser permissions.` });
        setIsScanning(false); // Turn off scanning state
      });
    }

    return () => {
      // Cleanup function to clear scanner when component unmounts or isScanning becomes false
      if (html5QrcodeScannerInstanceRef.current) {
        html5QrcodeScannerInstanceRef.current.stop().then(() => {
          console.log("Scanner stopped.");
          html5QrcodeScannerInstanceRef.current = null; // Clear ref
        }).catch(error => {
          console.error("Failed to stop html5QrcodeScanner on cleanup:", error);
        });
      }
    };
  }, [isScanning, isAuthReady, Html5QrcodeScanner]);

  const stopScanner = () => {
    if (html5QrcodeScannerInstanceRef.current) {
      html5QrcodeScannerInstanceRef.current.stop().then(() => {
        console.log("Scanner stopped manually.");
        html5QrcodeScannerInstanceRef.current = null;
        setIsScanning(false);
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
    setImageUploadError('');
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

    let imageUrl = imagePreviewUrl; // Start with current preview URL if any

    // Handle image upload if a new file is selected
    if (productImage && storage) {
        setUploadingImage(true);
        try {
            const imageRef = ref(storage, `product_images/${scannedBarcode}-${Date.now()}-${productImage.name}`);
            await uploadBytes(imageRef, productImage);
            imageUrl = await getDownloadURL(imageRef);
            setMessage({ type: 'info', text: 'Image uploaded successfully!' });
        } catch (uploadError) {
            console.error("Error uploading image:", uploadError);
            setImageUploadError('Failed to upload image. Please try again.');
            setUploadingImage(false);
            return; // Stop the process if image upload fails
        } finally {
            setUploadingImage(false);
        }
    }


    try {
      const productDocRef = doc(db, 'products', scannedBarcode);

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
          lastUpdated: new Date(),
          imageUrl: imageUrl || existingProductData.imageUrl || null // Update image URL, keep existing if no new upload
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
          lastUpdated: new Date(),
          imageUrl: imageUrl || null // Store image URL for new product
        });
        setMessage({ type: 'success', text: `New product "${productName}" (Barcode: ${scannedBarcode}) added successfully.` });
      }

      setScannedBarcode('');
      setProductName('');
      setCategory('Chocolates');
      setQuantity('');
      setExpiryDate(getTodayDate());
      setIsExistingProduct(false);
      setProductImage(null); // Clear selected image file
      setImagePreviewUrl(null); // Clear image preview
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
              <div id="qr-code-reader" ref={qrCodeReaderRef} className="w-full max-w-md mx-auto border-4 border-blue-500 rounded-lg overflow-hidden">
                {/* HTML5-QRCode will render here */}
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
              productImage={productImage} // Pass image states
              setProductImage={setProductImage}
              imagePreviewUrl={imagePreviewUrl}
              setImagePreviewUrl={setImagePreviewUrl}
              uploadingImage={uploadingImage}
              imageUploadError={imageUploadError}
              db={db} // Pass db to AddProductForm for its internal barcode check
              userId={userId} // Pass userId as well
            />
          </div>
        </div>

        {/* Existing Inventory Overview Section */}
        <ProductList db={db} userId={userId} />
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
    </div >
  );
}

// Wrap the main App component with AuthProvider for global Firebase access
export const AppWithProvider = () => (
  <AuthProvider>
    <App />
  </AuthProvider>
);
