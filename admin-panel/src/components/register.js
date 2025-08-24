import React, { useState, useEffect, useRef, useCallback } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import API from '../api'; // ✅ Use our central API service
import './Register.css'; // ✅ Styles moved to a separate file

// --- Helper Component for Gating Features ---
const FeatureGuard = ({ isAllowed, children, message }) => {
  if (isAllowed) {
    return children;
  }
  return (
    <div className="feature-locked-notice">
      <p>🔒 {message}</p>
    </div>
  );
};


export default function RegisterProduct({ user }) {
  // Define plan features on the frontend to control UI
  const planFeatures = {
    free: { updateQuantity: false, maxProducts: 10, bulkUpload: false },
    '299': { updateQuantity: true, maxProducts: 50, bulkUpload: true },
    '699': { updateQuantity: true, maxProducts: 100, bulkUpload: true },
    '1499': { updateQuantity: true, maxProducts: Infinity, bulkUpload: true },
  };
  const features = planFeatures[user.subscription?.plan] || planFeatures.free;

  const [formData, setFormData] = useState({ barcode: "", name: "", price: "", quantity: "" });
  const [products, setProducts] = useState([]);
  const [message, setMessage] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [isUpdateMode, setIsUpdateMode] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const scannerRef = useRef(null);
  const fileInputRef = useRef(null);
  const nameInputRef = useRef(null);

  const fetchProducts = useCallback(async () => {
    try {
      // ✅ Correct endpoint and API service
      const response = await API.get("/api/stock"); 
      setProducts(response.data || []);
    } catch (err) {
      console.error("Fetch products failed:", err);
      setMessage(`Error: Failed to load product list.`);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    return () => { // Cleanup scanner on component unmount
      if (scannerRef.current) scannerRef.current.clear().catch(console.error);
    };
  }, [fetchProducts]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  const onScanSuccess = (decodedText) => {
    setFormData((prev) => ({ ...prev, barcode: decodedText.trim() }));
    setMessage(`✅ Barcode scanned: ${decodedText}`);
    if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
    }
    setIsScanning(false);
    nameInputRef.current?.focus();
  };

  const startScanner = () => {
    setIsScanning(true);
    const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
    scanner.render(onScanSuccess, (error) => console.warn(error));
    scannerRef.current = scanner;
  };

  const stopScanner = () => {
    if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
    }
    setIsScanning(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    // --- ✅ Feature Gating: Product Limit ---
    if (!isUpdateMode && products.length >= features.maxProducts) {
      setMessage(`Error: Your plan's limit of ${features.maxProducts} products has been reached. Please upgrade.`);
      return;
    }

    try {
      const response = await API.post("/api/products", {
        ...formData,
        updateStock: isUpdateMode,
      });
      setMessage(response.data.message);
      setFormData({ barcode: "", name: "", price: "", quantity: "" }); // Reset form
      fetchProducts(); // Refresh list
    } catch (err) {
      setMessage(`Error: ${err.response?.data?.error || "Failed to add product"}`);
    }
  };
  
  const handleExcelUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setMessage("Uploading and processing file...");
    
    // ✅ Create FormData to send the raw file
    const excelData = new FormData();
    excelData.append('file', file);

    try {
      // ✅ Make a single API call to the dedicated bulk upload endpoint
      const response = await API.post('/api/stock/upload', excelData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setMessage(response.data.message || "Bulk upload completed!");
      fetchProducts(); // Refresh list
    } catch (err) {
      setMessage(`Error: ${err.response?.data?.error || 'File upload failed'}`);
    } finally {
      setIsUploading(false);
      if(fileInputRef.current) fileInputRef.current.value = ""; // Reset file input
    }
  };

  return (
    <div className="register-product-container">
      <h2>{isUpdateMode ? "Update Product Stock" : "Register New Product"}</h2>

      <FeatureGuard
        isAllowed={features.updateQuantity}
        message="The ability to update existing stock is a premium feature."
      >
        <div className="toggle-mode">
          <label>
            <input type="checkbox" checked={isUpdateMode} onChange={(e) => setIsUpdateMode(e.target.checked)} />
            Update Stock Only
          </label>
        </div>
      </FeatureGuard>
      
      <div className="content-wrapper">
        <div className="form-section">
          <form onSubmit={handleSubmit}>
            <input name="barcode" placeholder="Barcode" value={formData.barcode} onChange={handleChange} required />
            {!isUpdateMode && (
              <>
                <input name="name" placeholder="Product Name" value={formData.name} onChange={handleChange} ref={nameInputRef} required={!isUpdateMode}/>
                <input name="price" placeholder="Price (₹)" type="number" value={formData.price} onChange={handleChange} required={!isUpdateMode} />
              </>
            )}
            <input name="quantity" placeholder="Quantity to Add" type="number" value={formData.quantity} onChange={handleChange} required />
            <button type="submit" disabled={isUploading || isScanning}>
              {isUpdateMode ? "Update Stock" : "Add Product"}
            </button>
          </form>

          <hr/>

          <h4>Tools</h4>
          <div className="tools-section">
             <button onClick={isScanning ? stopScanner : startScanner} disabled={isUploading} className={isScanning ? 'stop-scan' : ''}>
              {isScanning ? "🛑 Stop Scanner" : "📷 Scan Barcode"}
            </button>
            <div id="reader" style={{ display: isScanning ? 'block' : 'none' }}></div>
          </div>
          
          <FeatureGuard
            isAllowed={features.bulkUpload}
            message="Bulk product registration via Excel is a premium feature."
          >
            <div className="excel-upload">
              <label htmlFor="excelFile">{isUpdateMode ? "Update Stock via Excel" : "Add Products via Excel"}:</label>
              <input id="excelFile" type="file" accept=".xlsx, .xls" onChange={handleExcelUpload} disabled={isUploading || isScanning} ref={fileInputRef}/>
            </div>
          </FeatureGuard>
          
          {message && <p className={`message ${message.includes("Error") ? 'error' : 'success'}`}>{message}</p>}
        </div>
      </div>
    </div>
  );
}