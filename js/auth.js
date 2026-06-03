// ===== AUTHENTICATION =====

function setupAuthListener() {
  var sb = getSupabase();
  if (!sb) return;
  var { data: { subscription } } = sb.auth.onAuthStateChanged(async function(event, session) {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      window.state.session = session;
      window.state.user = session.user;
      await loadUserData();
      updateAuthUI();
      await loadItemsFromSupabase();
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

  // Check for OAuth redirect data in URL (?code= or #access_token=)
  var hash = window.location.hash || '';
  var params = new URLSearchParams(window.location.search || '');
  var hasAuthData = hash.includes('access_token') || hash.includes('error') || params.has('code') || params.has('error');

  if (hasAuthData) {
    // Clean URL after session is established
    setTimeout(function() {
      history.replaceState(null, '', window.location.pathname);
    }, 2000);
  }

  try {
    // getSession() exchanges any code/token from URL for a real session
    var result = await sb.auth.getSession();
    var session = result.data ? result.data.session : null;
    var error = result.error;

    if (error) {
      console.warn('getSession error:', error);
    }

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

async function loadUserData() {
  var sb = getSupabase();
  if (!window.state.user || !sb) return;
  try {
    var { data: profile } = await sb.from('profiles').select('*').eq('id', window.state.user.id).single();
    if (profile) {
      window.state.userProfile = profile;
      updateAuthUI();
    }
  } catch(e) {}
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
    if (headerName) headerName.textContent = name;
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
  if (loginForm) loginForm.style.display = (tab === 'login') ? '' : 'none';
  if (registerForm) registerForm.style.display = (tab === 'register') ? '' : 'none';

  var errEl = document.getElementById('authError');
  var errElReg = document.getElementById('authErrorReg');
  if (errEl) errEl.style.display = 'none';
  if (errElReg) errElReg.style.display = 'none';
}

async function handleGoogleAuth() {
  var sb = getSupabase();
  if (!sb) { showAuthError('Supabase not connected. Check Settings.'); return; }
  closeModal('authModalOverlay');
  try {
    var redirectUrl = window.location.origin + window.location.pathname;
    var { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl
      }
    });
    if (error) throw error;
    // Page redirects to Google → Supabase callback → back here
    // checkSession() on page load will pick up the session
  } catch(e) { showAuthError(e.message); }
}

async function handleEmailAuth(e) {
  e.preventDefault();
  var sb = getSupabase();
  if (!sb) { showAuthError('Supabase not connected. Try again or refresh.'); return; }

  var loginForm = document.getElementById('loginForm');
  var isRegister = loginForm && loginForm.style.display === 'none';

  try {
    if (!isRegister) {
      var email = document.getElementById('loginEmail').value.trim();
      var password = document.getElementById('loginPassword').value;
      if (!email || !password) { showAuthError('Please enter both email and password.'); return; }
      var { error } = await sb.auth.signInWithPassword({ email: email, password: password });
      if (error) {
        if (error.message && error.message.toLowerCase().includes('confirm')) {
          showAuthError('Please confirm your email first. Check your inbox for the confirmation link.');
        } else if (error.message && error.message.toLowerCase().includes('invalid')) {
          showAuthError('Invalid email or password. Please try again.');
        } else {
          showAuthError(error.message || 'Sign in failed. Please try again.');
        }
        return;
      }
    } else {
      var email = document.getElementById('registerEmail').value.trim();
      var password = document.getElementById('registerPassword').value;
      if (!email || !password) { showAuthErrorReg('Please enter both email and password.'); return; }
      if (password.length < 6) { showAuthErrorReg('Password must be at least 6 characters.'); return; }
      var { error } = await sb.auth.signUp({ email: email, password: password });
      if (error) {
        showAuthErrorReg(error.message || 'Registration failed. Please try again.');
        return;
      }
      // Check if email confirmation is required
      showAuthErrorReg('');
      var regSuccess = document.getElementById('authSuccessReg');
      if (regSuccess) {
        regSuccess.textContent = 'Account created! Check your email to confirm, then sign in.';
        regSuccess.style.display = 'block';
      }
      // Switch to login tab after short delay
      setTimeout(function() { switchAuthTab('login'); }, 2000);
      return;
    }
    closeModal('authModalOverlay');
    showToast(isRegister ? 'Account created! 🎉' : 'Welcome back! 🎉');
  } catch(e) {
    if (isRegister) {
      showAuthErrorReg(e.message || 'Registration failed.');
    } else {
      showAuthError(e.message || 'Sign in failed.');
    }
  }
}

async function handleLogout() {
  var sb = getSupabase();
  if (sb) { try { await sb.auth.signOut(); } catch(e) {} }
  window.state.user = null;
  window.state.session = null;
  window.state.userProfile = null;
  updateAuthUI();
  showToast('Signed out.');
  switchPage('browse');
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
}

function saveSettings() {
  var url = document.getElementById('settingsSbUrl').value.trim();
  var key = document.getElementById('settingsSbKey').value.trim();
  if (!url || !key) { showToast('Please enter both URL and Key.'); return; }
  try { var p = new URL(url); } catch(e) { showToast('Invalid URL format.'); return; }
  localStorage.setItem('geogive_sb_url', url);
  localStorage.setItem('geogive_sb_key', key);
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
