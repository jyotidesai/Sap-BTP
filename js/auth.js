/**
 * ============================================================
 * SAP BTP MASTERY PORTAL — AUTH MODULE
 * ============================================================
 * Handles JWT-based login/registration.
 * Runs before app.js — calls window.initApp(name) on success.
 * ============================================================
 */

const Auth = (() => {
  const TOKEN_KEY = 'btp_token';
  let _user = null;

  function getApiUrl() {
    return (typeof CONFIG !== 'undefined' && CONFIG.apiUrl) ? CONFIG.apiUrl : 'http://localhost:3001';
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function saveToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  function getUser() {
    return _user;
  }

  function isAuthenticated() {
    return _user !== null;
  }

  function logout() {
    clearToken();
    _user = null;
    localStorage.removeItem('btp_user_name');
    location.reload();
  }

  function startTokenRefresh() {
    // Refresh token every 6 days (token lasts 7 days)
    setInterval(async () => {
      const token = getToken();
      if (!token) return;
      try {
        const res = await fetch(`${getApiUrl()}/api/refresh`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          saveToken(data.token);
        }
      } catch (e) {}
    }, 6 * 24 * 60 * 60 * 1000);
  }

  // ── Modal UI ────────────────────────────────────────────────

  function showModal() {
    const overlay = document.createElement('div');
    overlay.id = 'auth-overlay';
    overlay.innerHTML = `
      <div class="auth-modal">
        <div class="auth-logo">SAP<span>BTP</span> Mastery</div>
        <p class="auth-tagline">Sign in to access your learning portal</p>

        <div class="auth-tabs">
          <button class="auth-tab active" id="tab-login" onclick="Auth._switchTab('login')">Sign In</button>
          <button class="auth-tab" id="tab-register" onclick="Auth._switchTab('register')">Register</button>
        </div>

        <!-- LOGIN FORM -->
        <form id="auth-login-form" class="auth-form" onsubmit="Auth._submitLogin(event)">
          <div class="auth-field">
            <label>Email</label>
            <input type="email" id="auth-login-email" placeholder="you@example.com" required autocomplete="email"/>
          </div>
          <div class="auth-field">
            <label>Password</label>
            <input type="password" id="auth-login-pass" placeholder="Your password" required autocomplete="current-password"/>
          </div>
          <div class="auth-error" id="auth-login-error"></div>
          <button type="submit" class="auth-submit" id="auth-login-btn">Sign In →</button>
        </form>

        <!-- REGISTER FORM -->
        <form id="auth-register-form" class="auth-form" style="display:none" onsubmit="Auth._submitRegister(event)">
          <div class="auth-field">
            <label>Full Name</label>
            <input type="text" id="auth-reg-name" placeholder="Your full name" required autocomplete="name" maxlength="60"/>
          </div>
          <div class="auth-field">
            <label>Email</label>
            <input type="email" id="auth-reg-email" placeholder="you@example.com" required autocomplete="email"/>
          </div>
          <div class="auth-field">
            <label>Password <span style="font-weight:400;font-size:11px;opacity:.6">(min 6 characters)</span></label>
            <input type="password" id="auth-reg-pass" placeholder="Create a password" required autocomplete="new-password" minlength="6"/>
          </div>
          <div class="auth-error" id="auth-reg-error"></div>
          <button type="submit" class="auth-submit" id="auth-reg-btn">Create Account →</button>
        </form>

      </div>`;
    document.body.appendChild(overlay);

    // Stop protect.js keyboard blocks from affecting modal inputs
    overlay.querySelectorAll('input').forEach(input => {
      input.addEventListener('keydown',     e => e.stopPropagation());
      input.addEventListener('selectstart', e => e.stopPropagation());
    });

    setTimeout(() => document.getElementById('auth-login-email').focus(), 120);
  }

  function hideModal() {
    const overlay = document.getElementById('auth-overlay');
    if (overlay) overlay.remove();
  }

  function setUserChip(name) {
    const chip = document.getElementById('userChip');
    if (chip) chip.textContent = name;
  }

  function _switchTab(tab) {
    const loginForm = document.getElementById('auth-login-form');
    const regForm   = document.getElementById('auth-register-form');
    const tabLogin  = document.getElementById('tab-login');
    const tabReg    = document.getElementById('tab-register');

    if (tab === 'login') {
      loginForm.style.display = '';
      regForm.style.display   = 'none';
      tabLogin.classList.add('active');
      tabReg.classList.remove('active');
      setTimeout(() => document.getElementById('auth-login-email').focus(), 50);
    } else {
      loginForm.style.display = 'none';
      regForm.style.display   = '';
      tabLogin.classList.remove('active');
      tabReg.classList.add('active');
      setTimeout(() => document.getElementById('auth-reg-name').focus(), 50);
    }
  }

  function setError(elId, msg) {
    const el = document.getElementById(elId);
    if (el) el.textContent = msg;
  }

  function setLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = loading;
    btn.textContent = loading ? 'Please wait…' : (btnId === 'auth-login-btn' ? 'Sign In →' : 'Create Account →');
  }

  // ── API Calls ───────────────────────────────────────────────

  async function _submitLogin(e) {
    e.preventDefault();
    setError('auth-login-error', '');
    setLoading('auth-login-btn', true);

    const email    = document.getElementById('auth-login-email').value.trim();
    const password = document.getElementById('auth-login-pass').value;

    try {
      const res  = await fetch(`${getApiUrl()}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (!res.ok) {
        setError('auth-login-error', data.error || 'Login failed.');
        setLoading('auth-login-btn', false);
        return;
      }

      saveToken(data.token);
      _user = data.user;
      localStorage.setItem('btp_user_name', _user.name);
      hideModal();
      setUserChip(_user.name);
      startTokenRefresh();
      if (typeof window.initApp === 'function') window.initApp(_user.name);

    } catch (err) {
      setError('auth-login-error', 'Cannot reach server. Is it running?');
      setLoading('auth-login-btn', false);
    }
  }

  async function _submitRegister(e) {
    e.preventDefault();
    setError('auth-reg-error', '');
    setLoading('auth-reg-btn', true);

    const name     = document.getElementById('auth-reg-name').value.trim();
    const email    = document.getElementById('auth-reg-email').value.trim();
    const password = document.getElementById('auth-reg-pass').value;

    try {
      const res  = await fetch(`${getApiUrl()}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();

      if (!res.ok) {
        setError('auth-reg-error', data.error || 'Registration failed.');
        setLoading('auth-reg-btn', false);
        return;
      }

      saveToken(data.token);
      _user = data.user;
      localStorage.setItem('btp_user_name', _user.name);
      hideModal();
      setUserChip(_user.name);
      startTokenRefresh();
      if (typeof window.initApp === 'function') window.initApp(_user.name);

    } catch (err) {
      setError('auth-reg-error', 'Cannot reach server. Is it running?');
      setLoading('auth-reg-btn', false);
    }
  }

  // ── Token Verification on Page Load ────────────────────────

  async function init() {
    const token = getToken();

    if (!token) {
      showModal();
      return;
    }

    try {
      const res  = await fetch(`${getApiUrl()}/api/verify`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();

      if (res.ok && data.valid) {
        _user = data.user;
        localStorage.setItem('btp_user_name', _user.name);
        setUserChip(_user.name);
        startTokenRefresh();
        if (typeof window.initApp === 'function') window.initApp(_user.name);
      } else {
        clearToken();
        showModal();
      }
    } catch (err) {
      // Server unreachable — fall back to cached name if available
      const cached = localStorage.getItem('btp_user_name');
      if (cached) {
        _user = { name: cached, email: '', id: '' };
        setUserChip(cached);
        if (typeof window.initApp === 'function') window.initApp(cached);
      } else {
        showModal();
      }
    }
  }

  function showChangePassword() {
    if (document.getElementById('chpw-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'chpw-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(10,12,20,.85);display:flex;align-items:center;justify-content:center';
    overlay.innerHTML = `
      <div style="background:var(--card-bg,#1a1d2e);border:1px solid var(--border,#2a2d3e);border-radius:16px;padding:36px;width:100%;max-width:380px;box-shadow:0 24px 64px rgba(0,0,0,.5)">
        <div style="font-size:17px;font-weight:700;color:var(--text1);margin-bottom:20px">Change Password</div>
        <div class="auth-field"><label>Current Password</label>
          <input type="password" id="chpw-cur" placeholder="Current password" style="width:100%;padding:10px 12px;border-radius:8px;border:1px solid var(--border,#2a2d3e);background:var(--bg2,#12141f);color:var(--text1);font-size:14px;box-sizing:border-box;outline:none"/>
        </div>
        <div class="auth-field"><label>New Password</label>
          <input type="password" id="chpw-new" placeholder="New password (min 6 chars)" style="width:100%;padding:10px 12px;border-radius:8px;border:1px solid var(--border,#2a2d3e);background:var(--bg2,#12141f);color:var(--text1);font-size:14px;box-sizing:border-box;outline:none"/>
        </div>
        <div id="chpw-error" style="min-height:18px;font-size:12px;color:#F75757;margin-bottom:12px"></div>
        <div style="display:flex;gap:10px">
          <button id="chpw-btn" onclick="Auth._submitChangePassword()"
            style="flex:1;padding:11px;border-radius:8px;border:none;background:#F4C542;color:#111;font-weight:700;cursor:pointer">Update Password</button>
          <button onclick="document.getElementById('chpw-overlay').remove()"
            style="padding:11px 18px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text2);cursor:pointer">Cancel</button>
        </div>
      </div>`;
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }

  async function _submitChangePassword() {
    const cur = document.getElementById('chpw-cur')?.value;
    const nw  = document.getElementById('chpw-new')?.value;
    const err = document.getElementById('chpw-error');
    const btn = document.getElementById('chpw-btn');
    if (!cur || !nw) { if (err) err.textContent = 'Both fields are required.'; return; }
    if (nw.length < 6) { if (err) err.textContent = 'New password must be at least 6 characters.'; return; }
    if (btn) { btn.disabled = true; btn.textContent = 'Updating…'; }
    try {
      const res = await fetch(`${getApiUrl()}/api/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify({ currentPassword: cur, newPassword: nw })
      });
      const data = await res.json();
      if (!res.ok) { if (err) err.textContent = data.error || 'Failed.'; if (btn) { btn.disabled = false; btn.textContent = 'Update Password'; } return; }
      document.getElementById('chpw-overlay')?.remove();
      alert('Password updated successfully!');
    } catch(e) {
      if (err) err.textContent = 'Cannot reach server.';
      if (btn) { btn.disabled = false; btn.textContent = 'Update Password'; }
    }
  }

  // Expose public API
  return { init, logout, getUser, getToken, isAuthenticated, showChangePassword, _switchTab, _submitLogin, _submitRegister, _submitChangePassword };
})();

// Kick off auth check when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', Auth.init);
} else {
  Auth.init();
}
