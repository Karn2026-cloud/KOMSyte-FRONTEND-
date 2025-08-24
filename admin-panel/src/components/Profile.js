import React, { useEffect, useState } from "react";
import API from "../api";
import { useNavigate } from "react-router-dom";

export default function Profile() {
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [workerName, setWorkerName] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [addingWorker, setAddingWorker] = useState(false);
  const navigate = useNavigate();

  // Fetch profile function
  const fetchProfile = async () => {
    const token = localStorage.getItem("token");
    if (!token) return navigate("/login");
    try {
      const res = await API.get("/api/profile", { headers: { Authorization: `Bearer ${token}` } });
      setProfileData({ ...res.data }); // force React to re-render
    } catch {
      localStorage.removeItem("token");
      navigate("/login");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to log out?")) {
      localStorage.removeItem("token");
      navigate("/login");
    }
  };

  const handleSubscribe = () => navigate("/subscription");

  const handleAddWorker = async () => {
    if (!workerName || !workerId) return alert("Please enter both name and worker ID");
    setAddingWorker(true);
    try {
      const token = localStorage.getItem("token");
      await API.post(
        "/api/workers/add",
        { name: workerName, workerId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setWorkerName("");
      setWorkerId("");
      fetchProfile(); // Refresh profile immediately
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Failed to add worker");
    } finally {
      setAddingWorker(false);
    }
  };

  const styles = {
    container: {
      maxWidth: "600px",
      margin: "50px auto",
      padding: "40px",
      borderRadius: "12px",
      background: "#f9f9f9",
      boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
      fontFamily: "'Segoe UI', sans-serif",
      color: "#333"
    },
    title: { fontSize: "2.2rem", marginBottom: "20px", color: "#222" },
    section: { fontSize: "1.3rem", margin: "25px 0 15px", fontWeight: "bold", color: "#444" },
    item: { marginBottom: "10px", fontSize: "1rem", color: "#555" },
    input: { padding: "12px", margin: "8px 0", width: "90%", borderRadius: "8px", border: "1px solid #ccc" },
    button: { padding: "12px 20px", fontSize: "1rem", borderRadius: "8px", border: "none", cursor: "pointer", margin: "10px 0", width: "100%", maxWidth: "220px", transition: "0.3s all" },
    subscribeButton: { backgroundColor: "#4CAF50", color: "#fff" },
    logoutButton: { backgroundColor: "#ff4d4d", color: "#fff" },
    addWorkerButton: { backgroundColor: "#2196F3", color: "#fff" },
    listItem: { padding: "8px 0", borderBottom: "1px solid #ddd" }
  };

  if (loading) return <p style={{ textAlign: "center" }}>Loading profile...</p>;
  if (!profileData) return <p style={{ textAlign: "center", color: "red" }}>No profile data found.</p>;

  const { shop, subscription, workers } = profileData;
  const isFreePlan = !subscription || subscription.plan.toLowerCase() === "free";

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Shop Profile</h2>
      <p style={styles.item}><strong>Shop Name:</strong> {shop?.shopName || "-"}</p>
      <p style={styles.item}><strong>Email:</strong> {shop?.email || "-"}</p>

      <h3 style={styles.section}>Subscription</h3>
      <p style={styles.item}><strong>Plan:</strong> {subscription?.plan || "Free"}</p>
      <p style={styles.item}><strong>Status:</strong> {subscription?.status || "Inactive"}</p>
      <p style={styles.item}><strong>Renewal Date:</strong> {subscription?.nextBillingDate ? new Date(subscription.nextBillingDate).toLocaleDateString() : "-"}</p>
      {isFreePlan && <button style={{ ...styles.button, ...styles.subscribeButton }} onClick={handleSubscribe}>Upgrade Plan</button>}

      <h3 style={styles.section}>Workers</h3>
      {workers?.length > 0 ? (
        <ul>
          {workers.map(w => <li key={w.workerId} style={styles.listItem}>{w.name} (ID: {w.workerId})</li>)}
        </ul>
      ) : <p style={styles.item}>No workers added yet.</p>}

      <div style={{ marginTop: "20px" }}>
        <input type="text" placeholder="Worker Name" style={styles.input} value={workerName} onChange={e => setWorkerName(e.target.value)} />
        <input type="text" placeholder="Worker ID" style={styles.input} value={workerId} onChange={e => setWorkerId(e.target.value)} />
        <button style={{ ...styles.button, ...styles.addWorkerButton }} onClick={handleAddWorker} disabled={addingWorker}>
          {addingWorker ? "Adding..." : "Add Worker"}
        </button>
      </div>

      <button style={{ ...styles.button, ...styles.logoutButton }} onClick={handleLogout}>Logout</button>
    </div>
  );
}
