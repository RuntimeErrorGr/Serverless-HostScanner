import React, { useEffect, useState } from "react";

function Scan({ token }) {
  const [dashboardData, setDashboardData] = useState("");

  useEffect(() => {
    const getDashboard = async () => {
      try {
        const res = await fetch("/api/scan/", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`API error: ${res.status} - ${text}`);
        }
        setDashboardData(data.data);
      } catch (err) {
        console.error("Failed to fetch scans", err);
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
