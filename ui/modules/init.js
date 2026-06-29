// ===== INIT MODULE v1.1.0 =====
// Contract: ui/contracts/UI_CONTRACTS.md
// Entry point: checks for existing auth token and restores session.

(async function init() {
  if (!authToken) return; // login screen is visible by default

  // Restore token expiry from stored token
  if (typeof decodeJwtExp === 'function') {
    tokenExpiry = decodeJwtExp(authToken);
  }

  try {
    const { data } = await API.get('/api/auth/me');
    currentUser = data;
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');
    const userDisplay = document.getElementById('user-display');
    if (userDisplay) userDisplay.textContent = data.name || data.email;
    const avatar = document.getElementById('user-avatar');
    if (avatar) avatar.textContent = (data.name || data.email || '?').charAt(0).toUpperCase();
    navigate('summary');
  } catch (e) {
    // Token expired or invalid
    logout();
  }
})();