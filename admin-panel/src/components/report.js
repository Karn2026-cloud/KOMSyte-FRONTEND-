import React, { useEffect, useState, useMemo } from 'react';
import API from '../api'; // ✅ Use our central API service
import './Reports.css'; // ✅ Styles moved to a separate file

// --- Helper Component for Gating Features ---
const UpgradeNotice = ({ message }) => (
  <div className="upgrade-notice">
    <h3>Upgrade Required</h3>
    <p>{message}</p>
    {/* You can add a <Link> or button here to the subscription page */}
  </div>
);

export default function Reports({ user }) {
  // Get the user's plan from the prop
  const plan = user?.subscription?.plan || 'free';
  
  // Define plan features on the frontend to control UI
  const planFeatures = {
    free: { reports: 'none', downloadBill: false },
    '299': { reports: 'simple', downloadBill: true },
    '699': { reports: 'all', downloadBill: true },
    '1499': { reports: 'all', downloadBill: true },
  };
  
  const features = planFeatures[plan];

  const [bills, setBills] = useState([]);
  const [stockCount, setStockCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Fetch all necessary data in one go
  useEffect(() => {
    // Don't fetch data if the user's plan doesn't allow reports
    if (features.reports === 'none') {
      setLoading(false);
      return;
    }

    const fetchReportData = async () => {
      setLoading(true);
      setError('');
      try {
        // Fetch bills and stock concurrently for better performance
        const [billsResponse, stockResponse] = await Promise.all([
          API.get('/api/bills'),
          API.get('/api/stock'),
        ]);
        setBills(billsResponse.data || []);
        setStockCount(stockResponse.data?.length || 0);
      } catch (err) {
        console.error("Report fetch error:", err);
        setError(err.response?.data?.error || 'Failed to fetch report data');
      } finally {
        setLoading(false);
      }
    };

    fetchReportData();
  }, [features.reports]);

  // useMemo will recalculate derived data only when bills or dateFilter changes
  const { filteredBills, salesSummary, kpis } = useMemo(() => {
    const billsToProcess = dateFilter
      ? bills.filter(b => new Date(b.createdAt).toISOString().startsWith(dateFilter))
      : bills;

    // Calculate Sales Summary (Product-wise aggregation)
    const salesMap = {};
    billsToProcess.forEach(bill => {
      bill.items.forEach(item => {
        if (!salesMap[item.name]) {
          salesMap[item.name] = { product: item.name, quantity: 0, total: 0 };
        }
        salesMap[item.name].quantity += item.quantity;
        salesMap[item.name].total += item.subtotal;
      });
    });
    const salesData = Object.values(salesMap).sort((a, b) => b.total - a.total);

    // Calculate KPIs
    const totalRevenue = billsToProcess.reduce((sum, bill) => sum + bill.totalAmount, 0);
    const totalItemsSold = salesData.reduce((sum, item) => sum + item.quantity, 0);
    const topProduct = salesData.length > 0 ? salesData[0].product : 'N/A';
    
    const calculatedKpis = {
      totalRevenue,
      totalBills: billsToProcess.length,
      avgBillValue: billsToProcess.length > 0 ? totalRevenue / billsToProcess.length : 0,
      totalItemsSold,
      stockCount,
      topProduct,
    };

    return { filteredBills: billsToProcess, salesSummary: salesData, kpis: calculatedKpis };
  }, [bills, dateFilter, stockCount]);


  if (loading) return <p className="loading">Loading reports...</p>;
  if (error) return <p className="error">Error: {error}</p>;

  // --- Render different UI based on plan ---
  if (features.reports === 'none') {
    return <UpgradeNotice message="Access to reports is a premium feature. Please upgrade your plan to view sales and stock analytics." />;
  }

  return (
    <div className="reports-container">
      <h2>Reports Dashboard</h2>

      {/* --- KPI Section --- */}
      <div className="kpi-grid">
        <div className="kpi-card"><h4>Total Revenue</h4><p>₹{kpis.totalRevenue.toFixed(2)}</p></div>
        <div className="kpi-card"><h4>Total Bills</h4><p>{kpis.totalBills}</p></div>
        {features.reports === 'all' ? (
          <>
            <div className="kpi-card"><h4>Avg. Bill Value</h4><p>₹{kpis.avgBillValue.toFixed(2)}</p></div>
            <div className="kpi-card"><h4>Items Sold</h4><p>{kpis.totalItemsSold}</p></div>
            <div className="kpi-card"><h4>Products in Stock</h4><p>{kpis.stockCount}</p></div>
            <div className="kpi-card"><h4>Top Selling Product</h4><p>{kpis.topProduct}</p></div>
          </>
        ) : (
           <div className="kpi-card kpi-upgrade">
             <h4>More Insights</h4>
             <p>Upgrade to the Growth plan for more KPIs!</p>
           </div>
        )}
      </div>

      {/* --- Sales Report Table --- */}
      <div className="report-table-container">
        <div className="table-header">
          <h3>Product Sales Summary</h3>
          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
        </div>
        <table>
          <thead><tr><th>Product</th><th>Quantity Sold</th><th>Total Revenue (₹)</th></tr></thead>
          <tbody>
            {salesSummary.length > 0 ? salesSummary.map((item, idx) => (
              <tr key={idx}><td>{item.product}</td><td>{item.quantity}</td><td>₹{item.total.toFixed(2)}</td></tr>
            )) : <tr><td colSpan="3">No sales data for the selected period.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}