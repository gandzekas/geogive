// ===== AUTHENTICATION =====

function setupAuthListener() {
  var sb = getSupabase();
  if (!sb) return;
  var { data: { subscription } } = sb.auth.onAuthStateChange(async function(event, session) {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
      if (session) {
        window.state.session = session;
        window.state.user = session.user;
        await loadUserData();
        updateAuthUI();
        await loadItemsFromSupabase();
      }
    } else if (event === 'SIGNED_OUT') {
      window.state.session = null;
      window.state.user = null;
      window.state.userProfile = null;
      updateAuthUI();
    }
  });
  window.state.authListener = subscription;
}

async function checkSession() {
  var sb = getSupabase();
  if (!sb) return;

  var hash = window.location.hash || '';
  var params = new URLSearchParams(window.location.search || '');
  var hasAuthData = hash.includes('access_token') || hash.includes('error') || params.has('code') || params.has('error');

  // Verify CSRF nonce from OAuth callback
  if (params.has('state')) {
    if (!verifyNonce(params.get('state'))) {
      showToast('Security verification failed. Please try signing in again.');
      return;
    }
  }

  if (params.has('error') || hash.includes('error')) {
    var errorDesc = params.get('error_description') || params.get('error') || 'Authentication failed';
    try { errorDesc = decodeURIComponent(errorDesc); } catch(e) {}
    showToast('Sign-in error: ' + errorDesc);
    setTrackedTimeout(function() { history.replaceState(null, '', window.location.pathname); }, 3000);
    return;
  }

  if (hasAuthData) {
    try {
      var { data, error } = await withRetry(function() { return sb.auth.getSession(); }, { maxAttempts: 2, baseDelay: 1000 });
      if (error) {
        if (hash.includes('access_token')) {
          var hashParams = new URLSearchParams(hash.substring(1));
          var accessToken = hashParams.get('access_token');
          var refreshToken = hashParams.get('refresh_token');
          if (accessToken) {
            var { data: sessData, error: sessErr } = await sb.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || ''
            });
            if (!sessErr && sessData && sessData.session) {
              window.state.session = sessData.session;
              window.state.user = sessData.session.user;
              await loadUserData();
              updateAuthUI();
              history.replaceState(null, '', window.location.pathname);
              showToast('Signed in! 🎉');
      trackEvent('user_signed_in');
              return;
            }
          }
        }
      }
      if (data && data.session) {
        window.state.session = data.session;
        window.state.user = data.session.user;
        await loadUserData();
        updateAuthUI();
        history.replaceState(null, '', window.location.pathname);
        showToast('Signed in! 🎉');
      trackEvent('user_signed_in');
        return;
      }
    } catch(e) {
      console.warn('checkSession error:', e);
    }
    setTrackedTimeout(function() { history.replaceState(null, '', window.location.pathname); }, 3000);
  } else {
    try {
      var result = await withRetry(function() { return sb.auth.getSession(); }, { maxAttempts: 2, baseDelay: 1000 });
      var session = result.data ? result.data.session : null;
      if (session) {
        window.state.session = session;
        window.state.user = session.user;
        await loadUserData();
        updateAuthUI();
      }
    } catch(e) {
      console.warn('checkSession error:', e);
    }
  }
}

async function loadUserData() {
  var sb = getSupabase();
  if (!window.state.user || !sb) return;
  try {
    var { data: profile } = await sb.from('profiles').select('*').eq('id', window.state.user.id).single();
    if (profile) {
      window.state.userProfile = profile;
    } else {
      var email = window.state.user.email || '';
      var name = email.split('@')[0] || 'User';
      try {
        var { data: created } = await sb.from('profiles').upsert({
          id: window.state.user.id,
          display_name: name
        }).select().single();
        if (created) {
          window.state.userProfile = created;
        }
      } catch(profileErr) {
        console.warn('Profile auto-create failed:', profileErr);
      }
    }
  } catch(e) {
    console.warn('loadUserData error:', e);
  }
  updateAuthUI();
}

