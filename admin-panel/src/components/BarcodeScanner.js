import React, { useEffect, useState } from 'react';

export default function Billing({ scannedBarcode }) {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [quantityInput, setQuantityInput] = useState(1);
  // ... other state and logic

  // Update barcode input when scannedBarcode changes
  useEffect(() => {
    if (scannedBarcode) {
      setBarcodeInput(scannedBarcode);
    }
  }, [scannedBarcode]);

  // ... rest of your billing logic (fetch products, add to bill, etc.)

  return (
    <div>
      {/* Input for barcode */}
      <input
        type="text"
        placeholder="Scan or enter barcode"
        value={barcodeInput}
        onChange={e => setBarcodeInput(e.target.value)}
      />
      {/* Quantity and Add button */}
      {/* ... */}
    </div>
  );
}
