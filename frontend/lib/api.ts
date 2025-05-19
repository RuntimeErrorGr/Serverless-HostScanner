// Base API URL
const API_BASE_URL = "/api"

// Helper function for making API requests
async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${endpoint}`

  // Default headers
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  // Handle non-2xx responses
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.message || `API request failed with status ${response.status}`)
  }

  // Parse JSON response if available
  const contentType = response.headers.get("content-type")
  if (contentType && contentType.includes("application/json")) {
    return response.json()
  }

  return response
}

// Scans API
export const scansAPI = {
  getScans: () => fetchAPI("/scans"),
  getScan: (id: string) => fetchAPI(`/scans/${id}`),
  startScan: (data: any) =>
    fetchAPI("/scans/start", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteScan: (id: string) =>
    fetchAPI(`/scans/${id}`, {
      method: "DELETE",
    }),
  generateReport: (id: string, format: string) =>
    fetchAPI(`/scans/${id}/report`, {
      method: "POST",
      body: JSON.stringify({ format }),
    }),
}

// Targets API
export const targetsAPI = {
  getTargets: () => fetchAPI("/targets"),
  getTarget: (id: string) => fetchAPI(`/targets/${id}`),
  createTarget: (data: any) =>
    fetchAPI("/targets", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteTarget: (id: string) =>
    fetchAPI(`/targets/${id}`, {
      method: "DELETE",
    }),
}

// Reports API
export const reportsAPI = {
  getReports: () => fetchAPI("/reports"),
  getReport: (id: string) => fetchAPI(`/reports/${id}`),
  deleteReport: (id: string) =>
    fetchAPI(`/reports/${id}`, {
      method: "DELETE",
    }),
  downloadReport: (id: string) => fetchAPI(`/reports/${id}/download`),
}

// WebSocket connection for real-time updates
export function connectWebSocket(
  scanId: string,
  callbacks: {
    onMessage?: (data: any) => void
    onProgress?: (progress: number) => void
    onComplete?: (data: any) => void
    onError?: (error: any) => void
  },
) {
  // In a real app, this would connect to a WebSocket server
  console.log(`Connecting to WebSocket for scan ${scanId}`)

  // Mock implementation
  const mockSocket = {
    send: (message: string) => {
      console.log("WebSocket message sent:", message)
    },
    close: () => {
      console.log("WebSocket connection closed")
    },
  }

  return mockSocket
}
