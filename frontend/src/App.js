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

import Tesseract from 'tesseract.js';


const Html5Qrcode = typeof window !== 'undefined' ? window.Html5Qrcode : null;
const moment = typeof window !== 'undefined' ? window.moment : null;

// --- Global Variables (Provided by Canvas Environment) ---
const appId = typeof window.__app_id !== 'undefined' ? window.__app_id : 'default-app-id';
const initialAuthToken = typeof window.__initial_auth_token !== 'undefined' ? window.__initial_auth_token : null;

// --- Firebase Initialization ---
const firebaseConfig = {
    apiKey: "AIzaSyCVwde47xofIaRyJQr5QjeDgKCinQ7s8_U",
    authDomain: "londisinventoryapp.firebaseapp.com",
    projectId: "londisinventoryapp",
    storageBucket: "londisinventoryapp.appspot.com", // Updated storage bucket URL
    messagingSenderId: "990186016538",
    appId: "1:990186016538:web:e69f834cb120e62e5966a3"
};

let firebaseAppInstance;
let authInstance;
let dbInstance;
// Remove local storage instance since we're importing it from firebaseConfig

if (!firebaseAppInstance) {
  try {
    firebaseAppInstance = initializeApp(firebaseConfig);
    authInstance = getAuth(firebaseAppInstance);
    dbInstance = getFirestore(firebaseAppInstance);
    // Removed local storage initialization - using imported storage instead
  } catch (error) {
    console.error("Firebase initialization error:", error);
  }
}

