// frontend/src/ProductList.js
import React, { useState, useEffect } from 'react';
import { db } from './firebaseConfig';
import { collection, query, onSnapshot, orderBy, doc, updateDoc } from 'firebase/firestore';

function ProductList() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updateMessage, setUpdateMessage] = useState('');

  useEffect(() => {
    const productsCollectionRef = collection(db, 'products');
    const q = query(productsCollectionRef, orderBy('name', 'asc'));

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
  }, []);

  const handleMarkAsRemoved = async (productId, batchIndex) => {
    setUpdateMessage('');
    try {
      const productDocRef = doc(db, 'products', productId);
      const productToUpdate = products.find(p => p.id === productId);

      if (!productToUpdate) {
        setError('Product not found for update.');
        return;
      }

      // Create a deep copy of the expiryDates array to avoid direct mutation
      const updatedExpiryDates = productToUpdate.expiryDates.map((batch, idx) => {
        if (idx === batchIndex) {
          return { ...batch, isRemoved: true }; // Mark this specific batch as removed
        }
        return batch; // Return other batches as they are
      });

      // Calculate the new total quantity by summing quantities of only the UNREMOVED batches
      const newTotalQuantity = updatedExpiryDates
        .filter(batch => !batch.isRemoved)
        .reduce((sum, batch) => sum + (batch.quantity || 0), 0); // Sum their quantities

      await updateDoc(productDocRef, {
        expiryDates: updatedExpiryDates,
        quantity: newTotalQuantity // Update the main product quantity field
      });
      setUpdateMessage(`Product "${productToUpdate.name}" batch marked as removed. Total stock updated.`);
    } catch (err) {
      console.error("Error marking product as removed:", err);
      setError(`Failed to mark product as removed: ${err.message}`);
    }
  };

  if (loading) {
    return <div style={styles.container}><p>Loading inventory...</p></div>;
  }

  if (error) {
    return <div style={styles.container}><p style={styles.error}>{error}</p></div>;
  }

  return (
    <div style={styles.container}>
      <h2>Current Inventory</h2>
      {updateMessage && <p style={styles.successMessage}>{updateMessage}</p>}
      {products.length === 0 ? (
        <p>No products found. Add some using the form above!</p>
      ) : (
        <div style={styles.productList}>
          {products.map((product) => (
            <div key={product.id} style={styles.productCard}>
              <h3>{product.name} ({product.id})</h3>
              <p><strong>Category:</strong> {product.category}</p>
              <p>
                <strong>Total Stock:</strong>{' '}
                {product.expiryDates
                  ? product.expiryDates
                      .filter(batch => !batch.isRemoved)
                      .reduce((sum, batch) => sum + (batch.quantity || 0), 0)
                  : 0}
              </p>
              <h4>Expiry Batches:</h4>
              {product.expiryDates && product.expiryDates.length > 0 ? (
                <ul style={styles.expiryList}>
                  {product.expiryDates
                    .filter(batch => !batch.isRemoved)
                    .sort((a, b) => new Date(a.date) - new Date(b.date))
                    .map((batch, index) => (
                      <li key={index} style={styles.expiryItem}>
                        <span>
                          Expiry: <span style={styles.expiryDate}>{batch.date}</span> (Added: {new Date(batch.addedOn.toDate()).toLocaleDateString()}) - Quantity: {batch.quantity}
                        </span>
                        <button
                          onClick={() => handleMarkAsRemoved(product.id, index)}
                          style={styles.removeButton}
                        >
                          Mark Removed
                        </button>
                      </li>
                    ))}
                  {product.expiryDates.some(batch => batch.isRemoved) && (
                    <p style={styles.removedBatchesNote}>
                      (Some expired/removed batches are hidden. They remain in the system.)
                    </p>
                  )}
                  {product.expiryDates.every(batch => batch.isRemoved) && (
                     <p style={styles.allRemovedNote}>
                        All batches for this product have been marked as removed.
                     </p>
                  )}
                </ul>
              ) : (
                <p>No expiry batches recorded for this product.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Basic Inline Styles
const styles = {
  container: {
    maxWidth: '900px',
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
  productList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '20px',
  },
  productCard: {
    border: '1px solid #eee',
    borderRadius: '8px',
    padding: '15px',
    backgroundColor: '#f9f9f9',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
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
  error: {
    color: '#dc3545',
    textAlign: 'center',
  },
  successMessage: {
    marginTop: '15px',
    padding: '10px',
    backgroundColor: '#d4edda',
    color: '#155724',
    border: '1px solid #c3e6cb',
    borderRadius: '4px',
    textAlign: 'center',
  },
  removedBatchesNote: {
    marginTop: '10px',
    fontStyle: 'italic',
    color: '#888',
    fontSize: '0.8em',
    textAlign: 'center',
  },
  allRemovedNote: {
      marginTop: '10px',
      fontStyle: 'italic',
      color: '#dc3545',
      fontSize: '0.9em',
      fontWeight: 'bold',
      textAlign: 'center',
  }
};

export default ProductList;