function updateAuthUI() {
  var loginBtn = document.getElementById('loginBtn');
  var logoutBtn = document.getElementById('logoutBtn');
  var userInfo = document.getElementById('userInfo');
  var headerName = document.getElementById('headerName');
  var headerAvatar = document.getElementById('headerAvatar');

  if (window.state.user) {
    if (loginBtn) loginBtn.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = '';
    if (userInfo) userInfo.style.display = '';
    var name = (window.state.userProfile && window.state.userProfile.display_name) || window.state.user.email.split('@')[0];
    var verified = window.state.user.email_confirmed_at || (window.state.userProfile && window.state.userProfile.verified);
    if (headerName) headerName.textContent = name + (verified ? ' ✓' : '');
    if (verified) headerName.style.color = 'var(--green)';
    if (headerAvatar) {
      if (window.state.userProfile && window.state.userProfile.avatar_url) {
        headerAvatar.innerHTML = '<img src="' + escHtml(window.state.userProfile.avatar_url) + '" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover">';
      } else {
        headerAvatar.textContent = name.charAt(0).toUpperCase();
      }
    }
  } else {
    if (loginBtn) loginBtn.style.display = '';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (userInfo) userInfo.style.display = 'none';
  }
}

function openAuthModal() {
  document.getElementById('authModalOverlay').style.display = 'flex';
  switchAuthTab('login');
}

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(function(t) {
    t.classList.remove('active');
    t.style.color = 'var(--gray-400)';
    t.style.fontWeight = 'normal';
  });
  var activeTab = document.querySelector('.auth-tab[data-tab="' + tab + '"]');
  if (activeTab) {
    activeTab.classList.add('active');
    activeTab.style.color = '';
    activeTab.style.fontWeight = '600';
  }

  var loginForm = document.getElementById('loginForm');
  var registerForm = document.getElementById('registerForm');
  if (loginForm) {
    loginForm.style.display = '';
    loginForm.classList.toggle('active', tab === 'login');
  }
  if (registerForm) {
    registerForm.style.display = '';
    registerForm.classList.toggle('active', tab === 'register');
  }

  var errEl = document.getElementById('authError');
  var errElReg = document.getElementById('authErrorReg');
  if (errEl) errEl.style.display = 'none';
  if (errElReg) errElReg.style.display = 'none';
}

async function handleGoogleAuth() {
  var sb = getSupabase();
  if (!sb) { showToast('Supabase not connected. Try again or refresh.'); return; }
  if (!SUPABASE_URL) { showToast('Supabase URL is not configured.'); return; }
  var redirectUrl = window.location.origin + window.location.pathname;
  var nonce = storeNonce();
  var authUrl = SUPABASE_URL.replace(/\/$/, '') + '/auth/v1/authorize?provider=google&redirect_to=' + encodeURIComponent(redirectUrl) + '&state=' + encodeURIComponent(nonce);
  closeModal('authModalOverlay');
  showToast('Redirecting to Google...');
  window.location.assign(authUrl);
}

window.handleGoogleAuth = handleGoogleAuth;

