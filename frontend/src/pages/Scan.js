import React, { useEffect, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { apiFetch } from "../api";
import ScanModal from "../components/ScanModal";

function Scan() {
  const { token } = useOutletContext();
  const navigate = useNavigate();
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const fetchScans = async () => {
      setLoading(true);
      try {
        const res = await apiFetch("/api/scans/", {}, token);
        if (!res.ok) {
          throw new Error(`API error: ${res.status}`);
        }
        const data = await res.json();
        setScans(data.data || []);
      } catch (err) {
        setError(err.message);
        console.error("Failed to fetch scans", err);
      } finally {
        setLoading(false);
      }
    };

    fetchScans();
  }, [token]);

  const handleModalClose = () => {
    setShowModal(false);
  };

  const handleScanStart = (scanUuid) => {
    navigate(`/scans/${scanUuid}/running`);
  };

  const handleViewScan = (scanUuid, status) => {
    if (status === "pending" || status === "running") {
      navigate(`/scans/${scanUuid}/running`);
    } else {
      navigate(`/scans/${scanUuid}/results`);
    }
  };

  const renderStatusBadge = (status) => {
    let bgColor = "bg-gray-200";
    
    switch (status) {
      case "completed":
        bgColor = "bg-green-100 text-green-800";
        break;
      case "running":
        bgColor = "bg-blue-100 text-blue-800";
        break;
      case "pending":
        bgColor = "bg-yellow-100 text-yellow-800";
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

  if (loading) return <div>Loading scans...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Scans - here you can see all of your scans and start new ones</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Start New Scan
        </button>
      </div>

      {scans.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-gray-500">No scans found. Start a new scan!</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead>
              <tr>
                <th className="py-2 px-4 border-b">Targets</th>
                <th className="py-2 px-4 border-b">Type</th>
                <th className="py-2 px-4 border-b">Status</th>
                <th className="py-2 px-4 border-b">Created</th>
                <th className="py-2 px-4 border-b">Actions</th>
              </tr>
            </thead>
            <tbody>
              {scans.map((scan) => (
                <tr key={scan.uuid} className="hover:bg-gray-50">
                  <td className="py-2 px-4 border-b">{scan.targets.join(", ")}</td>
                  <td className="py-2 px-4 border-b">{scan.type}</td>
                  <td className="py-2 px-4 border-b">{renderStatusBadge(scan.status)}</td>
                  <td className="py-2 px-4 border-b">
                    {new Date(scan.created_at).toLocaleString()}
                  </td>
                  <td className="py-2 px-4 border-b">
                    <button
                      onClick={() => handleViewScan(scan.uuid, scan.status)}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-1 px-3 rounded text-sm mr-2"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <ScanModal 
          onClose={handleModalClose} 
          onScanStart={handleScanStart} 
          token={token} 
        />
      )}
    </div>
  );
}

export default Scan;