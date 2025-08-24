import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

// --- API Abstraction ---
// Separating the API call makes the component cleaner.
const signupUser = async (userData) => {
  const response = await fetch("http://localhost:5000/api/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(userData),
  });

  const data = await response.json();

  if (!response.ok) {
    // Throw an error to be caught by the component's catch block.
    throw new Error(data.error || "An unknown error occurred.");
  }

  // The signup endpoint returns a token on success.
  return data;
};

// --- Component ---
function Signup({ onAuthChange }) {
  const [formData, setFormData] = useState({
    shopName: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // A single handler for all form inputs.
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { token } = await signupUser(formData);

      // 1. Save the token from the signup response.
      localStorage.setItem("token", token);

      // 2. Notify the parent app that authentication state has changed.
      if (onAuthChange) onAuthChange();

      // 3. Redirect to the main page to start using the app.
      navigate("/");
    } catch (err) {
      // The error message comes directly from the API service.
      setError(err.message || "Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Create Account</h2>
      <form onSubmit={handleSignup}>
        <div style={styles.inputGroup}>
          <label htmlFor="shopName" style={styles.label}>Shop Name</label>
          <input
            id="shopName"
            name="shopName"
            type="text"
            placeholder="Shop Name"
            value={formData.shopName}
            onChange={handleChange}
            required
            autoComplete="organization"
            style={styles.input}
          />
        </div>
        <div style={styles.inputGroup}>
          <label htmlFor="email" style={styles.label}>Email Address</label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            required
            autoComplete="email"
            style={styles.input}
          />
        </div>
        <div style={styles.inputGroup}>
          <label htmlFor="password" style={styles.label}>Password</label>
          <input
            id="password"
            name="password"
            type="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            required
            minLength={6}
            autoComplete="new-password"
            style={styles.input}
          />
        </div>
        <button type="submit" disabled={loading} style={styles.button(loading)}>
          {loading ? "Creating Account..." : "Sign Up"}
        </button>
      </form>

      {error && <p style={styles.errorText}>{error}</p>}

      <p style={styles.footerText}>
        Already have an account?{" "}
        <Link to="/login" style={styles.link}>
          Login here
        </Link>
      </p>
    </div>
  );
}

// --- Styles ---
// Centralizing styles makes the JSX cleaner and easier to manage.
const styles = {
  container: {
    maxWidth: 400,
    margin: "50px auto",
    padding: 20,
    border: "1px solid #ddd",
    borderRadius: 8,
    background: "#fff",
    boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
  },
  title: {
    textAlign: "center",
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    position: 'absolute',
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    borderWidth: 0,
  },
  input: {
    width: "100%",
    padding: 10,
    boxSizing: 'border-box'
  },
  button: (loading) => ({
    width: "100%",
    padding: 12,
    backgroundColor: loading ? "#6c757d" : "#28a745",
    color: "white",
    fontSize: 16,
    border: "none",
    borderRadius: 4,
    cursor: loading ? "not-allowed" : "pointer",
  }),
  errorText: {
    color: "red",
    marginTop: 10,
    fontWeight: "bold",
    textAlign: "center",
  },
  footerText: {
    marginTop: 15,
    textAlign: "center",
  },
  link: {
    color: "#007bff",
    textDecoration: "none",
  },
};

export default Signup;