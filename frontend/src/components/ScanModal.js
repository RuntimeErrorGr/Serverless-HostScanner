import React, { useState } from "react";
import { apiFetch } from "../api";

const SCAN_TYPE_INFO = {
  default: "Default scan uses common ports (1-1000) and standard probes for quick results",
  custom: "Custom scan allows scanning specific ports and using aggressive probes for detailed results"
};

function ScanModal({ onClose, onScanStart, token }) {
  const [targetInput, setTargetInput] = useState("");
  const [scanType, setScanType] = useState("default");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showTooltip, setShowTooltip] = useState(false);

  const handleTargetChange = (e) => {
    setTargetInput(e.target.value);
  };

  const handleScanTypeChange = (e) => {
    setScanType(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!targetInput.trim()) {
      setError("Please enter at least one target");
      return;
    }
    
    // Parse targets from the input (comma-separated)
    const targets = targetInput.split(",").map(t => t.trim()).filter(t => t);
    
    if (targets.length === 0) {
      setError("Please enter at least one valid target");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const payload = {
        targets: targets,
        type: scanType,
        scan_options: scanType === "custom" ? { aggressive: true } : null
      };
      
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
      onClose();
      onScanStart(data.scan_uuid);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Start New Scan</h2>
        
        {error && (
          <div className="mb-4 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 font-bold mb-2" htmlFor="targets">
              Targets (IP addresses or hostnames, comma-separated)
            </label>
            <input
              id="targets"
              type="text"
              value={targetInput}
              onChange={handleTargetChange}
              placeholder="e.g. 192.168.1.1, example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
              disabled={loading}
            />
          </div>
          
          <div className="mb-6">
            <label className="block text-gray-700 font-bold mb-2">
              Scan Type
            </label>
            <div className="space-y-2">
              <div className="flex items-center">
                <input
                  id="scan-type-default"
                  type="radio"
                  name="scanType"
                  value="default"
                  checked={scanType === "default"}
                  onChange={handleScanTypeChange}
                  className="mr-2"
                  disabled={loading}
                />
                <label 
                  htmlFor="scan-type-default" 
                  className="cursor-pointer relative"
                  onMouseEnter={() => setShowTooltip("default")}
                  onMouseLeave={() => setShowTooltip(null)}
                >
                  Default
                  {showTooltip === "default" && (
                    <div className="absolute left-0 bottom-full mb-2 w-64 bg-gray-800 text-white text-xs rounded py-1 px-2 z-10">
                      {SCAN_TYPE_INFO.default}
                    </div>
                  )}
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  id="scan-type-custom"
                  type="radio"
                  name="scanType"
                  value="custom"
                  checked={scanType === "custom"}
                  onChange={handleScanTypeChange}
                  className="mr-2"
                  disabled={loading}
                />
                <label 
                  htmlFor="scan-type-custom" 
                  className="cursor-pointer relative"
                  onMouseEnter={() => setShowTooltip("custom")}
                  onMouseLeave={() => setShowTooltip(null)}
                >
                  Custom
                  {showTooltip === "custom" && (
                    <div className="absolute left-0 bottom-full mb-2 w-64 bg-gray-800 text-white text-xs rounded py-1 px-2 z-10">
                      {SCAN_TYPE_INFO.custom}
                    </div>
                  )}
                </label>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50"
              disabled={loading}
            >
              {loading ? "Starting..." : "Start Scan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ScanModal; 