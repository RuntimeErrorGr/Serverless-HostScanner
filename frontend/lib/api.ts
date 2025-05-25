// Base API URL
const API_BASE_URL = "/api"

// Helper function for getting the auth token
function getAuthToken(): string | null {
  // Try to get token from localStorage or sessionStorage
  if (typeof window !== 'undefined') {
    // Look for Keycloak token in localStorage
    const keycloakToken = localStorage.getItem('kc-token');
    if (keycloakToken) {
      return keycloakToken;
    }
    
    // Check session storage as fallback
    const sessionToken = sessionStorage.getItem('kc-token');
    if (sessionToken) {
      return sessionToken;
    }
    
    // Last resort: check for Keycloak object directly
    const kcString = localStorage.getItem('keycloak');
    if (kcString) {
      try {
        const kcData = JSON.parse(kcString);
        return kcData.token;
      } catch (e) {
        console.error('Failed to parse Keycloak data:', e);
      }
    }
  }
  
  return null;
}

// Helper function for making API requests
async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${endpoint}`

  // Get auth token
  const token = getAuthToken()

  // Default headers
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    ...options.headers,
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  // Handle non-2xx responses
  if (!response.ok) {
    if (response.status === 401) {
      console.error("Unauthorized: Authentication token may be invalid or expired")
      // redirect to login
      window.location.href = "/login"
    }
    const errorBody = await response.json().catch(() => ({}))
    throw new Error(
      errorBody.message ||
      errorBody.detail ||
      `API request failed with status ${response.status}`
    )
  }

  // If it's JSON, parse it
  const contentType = response.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    const payload = await response.json()

    // If the payload is an object with a top‐level `data` key, return that
    if (
      payload !== null &&
      typeof payload === "object" &&
      // Make sure it's a plain data wrapper
      Object.prototype.hasOwnProperty.call(payload, "data")
    ) {
      return (payload as any).data
    }

    // Otherwise return the full JSON
    return payload
  }

  // Not JSON (e.g. file download), return raw response
  return response
}

// Scans API
export const scansAPI = {
  getScans: () => fetchAPI("/scans/"),
  getScan: (id: string) => fetchAPI(`/scans/${id}`),
  getScanStatus: (id: string) => fetchAPI(`/scans/${id}/status`),
  getScanFindings: (id: string) => fetchAPI(`/scans/${id}/findings`),
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

// Findings API
export const findingsAPI = {
  getFindings: () => fetchAPI("/findings"),
  getFinding: (id: string) => fetchAPI(`/findings/${id}`),
  deleteFinding: (id: string) =>
    fetchAPI(`/findings/${id}`, {
      method: "DELETE",
    }),
}
