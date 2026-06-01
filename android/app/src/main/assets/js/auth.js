function setupAuthListener() {
  if (!supabase) return;
  var { data: { subscription } } = window.supabaseClient.auth.onAuthStateChanged(async function(event, session) {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      window.state.session = session;
      window.state.user = session.user;
      await loadUserData();
      updateAuthUI();
      await loadItemsFromSupabase();
      setupRealtimeSubscriptions();
    } else if (event === 'SIGNED_OUT') {
      window.state.session = null; window.state.user = null; window.state.userProfile = null;
      // Clean up realtime subscriptions on sign out
      if (window.state.itemsChannel) { try { window.supabaseClient.removeChannel(window.state.itemsChannel); } catch(e) {} window.state.itemsChannel = null; }
      if (window.state.requestsChannel) { try { window.supabaseClient.removeChannel(window.state.requestsChannel); } catch(e) {} window.state.requestsChannel = null; }
      updateAuthUI();
    }
  });
  window.state.authListener = subscription;
}

async function checkSession() {
  if (!supabase) return;
  // Manual PKCE exchange: check URL hash for auth code from Google OAuth redirect
  var hash = location.hash;
  if (hash && hash.includes('code=')) {
    try {
      var codeMatch = hash.match(/code=([^&]+)/);
      if (codeMatch) {
        var code = decodeURIComponent(codeMatch[1]);
        var storageKey = window.supabaseClient.auth.storageKey || 'sb-tfqrgytmlppgovgvyaor-auth-token';
        var verifier = localStorage.getItem(storageKey + '-code-verifier');
        if (verifier) {
          var resp = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=authorization_code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ auth_code: code, code_verifier: verifier })
          });
          var tokens = await resp.json();
          if (tokens.access_token) {
            var { data: { session }, error } = await window.supabaseClient.auth.setSession({
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token
            });
            if (session) {
              window.state.session = session; window.state.user = session.user;
              localStorage.removeItem(storageKey + '-code-verifier');
              await loadUserData(); updateAuthUI();
              history.replaceState(null, '', location.pathname + location.search);
              return;
            }
          }
        }
      }
    } catch(e) { console.warn('GeoGive: PKCE exchange error', e); }
  }
  // Standard session recovery via initialize()
  try {
    var { data: { session } } = await window.supabaseClient.auth.initialize();
    if (session) { window.state.session = session; window.state.user = session.user; await loadUserData(); updateAuthUI(); return; }
  } catch(e) { console.warn('GeoGive: initialize error', e); }
  // Fallback: getSession retries
  for (var i = 0; i < 5; i++) {
    try {
      var { data: { session } } = await window.supabaseClient.auth.getSession();
      if (session) { window.state.session = session; window.state.user = session.user; await loadUserData(); updateAuthUI(); return; }
    } catch(e) {}
    await new Promise(function(r) { setTimeout(r, 300); });
  }
}

async function loadUserData() {
  if (!window.state.user) return;
  try {
    var { data: profile } = await window.supabaseClient.from('profiles').select('*').eq('id', window.state.user.id).single();
    if (profile) { window.state.userProfile = profile; updateAuthUI(); }
  } catch(e) {}
}

function updateAuthUI() {
  var authButtons = document.getElementById('authButtons');
  var userInfo = document.getElementById('userInfo');
  if (window.state.user) {
    authButtons.style.display = 'none'; userInfo.style.display = 'flex';
    var name = (window.state.userProfile && window.state.userProfile.display_name) || window.state.user.email.split('@')[0];
    document.getElementById('userNameDisplay').textContent = name;
    var avatar = document.getElementById('userAvatarSmall');
    if (window.state.userProfile && window.state.userProfile.avatar_url) {
      avatar.innerHTML = '<img src="' + escHtml(window.state.userProfile.avatar_url) + '" alt="">';
    } else {
      avatar.textContent = name.charAt(0).toUpperCase();
    }
  } else {
    authButtons.style.display = ''; userInfo.style.display = 'none';
  }
}

function openAuthModal() {
  document.getElementById('authModal').classList.add('active');
  document.getElementById('authError').style.display = 'none';
  document.getElementById('signinEmail').focus();
}

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(function(t) { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
  document.getElementById('tab-' + tab).classList.add('active');
  document.getElementById('tab-' + tab).setAttribute('aria-selected', 'true');
  document.querySelectorAll('.auth-form').forEach(function(f) { f.classList.remove('active'); });
  document.getElementById(tab + 'Form').classList.add('active');
  document.getElementById('authError').style.display = 'none';
}

async function handleGoogleAuth() {
  if (!supabase) { showAuthError('Supabase not connected. Check Settings or refresh page.'); return; }
  var btn = document.getElementById('googleBtn');
  btn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px;margin:0"></div> Connecting...';
  btn.disabled = true;
  try {
    var { error } = await window.supabaseClient.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } });
    if (error) throw error;
  } catch(e) { btn.innerHTML = '<span>🔵</span> Continue with Google'; btn.disabled = false; showAuthError(e.message); }
}

