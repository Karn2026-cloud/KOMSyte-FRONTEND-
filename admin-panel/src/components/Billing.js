import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import API from '../api';
import './Billing.css'; // Make sure to create and use this new CSS file

export default function Billing({ user }) {
  // Define plan features on the frontend to control UI
  const planFeatures = {
    free:   { downloadBill: false, manualAdd: false, whatsappShare: false },
    '299':  { downloadBill: true,  manualAdd: false, whatsappShare: false },
    '699':  { downloadBill: true,  manualAdd: true,  whatsappShare: true },
    '1499': { downloadBill: true,  manualAdd: true,  whatsappShare: true },
  };
  const features = planFeatures[user.subscription?.plan] || planFeatures.free;

  const [products, setProducts] = useState([]);
  const [billItems, setBillItems] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [quantityInput, setQuantityInput] = useState(1);
  const [unitInput, setUnitInput] = useState('qty'); // ✅ New state for unit selection
  const [customerMobile, setCustomerMobile] = useState('');
  const [message, setMessage] = useState({ text: '', type: 'info' });
  const [isScanning, setIsScanning] = useState(false);
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualProduct, setManualProduct] = useState({ name: '', price: '', quantity: 1, unit: 'qty' });

  const scannerRef = useRef(null);
  const productMap = useMemo(() => new Map(products.map(p => [p.barcode, p])), [products]);

  const fetchStock = useCallback(async () => {
    try {
      const response = await API.get('/api/stock');
      setProducts(response.data || []);
    } catch (err) {
      console.error('Stock fetch error:', err);
      setMessage({ text: 'Error: Could not load product stock.', type: 'error' });
    }
  }, []);

  useEffect(() => {
    fetchStock();
    return () => {
      if (scannerRef.current) scannerRef.current.clear().catch(console.error);
    };
  }, [fetchStock]);

  const onScanSuccess = (decodedText) => {
    setBarcodeInput(decodedText.trim());
    addItemToBill(decodedText.trim(), 1, 'qty');
  };

  const startScanner = () => {
    setIsScanning(true);
    const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
    scanner.render(onScanSuccess, (error) => console.warn(error));
    scannerRef.current = scanner;
  };

  const stopScanner = () => {
    if (scannerRef.current) scannerRef.current.clear().catch(console.error);
    setIsScanning(false);
  };

  // ✅ Updated to handle unit and discount
  const calculateSubtotal = (item) => {
    return (item.price * item.quantity) - (item.discount || 0);
  };
  
  const addItemToBill = (barcode, quantity, unit) => {
    const product = productMap.get(barcode);
    if (!product) return setMessage({ text: 'Product not found.', type: 'error' });
    if (quantity <= 0 || quantity > product.quantity) return setMessage({ text: 'Invalid or insufficient quantity.', type: 'error' });

    setBillItems(prevItems => {
      const existingItemIndex = prevItems.findIndex(item => item.barcode === barcode && item.unit === unit);
      if (existingItemIndex > -1) {
        const updatedItems = [...prevItems];
        const existingItem = updatedItems[existingItemIndex];
        existingItem.quantity += quantity;
        existingItem.subtotal = calculateSubtotal(existingItem);
        return updatedItems;
      }
      const newItem = {
        ...product,
        quantity,
        unit,
        discount: 0, // Default discount is 0
        subtotal: product.price * quantity,
      };
      return [...prevItems, newItem];
    });

    setBarcodeInput('');
    setQuantityInput(1);
    setMessage({ text: `Added ${product.name}`, type: 'success' });
  };
  
  const addManualItemToBill = () => {
    if (!manualProduct.name || !manualProduct.price || !manualProduct.quantity) {
      return setMessage({ text: 'Please fill all fields for the manual product.', type: 'error' });
    }
    const newItem = {
      // ✅ FIX: Changed barcode from `manual_${Date.now()}` to an empty string ''
      // This tells the backend to treat it as a new, non-stock item.
      barcode: '',
      name: manualProduct.name,
      price: Number(manualProduct.price),
      quantity: Number(manualProduct.quantity),
      unit: manualProduct.unit,
      discount: 0,
      subtotal: Number(manualProduct.price) * Number(manualProduct.quantity),
    };
    setBillItems(prev => [...prev, newItem]);
    setManualProduct({ name: '', price: '', quantity: 1, unit: 'qty' });
    setIsManualMode(false);
    setMessage({ text: `Added manual item: ${newItem.name}`, type: 'success' });
  };
  
  // ✅ New function to handle discount changes
  const handleDiscountChange = (index, discountValue) => {
    const discount = Number(discountValue) || 0;
    setBillItems(prevItems => {
        const updatedItems = [...prevItems];
        const item = updatedItems[index];
        item.discount = discount;
        item.subtotal = calculateSubtotal(item);
        return updatedItems;
    });
  };

  const removeItem = (index) => {
    setBillItems(prev => prev.filter((_, i) => i !== index));
  };

  const totalAmount = useMemo(() => billItems.reduce((sum, item) => sum + item.subtotal, 0), [billItems]);

  // ✅ Updated to include new fields in the PDF
  const generateAndDownloadPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(user.shopName || "Your Store", 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Date: ${new Date().toLocaleString()}`, 14, 30);
    doc.text(`Customer: ${customerMobile || 'N/A'}`, 14, 35);

    autoTable(doc, {
      startY: 40,
      head: [['Product', 'Price', 'Qty', 'Unit', 'Discount (Rs)', 'Subtotal']],
      body: billItems.map(item => [
        item.name,
        `Rs. ${item.price.toFixed(2)}`,
        item.quantity,
        item.unit,
        `Rs. ${item.discount.toFixed(2)}`,
        `Rs. ${item.subtotal.toFixed(2)}`
      ]),
      foot: [['Total', '', '', '', '', `Rs. ${totalAmount.toFixed(2)}`]],
      theme: 'striped',
      headStyles: { fillColor: [41, 128, 185] },
    });

    doc.save(`Receipt-${Date.now()}.pdf`);
  };

  const finalizeBill = async () => {
    if (billItems.length === 0) return setMessage({ text: 'Cannot finalize an empty bill.', type: 'error' });
    try {
      await API.post('/api/bills', { items: billItems, customerMobile });
      setMessage({ text: 'Bill finalized and saved successfully!', type: 'success' });
      if (features.downloadBill) generateAndDownloadPDF();
      setBillItems([]);
      setCustomerMobile('');
      stopScanner();
    } catch (err) {
      console.error('Finalize bill error:', err);
      setMessage({ text: `Error: ${err.response?.data?.error || 'Failed to finalize bill'}`, type: 'error' });
    }
  };

  return (
    <div className="billing-container">
      <div className="billing-main">
        {/* ✅ Updated input section with Unit selector */}
        <div className="input-section">
          <input className="barcode-input" placeholder="Enter or Scan Barcode" value={barcodeInput} onChange={e => setBarcodeInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && addItemToBill(barcodeInput, quantityInput, unitInput)} />
          <input className="quantity-input" type="number" value={quantityInput} onChange={e => setQuantityInput(Number(e.target.value))} min="0.01" step="0.01" />
          <select className="unit-selector" value={unitInput} onChange={e => setUnitInput(e.target.value)}>
            <option value="qty">qty</option>
            <option value="kg">kg</option>
            <option value="litre">litre</option>
          </select>
          <button className="add-item-btn" onClick={() => addItemToBill(barcodeInput, quantityInput, unitInput)}>Add Item</button>
        </div>
        
        <div className="tools-section">
          <button className={`tool-btn ${isScanning ? 'stop' : 'scan'}`} onClick={isScanning ? stopScanner : startScanner}>{isScanning ? '🛑 Stop' : '📷 Scan'}</button>
          {features.manualAdd && (
            <button className="tool-btn manual" onClick={() => setIsManualMode(!isManualMode)}>{isManualMode ? 'Cancel' : '✍️ Manual'}</button>
          )}
        </div>
        
        <div id="reader" style={{ display: isScanning ? 'block' : 'none' }}></div>
        
        {isManualMode && (
          <div className="manual-add-section">
            <input placeholder="Product Name" value={manualProduct.name} onChange={e => setManualProduct({...manualProduct, name: e.target.value})} />
            <input placeholder="Price (Rs.)" type="number" value={manualProduct.price} onChange={e => setManualProduct({...manualProduct, price: e.target.value})} />
            <input placeholder="Quantity" type="number" min="1" value={manualProduct.quantity} onChange={e => setManualProduct({...manualProduct, quantity: e.target.value})} />
            <select value={manualProduct.unit} onChange={e => setManualProduct({...manualProduct, unit: e.target.value})}>
                <option value="qty">qty</option>
                <option value="kg">kg</option>
                <option value="litre">litre</option>
            </select>
            <button onClick={addManualItemToBill}>Add Manual Item</button>
          </div>
        )}
      </div>

      <div className="billing-sidebar">
        <h3>Current Bill</h3>
        <div className="bill-items-list">
          {billItems.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty/Unit</th>
                  <th>Discount (Rs.)</th>
                  <th>Subtotal</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {billItems.map((item, index) => (
                  <tr key={index}>
                    <td>{item.name}<br/><small>@ Rs. {item.price.toFixed(2)}</small></td>
                    <td>{item.quantity} <span className="unit-text">{item.unit}</span></td>
                    <td>
                      {/* ✅ Discount input for each item */}
                      <input 
                        type="number" 
                        className="discount-input" 
                        placeholder="0.00"
                        value={item.discount || ''}
                        onChange={(e) => handleDiscountChange(index, e.target.value)}
                      />
                    </td>
                    <td>Rs. {item.subtotal.toFixed(2)}</td>
                    <td><button className="remove-item-btn" onClick={() => removeItem(index)}>×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="empty-bill-text">Scan or add items to begin</p>}
        </div>

        <div className="bill-summary">
          {features.whatsappShare && (
            <input className="customer-mobile-input" placeholder="Customer Mobile (for sharing)" value={customerMobile} onChange={e => setCustomerMobile(e.target.value)} />
          )}
          <div className="total-amount">Total: <span>Rs. {totalAmount.toFixed(2)}</span></div>
          <button className="finalize-btn" onClick={finalizeBill} disabled={billItems.length === 0}>
            {features.downloadBill ? 'Finalize & Download' : 'Finalize Bill'}
          </button>
          {message.text && <p className={`message ${message.type}`}>{message.text}</p>}
        </div>
      </div>
    </div>
  );
}