// Shared auth/API helper for the static frontend.
// This version assumes the frontend is served from the same FastAPI app.
//
// Required backend endpoints:
// - POST /auth/login
// - POST /auth/refresh
// - POST /auth/logout
// - GET  /api/history
// - POST /api/predict

const API_BASE_URL = "";

const ACCESS_TOKEN_KEY = "xpressnet_access_token";
const REFRESH_TOKEN_KEY = "xpressnet_refresh_token";
const EMAIL_KEY = "xpressnet_email";

function getToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

function getEmail() {
  return localStorage.getItem(EMAIL_KEY);
}

function setEmail(email) {
  localStorage.setItem(EMAIL_KEY, email);
}

function setTokens(accessToken, refreshToken) {
  if (accessToken) {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  }
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

function clearSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(EMAIL_KEY);
}

function requireAuth() {
  if (!getToken()) {
    window.location.href = "/static/login.html";
    return false;
  }
  return true;
}

async function logout() {
  const refreshToken = getRefreshToken();

  if (refreshToken) {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch {
      // Ignore logout network failures and still clear local session.
    }
  }

  clearSession();
  window.location.href = "/static/login.html";
}

async function tryRefreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) return false;

    const data = await response.json();
    setTokens(data.access_token, data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

async function apiFetch(path, options = {}, isRetry = false) {
  const headers = new Headers(options.headers || {});
  const token = getToken();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && !isRetry) {
    const refreshed = await tryRefreshAccessToken();
    if (refreshed) {
      return apiFetch(path, options, true);
    }

    clearSession();
    window.location.href = "/static/login.html";
    throw new Error("Session expired");
  }

  return response;
}