async function handleEmailAuth(e) {
  e.preventDefault();
  if (!rateLimit('auth_attempt', 3000)) {
    showToast('Please wait before trying again.');
    return;
  }
  var sb = getSupabase();
  if (!sb) { showAuthError('Supabase not connected. Try again or refresh.'); return; }

  var loginForm = document.getElementById('loginForm');
  var isRegister = loginForm && !loginForm.classList.contains('active');

  try {
    if (!isRegister) {
      var email = document.getElementById('loginEmail').value.trim();
      var password = document.getElementById('loginPassword').value;
      if (!email || !password) { showAuthError('Please enter both email and password.'); return; }
      if (!isValidEmail(email)) { showAuthError('Please enter a valid email address.'); return; }
      var { data, error } = await sb.auth.signInWithPassword({ email: email, password: password });
      if (error) {
        showAuthError(sanitizeError(error));
        return;
      }
      if (data.session) {
        window.state.session = data.session;
        window.state.user = data.session.user;
        await loadUserData();
        updateAuthUI();
      } else {
        var { data: sessionData } = await sb.auth.getSession();
        if (sessionData && sessionData.session) {
          window.state.session = sessionData.session;
          window.state.user = sessionData.session.user;
          await loadUserData();
          updateAuthUI();
        }
      }
    } else {
      var email = document.getElementById('registerEmail').value.trim();
      var password = document.getElementById('registerPassword').value;
      if (!email || !password) { showAuthErrorReg('Please enter both email and password.'); return; }
      if (!isValidEmail(email)) { showAuthErrorReg('Please enter a valid email address.'); return; }
      if (password.length < 8) { showAuthErrorReg('Password must be at least 8 characters.'); return; }
      if (!/[A-Z]/.test(password)) { showAuthErrorReg('Password needs at least one uppercase letter.'); return; }
      if (!/[0-9]/.test(password)) { showAuthErrorReg('Password needs at least one number.'); return; }
      if (password.length > 128) { showAuthErrorReg('Password is too long.'); return; }
      var { error } = await sb.auth.signUp({ email: email, password: password });
      if (error) {
        showAuthErrorReg(sanitizeError(error));
        return;
      }
      showAuthErrorReg('');
      var regSuccess = document.getElementById('authSuccessReg');
      if (regSuccess) {
        regSuccess.textContent = 'Account created! Check your email to confirm, then sign in.';
        regSuccess.style.display = 'block';
      }
      setTrackedTimeout(function() { switchAuthTab('login'); }, 2000);
      return;
    }
    closeModal('authModalOverlay');
    showToast(isRegister ? 'Account created! 🎉' : 'Welcome back! 🎉');
  } catch(e) {
    if (isRegister) {
      showAuthErrorReg(sanitizeError(e, 'registration'));
    } else {
      showAuthError(sanitizeError(e, 'sign in'));
    }
  }
}

async function handleLogout() {
  confirmAction('Are you sure you want to sign out?', async function() {
    var sb = getSupabase();
    if (sb) { try { await sb.auth.signOut(); } catch(e) { console.error('Logout error:', e); } }
    window.state.user = null;
    window.state.session = null;
    window.state.userProfile = null;
    updateAuthUI();
    showToast('Signed out.');
    switchPage('browse');
  });
}

function showAuthError(msg) {
  var el = document.getElementById('authError');
  if (el) { el.textContent = msg; el.style.display = msg ? 'block' : 'none'; }
}

function showAuthErrorReg(msg) {
  var el = document.getElementById('authErrorReg');
  if (el) { el.textContent = msg; el.style.display = msg ? 'block' : 'none'; }
}

function openSettingsModal() {
  var sb = getSupabase();
  document.getElementById('settingsSbUrl').value = SUPABASE_URL;
  document.getElementById('settingsSbKey').value = SUPABASE_KEY;
  document.getElementById('settingsModalOverlay').style.display = 'flex';
  initNotifToggles();
  if (typeof renderAnalyticsDashboard === 'function') renderAnalyticsDashboard();
}

function saveSettings() {
  var url = document.getElementById('settingsSbUrl').value.trim();
  var key = document.getElementById('settingsSbKey').value.trim();
  if (!url || !key) { showToast('Please enter both URL and Key.'); return; }
  try { var p = new URL(url); } catch(e) { showToast('Invalid URL format.'); return; }
  try { localStorage.setItem('geogive_sb_url', url); } catch(e) { showToast('Failed to save settings.'); return; }
  try { localStorage.setItem('geogive_sb_key', key); } catch(e) { showToast('Failed to save key.'); return; }
  SUPABASE_URL = url;
  SUPABASE_KEY = key;
  closeModal('settingsModalOverlay');
  if (window.state.authListener) window.state.authListener.unsubscribe();
  initSupabase();
  setupAuthListener();
  checkSession();
  loadItemsFromSupabase();
  showToast('Settings saved! Connecting...');
}
