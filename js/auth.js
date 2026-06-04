// ===== AUTHENTICATION =====

// ===== DEBUG LOGGING =====
function dbg(msg) {
  try {
    var panel = document.getElementById('debugPanel');
    if (panel) {
      var line = document.createElement('div');
      line.textContent = new Date().toLocaleTimeString() + ' ' + msg;
      panel.appendChild(line);
      if (panel.children.length > 10) panel.removeChild(panel.firstChild);
    }
  } catch(e) {}
  console.log('[GeoGive]', msg);
}

function setupAuthListener() {
  var sb = getSupabase();
  if (!sb) { dbg('setupAuthListener: no supabase client'); return; }
  dbg('setupAuthListener: OK');
  var { data: { subscription } } = sb.auth.onAuthStateChanged(async function(event, session) {
    dbg('auth event: ' + event + ' session=' + (session ? 'yes' : 'no'));
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
      if (session) {
        window.state.session = session;
        window.state.user = session.user;
        dbg('user: ' + session.user.email);
        await loadUserData();
        updateAuthUI();
        await loadItemsFromSupabase();
      } else {
        dbg('event=' + event + ' but no session');
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
  if (!sb) { dbg('checkSession: no supabase client'); return; }

  var hash = window.location.hash || '';
  var params = new URLSearchParams(window.location.search || '');
  var hasAuthData = hash.includes('access_token') || hash.includes('error') || params.has('code') || params.has('error');
  dbg('checkSession: hash=' + hash.substring(0,80) + ' hasAuthData=' + hasAuthData);

  // If URL has hash fragment with auth data, let Supabase process it
  if (hasAuthData) {
    dbg('checkSession: URL has auth data, exchanging for session...');
    try {
      // Supabase v2 can exchange hash tokens for a session
      var { data, error } = await sb.auth.getSession();
      if (error) {
        dbg('checkSession: getSession error: ' + error.message);
        // Try exchanging the hash fragment directly
        if (hash.includes('access_token')) {
          dbg('checkSession: attempting hash exchange...');
          var hashParams = new URLSearchParams(hash.substring(1));
          var accessToken = hashParams.get('access_token');
          var refreshToken = hashParams.get('refresh_token');
          if (accessToken) {
            var { data: sessData, error: sessErr } = await sb.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || ''
            });
            if (sessErr) {
              dbg('checkSession: setSession error: ' + sessErr.message);
            } else if (sessData && sessData.session) {
              dbg('checkSession: setSession SUCCESS for ' + sessData.session.user.email);
              window.state.session = sessData.session;
              window.state.user = sessData.session.user;
              await loadUserData();
              updateAuthUI();
              // Clean up URL
              history.replaceState(null, '', window.location.pathname);
              showToast('Signed in! 🎉');
              return;
            }
          }
        }
      }
      if (data && data.session) {
        dbg('checkSession: got session for ' + data.session.user.email);
        window.state.session = data.session;
        window.state.user = data.session.user;
        await loadUserData();
        updateAuthUI();
        history.replaceState(null, '', window.location.pathname);
        showToast('Signed in! 🎉');
        return;
      }
    } catch(e) {
      dbg('checkSession: exception: ' + e.message);
    }
    // Clean up URL even on failure
    setTimeout(function() { history.replaceState(null, '', window.location.pathname); }, 1000);
  } else {
    // No hash — just check for existing session
    try {
      var result = await sb.auth.getSession();
      var session = result.data ? result.data.session : null;
      if (session) {
        dbg('checkSession: existing session for ' + session.user.email);
        window.state.session = session;
        window.state.user = session.user;
        await loadUserData();
        updateAuthUI();
      } else {
        dbg('checkSession: no session');
      }
    } catch(e) {
      dbg('checkSession exception: ' + e.message);
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
      // Auto-create profile for new users (e.g., Google sign-in)
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
        // RLS may block insert — that's OK, use fallback
        console.warn('Profile auto-create failed:', profileErr);
      }
    }
  } catch(e) {
    // Profile operations failed — use fallback
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
  dbg('handleGoogleAuth: clicked');
  var sb = getSupabase();
  if (!sb) { dbg('handleGoogleAuth: no supabase client'); showAuthError('Supabase not connected. Check Settings.'); return; }
  closeModal('authModalOverlay');
  var redirectUrl = window.location.origin + window.location.pathname;
  dbg('handleGoogleAuth: redirectUrl=' + redirectUrl);
  // Use direct authorize endpoint — signInWithOAuth can be unreliable on mobile web
  var authUrl = 'https://tfqrgytmlppgovgvyaor.supabase.co/auth/v1/authorize?provider=google&redirect_to=' + encodeURIComponent(redirectUrl);
  dbg('handleGoogleAuth: navigating to authorize endpoint');
  window.location.href = authUrl;
}

async function handleEmailAuth(e) {
  e.preventDefault();
  var sb = getSupabase();
  if (!sb) { showAuthError('Supabase not connected. Try again or refresh.'); return; }

  var loginForm = document.getElementById('loginForm');
  var isRegister = loginForm && !loginForm.classList.contains('active');

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
