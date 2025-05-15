export function apiFetch(url, options = {}, token) {
    // Only add the Authorization header for /api/ requests
    const isApi = url.startsWith("/api/");
    const headers = {
      ...(options.headers || {}),
      ...(isApi && token ? { Authorization: `Bearer ${token}` } : {}),
    };
  
    return fetch(url, {
      ...options,
      headers,
    });
  }