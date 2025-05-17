import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from "react-router-dom";
import Keycloak from "keycloak-js";
import Scan from "./pages/Scan";
import ScanStart from "./pages/ScanStart";
import PendingRunningScan from "./pages/PendingRunningScan";
import FinishedScan from "./pages/FinishedScan";
import Dashboard from "./pages/Dashboard";

function Spinner() {
  return (
    <div className="spinner-container">
      <div className="spinner" />
      <div className="spinner-text"></div>
    </div>
  );
}

// ProtectedRoute: just checks for token, does not init Keycloak
function ProtectedRoute({ token, keycloak }) {
  if (!token) {
    return <Navigate to="/dashboard" />;
  }
  // Provide token and keycloak to all children via context or props
  return <Outlet context={{ token, keycloak }} />;
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
      .then(async (authenticated) => {
        if (authenticated) {
          setKeycloak(kc);
          setToken(kc.token);

          // Sync user to DB only once after login
          try {
            const response = await fetch("/api/auth/callback", {
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

  useEffect(() => {
    if (!keycloak) return;
  
    // Refresh token every 30 seconds
    const refreshInterval = setInterval(() => {
      keycloak.updateToken(60) // refresh if token will expire in 60s
        .then(refreshed => {
          if (refreshed) {
            setToken(keycloak.token);
          }
        })
        .catch(() => {
          // If refresh fails, force logout
          keycloak.logout();
        });
    }, 99999999);
  
    return () => clearInterval(refreshInterval);
  }, [keycloak]);

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
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/scans" element={<ProtectedRoute token={token} keycloak={keycloak} />}>
            <Route index element={<Scan />} />
            <Route path="start" element={<ScanStart />} />
            <Route path=":scanUuid/running" element={<PendingRunningScan />} />
            <Route path=":scanUuid/results" element={<FinishedScan />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;