// --- Auth Context ---
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [employeeId, setEmployeeId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    if (!authInstance) {
        setLoading(false);
        setIsAuthReady(true);
        return;
    }
    const unsubscribe = onAuthStateChanged(authInstance, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setUserId(currentUser.uid);
        try {
          const userDocRef = doc(dbInstance, `artifacts/${appId}/users/${currentUser.uid}/user_details`, currentUser.uid);
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            setEmployeeId(docSnap.data().employeeId || null);
          } else {
            setEmployeeId(null);
          }
        } catch (error) {
          setEmployeeId(null);
        }
      } else {
        setUser(null);
        setUserId(null);
        setEmployeeId(null);
      }
      setLoading(false);
      setIsAuthReady(true);
    });
    const performAuth = async () => {
      if (initialAuthToken) {
        try {
          await signInWithCustomToken(authInstance, initialAuthToken);
        } catch (error) {
          console.error("Custom token sign-in failed:", error.code, error.message);
        }
      } else {
        try {
          await signInAnonymously(authInstance);
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

  const value = { user, userId, employeeId, loading, isAuthReady, auth: authInstance, db: dbInstance };

  return (
    <AuthContext.Provider value={value}>
      {loading ? <div className="flex items-center justify-center min-h-screen"><p>Loading application...</p></div> : children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

// --- Reusable Components (kept inside App.js) ---

const MessageBox = ({ message, type, onClose }) => {
  if (!message) return null;
  const typeClasses = { success: 'bg-green-100 text-green-800 border-green-200', error: 'bg-red-100 text-red-800 border-red-200', info: 'bg-blue-100 text-blue-800 border-blue-200' };
  return (
    <div className={`p-4 mb-4 rounded-lg shadow-md border ${typeClasses[type || 'info']} flex justify-between items-center`} role="alert">
      <span className="font-medium">{message}</span>
      {onClose && (
        <button onClick={onClose} className="ml-4 p-1 rounded-full hover:bg-opacity-75 focus:outline-none" aria-label="Close">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
        </button>
      )}
    </div>
  );
};

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
  productImageData,
  setProductImageData,
  imagePreviewUrl,
  setImagePreviewUrl,
  uploadingImage,
  imageUploadError,
  onScanNameClick, // <-- This will now trigger the hidden file input
  ocrInputRef, // <-- Ref to the hidden file input
  handleOcrFileChange, // <-- Handler for when a file is selected
  ocrOptions,
  setOcrOptions,
  isExistingBarcode,
}) => {
  const handleOcrOptionClick = (option) => {
    setProductName(prev => `${prev} ${option}`.trim());
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) {
      setProductImageData(null);
      setImagePreviewUrl(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = event.target.result;
      setProductImageData(base64Data);
      setImagePreviewUrl(base64Data);
    };
    reader.onerror = () => {
      console.error('Failed to read image file.');
      setProductImageData(null);
      setImagePreviewUrl(null);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
      <h3 className="text-2xl font-semibold text-gray-800 mb-4">{isExistingProduct ? 'Update Product Stock' : 'Add New Product'}</h3>
      
      {imageUploadError && <MessageBox message={imageUploadError} type="error" />}

      {ocrOptions.length > 0 && (
        <div className="my-4 p-3 bg-purple-100 rounded-lg border border-purple-200">
          <div className="flex justify-between items-center">
             <p className="font-semibold text-purple-800">Tap to build name:</p>
             <button type="button" onClick={() => setOcrOptions([])} className="text-sm text-purple-600 hover:text-purple-800">Clear</button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {ocrOptions.map((option, index) => (
              <button key={index} type="button" onClick={() => handleOcrOptionClick(option)} className="bg-purple-200 hover:bg-purple-300 text-purple-900 font-semibold py-1 px-3 rounded-full text-sm transition-transform transform hover:scale-105">
                {option}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleAddInventoryItem} className="space-y-4">
        <div>
          <label htmlFor="barcode" className="block text-gray-700 text-sm font-bold mb-2">Barcode:</label>
          <input type="text" id="barcode" className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700" value={scannedBarcode} onChange={(e) => setScannedBarcode(e.target.value)} required />
        </div>

        <div>
          <label htmlFor="productName" className="block text-gray-700 text-sm font-bold mb-2">Product Name:</label>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              id="productName"
              className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700"
              placeholder="e.g., Dairy Milk"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              required={!isExistingProduct}
              readOnly={isExistingProduct}
            />
            {/* This hidden input is the key to the new approach */}
            <input
              type="file"
              ref={ocrInputRef}
              onChange={handleOcrFileChange}
              className="hidden"
              accept="image/*"
              capture="environment" 
            />
            <button
              type="button"
              onClick={onScanNameClick} // This now clicks the hidden input
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold p-3 rounded-lg disabled:bg-gray-400"
              aria-label="Scan product name with camera"
              disabled={isExistingProduct}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="category" className="block text-gray-700 text-sm font-bold mb-2">Category:</label>
          <select id="category" className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700" value={category} onChange={(e) => setCategory(e.target.value)} required disabled={isExistingProduct}>
            {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="quantity" className="block text-gray-700 text-sm font-bold mb-2">Quantity:</label>
          <input type="number" id="quantity" className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700" value={quantity} onChange={(e) => setQuantity(e.target.value)} required min="1" />
        </div>
        <div>
          <label htmlFor="expiryDate" className="block text-gray-700 text-sm font-bold mb-2">Expiry Date:</label>
          <input type="date" id="expiryDate" className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} required />
        </div>
        <div>
            <label htmlFor="productImage" className="block text-gray-700 text-sm font-bold mb-2">Product Photo:</label>
            <input type="file" id="productImage" accept="image/*" className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0" onChange={handleImageChange} disabled={uploadingImage || isExistingBarcode} />
            {imagePreviewUrl && <img src={imagePreviewUrl} alt="Preview" className="mt-2 h-24 w-24 object-cover rounded-md border" />}
        </div>
        <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg w-full" disabled={uploadingImage}>
          {uploadingImage ? 'Uploading...' : (isExistingProduct ? 'Add New Stock' : 'Add Product')}
        </button>
      </form>
    </div>
  );
};

const ProductList = ({ db, userId, employeeId }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updateMessage, setUpdateMessage] = useState({ type: '', text: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterExpiryStatus, setFilterExpiryStatus] = useState('All');
  const [sortBy, setSortBy] = useState('name_asc');

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

      const updatedExpiryDates = productToUpdate.expiryDates.map((batch, idx) => {
        if (idx === expiryDateIndex) {
          return { ...batch, isRemoved: true, removedBy: employeeId };
        }
        return batch;
      });

      const newTotalQuantity = updatedExpiryDates
        .filter(batch => !batch.isRemoved)
        .reduce((sum, batch) => sum + (batch.quantity || 0), 0);

      await updateDoc(productDocRef, {
        expiryDates: updatedExpiryDates,
        quantity: newTotalQuantity,
        lastUpdated: new Date()
      });

      setUpdateMessage({ type: 'success', text: 'Item marked as removed successfully!' });
      setTimeout(() => setUpdateMessage({ type: '', text: '' }), 3000);
    } catch (err) {
      console.error("Error marking item as removed:", err);
      setError('Failed to mark item as removed. Please try again.');
    }
  };

  const filteredProducts = useMemo(() => {
    let currentProducts = [...products];

    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      currentProducts = currentProducts.filter(product =>
        (product.name || '').toLowerCase().includes(lowerCaseSearchTerm) ||
        (product.barcode || '').toLowerCase().includes(lowerCaseSearchTerm)
      );
    }

    if (filterCategory !== 'All') {
      currentProducts = currentProducts.filter(product => product.category === filterCategory);
    }

    if (filterExpiryStatus !== 'All') {
        const today = moment().startOf('day');
        currentProducts = currentProducts.filter(product => {
            const activeBatches = (product.expiryDates || []).filter(batch => !batch.isRemoved);
            if (filterExpiryStatus === 'Expired') {
                return activeBatches.some(batch => moment(batch.date).isBefore(today));
            } else if (filterExpiryStatus === 'Expiring Soon') {
                return activeBatches.some(batch => {
                    const daysDiff = moment(batch.date).diff(today, 'days');
                    return daysDiff >= 0 && daysDiff <= 7;
                });
            } else if (filterExpiryStatus === 'Not Expired') {
                return activeBatches.some(batch => moment(batch.date).isAfter(today.clone().add(7, 'days')));
            }
            return true;
        });
    }

    currentProducts.sort((a, b) => {
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        const getEarliestExpiry = (product) => {
            const activeBatches = (product.expiryDates || []).filter(batch => !batch.isRemoved);
            if (activeBatches.length === 0) return moment().add(100, 'years');
            return moment.min(activeBatches.map(batch => moment(batch.date)));
        };
        const expiryA = getEarliestExpiry(a);
        const expiryB = getEarliestExpiry(b);

        switch (sortBy) {
            case 'name_asc': return nameA.localeCompare(nameB);
            case 'name_desc': return nameB.localeCompare(nameA);
            case 'expiry_asc': return expiryA.diff(expiryB);
            case 'expiry_desc': return expiryB.diff(expiryA);
            default: return 0;
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

  const getExpiryItemStyleClass = (expiryDate, isRemoved) => {
    if (isRemoved) return 'bg-gray-200 border-l-gray-400 text-gray-500 line-through';
    const today = moment();
    const expiry = moment(expiryDate);
    const daysDiff = expiry.diff(today, 'days');
    if (daysDiff < 0) return 'bg-red-100 border-l-red-500';
    if (daysDiff <= 7) return 'bg-yellow-100 border-l-yellow-500';
    return 'bg-green-100 border-l-green-500';
  };

  if (loading) return <p className="text-center text-gray-600">Loading product list...</p>;
  if (error) return <MessageBox message={error} type="error" />;

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">Current Inventory</h2>
      {updateMessage.text && <MessageBox message={updateMessage.text} type={updateMessage.type} onClose={() => setUpdateMessage({ type: '', text: '' })} />}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 items-end">
        <div>
            <label htmlFor="search-term" className="block text-sm font-medium text-gray-700">Search Name/Barcode</label>
            <input type="text" id="search-term" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"/>
        </div>
        <div>
            <label htmlFor="filter-category" className="block text-sm font-medium text-gray-700">Category</label>
            <select id="filter-category" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2">
                {categories.map(cat => <option key={cat}>{cat}</option>)}
            </select>
        </div>
        <div>
            <label htmlFor="filter-expiry" className="block text-sm font-medium text-gray-700">Expiry Status</label>
            <select id="filter-expiry" value={filterExpiryStatus} onChange={(e) => setFilterExpiryStatus(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2">
                <option value="All">All</option>
                <option value="Expired">Expired</option>
                <option value="Expiring Soon">Expiring Soon (7 days)</option>
                <option value="Not Expired">Not Expired</option>
            </select>
        </div>
        <div>
            <label htmlFor="sort-by" className="block text-sm font-medium text-gray-700">Sort By</label>
            <select id="sort-by" value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2">
                <option value="name_asc">Name (A-Z)</option>
                <option value="name_desc">Name (Z-A)</option>
                <option value="expiry_asc">Expiry (Earliest First)</option>
                <option value="expiry_desc">Expiry (Latest First)</option>
            </select>
        </div>
        <div className="col-span-full flex justify-end">
            <button onClick={handleClearFilters} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg">Clear Filters</button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.length > 0 ? filteredProducts.map(product => {
          const activeBatches = (product.expiryDates || []).filter(batch => !batch.isRemoved);
          const removedBatches = (product.expiryDates || []).filter(batch => batch.isRemoved);
          return (
            <div key={product.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50 shadow-sm">
              <div className="flex items-center mb-3">
                {product.imageUrl && <img src={product.imageUrl} alt={product.name} className="w-20 h-20 object-cover rounded-md mr-4 border" onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/80x80/cccccc/000000?text=No+Image'; }} />}
                <h3 className="text-xl font-semibold text-gray-900">{product.name} <span className="text-gray-500 text-base">({product.barcode})</span></h3>
              </div>
              <p>Category: {product.category}</p>
              <p className="font-bold">Total Quantity: {product.quantity}</p>
              <h4 className="font-medium mt-2">Expiry Batches:</h4>
              <ul className="list-none p-0 m-0 space-y-1">
                {activeBatches.sort((a,b) => moment(a.date).diff(moment(b.date))).map((expiry, index) => (
                    <li key={index} className={`border-l-4 p-2 rounded-r-md ${getExpiryItemStyleClass(expiry.date, expiry.isRemoved)} flex justify-between items-center`}>
                        <span>Exp: {moment(expiry.date).format('DD/MM/YYYY')} (Qty: {expiry.quantity})</span>
                        <button onClick={() => handleMarkAsRemoved(product.id, product.expiryDates.indexOf(expiry))} className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold py-1 px-2 rounded">Remove</button>
                    </li>
                ))}
                {removedBatches.map((expiry, index) => (
                    <li key={`removed-${index}`} className={`border-l-4 p-2 rounded-r-md ${getExpiryItemStyleClass(expiry.date, expiry.isRemoved)}`}>
                        <span>Exp: {moment(expiry.date).format('DD/MM/YYYY')} (Qty: {expiry.quantity})</span>
                    </li>
                ))}
              </ul>
            </div>
          )
        }) : <p className="text-center col-span-full text-gray-500">No products match your filters.</p>}
      </div>
    </div>
  );
};

const MessageDisplay = ({ currentMessage, db }) => {
    const [newMessageText, setNewMessageText] = useState(currentMessage);
    const [postMessageError, setPostMessageError] = useState('');
    const [postMessageSuccess, setPostMessageSuccess] = useState('');

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
            const messageDocRef = doc(db, 'appSettings', 'messages');
            await setDoc(messageDocRef, { currentMessage: newMessageText.trim() }, { merge: true });
            setPostMessageSuccess('Message posted successfully!');
            setTimeout(() => setPostMessageSuccess(''), 3000);
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
                className="w-full min-h-[80px] p-3 rounded-lg border border-blue-300"
            />
            <button onClick={handlePostMessage} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">
                Post Message
            </button>
            {postMessageError && <p className="text-red-600 mt-2">{postMessageError}</p>}
            {postMessageSuccess && <p className="text-green-600 mt-2">{postMessageSuccess}</p>}
        </div>
    );
};

// --- RESTORED SignUpModal ---
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

      await setDoc(doc(db, `artifacts/${appId}/users/${user.uid}/user_details`, user.uid), {
        email: user.email,
        createdAt: new Date(),
      });

      onSignUpSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex justify-center items-center z-50 p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">Create Account</h2>
        {error && <MessageBox message={error} type="error" onClose={() => setError('')} />}
        <form onSubmit={handleSignUp} className="space-y-4">
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full p-3 border border-gray-300 rounded-lg"/>
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full p-3 border border-gray-300 rounded-lg"/>
          <input type="password" placeholder="Confirm Password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className="w-full p-3 border border-gray-300 rounded-lg"/>
          <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg">{loading ? 'Creating...' : 'Sign Up'}</button>
          <button type="button" onClick={onClose} className="w-full bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-3 px-4 rounded-lg mt-2">Cancel</button>
        </form>
      </div>
    </div>
  );
};


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
            await setDoc(doc(db, `artifacts/${appId}/users/${user.uid}/user_details`, user.uid), {
                email: user.email,
                mobileNumber: mobileNumber,
                employeeId: employeeId,
                createdAt: new Date(),
            });
            setCurrentPage('login');
        } catch (error) {
            setMessage(error.message);
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
                    <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700" />
                    <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700" />
                    <input type="tel" placeholder="Mobile Number" value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} required className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700" />
                    <input type="text" placeholder="Employee ID" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700" />
                    <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg">{loading ? 'Signing up...' : 'Sign Up'}</button>
                </form>
                <p className="text-center mt-6">Already have an account? <button onClick={() => setCurrentPage('login')} className="text-blue-600 hover:underline">Log In</button></p>
            </div>
        </div>
    );
};

const LoginPage = ({ setCurrentPage }) => {
    const { auth } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            setMessage(error.message);
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
                    <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700" />
                    <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700" />
                    <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg">{loading ? 'Logging in...' : 'Log In'}</button>
                </form>
                <p className="text-center mt-6">Don't have an account? <button onClick={() => setCurrentPage('signup')} className="text-blue-600 hover:underline">Sign Up</button></p>
            </div>
        </div>
    );
};

// --- Main Pages ---

const DashboardPage = ({ setCurrentPage }) => {
  const { user, userId, employeeId, auth, db, isAuthReady } = useAuth();
  const [userDetails, setUserDetails] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [appMessage, setAppMessage] = useState('');
  
  // States for Barcode Scanning and Add/Update Product Form
  const [isScanning, setIsScanning] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState('Chocolates');
  const [quantity, setQuantity] = useState('');
  const [expiryDate, setExpiryDate] = useState(moment ? moment().format('YYYY-MM-DD') : '');
  const [isExistingProduct, setIsExistingProduct] = useState(false);
  
  // New states for image upload
  const [productImageData, setProductImageData] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState('');
  
  // Camera selection states
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');

  const qrCodeReaderRef = useRef(null);
  const html5QrcodeScannerInstanceRef = useRef(null);

  const categories = useMemo(() => ['Chocolates', 'Alcohol', 'Wines', 'Cigarettes', 'Soft Drinks', 'Crisps', 'Other'], []);

  const getTodayDate = useCallback(() => {
    return moment ? moment().format('YYYY-MM-DD') : new Date().toISOString().split('T')[0];
  }, []);
  
  const ocrInputRef = useRef(null);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrOptions, setOcrOptions] = useState([]);
  const [ocrError, setOcrError] = useState('');

  useEffect(() => {
    if (!db) return;
    const checkBarcode = async () => {
      if (scannedBarcode) {
        setOcrOptions([]);
        const productDocRef = doc(db, 'products', scannedBarcode);
        const docSnap = await getDoc(productDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProductName(data.name || '');
          setCategory(data.category || categories[0]);
          const storedImage = data.imageUrl || null;
          setImagePreviewUrl(storedImage);
          setProductImageData(storedImage);
          setIsExistingProduct(true);
        } else {
          setProductName('');
          setCategory(categories[0]);
          setImagePreviewUrl(null);
          setProductImageData(null);
          setIsExistingProduct(false);
        }
      }
    };
    const debounce = setTimeout(() => checkBarcode(), 300);
    return () => clearTimeout(debounce);
  }, [scannedBarcode, db, categories]);

  useEffect(() => {
    if (!isAuthReady || !userId || !db) return;
    const fetchUserDetails = async () => {
      const userDocRef = doc(db, `artifacts/${appId}/users/${userId}/user_details`, userId);
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists()) {
        setUserDetails(docSnap.data());
      }
    };
    fetchUserDetails();

    const messageDocRef = doc(db, 'appSettings', 'messages');
    const unsubscribeMessage = onSnapshot(messageDocRef, (docSnap) => {
        setAppMessage(docSnap.exists() ? docSnap.data().currentMessage : "");
    });
    return () => unsubscribeMessage();
  }, [userId, db, isAuthReady]);

  // --- RESTORED Barcode Scanner Logic ---
   const stopScanner = useCallback(() => {
    if (html5QrcodeScannerInstanceRef.current) {
        html5QrcodeScannerInstanceRef.current.stop().catch(error => {
            console.error("Failed to stop scanner on manual stop:", error);
        });
        html5QrcodeScannerInstanceRef.current = null;
    }
    setIsScanning(false);
  }, []);
  
  useEffect(() => {
    if (isScanning && isAuthReady && selectedDeviceId) {
        if (!html5QrcodeScannerInstanceRef.current) {
            const scanner = new Html5Qrcode("qr-code-reader");
            html5QrcodeScannerInstanceRef.current = scanner;
        }
        
        const onScanSuccess = (decodedText, decodedResult) => {
            setScannedBarcode(decodedText);
            stopScanner();
        };
        
        html5QrcodeScannerInstanceRef.current.start(
            selectedDeviceId, 
            { fps: 10, qrbox: { width: 250, height: 250 } }, 
            onScanSuccess, 
            (errorMessage) => { /* handle error */ }
        ).catch(err => {
            setMessage({ type: 'error', text: 'Failed to start scanner. Check permissions.' });
            stopScanner();
        });
    }

    return () => {
        if (html5QrcodeScannerInstanceRef.current) {
            html5QrcodeScannerInstanceRef.current.stop().catch(error => {
                console.error("Failed to stop html5QrcodeScanner on cleanup:", error);
            });
        }
    };
  }, [isScanning, isAuthReady, selectedDeviceId, stopScanner]);

  useEffect(() => {
      if(Html5Qrcode) {
          Html5Qrcode.getCameras().then(devices => {
              if (devices && devices.length) {
                  setAvailableCameras(devices);
                  if(!selectedDeviceId) {
                    const backCamera = devices.find(d => d.label.toLowerCase().includes('back'));
                    setSelectedDeviceId(backCamera ? backCamera.id : devices[0].id);
                  }
              }
          }).catch(err => {
              console.error("Error getting cameras", err);
          });
      }
  }, []);

  const handleAddInventoryItem = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    setImageUploadError('');

    if (!scannedBarcode || !quantity || !expiryDate || (!isExistingProduct && !productName)) {
        setMessage({ type: 'error', text: 'Please fill all required fields.' });
        return;
    }
    setUploadingImage(true);
    let itemImageUrl = productImageData || imagePreviewUrl;
    setUploadingImage(false);

    const productDocRef = doc(db, 'products', scannedBarcode);
    try {
        const docSnap = await getDoc(productDocRef);
        if (docSnap.exists()) {
            const existingData = docSnap.data();
            const newExpiryBatch = { date: expiryDate, quantity: parseInt(quantity), addedBy: employeeId, isRemoved: false };
            await updateDoc(productDocRef, {
                expiryDates: [...(existingData.expiryDates || []), newExpiryBatch],
                quantity: (existingData.quantity || 0) + parseInt(quantity),
                lastUpdated: new Date().toISOString(),
                imageUrl: itemImageUrl || existingData.imageUrl,
            });
            setMessage({ type: 'success', text: `Stock added to "${existingData.name}".` });
        } else {
            const newProductData = {
                barcode: scannedBarcode,
                name: productName,
                category,
                quantity: parseInt(quantity),
                expiryDates: [{ date: expiryDate, quantity: parseInt(quantity), addedBy: employeeId, isRemoved: false }],
                createdAt: new Date().toISOString(),
                imageUrl: itemImageUrl,
            };
            await setDoc(productDocRef, newProductData);
            setMessage({ type: 'success', text: `New product "${productName}" added.` });
        }
        setScannedBarcode(''); setProductName(''); setCategory(categories[0]); setQuantity(''); setExpiryDate(getTodayDate()); setProductImageData(null); setImagePreviewUrl(null); setOcrOptions([]);
    } catch (error) {
        setMessage({ type: 'error', text: 'Failed to save product.' });
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setCurrentPage('login');
  };
  
  const handleOcrFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsOcrProcessing(true);
    setOcrError('');
    setOcrOptions([]);

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const { data } = await Tesseract.recognize(e.target.result, 'eng', { logger: m => console.log(m) });
            if (data && data.words && data.words.length > 0) {
                const topWords = data.words
                    .filter(w => w.confidence > 60 && /^[a-zA-Z0-9&]+$/.test(w.text))
                    .sort((a,b) => b.confidence - a.confidence)
                    .slice(0, 5)
                    .map(w => w.text);
                setOcrOptions(topWords);
            } else {
                 setOcrError("Could not find any clear text. Please try again or type manually.");
            }
        } catch (err) {
            setOcrError("An error occurred during text recognition.");
        } finally {
            setIsOcrProcessing(false);
            // Reset file input to allow re-selection of the same file
            event.target.value = null; 
        }
    };
    reader.readAsDataURL(file);
  };

  const isOwner = user && user.email === 'siddeshpawar622.sp@gmail.com';

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <nav className="bg-blue-700 p-4 shadow-md flex justify-between items-center">
        <h1 className="text-white text-2xl font-bold">Londis Dashboard</h1>
        <div>
            {user && <span className="text-white mr-4">Welcome, {employeeId || user.email}</span>}
            <button onClick={handleLogout} className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg">Logout</button>
        </div>
      </nav>
      <main className="container mx-auto p-6">
        <MessageBox message={message.text} type={message.type} onClose={() => setMessage({ type: '', text: '' })} />
        {ocrError && <MessageBox message={ocrError} type="error" onClose={() => setOcrError('')} />}
        {isOcrProcessing && <MessageBox message={"Reading text from image..."} type="info" />}
        {appMessage && <div className="bg-yellow-100 text-yellow-800 p-4 rounded-lg mb-4"><strong>Announcement:</strong> {appMessage}</div>}
        {isOwner && <MessageDisplay currentMessage={appMessage} db={db} />}
        
        <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
            <h3 className="text-2xl font-semibold">Barcode Scanner</h3>
            <button onClick={() => setIsScanning(!isScanning)} className="my-2 bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-lg">{isScanning ? 'Stop Scanner' : 'Start Scanner'}</button>
            <div id="qr-code-reader" ref={qrCodeReaderRef} style={{width: '100%', maxWidth: '500px', margin: 'auto'}}></div>
        </div>

        <AddProductForm
            scannedBarcode={scannedBarcode} setScannedBarcode={setScannedBarcode}
            productName={productName} setProductName={setProductName}
            category={category} setCategory={setCategory}
            quantity={quantity} setQuantity={setQuantity}
            expiryDate={expiryDate} setExpiryDate={setExpiryDate}
            isExistingProduct={isExistingProduct}
            handleAddInventoryItem={handleAddInventoryItem}
            categories={categories}
            productImageData={productImageData} setProductImageData={setProductImageData}
            imagePreviewUrl={imagePreviewUrl} setImagePreviewUrl={setImagePreviewUrl}
            uploadingImage={uploadingImage} imageUploadError={imageUploadError}
            ocrInputRef={ocrInputRef}
            handleOcrFileChange={handleOcrFileChange}
            onScanNameClick={() => ocrInputRef.current.click()}
            ocrOptions={ocrOptions} setOcrOptions={setOcrOptions}
            isExistingBarcode={isExistingProduct}
        />
        
        <ProductList db={db} userId={userId} employeeId={employeeId} />
      </main>
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
    return <div className="flex items-center justify-center min-h-screen"><p>Loading application...</p></div>;
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
