import React, { useEffect, useState } from "react";
import { useOutletContext, useParams, Link } from "react-router-dom";
import { apiFetch } from "../api";

function FinishedScan() {
  const { token } = useOutletContext();
  const { scanUuid } = useParams();
  const [scanData, setScanData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('output');

  useEffect(() => {
    const fetchScanData = async () => {
      try {
        const res = await apiFetch(`/api/scans/${scanUuid}`, {}, token);
        if (!res.ok) {
          throw new Error(`API error: ${res.status}`);
        }
        const data = await res.json();
        setScanData(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchScanData();
  }, [scanUuid, token]);

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp).toLocaleString();
  };

  const renderStatusBadge = (status) => {
    let bgColor = "bg-gray-200 text-gray-800";
    
    switch (status) {
      case "completed":
        bgColor = "bg-green-100 text-green-800";
        break;
      case "failed":
        bgColor = "bg-red-100 text-red-800";
        break;
      default:
        bgColor = "bg-gray-100 text-gray-800";
    }

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${bgColor}`}>
        {status}
      </span>
    );
  };

  const renderScanOutput = () => {
    if (!scanData.output) {
      return <p className="text-gray-500">No output recorded for this scan.</p>;
    }

    return (
      <div className="bg-black text-green-400 p-4 rounded h-96 overflow-auto font-mono text-sm">
        {scanData.output.split("\n").map((line, idx) => (
          <div key={idx}>{line}</div>
        ))}
      </div>
    );
  };

  const renderScanResults = () => {
    if (!scanData.result || Object.keys(scanData.result).length === 0) {
      return <p className="text-gray-500">No results available for this scan.</p>;
    }

    // Render results based on your scan result structure
    return (
      <div className="bg-white p-4 rounded border">
        <pre className="overflow-auto max-h-96">
          {JSON.stringify(scanData.result, null, 2)}
        </pre>
      </div>
    );
  };

  if (loading) return <div>Loading scan data...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!scanData) return <div>No scan data found</div>;

  return (
    <div className="container mx-auto p-4">
      <div className="mb-6">
        <Link 
          to="/scans" 
          className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
        >
          &larr; Back to Scans
        </Link>
        <h1 className="text-2xl font-bold mb-2">
          Scan Results for {scanData.targets.join(", ")}
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="bg-gray-50 p-3 rounded">
            <h3 className="font-bold text-gray-700">Status</h3>
            <div>{renderStatusBadge(scanData.status)}</div>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <h3 className="font-bold text-gray-700">Scan Type</h3>
            <div>{scanData.type}</div>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <h3 className="font-bold text-gray-700">Completed At</h3>
            <div>{formatTimestamp(scanData.finished_at)}</div>
          </div>
        </div>
      </div>
      
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex">
            <button
              onClick={() => setActiveTab('output')}
              className={`py-2 px-4 text-center border-b-2 font-medium text-sm ${
                activeTab === 'output'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Scan Output
            </button>
            <button
              onClick={() => setActiveTab('results')}
              className={`py-2 px-4 text-center border-b-2 font-medium text-sm ${
                activeTab === 'results'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Results Data
            </button>
          </nav>
        </div>
        
        <div className="mt-4">
          {activeTab === 'output' ? renderScanOutput() : renderScanResults()}
        </div>
      </div>
      
      <div className="mt-6">
        <h2 className="text-xl font-bold mb-2">Scan Details</h2>
        <div className="bg-white p-4 rounded border">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-bold">Scan Parameters</h3>
              <pre className="bg-gray-50 p-2 rounded mt-2 text-sm overflow-auto max-h-32">
                {scanData.parameters ? JSON.stringify(scanData.parameters, null, 2) : 'None'}
              </pre>
            </div>
            <div>
              <h3 className="font-bold">Timeline</h3>
              <div className="mt-2 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Created:</span>
                  <span>{formatTimestamp(scanData.created_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Started:</span>
                  <span>{formatTimestamp(scanData.started_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Finished:</span>
                  <span>{formatTimestamp(scanData.finished_at)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FinishedScan; 