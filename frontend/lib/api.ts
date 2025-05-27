// Base API URL
const API_BASE_URL = "/api"

// Helper function for getting the auth token
function getAuthToken(): string | null {
  // Try to get token from localStorage or sessionStorage
  if (typeof window !== "undefined") {
    // Look for Keycloak token in localStorage
    const keycloakToken = localStorage.getItem("kc-token")
    if (keycloakToken) {
      return keycloakToken
    }

    // Check session storage as fallback
    const sessionToken = sessionStorage.getItem("kc-token")
    if (sessionToken) {
      return sessionToken
    }

    // Last resort: check for Keycloak object directly
    const kcString = localStorage.getItem("keycloak")
    if (kcString) {
      try {
        const kcData = JSON.parse(kcString)
        return kcData.token
      } catch (e) {
        console.error("Failed to parse Keycloak data:", e)
      }
    }
  }

  return null
}

// Helper function for making API requests
async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${endpoint}`

  // Get auth token
  const token = getAuthToken()

  // Default headers
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
    throw new Error(errorBody.message || errorBody.detail || `API request failed with status ${response.status}`)
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
  getScan: (uuid: string) => fetchAPI(`/scans/${uuid}`),
  getScanStatus: (uuid: string) => fetchAPI(`/scans/${uuid}/status`),
  getScanFindings: (uuid: string) => fetchAPI(`/scans/${uuid}/findings`),
  startScan: (data: any) =>
    fetchAPI("/scans/start", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteScan: (uuid: string) =>
    fetchAPI(`/scans/${uuid}`, {
      method: "DELETE",
    }),
  bulkDeleteScans: (uuids: string[]) =>
    fetchAPI("/scans/bulk-delete", {
      method: "POST",
      body: JSON.stringify(uuids),
    }),
  generateReport: (uuid: string, format: string) =>
    fetchAPI(`/scans/${uuid}/report`, {
      method: "POST",
      body: JSON.stringify({ format }),
    }),
}

// Targets API
export const targetsAPI = {
  getTargets: () => fetchAPI("/targets/"),
  getTarget: (uuid: string) => fetchAPI(`/targets/${uuid}`),
  getTargetFlag: (uuid: string) => fetchAPI(`/targets/${uuid}/flag`),
  createTarget: (data: any) =>
    fetchAPI("/targets/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteTarget: (uuid: string) =>
    fetchAPI(`/targets/${uuid}`, {
      method: "DELETE",
    }),
  bulkDeleteTargets: (uuids: string[]) =>
    fetchAPI("/targets/bulk-delete", {
      method: "POST",
      body: JSON.stringify(uuids),
    }),
}

// Reports API
export const reportsAPI = {
  getReports: () => fetchAPI("/reports/"),
  getReport: (uuid: string) => fetchAPI(`/reports/${uuid}`),
  deleteReport: (uuid: string) =>
    fetchAPI(`/reports/${uuid}`, {
      method: "DELETE",
    }),
  bulkDeleteReports: (uuids: string[]) =>
    fetchAPI("/reports/bulk-delete", {
      method: "POST",
      body: JSON.stringify(uuids),
    }),
  downloadReport: (uuid: string) => fetchAPI(`/reports/${uuid}/download`),
}

// Findings API
export const findingsAPI = {
  getFindings: () => fetchAPI("/findings/"),
  getFinding: (uuid: string) => fetchAPI(`/findings/${uuid}`),
  getFindingsByTarget: (targetUuid: string) => fetchAPI(`/findings/by-target/${targetUuid}`),
  updateFinding: (uuid: string, data: any) =>
    fetchAPI(`/findings/${uuid}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteFinding: (uuid: string) =>
    fetchAPI(`/findings/${uuid}`, {
      method: "DELETE",
    }),
  bulkDeleteFindings: (uuids: string[]) =>
    fetchAPI("/findings/bulk-delete", {
      method: "POST",
      body: JSON.stringify(uuids),
    }),
}

export const dashboardAPI = {
  getStats: () => fetchAPI("/dashboard/stats"),
  getScanActivity: () => fetchAPI("/dashboard/scan-activity"),
  getVulnerabilityTrends: () => fetchAPI("/dashboard/vulnerability-trends"),
  getOpenPorts: () => fetchAPI("/dashboard/open-ports"),
  getProtocols: () => fetchAPI("/dashboard/protocols"),
}

// Admin API
export const adminAPI = {
  // Users management
  getUsers: () => fetchAPI("/admin/users"),
  getUserDetails: (userId: string) => fetchAPI(`/admin/users/${userId}`),
  banUser: (userId: string, banData: { duration: number; reason: string }) =>
    fetchAPI(`/admin/users/${userId}/ban`, {
      method: "POST",
      body: JSON.stringify(banData),
    }),
  unbanUser: (userId: string) =>
    fetchAPI(`/admin/users/${userId}/unban`, {
      method: "POST",
    }),

  // Aggregated statistics
  getAggregatedStats: () => fetchAPI("/admin/stats/aggregated"),
  getScanTrends: () => fetchAPI("/admin/stats/scan-trends"),
  getFindingsByPort: () => fetchAPI("/admin/stats/findings-by-port"),
  getFindingsByService: () => fetchAPI("/admin/stats/findings-by-service"),
  getUserActivity: () => fetchAPI("/admin/stats/user-activity"),
  getTargetDistribution: () => fetchAPI("/admin/stats/target-distribution"),
  getReportGeneration: () => fetchAPI("/admin/stats/report-generation"),

  // System monitoring
  getSystemOverview: () => fetchAPI("/admin/system/overview"),
  getClusterStatus: () => fetchAPI("/admin/system/clusters"),
  getDeploymentStatus: () => fetchAPI("/admin/system/deployments"),
  getResourceUsage: () => fetchAPI("/admin/system/resources"),
  getNodeMetrics: () => fetchAPI("/admin/system/nodes"),
  getServiceHealth: () => fetchAPI("/admin/system/services"),
  getOpenFaasMetrics: () => fetchAPI("/admin/system/openfaas"),
}
