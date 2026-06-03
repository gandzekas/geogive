// ===== PROFILE =====

function showUserProfile(userId) {
  var userItems = window.state.items.filter(function(i) { return i.ownerId === userId; });
  var userName = userItems.length > 0 ? userItems[0].ownerName : 'User';

  var content = document.getElementById('itemModalContent');
  if (!content) return;

  var body = '';
  body += '<div style="padding:16px">';
  body += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
  body += '<h3 style="margin:0">' + escHtml(userName) + '</h3>';
  body += '<button onclick="closeModal(\'itemModalOverlay\')" style="background:none;border:none;font-size:1.5rem;cursor:pointer">✕</button>';
  body += '</div>';
  body += '<div style="text-align:center;margin-bottom:16px">';
  body += '<div style="width:64px;height:64px;border-radius:50%;background:var(--green);color:white;display:inline-flex;align-items:center;justify-content:center;font-size:2rem">' + escHtml(userName.charAt(0).toUpperCase()) + '</div>';
  body += '</div>';
  body += '<p style="text-align:center;color:#666">' + userItems.length + ' items listed</p>';
  body += '</div>';
  content.innerHTML = body;
  document.getElementById('itemModalOverlay').style.display = 'flex';
}

function loadProfile() {
  if (!window.state.user) return;
  var sb = getSupabase();
  if (sb) {
    sb.from('profiles').select('*').eq('id', window.state.user.id).single().then(function(result) {
      if (result.data) {
        window.state.userProfile = result.data;
        updateHeaderProfile();
      }
    }).catch(function() {});
  }
}

function saveProfile(profileData) {
  if (!window.state.user) return;
  var profile = Object.assign({ id: window.state.user.id, updated_at: new Date().toISOString() }, profileData);
  window.state.userProfile = profile;
  localStorage.setItem(PROFILE_KEY + window.state.user.id, JSON.stringify(profile));
  var sb = getSupabase();
  if (sb) {
    sb.from('profiles').upsert(profile).then(function() {});
  }
  updateHeaderProfile();
  showToast('Profile saved! ✓');
}

function updateHeaderProfile() {
  if (!window.state.user) return;
  var name = (window.state.userProfile && window.state.userProfile.display_name) || (window.state.user.email ? window.state.user.email.split('@')[0] : 'User');
  var avatar = window.state.userProfile && window.state.userProfile.avatar_url;
  var avatarEl = document.getElementById('headerAvatar');
  var nameEl = document.getElementById('headerName');
  if (avatarEl) {
    if (avatar) {
      avatarEl.innerHTML = '<img src="' + escHtml(avatar) + '" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover">';
    } else {
      avatarEl.textContent = name.charAt(0).toUpperCase();
    }
  }
  if (nameEl) nameEl.textContent = name;
}

function openReportModal(userId) {
  closeModal('itemModalOverlay');
  showToast('Report feature coming soon');
}

function submitReport() {
  showToast('Report submitted. Thank you.');
}

function showRatingPrompt(itemId, userId) {
  showToast('Rating feature coming soon');
}

function submitRating(itemId, userId, rating) {
  showToast('Thanks for rating! ⭐');
}

function isUserBlocked(userId) {
  return window.state.blockedUsers.indexOf(userId) !== -1;
}

function toggleBlockUser(userId) {
  if (isUserBlocked(userId)) {
    window.state.blockedUsers = window.state.blockedUsers.filter(function(id) { return id !== userId; });
    showToast('User unblocked.');
  } else {
    window.state.blockedUsers.push(userId);
    showToast('User blocked.');
  }
  localStorage.setItem('geogive_blocked', JSON.stringify(window.state.blockedUsers));
  applyFilters();
}

function showSafetyTips() {
  if (localStorage.getItem('geogive_safety_shown')) return;
  localStorage.setItem('geogive_safety_shown', 'true');
  showToast('🛡️ Safety tips: Meet in public, bring a friend!');
}

function submitProfileEdit() {
  var name = document.getElementById('profileName') ? document.getElementById('profileName').value.trim() : '';
  if (!name) { showToast('Please enter a display name'); return; }
  saveProfile({ display_name: name });
  closeModal('itemModalOverlay');
}

function renderProfile() {
  var container = document.getElementById('profileContent');
  if (!container) return;
  if (!window.state.user) {
    container.innerHTML = '<div class="empty-state"><p>Please sign in to view your profile.</p></div>';
    return;
  }
  var name = (window.state.userProfile && window.state.userProfile.display_name) || window.state.user.email.split('@')[0];
  var bio = (window.state.userProfile && window.state.userProfile.bio) || '';
  var html = '';
  html += '<div style="text-align:center;padding:20px">';
  html += '<div style="width:80px;height:80px;border-radius:50%;background:var(--green);color:white;display:inline-flex;align-items:center;justify-content:center;font-size:2rem;margin-bottom:12px">' + escHtml(name.charAt(0).toUpperCase()) + '</div>';
  html += '<h3>' + escHtml(name) + '</h3>';
  if (bio) html += '<p style="color:#666;margin-top:8px">' + escHtml(bio) + '</p>';
  html += '<p style="color:#999;font-size:0.85rem;margin-top:8px">' + escHtml(window.state.user.email) + '</p>';
  html += '</div>';
  container.innerHTML = html;
}
