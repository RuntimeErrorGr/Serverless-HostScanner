import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { apiFetch } from "../api";

function ScanStart() {
  const { token } = useOutletContext();
  const [scanUuid, setScanUuid] = useState(null);
  const [output, setOutput] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function startScan() {
      try {
        const payload = { targets: ["8.8.8.8"], type: "default" };
        const res = await apiFetch(
          "/api/scans/start",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          },
          token
        );
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`API error: ${res.status} - ${text}`);
        }
        const data = await res.json();
        setScanUuid(data.scan_uuid);
      } catch (err) {
        setError(err.message);
      }
    }
    startScan();
  }, [token]);

  useEffect(() => {
    if (!scanUuid) return;
    const ws = new WebSocket(`wss://${window.location.host}/api/scans/ws/${scanUuid}`);
    ws.onmessage = (event) => {
      console.log("Received message:", event.data);
      setOutput((prev) => [...prev, event.data]);
    };
    ws.onerror = (e) => setError("WebSocket error");
    return () => ws.close();
  }, [scanUuid]);

  if (error) return <div>Error: {error}</div>;
  if (!scanUuid) return <div>Starting scan...</div>;

  return (
    <div>
      <h2>Scan Started!</h2>
      <pre style={{ maxHeight: 400, overflow: "auto" }}>
        {output.map((line, idx) => <div key={idx}>{line}</div>)}
      </pre>
    </div>
  );
}

export default ScanStart;