import React, { useState, useEffect, useCallback } from "react";
import API from '../api'; // ✅ Use our central API service
import './Subscription.css'; // ✅ Styles moved to a separate file

export default function Subscription({ user, onSubscriptionUpdate }) {
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(user.subscription?.plan || '');
  const [message, setMessage] = useState({ text: '', type: 'info' });
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);

  // Load Razorpay script
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  // ✅ Fetch plans dynamically from the backend
  const fetchPlans = useCallback(async () => {
    try {
      const response = await API.get('/api/plans');
      setPlans(response.data.plans || []);
    } catch (err) {
      setMessage({ text: 'Error: Could not load subscription plans.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const handleSubscribe = async (e) => {
    e.preventDefault();
    setSubscribing(true);
    setMessage({ text: '', type: 'info' });

    try {
      // ✅ Use central API service to create order
      const response = await API.post('/api/subscribe', { plan: selectedPlan });

      // Handle free plan activation
      if (selectedPlan === 'free') {
        setMessage({ text: 'Success! You are now on the Free plan.', type: 'success' });
        if (onSubscriptionUpdate) onSubscriptionUpdate(); // ✅ Notify parent component
        return;
      }

      // Handle paid plans with Razorpay
      const { key_id, order_id } = response.data;
      const options = {
        key: key_id,
        order_id: order_id,
        name: "KOMSYTE Subscription",
        description: `Payment for ${plans.find(p => p.id === selectedPlan)?.name} Plan`,
        handler: async function (paymentResponse) {
          try {
            // ✅ Use central API service to confirm payment
            await API.post('/api/subscribe/confirm', {
              razorpay_order_id: paymentResponse.razorpay_order_id,
              razorpay_payment_id: paymentResponse.razorpay_payment_id,
              razorpay_signature: paymentResponse.razorpay_signature,
            });
            setMessage({ text: `Payment successful! Your subscription is now active.`, type: 'success' });
            if (onSubscriptionUpdate) onSubscriptionUpdate(); // ✅ Notify parent component
          } catch (err) {
            setMessage({ text: `Payment verification failed: ${err.response?.data?.error || 'Unknown error'}`, type: 'error' });
          }
        },
        modal: {
          ondismiss: () => setMessage({ text: 'Payment was cancelled.', type: 'info' }),
        },
        theme: { color: "#007bff" },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();

    } catch (err) {
      setMessage({ text: `Error: ${err.response?.data?.error || 'Subscription failed'}`, type: 'error' });
    } finally {
      setSubscribing(false);
    }
  };

  if (loading) return <p>Loading subscription plans...</p>;

  return (
    <div className="subscription-container">
      <h2>Manage Your Subscription</h2>
      <p className="current-plan-info">
        You are currently on the <strong>{user.subscription?.plan || 'Free'}</strong> plan.
      </p>
      <form onSubmit={handleSubscribe}>
        <div className="plans-grid">
          {/* ✅ Dynamically render plans from API */}
          {plans.map(plan => (
            <label key={plan.id} className={`plan-card ${selectedPlan === plan.id ? 'selected' : ''}`}>
              <input
                type="radio"
                name="plan"
                value={plan.id}
                checked={selectedPlan === plan.id}
                onChange={(e) => setSelectedPlan(e.target.value)}
                disabled={subscribing || user.subscription?.plan === plan.id}
              />
              <div className="plan-details">
                <span className="plan-name">{plan.name} Plan</span>
                <span className="plan-price">₹{plan.price} / month</span>
                <ul className="plan-features">
                  <li>{plan.maxProducts === Infinity ? 'Unlimited Products' : `${plan.maxProducts} Products`}</li>
                  {plan.features.downloadBill && <li>Download Bills</li>}
                  {plan.features.reports !== 'none' && <li>{plan.features.reports === 'simple' ? 'Simple' : 'Advanced'} Reports</li>}
                  {plan.features.whatsappShare && <li>WhatsApp Sharing</li>}
                  {plan.features.lowStockAlert && <li>Low Stock Alerts</li>}
                </ul>
                {user.subscription?.plan === plan.id && <div className="current-badge">Current Plan</div>}
              </div>
            </label>
          ))}
        </div>

        <button type="submit" disabled={subscribing || selectedPlan === user.subscription?.plan}>
          {subscribing ? "Processing..." : "Change Subscription"}
        </button>
      </form>
      {message.text && <p className={`message ${message.type}`}>{message.text}</p>}
    </div>
  );
}