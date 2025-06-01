// frontend/src/AddProductForm.js
import React, { useState, useEffect } from 'react';
import { db, auth } from './firebaseConfig';
import { collection, doc, getDoc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';

function AddProductForm() {
  const [barcode, setBarcode] = useState('');
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState('Chocolates'); // Default category
  const [quantity, setQuantity] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [isExistingProduct, setIsExistingProduct] = useState(false); // New state to track if product exists
  const [originalQuantity, setOriginalQuantity] = useState(0); // Store original quantity for update logic

  const categories = ['Chocolates', 'Alcohol', 'Wines', 'Cigarettes', 'Soft Drinks', 'Crisps', 'Other'];

  // Effect to check barcode existence whenever it changes
  useEffect(() => {
    const checkBarcode = async () => {
      setMessage('');
      setError('');
      if (barcode.length > 0) { // Only check if barcode is not empty
        const productDocRef = doc(db, 'products', barcode);
        try {
          const docSnap = await getDoc(productDocRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setProductName(data.name);
            setCategory(data.category);
            setOriginalQuantity(data.quantity); // Store existing quantity
            setIsExistingProduct(true);
            setMessage(`Product "${data.name}" already exists. Add new stock/expiry date.`);
          } else {
            // New product
            setProductName('');
            setCategory('Chocolates'); // Reset category for new products
            setOriginalQuantity(0);
            setIsExistingProduct(false);
            setMessage('New product barcode. Please fill in details.');
          }
        } catch (err) {
          console.error("Error checking barcode:", err);
          setError(`Error checking barcode: ${err.message}`);
          // Reset fields in case of error
          setProductName('');
          setCategory('Chocolates');
          setOriginalQuantity(0);
          setIsExistingProduct(false);
        }
      } else {
        // Clear when barcode field is empty
        setProductName('');
        setCategory('Chocolates');
        setQuantity(''); // Clear quantity too
        setExpiryDate(''); // Clear expiry too
        setOriginalQuantity(0);
        setIsExistingProduct(false);
        setMessage('');
      }
    };

    const debounceTimeout = setTimeout(() => {
      checkBarcode();
    }, 500); // Debounce to prevent too many Firestore reads on rapid typing

    return () => clearTimeout(debounceTimeout); // Cleanup timeout on component unmount or barcode change
  }, [barcode]); // Dependency array: run this effect whenever 'barcode' changes

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (!barcode || !quantity || !expiryDate) {
      setError('Please fill in barcode, quantity, and expiry date.');
      return;
    }
    // For new products, name and category are also required
    if (!isExistingProduct && (!productName || !category)) {
        setError('For new products, please fill in Product Name and Category.');
        return;
    }

    if (auth.currentUser === null) {
      setError('You must be logged in to add products.');
      return;
    }

    const productsCollectionRef = collection(db, 'products');
    const productDocRef = doc(productsCollectionRef, barcode);

    try {
      const newExpiryBatch = {
        date: expiryDate,
        addedOn: new Date(), // Timestamp when this batch was added
        isRemoved: false,
        quantity: parseInt(quantity), // Store quantity FOR THIS BATCH
      };

      if (isExistingProduct) {
        // Product exists, append new expiry date and update total quantity
        await updateDoc(productDocRef, {
          quantity: originalQuantity + parseInt(quantity), // Add new quantity to existing total
          expiryDates: arrayUnion(newExpiryBatch),
          lastScanTimestamp: new Date(),
        });
        setMessage(`Product "${productName}" (Barcode: ${barcode}) updated with new expiry batch.`);
      } else {
        // New product, create new document
        await setDoc(productDocRef, {
          barcode: barcode,
          name: productName,
          category: category,
          quantity: parseInt(quantity), // Initial quantity is just this batch's quantity
          expiryDates: [newExpiryBatch],
          lastScanTimestamp: new Date(),
        });
        setMessage(`New product "${productName}" (Barcode: ${barcode}) added successfully.`);
      }

      // Clear form after successful submission, except for barcode if user wants to keep adding
      // setBarcode(''); // You might want to keep barcode if scanning multiple items
      setProductName('');
      setCategory('Chocolates');
      setQuantity('');
      setExpiryDate('');
      setIsExistingProduct(false); // Reset this state
      setOriginalQuantity(0); // Reset
      // To allow rapid barcode scanning, you might only clear everything but the barcode:
      // setQuantity('');
      // setExpiryDate('');
      // setProductName(''); // Will be re-filled by useEffect
      // setCategory('Chocolates'); // Will be re-filled by useEffect

    } catch (err) {
      console.error("Error adding/updating product:", err);
      setError(`Failed to add/update product: ${err.message}`);
    }
  };

  return (
    <div style={styles.container}>
      <h2>Add New Product / Add Stock</h2>
      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.formGroup}>
          <label htmlFor="barcode" style={styles.label}>Barcode:</label>
          <input
            type="text"
            id="barcode"
            value={barcode}
            onChange={(e) => {
                setBarcode(e.target.value);
                // Clear messages immediately when barcode changes
                setMessage('');
                setError('');
            }}
            style={styles.input}
            placeholder="Scan or enter barcode"
            required
          />
        </div>

        <div style={styles.formGroup}>
          <label htmlFor="productName" style={styles.label}>Product Name:</label>
          <input
            type="text"
            id="productName"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            style={styles.input}
            placeholder="e.g., Cadbury Dairy Milk"
            required={!isExistingProduct} // Required only for new products
            disabled={isExistingProduct} // Disable if product exists
          />
        </div>

        <div style={styles.formGroup}>
          <label htmlFor="category" style={styles.label}>Category:</label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={styles.select}
            required={!isExistingProduct} // Required only for new products
            disabled={isExistingProduct} // Disable if product exists
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
            style={styles.input}
            placeholder="e.g., 10"
            min="1"
            required
          />
        </div>

        <div style={styles.formGroup}>
          <label htmlFor="expiryDate" style={styles.label}>Expiry Date (YYYY-MM-DD):</label>
          <input
            type="date"
            id="expiryDate"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            style={styles.input}
            required
          />
        </div>

        <button type="submit" style={styles.button}>Add Product / Stock</button>

        {message && <p style={styles.message}>{message}</p>}
        {error && <p style={styles.error}>{error}</p>}
      </form>
    </div>
  );
}

// Basic Inline Styles (consider using CSS modules or a library like Tailwind CSS for real projects)
const styles = {
  container: {
    maxWidth: '500px',
    margin: '40px auto',
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
  buttonHover: { // For demonstration, actual hover handled by CSS
    backgroundColor: '#0056b3',
  },
  message: {
    marginTop: '15px',
    padding: '10px',
    backgroundColor: '#d4edda',
    color: '#155724',
    border: '1px solid #c3e6cb',
    borderRadius: '4px',
    textAlign: 'center',
  },
  error: {
    marginTop: '15px',
    padding: '10px',
    backgroundColor: '#f8d7da',
    color: '#721c24',
    border: '1px solid #f5c6cb',
    borderRadius: '4px',
    textAlign: 'center',
  },
};

export default AddProductForm;