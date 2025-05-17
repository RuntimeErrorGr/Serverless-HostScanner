import React, { useEffect, useState, useRef, useCallback } from "react";
import { useOutletContext, useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "../api";

function PendingRunningScan() {
  const { token } = useOutletContext();
  const { scanUuid } = useParams();
  const navigate = useNavigate();
  const [scanData, setScanData] = useState(null);
  const [output, setOutput] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);
  const outputContainerRef = useRef(null);
  const receivedMessagesRef = useRef(new Set());
  const pendingTransitionRef = useRef(false);
  const lastMessageTimeRef = useRef(Date.now());
  
  // For polling
  const statusPollingIntervalRef = useRef(null);

  // Function to check if it's safe to transition to results
  const checkAndTransitionToResults = useCallback(() => {
    const timeSinceLastMessage = Date.now() - lastMessageTimeRef.current;
    
    // If we've received no new messages for 3 seconds, it's safe to transition
    if (timeSinceLastMessage > 3000) {
      if (wsRef.current) {
        wsRef.current.close();
      }
      navigate(`/scans/${scanUuid}/results`);
    } else {
      // Check again in 1 second
      setTimeout(checkAndTransitionToResults, 1000);
    }
  }, [scanUuid, navigate]);

  // Fetch initial scan data
  useEffect(() => {
    const fetchScanData = async () => {
      try {
        const res = await apiFetch(`/api/scans/${scanUuid}`, {}, token);
        if (!res.ok) {
          throw new Error(`API error: ${res.status}`);
        }
        const data = await res.json();
        setScanData(data);
        
        // If scan has output already, initialize it
        if (data.output) {
          const lines = data.output.split("\n");
          setOutput(lines);
          lines.forEach(line => receivedMessagesRef.current.add(line));
        }
        
        // If scan is already completed or failed, transition safely
        if (data.status === "completed" || data.status === "failed") {
          pendingTransitionRef.current = true;
          checkAndTransitionToResults();
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchScanData();
  }, [scanUuid, token, navigate, checkAndTransitionToResults]);

  // Setup websocket
  useEffect(() => {
    if (!scanUuid || !scanData || scanData.status === "completed" || scanData.status === "failed") {
      return;
    }
  
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/scans/ws/${scanUuid}`;
  
    let retryAttempt = 0;
    let reconnectTimeout = null;
  
    const connectWebSocket = () => {
      wsRef.current = new WebSocket(wsUrl);
  
      wsRef.current.onopen = () => {
        console.log("WebSocket connected");
        retryAttempt = 0;
        setError(null);
      };
  
      wsRef.current.onmessage = (event) => {
        const message = event.data;
        lastMessageTimeRef.current = Date.now();
        
        // Skip heartbeat messages and duplicates
        if (message.includes("[heartbeat]") || receivedMessagesRef.current.has(message)) {
          return;
        }
        
        console.log("Received new message:", message);
        receivedMessagesRef.current.add(message);
        
        setOutput(prev => [...prev, message]);

        // If we're pending transition and received a message, check if we can transition
        if (pendingTransitionRef.current) {
          checkAndTransitionToResults();
        }
      };
  
      wsRef.current.onerror = (e) => {
        console.error("WebSocket error:", e);
        setError("WebSocket error. Attempting to reconnect...");
      };
  
      wsRef.current.onclose = () => {
        console.log("WebSocket closed");
        // If we're pending transition and the socket closed, we can transition
        if (pendingTransitionRef.current) {
          navigate(`/scans/${scanUuid}/results`);
          return;
        }

        if (retryAttempt < 5) {
          const delay = Math.pow(2, retryAttempt) * 1000;
          reconnectTimeout = setTimeout(() => {
            retryAttempt++;
            console.log(`Retrying WebSocket connection (attempt ${retryAttempt})...`);
            connectWebSocket();
          }, delay);
        } else {
          setError("WebSocket connection failed after multiple attempts.");
        }
      };
    };
  
    connectWebSocket();
  
    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (wsRef.current) wsRef.current.close();
    };
  }, [scanUuid, scanData, navigate, checkAndTransitionToResults]);

  // Start polling for status
  useEffect(() => {
    if (!scanUuid) return;
    
    const pollStatus = async () => {
      try {
        const res = await apiFetch(`/api/scans/${scanUuid}/status`, {}, token);
        if (!res.ok) {
          throw new Error(`API error: ${res.status}`);
        }
        
        const data = await res.json();
    
        // Update scanData.status if it changed
        setScanData(prev => {
          if (!prev) return prev;
          if (prev.status !== data.status) {
            return { ...prev, status: data.status };
          }
          return prev;
        });
    
        // If scan is completed or failed, mark for transition but don't navigate immediately
        if (data.status === "completed" || data.status === "failed") {
          clearInterval(statusPollingIntervalRef.current);
          pendingTransitionRef.current = true;
          checkAndTransitionToResults();
        }
      } catch (err) {
        console.error("Error polling scan status:", err);
      }
    };

    const pollInterval = 3000;
    statusPollingIntervalRef.current = setInterval(pollStatus, pollInterval);
    
    return () => {
      clearInterval(statusPollingIntervalRef.current);
    };
  }, [scanUuid, token, navigate, checkAndTransitionToResults]);

  // Auto-scroll to bottom of output
  useEffect(() => {
    if (outputContainerRef.current) {
      outputContainerRef.current.scrollTop = outputContainerRef.current.scrollHeight;
    }
  }, [output]);

  if (loading) return <div>Loading scan data...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!scanData) return <div>No scan data found</div>;

  return (
    <div className="container mx-auto p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">
          {scanData.status === "pending" ? "Pending" : "Running"} Scan for {scanData.targets.join(", ")}
        </h1>
        <div className="flex items-center">
          <span className="mr-2">Status:</span>
          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
            scanData.status === "running" 
              ? "bg-blue-100 text-blue-800" 
              : "bg-yellow-100 text-yellow-800"
          }`}>
            {scanData.status}
          </span>
        </div>
      </div>
      
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-2">Scan Output</h2>
        <div 
          ref={outputContainerRef}
          className="bg-black text-green-400 p-4 rounded h-64 overflow-auto font-mono text-sm"
        >
          {output.length === 0 ? (
            <div className="text-gray-500">Waiting for scan output...</div>
          ) : (
            output.map((line, idx) => (
              <div key={idx}>{line}</div>
            ))
          )}
        </div>
      </div>
      
      <div>
        <h2 className="text-xl font-bold mb-2">Results</h2>
        <div className="bg-gray-100 p-4 rounded">
          <p className="text-gray-500">No final results yet. Scan is still in progress.</p>
        </div>
      </div>
    </div>
  );
}

export default PendingRunningScan; 