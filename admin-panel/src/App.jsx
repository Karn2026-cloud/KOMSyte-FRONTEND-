import { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Shop from "./pages/Shop";
import Product from "./pages/Product";

export default function App() {
  const [isAuth, setAuth] = useState(!!localStorage.getItem("token"));

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login setAuth={setAuth} />} />
        {isAuth ? (
          <>
            <Route path="/shop" element={<Shop />} />
            <Route path="/product" element={<Product />} />
          </>
        ) : (
          <Route path="*" element={<Navigate to="/login" />} />
        )}
      </Routes>
    </Router>
  );
}
