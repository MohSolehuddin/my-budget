// ===== API MODULE v1.1.0 =====
// Contract: ui/contracts/UI_CONTRACTS.md
// Exposes: API, authToken, currentUser, setAuth, logout, handleLogin

// ===== AUTH STATE =====
let authToken = localStorage.getItem('pb_token') || null;
let currentUser = null;
let tokenExpiry = null;

// Decode JWT exp without external libs
function decodeJwtExp(token) {
  try {
    const payload = token.split('.')[1];
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - b64.length % 4) % 4);
    const json = JSON.parse(atob(padded));
    return json.exp ? json.exp * 1000 : null; // Convert to ms
  } catch { return null; }
}

// Check if token will expire within next 60 seconds
function tokenNeedsRefresh() {
  if (!authToken || !tokenExpiry) return false;
  return (tokenExpiry - Date.now()) < 60000;
}

// Refresh token by re-authenticating with stored credentials
async function refreshToken() {
  const savedEmail = localStorage.getItem('pb_email');
  const savedPass = localStorage.getItem('pb_pass');
  if (!savedEmail || !savedPass) return false;
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: savedEmail, password: savedPass }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    authToken = data.data.token;
    tokenExpiry = decodeJwtExp(authToken);
    localStorage.setItem('pb_token', authToken);
    currentUser = data.data.user;
    return true;
  } catch { return false; }
}

// Ensure token is valid before making API call
async function ensureValidToken() {
  if (!authToken) return;
  if (tokenNeedsRefresh()) {
    const ok = await refreshToken();
    if (!ok) { logout(); throw new Error('Session expired'); }
  }
}

// ===== AUTH FUNCTIONS =====
function setAuth(token, user) {
  authToken = token;
  currentUser = user;
  tokenExpiry = decodeJwtExp(token);
  localStorage.setItem('pb_token', token);
  if (user.email) localStorage.setItem('pb_email', user.email);
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
  document.getElementById('user-display').textContent = user.name || user.email;
  const avatar = document.getElementById('user-avatar');
  if (avatar) avatar.textContent = (user.name || user.email || '?').charAt(0).toUpperCase();
  navigate('summary');
}

function logout() {
  authToken = null;
  currentUser = null;
  tokenExpiry = null;
  localStorage.removeItem('pb_token');
  localStorage.removeItem('pb_email');
  localStorage.removeItem('pb_pass');
  document.getElementById('app-screen').classList.add('hidden');
  document.getElementById('auth-screen').classList.remove('hidden');
  const form = document.getElementById('login-form');
  if (form) form.reset();
}

async function handleLogin(e) {
  e.preventDefault();
  const f = e.target;
  const errEl = document.getElementById('login-error');
  errEl.classList.add('hidden');
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: f.email.value, password: f.password.value }),
    });
    const data = await res.json();
    if (!res.ok) {
      errEl.textContent = data.error || 'Login failed';
      errEl.classList.remove('hidden');
      return;
    }
    setAuth(data.data.token, data.data.user);
    // Save credentials for silent token refresh (token expires in 5 days)
    localStorage.setItem('pb_pass', f.password.value);
  } catch (err) {
    errEl.textContent = 'Network error: ' + (err?.message || 'Unknown');
    errEl.classList.remove('hidden');
  }
}

// ===== API HELPER =====
const API = {
  async get(path) {
    await ensureValidToken();
    const headers = {};
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    const res = await fetch(path, { headers });
    if (res.status === 401) { logout(); throw new Error('Session expired'); }
    if (!res.ok) throw new Error(await res.text().catch(() => 'Request failed'));
    return res.json();
  },

  async post(path, body) {
    await ensureValidToken();
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    const res = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body) });
    if (res.status === 401) { logout(); throw new Error('Session expired'); }
    if (!res.ok) throw new Error(await res.text().catch(() => 'Request failed'));
    return res.json();
  },

  async put(path, body) {
    await ensureValidToken();
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    const res = await fetch(path, { method: 'PUT', headers, body: JSON.stringify(body) });
    if (res.status === 401) { logout(); throw new Error('Session expired'); }
    if (!res.ok) throw new Error(await res.text().catch(() => 'Request failed'));
    return res.json();
  },

  async del(path) {
    await ensureValidToken();
    const headers = {};
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    const res = await fetch(path, { method: 'DELETE', headers });
    if (res.status === 401) { logout(); throw new Error('Session expired'); }
    if (!res.ok) throw new Error(await res.text().catch(() => 'Request failed'));
    return res.json();
  },
};