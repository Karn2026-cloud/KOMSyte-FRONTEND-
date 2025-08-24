import React, { useState, useCallback } from 'react';
import './Home.css'; // Assuming you have some styles for the layout

// Import your page components
import RegisterProduct from './register';
import Billing from './Billing';
import Subscription from './subscription';
import Reports from './report';
import StockList from './stock';

// A mapping for cleaner menu item labels
const MENU_ITEMS = {
  billing: 'Billing',
  stock: 'Stock List',
  register: 'Register Product',
  reports: 'Reports',
  subscription: 'Subscription',
  profile: 'Profile',
};

// The Home component now receives user, onLogout, and a new onUpdateUser prop.
export default function Home({ user, onLogout, onUpdateUser }) {
  const [activeMenu, setActiveMenu] = useState('billing');

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to log out?")) {
      onLogout();
    }
  };

  // ✅ This function is called by the Subscription component after a successful payment.
  // It calls the onUpdateUser function passed down from App.js to refresh the user's data.
  const handleSubscriptionUpdate = useCallback(() => {
    if (onUpdateUser) {
      onUpdateUser();
    }
  }, [onUpdateUser]);


  return (
    <div className="home-container">
      {/* Sidebar Navigation */}
      <nav className="sidebar">
        <h3 className="sidebar-title">KOMSYTE</h3>
        <ul className="menu-list">
          {Object.entries(MENU_ITEMS).map(([key, value]) => (
            <li key={key} className="menu-item">
              <button
                className={`menu-button ${activeMenu === key ? 'active' : ''}`}
                onClick={() => setActiveMenu(key)}
              >
                {value}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Main Content Area */}
      <div className="main-content-wrapper">
        <header className="main-header">
          <h2 className="header-title">
            {MENU_ITEMS[activeMenu]}
          </h2>
          <div className="header-user-info">
            <span>Welcome, <strong>{user.shopName}</strong></span>
            <button className="logout-button-header" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>

        <main className="main-content">
          {/* ✅ FIXED: Pass the 'user' prop to RegisterProduct */}
          {activeMenu === 'register' && <RegisterProduct user={user} />}
          
          {activeMenu === 'billing' && <Billing user={user} />}

          {/* ✅ ADDED: Pass the 'onSubscriptionUpdate' handler to Subscription */}
          {activeMenu === 'subscription' && <Subscription user={user} onSubscriptionUpdate={handleSubscriptionUpdate} />}
          
          {activeMenu === 'reports' && <Reports user={user} />}
          {activeMenu === 'stock' && <StockList user={user} />}

          {/* The Profile View */}
          {activeMenu === 'profile' && (
            <div className="profile-card">
              <h2 className="profile-title">Shop Profile</h2>
              <p className="profile-item"><strong>Shop Name:</strong> {user.shopName}</p>
              <p className="profile-item"><strong>Email:</strong> {user.email}</p>

              <h3 className="profile-subtitle">Subscription Details</h3>
              <p className="profile-item">
                <strong>Plan:</strong> <span className="plan-name">{user.subscription?.plan || 'N/A'}</span>
              </p>
              <p className="profile-item">
                <strong>Status:</strong> <span className="status-active">{user.subscription?.status || 'N/A'}</span>
              </p>
              <p className="profile-item">
                <strong>Next Billing Date:</strong>
                {user.subscription?.nextBillingDate
                  ? new Date(user.subscription.nextBillingDate).toLocaleDateString()
                  : 'N/A'}
              </p>

              {user.subscription?.plan === 'free' && (
                 <button className="button-upgrade" onClick={() => setActiveMenu('subscription')}>
                   Upgrade Plan
                 </button>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}