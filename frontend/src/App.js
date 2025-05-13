import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Keycloak from "keycloak-js";
import Scan from "./pages/Scan";

function Spinner() {
  return (
    <div className="spinner-container">
      <div className="spinner" />
      <div className="spinner-text">Loading...</div>
    </div>
  );
}

function App() {
  const [keycloak, setKeycloak] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const kc = new Keycloak({
      url: "https://kc-auth.linuxtecha.xyz",
      realm: "network-scanner",
      clientId: "fastapi-app",
    });

    kc.init({ onLoad: "login-required" })
      .then((authenticated) => {
        if (authenticated) {
          setKeycloak(kc);
          setToken(kc.token);

          try {
            const response = fetch("/api/auth/callback", {
              headers: {
                Authorization: `Bearer ${kc.token}`,
              },
            });
            
            if (!response.ok) {
              console.error("Failed to sync user:", response.status);
            }
          } catch (error) {
            console.error("Error syncing user:", error);
          }
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Keycloak init error:", err);
        setLoading(false);
      });
  }, []);

  const logout = () => {
    if (keycloak) {
      const logoutUrl = `${keycloak.authServerUrl}/realms/${keycloak.realm}/protocol/openid-connect/logout?post_logout_redirect_uri=${encodeURIComponent(window.location.origin)}&client_id=${keycloak.clientId}`;
      window.location.href = logoutUrl;
    }
  };

  if (loading) {
    return <Spinner />;
  }

  if (!token) {
    return <div>Authentication failed. Please try again.</div>;
  }

  return (
    <Router>
      <div style={{ padding: "1rem" }}>
        <button onClick={logout} style={{ marginBottom: "1rem" }}>
          Logout
        </button>

        <Routes>
          <Route path="/scan" element={<Scan token={token} />} />
          <Route path="*" element={<Navigate to="/scan" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
