import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

// --- API Abstraction ---
// It's better to keep API calls separate from your components.
const loginUser = async (credentials) => {
  const response = await fetch("http://localhost:5000/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });

  const data = await response.json();

  if (!response.ok) {
    // Throw an error with the message from the backend
    throw new Error(data.error || "An unknown error occurred.");
  }

  // The login endpoint only returns a token, so we just return that.
  return data;
};

// --- Component ---
function Login({ onAuthChange }) {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { token } = await loginUser(formData);

      // 1. Save only the token from the login response.
      localStorage.setItem("token", token);

      // 2. Notify the parent component that authentication state has changed.
      if (onAuthChange) onAuthChange();

      // 3. Redirect to the main page. The app should then fetch user
      //    profile info using the newly stored token.
      navigate("/");
    } catch (err) {
      // The error message now comes directly from the API service
      setError(err.message || "Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Login</h2>
      <form onSubmit={handleLogin}>
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
            autoComplete="username"
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
            autoComplete="current-password"
            style={styles.input}
          />
        </div>
        <button type="submit" disabled={loading} style={styles.button(loading)}>
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>

      {error && <p style={styles.errorText}>{error}</p>}

      <p style={styles.footerText}>
        Don’t have an account?{" "}
        <Link to="/signup" style={styles.link}>
          Sign up here
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
  label: { // Added for accessibility
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
    backgroundColor: loading ? "#6c757d" : "#007bff",
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

export default Login;