async function handleEmailAuth(e, type) {
  e.preventDefault();
  if (!supabase) { showAuthError('Supabase not connected. Try again or refresh.'); return; }
  var btn = document.getElementById(type + 'SubmitBtn');
  var orig = btn.textContent;
  btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;margin:0 8px 0 0;display:inline-block;vertical-align:middle"></div>Please wait...';
  btn.disabled = true;
  try {
    if (type === 'signin') {
      var { error } = await window.supabaseClient.auth.signInWithPassword({ email: document.getElementById('signinEmail').value.trim(), password: document.getElementById('signinPassword').value });
      if (error) throw error;
    } else {
      var email = document.getElementById('signupEmail').value.trim();
      var password = document.getElementById('signupPassword').value;
      var name = document.getElementById('signupName').value.trim();
      var zip = document.getElementById('signupZip').value.trim();
      var { data: authData, error } = await window.supabaseClient.auth.signUp({ email: email, password: password, options: { data: { display_name: name, zip: zip } } });
      if (error) throw error;
      if (authData.user) {
        await window.supabaseClient.from('profiles').upsert({ id: authData.user.id, display_name: name, zip: zip, email: email, updated_at: new Date().toISOString() });
      }
    }
    closeModal('authModal');
    showToast(type === 'signin' ? 'Welcome back! 🎉' : 'Account created! 🎉');
  } catch(e) { btn.textContent = orig; btn.disabled = false; showAuthError(e.message); }
}

async function handleLogout() {
  if (supabase) { try { await window.supabaseClient.auth.signOut(); } catch(e) {} }
  window.state.user = null; window.state.session = null; window.state.userProfile = null;
  updateAuthUI(); showToast('Signed out.'); switchPage('browse');
}

function showAuthError(msg) { var el = document.getElementById('authError'); el.textContent = msg; el.style.display = 'block'; }

function openSettingsModal() {
  document.getElementById('settingsSbUrl').value = SUPABASE_URL;
  document.getElementById('settingsSbKey').value = SUPABASE_KEY;
  document.getElementById('settingsStatus').textContent = supabase ? '✅ Connected' : '⚠️ Not connected';
  document.getElementById('settingsModal').classList.add('active');
}

function saveSettings() {
  var url = document.getElementById('settingsSbUrl').value.trim();
  var key = document.getElementById('settingsSbKey').value.trim();
  if (!url || !key) { showToast('Please enter both URL and Key.'); return; }
  try { var p = new URL(url); if (!p.hostname.endsWith('.window.supabaseClient.co') && !p.hostname.endsWith('.window.supabaseClient.in') && p.hostname !== 'localhost') { showToast('URL should be a Supabase project URL.'); return; } } catch(e) { showToast('Invalid URL format.'); return; }
  localStorage.setItem('geogive_sb_url', url); localStorage.setItem('geogive_sb_key', key);
  SUPABASE_URL = url; SUPABASE_KEY = key;
  closeModal('settingsModal');
  if (window.state.authListener) window.state.authListener.unsubscribe();
  initSupabase(); setupAuthListener(); checkSession(); loadItemsFromSupabase();
  showToast('Settings saved! Connecting...');
}

function clearSettings() {
  localStorage.removeItem('geogive_sb_url'); localStorage.removeItem('geogive_sb_key');
  var sb = supabase; // Save reference before nulling
  SUPABASE_URL = ''; SUPABASE_KEY = ''; supabase = null;
  if (window.state.authListener) window.state.authListener.unsubscribe(); window.state.authListener = null;
  if (window.state.itemsChannel) { sb && sb.removeChannel(window.state.itemsChannel); window.state.itemsChannel = null; }
  if (window.state.requestsChannel) { sb && sb.removeChannel(window.state.requestsChannel); window.state.requestsChannel = null; }
  window.state.user = null; window.state.session = null; window.state.userProfile = null;
  updateAuthUI(); closeModal('settingsModal'); loadItemsFromStorage(); showToast('Disconnected. Using local mode.');
}
