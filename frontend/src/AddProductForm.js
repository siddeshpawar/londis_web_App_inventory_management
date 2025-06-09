    import React from 'react';

    // This component now receives all necessary states and handlers as props
    function AddProductForm({
      scannedBarcode,
      setScannedBarcode, // Allows updating barcode if needed by parent
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
      categories // Pass categories down
    }) {

      const handleSubmit = (e) => {
        e.preventDefault();
        handleAddInventoryItem(); // Call the handler from parent (DashboardPage)
      };

      return (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Barcode Input is handled by parent. This component uses the passed scannedBarcode value */}
          {/* We remove the direct barcode input here to avoid redundancy with the main scanner input in DashboardPage */}

          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="productName">
              Product Name
            </label>
            <input
              type="text"
              id="productName"
              className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Milk Carton"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              required={!isExistingProduct} // Required only for new products
              disabled={isExistingProduct && scannedBarcode} // Disable if existing product and barcode is set
            />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="category">
              Category
            </label>
            <select
              id="category"
              className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required={!isExistingProduct} // Required only for new products
              disabled={isExistingProduct && scannedBarcode} // Disable if existing product and barcode is set
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="quantity">
              Quantity (for this batch)
            </label>
            <input
              type="number"
              id="quantity"
              className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., 50"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min="1"
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="expiryDate">
              Expiry Date
            </label>
            <input
              type="date"
              id="expiryDate"
              className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 transition duration-300 ease-in-out"
            disabled={!scannedBarcode || !quantity || !expiryDate || (!isExistingProduct && (!productName || !category))}
          >
            {isExistingProduct ? 'Add New Stock Batch' : 'Add New Product'}
          </button>
        </form>
      );
    }

    export default AddProductForm;
    