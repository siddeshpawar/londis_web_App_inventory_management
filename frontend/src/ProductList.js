    import React, { useState, useEffect } from 'react';
    // Import Firebase modules directly
    import { collection, query, onSnapshot, doc, updateDoc, getFirestore } from 'firebase/firestore';
    import { initializeApp } from 'firebase/app';

    // Access moment directly from window as it is loaded via CDN
    const moment = typeof window !== 'undefined' ? window.moment : null;

    // --- Firebase Initialization (Using your provided config) ---
    // IMPORTANT: Ensure these values match your actual Firebase project configuration.
    // This is duplicated from App.js but necessary for ProductList to be self-contained
    // and directly interact with Firestore.
    const firebaseConfig = {
        apiKey: "AIzaSyCVwde47xofIaRyJQr5QjeDgKCinQ7s8_U",
        authDomain: "londisinventoryapp.firebaseapp.com",
        projectId: "londisinventoryapp",
        storageBucket: "londisinventoryapp.firebasestorage.app",
        messagingSenderId: "990186016538",
        appId: "1:990186016538:web:e69f834cb120e62e5966a3"
    };

    let firebaseAppInstance;
    let dbInstance;

    // Initialize Firebase only once for this component
    if (!firebaseAppInstance) {
      try {
        firebaseAppInstance = initializeApp(firebaseConfig);
        dbInstance = getFirestore(firebaseAppInstance);
        console.log("ProductList: Firebase initialized successfully.");
      } catch (error) {
        console.error("ProductList: Firebase initialization error:", error);
      }
    }

    // --- Global Variables (Provided by Canvas Environment) ---
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';


    function ProductList() {
      const [products, setProducts] = useState([]);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState('');
      const [updateMessage, setUpdateMessage] = useState('');

      useEffect(() => {
        if (!dbInstance) {
            setLoading(false);
            setError("Database not initialized. Cannot load products.");
            return;
        }

        const productsCollectionRef = collection(dbInstance, `artifacts/${appId}/public/data/inventory_items`);
        const q = query(productsCollectionRef); // No orderBy() for simplicity

        const unsubscribe = onSnapshot(q, (snapshot) => {
          const productsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          const sortedProducts = productsData.map(product => ({
            ...product,
            expiryDates: product.expiryDates ? product.expiryDates.sort((a, b) => {
                // Ensure moment is loaded before using it for sorting dates
                if (moment) {
                    return moment(a.date).diff(moment(b.date));
                }
                return 0; // Fallback if moment is not available
            }) : []
          })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

          setProducts(sortedProducts);
          setLoading(false);
        }, (err) => {
          console.error("Error fetching products:", err);
          setError("Failed to load products. Please try again.");
          setLoading(false);
        });

        return () => unsubscribe();
      }, [dbInstance, appId]); // Added appId to dependencies


      const handleMarkAsRemoved = async (productId, batchIndex) => {
        setUpdateMessage('');
        if (!dbInstance) {
          setError('Database not initialized. Cannot update product.');
          return;
        }
        try {
          const productDocRef = doc(dbInstance, `artifacts/${appId}/public/data/inventory_items`, productId);
          const productToUpdate = products.find(p => p.id === productId);

          if (!productToUpdate) {
            setError('Product not found for update.');
            return;
          }

          const updatedExpiryDates = productToUpdate.expiryDates.map((batch, idx) => {
            if (idx === batchIndex) {
              return { ...batch, isRemoved: true };
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
          setUpdateMessage(`Product "${productToUpdate.name}" batch marked as removed. Total stock updated.`);
        } catch (err) {
          console.error("Error marking product as removed:", err);
          setError(`Failed to mark product as removed: ${err.message}`);
        }
      };

      const getExpiryStatusClass = (expiryDate, isRemoved) => {
        if (isRemoved) return 'line-through text-gray-500 bg-gray-50 border-gray-200';

        if (!moment) return '';

        const today = moment().startOf('day');
        const itemExpiry = moment(expiryDate).startOf('day');
        const daysLeft = itemExpiry.diff(today, 'days');

        if (daysLeft < 0) return 'bg-red-200 border-red-400';
        if (daysLeft <= 7) return 'bg-orange-100 border-orange-300';
        return 'bg-green-50 border-green-200';
      };


      if (loading) {
        return (
            <div className="bg-white p-6 rounded-lg shadow-lg">
                <p className="text-gray-600 text-lg">Loading inventory...</p>
            </div>
        );
      }

      if (error) {
        return (
            <div className="bg-red-100 text-red-800 p-4 rounded-lg shadow-md border border-red-200">
                <p>{error}</p>
            </div>
        );
      }

      return (
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h3 className="text-2xl font-semibold text-gray-800 mb-4">Current Inventory Overview</h3>
          {updateMessage && (
              <div className="bg-green-100 text-green-800 p-3 rounded-lg mb-4">
                  {updateMessage}
              </div>
          )}
          {products.length === 0 ? (
            <p className="text-gray-600">No products in inventory. Add some using the "Add/Update Inventory Item" section.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white rounded-lg overflow-hidden">
                <thead className="bg-gray-200">
                  <tr>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-700">Barcode</th>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-700">Item Name</th>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-700">Category</th>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-700">Total Quantity</th>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-700">Expiry Batches</th>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-700">Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="py-2 px-4 text-sm text-gray-800 break-all">{product.id}</td>
                      <td className="py-2 px-4 text-sm text-gray-800">{product.name || 'N/A'}</td>
                      <td className="py-2 px-4 text-sm text-gray-800">{product.category || 'N/A'}</td>
                      <td className="py-2 px-4 text-sm text-gray-800">{product.quantity || 0}</td>
                      <td className="py-2 px-4 text-sm text-gray-800">
                          {product.expiryDates && product.expiryDates.length > 0 ? (
                              <ul className="list-disc list-inside text-xs">
                                  {product.expiryDates
                                      .map((batch, idx) => ( // Don't filter out removed batches for display
                                      <li key={idx} className={`mb-1 p-1 rounded-md ${getExpiryStatusClass(batch.date, batch.isRemoved)} flex justify-between items-center`}>
                                          <span>
                                              Expiry: {moment ? moment(batch.date).format('YYYY-MM-DD') : batch.date} (Qty: {batch.quantity})
                                          </span>
                                          {!batch.isRemoved && ( // Show remove button only if not removed
                                              <button
                                                  onClick={() => handleMarkAsRemoved(product.id, idx)}
                                                  className="bg-red-500 hover:bg-red-600 text-white text-xs px-2 py-1 rounded transition-colors"
                                              >
                                                  Remove
                                              </button>
                                          )}
                                      </li>
                                  ))}
                              </ul>
                          ) : 'N/A'}
                      </td>
                      <td className="py-2 px-4 text-sm text-gray-800">
                        {product.lastUpdated ? (moment ? moment(product.lastUpdated.toDate()).toLocaleString() : product.lastUpdated.toDate().toLocaleString()) : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-sm text-gray-500 mt-4">
            To test inventory, manually add documents to your Firestore collection: <br />
            `artifacts/{appId}/public/data/inventory_items` <br />
            Example document fields: `name` (string), `quantity` (number), `updatedAt` (timestamp), `category` (string), `expiryDates` (array of objects with `date`, `quantity`, `addedAt`, `isRemoved` fields).
          </p>
        </div>
      );
    }

    export default ProductList;
    