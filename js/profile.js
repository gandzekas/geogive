function showUserProfile(userId) {
  // Find user's items and ratings
  var userItems = window.state.items.filter(function(i) { return i.ownerId === userId; });
  var userRatings = window.state.ratings[userId] || [];
  var avgRating = userRatings.length > 0 ? (userRatings.reduce(function(s,r) { return s+r; }, 0) / userRatings.length).toFixed(1) : 'New';
  var userName = userItems.length > 0 ? userItems[0].ownerName : 'User';
  var isVerified = (window.state.ratings[userId] && window.state.ratings[userId].length >= 3);

  var body = '';
  body += '<div class="user-profile-card">';
  body += '<div class="avatar">' + escHtml(userName.charAt(0).toUpperCase()) + '</div>';
  body += '<h3>' + escHtml(userName) + '</h3>';
  if (isVerified) body += '<span class="verified-badge">✓ Verified</span>';
  body += '<div class="stats">';
  body += '<div class="stat"><div class="stat-value">' + userItems.length + '</div><div class="stat-label">Items</div></div>';
  body += '<div class="stat"><div class="stat-value">' + avgRating + '</div><div class="stat-label">Rating</div></div>';
  body += '<div class="stat"><div class="stat-value">' + userRatings.length + '</div><div class="stat-label">Reviews</div></div>';
  body += '</div>';
  body += '<div style="display:flex;gap:8px;justify-content:center;margin-top:8px">';
  body += '<button class="report-btn" onclick="openReportModal(\'' + escHtml(userId) + '\')">🚩 Report</button>';
  body += '<button class="report-btn" onclick="toggleBlockUser(\'' + escHtml(userId) + '\');closeModal(\'itemModal\');">🚫 Block</button>';
  body += '</div>';
  body += '</div>';

  document.getElementById('modalTitle').textContent = 'User Profile';
  document.getElementById('modalBody').innerHTML = body;
  document.getElementById('itemModal').classList.add('active');
  setTimeout(function() { var btn = document.querySelector('#itemModal .modal-close'); if (btn) btn.focus(); }, 300);
}

function loadProfile() {
  if (!window.state.user) return;
  var saved = localStorage.getItem(PROFILE_KEY + window.state.user.id);
  if (saved) {
    try {
      window.state.userProfile = JSON.parse(saved);
    } catch(e) {
      window.state.userProfile = null;
    }
  }
  // Also fetch from Supabase for latest
  if (supabase) {
    window.supabaseClient.from('profiles').select('*').eq('id', window.state.user.id).single().then(function(result) {
      if (result.data) {
        window.state.userProfile = result.data;
        localStorage.setItem(PROFILE_KEY + window.state.user.id, JSON.stringify(result.data));
        updateHeaderProfile();
      }
    }).catch(function() { /* profiles table may not exist yet */ });
  }
}

function saveProfile(profileData) {
  if (!window.state.user) return;
  var profile = Object.assign({ id: window.state.user.id, updated_at: new Date().toISOString() }, profileData);
  window.state.userProfile = profile;
  localStorage.setItem(PROFILE_KEY + window.state.user.id, JSON.stringify(profile));
  if (supabase) {
    window.supabaseClient.from('profiles').upsert(profile).then(function() {});
  }
  updateHeaderProfile();
  showToast('Profile saved! ✓');
}

function updateHeaderProfile() {
  if (!window.state.user) return;
  var name = (window.state.userProfile && window.state.userProfile.display_name) || (window.state.user.email ? window.state.user.email.split('@')[0] : 'User');
  var avatar = window.state.userProfile && window.state.userProfile.avatar_url;
  var avatarEl = document.getElementById('userAvatarSmall');
  var nameEl = document.getElementById('userNameDisplay');
  if (avatarEl) {
    if (avatar) {
      avatarEl.innerHTML = '<img src="' + escHtml(avatar) + '" alt="">';
    } else {
      avatarEl.textContent = name.charAt(0).toUpperCase();
    }
  }
  if (nameEl) nameEl.textContent = name;
}

