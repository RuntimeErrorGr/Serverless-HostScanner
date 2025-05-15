import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { apiFetch } from "../api";

function Scan() {
  const { token } = useOutletContext();
  const [dashboardData, setDashboardData] = useState("");

  useEffect(() => {
    const getDashboard = async () => {
      try {
        const res = await apiFetch("/api/scans/", {}, token);
        const data = await res.json();
        setDashboardData(data.data);
      } catch (err) {
        console.error("Failed to fetch dashboard", err);
      }
    };

    getDashboard();
  }, [token]);

  return (
    <div>
      <h1>Scan Dashboard</h1>
      <p>{dashboardData}</p>
    </div>
  );
}

export default Scan;