// ===== API MODULE v1.0.0 =====
// Contract: ui/contracts/UI_CONTRACTS.md
// Exposes: API, authToken, currentUser, setAuth, logout, handleLogin

// ===== AUTH STATE =====
let authToken = localStorage.getItem('pb_token') || null;
let currentUser = null;

// ===== AUTH FUNCTIONS =====
function setAuth(token, user) {
  authToken = token;
  currentUser = user;
  localStorage.setItem('pb_token', token);
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
  localStorage.removeItem('pb_token');
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
  } catch (err) {
    errEl.textContent = 'Network error: ' + (err?.message || 'Unknown');
    errEl.classList.remove('hidden');
  }
}

// ===== API HELPER =====
const API = {
  async get(path) {
    const headers = {};
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    const res = await fetch(path, { headers });
    if (res.status === 401) { logout(); throw new Error('Session expired'); }
    if (!res.ok) throw new Error(await res.text().catch(() => 'Request failed'));
    return res.json();
  },

  async post(path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    const res = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body) });
    if (res.status === 401) { logout(); throw new Error('Session expired'); }
    if (!res.ok) throw new Error(await res.text().catch(() => 'Request failed'));
    return res.json();
  },

  async put(path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    const res = await fetch(path, { method: 'PUT', headers, body: JSON.stringify(body) });
    if (res.status === 401) { logout(); throw new Error('Session expired'); }
    if (!res.ok) throw new Error(await res.text().catch(() => 'Request failed'));
    return res.json();
  },

  async del(path) {
    const headers = {};
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    const res = await fetch(path, { method: 'DELETE', headers });
    if (res.status === 401) { logout(); throw new Error('Session expired'); }
    if (!res.ok) throw new Error(await res.text().catch(() => 'Request failed'));
    return res.json();
  },
};