function openEditProfile() {
  if (!window.state.user) { openAuthModal(); return; }
  var prof = window.state.userProfile || {};
  var name = prof.display_name || (window.state.user.email ? window.state.user.email.split('@')[0] : '');
  var bio = prof.bio || '';
  var avatar = prof.avatar_url || '';
  var body = '';
  body += '<div class="profile-edit-card">';
  body += '<h3>✏️ Edit Profile</h3>';
  body += '<div class="avatar-preview" id="avatarPreview">';
  if (avatar) { body += '<img src="' + escHtml(avatar) + '" alt="">'; }
  else { body += escHtml(name.charAt(0).toUpperCase()); }
  body += '</div>';
  body += '<label for="profileAvatar">Avatar URL</label>';
  body += '<input type="text" id="profileAvatar" placeholder="https://..." value="' + escHtml(avatar) + '">';
  body += '<label for="profileName">Display Name</label>';
  body += '<input type="text" id="profileName" placeholder="Your name" value="' + escHtml(name) + '" maxlength="32">';
  body += '<label for="profileBio">Bio</label>';
  body += '<textarea id="profileBio" placeholder="A short bio..." maxlength="160">' + escHtml(bio) + '</textarea>';
  body += '<button class="btn btn-primary btn-full" onclick="submitProfileEdit()">Save Profile</button>';
  body += '</div>';
  document.getElementById('modalTitle').textContent = 'Edit Profile';
  document.getElementById('modalBody').innerHTML = body;
  document.getElementById('itemModal').classList.add('active');
  setTimeout(function() { var btn = document.querySelector('#itemModal .modal-close'); if (btn) btn.focus(); }, 300);
}

function submitProfileEdit() {
  var name = document.getElementById('profileName').value.trim();
  var bio = document.getElementById('profileBio').value.trim();
  var avatar = document.getElementById('profileAvatar').value.trim();
  if (!name) { showToast('Please enter a display name'); return; }
  saveProfile({ display_name: name, bio: bio, avatar_url: avatar });
  closeModal('itemModal');
}

function openReportModal(userId) {
  closeModal('itemModal');
  window.state.reportingUserId = userId;
  document.getElementById('reportModal').classList.add('active');
}

function submitReport() {
  var reason = document.getElementById('reportReason').value;
  var details = document.getElementById('reportDetails').value.trim();
  window.state.reports.push({ userId: window.state.reportingUserId, reason: reason, details: details, createdAt: Date.now() });
  localStorage.setItem('geogive_reports', JSON.stringify(window.state.reports));
  closeModal('reportModal');
  document.getElementById('reportReason').value = 'spam';
  document.getElementById('reportDetails').value = '';
  showToast('Report submitted. Thank you for keeping GeoGive safe.');
  window.state.reportingUserId = null;
}

function showRatingPrompt(itemId, userId) {
  var body = '';
  body += '<div class="rating-prompt">';
  body += '<h4>⭐ Rate your experience</h4>';
  body += '<p style="font-size:0.85rem;color:var(--gray-400);margin-bottom:12px;">How was your pickup?</p>';
  body += '<div class="star-rating" id="ratingStars">';
  for (var i = 1; i <= 5; i++) {
    body += '<span class="star" data-rating="' + i + '" onclick="submitRating(' + itemId + ',\'' + escHtml(userId) + '\',' + i + ')">★</span>';
  }
  body += '</div>';
  body += '<button class="btn btn-secondary btn-sm" onclick="closeModal(&#39;itemModal&#39;)" style="margin-top:8px">Skip</button>';
  body += '</div>';
  document.getElementById('modalTitle').textContent = 'Rate Experience';
  document.getElementById('modalBody').innerHTML = body;
  document.getElementById('itemModal').classList.add('active');
  setTimeout(function() { var btn = document.querySelector('#itemModal .modal-close'); if (btn) btn.focus(); }, 300);
}

function submitRating(itemId, userId, rating) {
  if (!window.state.user) return;
  // Check for duplicate: key = userId_itemId
  var ratingKey = userId + '_item_' + itemId;
  if (window.state.ratings[ratingKey]) return; // Already rated this item
  window.state.ratings[ratingKey] = { rating: rating, raterId: window.state.user.id, createdAt: Date.now() };
  // Also maintain aggregate array for profile display
  if (!window.state.ratings[userId]) window.state.ratings[userId] = [];
  window.state.ratings[userId].push(rating);
  localStorage.setItem('geogive_ratings', JSON.stringify(window.state.ratings));
  var item = findItem(itemId);
  if (item) item.rated = true;
  closeModal('itemModal');
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
  applyFilters(); // Re-filter to hide blocked users' items
}

function showSafetyTips() {
  if (localStorage.getItem('geogive_safety_shown')) return;
  var body = '';
  body += '<div class="safety-tips">';
  body += '<h4>🛡️ Safety Tips</h4>';
  body += '<ul>';
  body += '<li>Meet in public, well-lit places</li>';
  body += '<li>Bring a friend for high-value items</li>';
  body += '<li>Inspect items before taking</li>';
  body += '<li>Trust your instincts — if something feels off, walk away</li>';
  body += '<li>Report suspicious behavior</li>';
  body += '</ul>';
  body += '</div>';
  body += '<button class="btn btn-primary btn-full" onclick="closeModal(&#39;itemModal&#39;)">Got it!</button>';
  document.getElementById('modalTitle').textContent = 'Stay Safe';
  document.getElementById('modalBody').innerHTML = body;
  document.getElementById('itemModal').classList.add('active');
  localStorage.setItem('geogive_safety_shown', 'true');
}
