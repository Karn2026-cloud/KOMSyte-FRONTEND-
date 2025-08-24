import React, { useEffect, useState, useCallback } from 'react';
import API from '../api'; // ✅ Use our central API service
import './Stock.css'; // ✅ Styles moved to a separate file

export default function StockList({ user }) {
  // Define plan features on the frontend to control UI
  const planFeatures = {
    free: { updateQuantity: false, lowStockAlert: false },
    '299': { updateQuantity: true, lowStockAlert: false },
    '699': { updateQuantity: true, lowStockAlert: true },
    '1499': { updateQuantity: true, lowStockAlert: true },
  };
  const features = planFeatures[user.subscription?.plan] || planFeatures.free;

  const [stockItems, setStockItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const LOW_STOCK_THRESHOLD = 10; // A common threshold

  const fetchStock = useCallback(async () => {
    setLoading(true);
    try {
      const response = await API.get('/api/stock');
      setStockItems(response.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch stock');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStock();
  }, [fetchStock]);

  useEffect(() => {
    const term = searchTerm.toLowerCase();
    if (!term) {
      setFilteredItems(stockItems);
    } else {
      setFilteredItems(
        stockItems.filter(
          (item) =>
            item.name.toLowerCase().includes(term) ||
            item.barcode.toLowerCase().includes(term)
        )
      );
    }
  }, [searchTerm, stockItems]);

  const handleDelete = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;

    try {
      await API.delete(`/api/stock/${productId}`);
      // Remove the item from the local state for an instant UI update
      setStockItems((prev) => prev.filter((item) => item._id !== productId));
    } catch (err) {
      alert(`Error: ${err.response?.data?.error || 'Failed to delete product'}`);
    }
  };

  const handleRestock = async (product) => {
    // ✅ Correctly check the feature based on the user's plan
    if (!features.updateQuantity) {
      alert('Updating stock quantity is a premium feature. Please upgrade your plan.');
      return;
    }

    const quantityToAdd = parseInt(prompt('Enter quantity to add:', '10'), 10);
    if (isNaN(quantityToAdd) || quantityToAdd <= 0) {
      alert('Please enter a valid, positive number.');
      return;
    }

    try {
      // ✅ Use the POST /api/stock endpoint for updating quantity
      const response = await API.post('/api/stock', {
        barcode: product.barcode,
        quantity: quantityToAdd,
        updateStock: true,
      });
      // Update the state with the returned product data
      setStockItems((prev) =>
        prev.map((item) =>
          item._id === product._id ? response.data.product : item
        )
      );
      alert('Stock updated successfully!');
    } catch (err) {
      alert(`Error: ${err.response?.data?.error || 'Failed to update stock'}`);
    }
  };
  
  const lowStockItems = filteredItems.filter(item => item.quantity > 0 && item.quantity <= LOW_STOCK_THRESHOLD);

  if (loading) return <p>Loading stock...</p>;
  if (error) return <p className="error-message">Error: {error}</p>;

  return (
    <div className="stock-list-container">
      <div className="stock-list-header">
        <input
          type="text"
          placeholder="🔍 Search by name or barcode..."
          className="search-bar"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <button className="refresh-btn" onClick={fetchStock}>
          🔄 Refresh
        </button>
      </div>

      {/* --- Low Stock Alerts (Premium Feature) --- */}
      {features.lowStockAlert && lowStockItems.length > 0 && (
        <div className="low-stock-alert">
          <h3>⚠️ Low Stock Alerts</h3>
          <ul>
            {lowStockItems.map((item) => (
              <li key={item._id}>
                <strong>{item.name}</strong> - Only {item.quantity} left in stock!
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Barcode</th>
              <th>Product Name</th>
              <th>Price</th>
              <th>Quantity</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => (
                <tr key={item._id} className={item.quantity === 0 ? 'out-of-stock' : item.quantity <= LOW_STOCK_THRESHOLD ? 'low-stock' : ''}>
                  <td>{item.barcode}</td>
                  <td>{item.name}</td>
                  <td>₹{item.price.toFixed(2)}</td>
                  <td>{item.quantity}</td>
                  <td>
                    <button className="action-btn restock-btn" onClick={() => handleRestock(item)}>Restock</button>
                    <button className="action-btn delete-btn" onClick={() => handleDelete(item._id)}>Delete</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="5">No products found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}