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
  body += '<button data-fn="closeModal" data-arg="itemModalOverlay" style="background:none;border:none;font-size:1.5rem;cursor:pointer">✕</button>';
  body += '</div>';
  body += '<div style="text-align:center;margin-bottom:16px">';
  body += '<div style="width:64px;height:64px;border-radius:50%;background:var(--green);color:white;display:inline-flex;align-items:center;justify-content:center;font-size:2rem">' + escHtml(userName.charAt(0).toUpperCase()) + '</div>';
  body += '</div>';
  body += '<p style="text-align:center;color:#666">' + userItems.length + ' items listed</p>';
  body += '</div>';
  content.innerHTML = body;
  document.getElementById('itemModalOverlay').style.display = 'flex';
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

function openReportModal(userId, itemId) {
  closeModal('itemModalOverlay');
  if (!window.state.user) { openAuthModal(); showToast('Please sign in to report.'); return; }
  window.state.reportTarget = { userId: userId, itemId: itemId };
  document.getElementById('reportReason').value = 'spam';
  document.getElementById('reportDetails').value = '';
  document.getElementById('reportError').style.display = 'none';
  document.getElementById('reportModalOverlay').style.display = 'flex';
}

async function submitReport() {
  if (!window.state.user || !window.state.reportTarget) return;
  var reason = document.getElementById('reportReason').value;
  var details = document.getElementById('reportDetails').value.trim();
  var errEl = document.getElementById('reportError');
  errEl.style.display = 'none';

  var sb = getSupabase();
  if (!sb) { errEl.textContent = 'Not connected to server.'; errEl.style.display = 'block'; return; }

  try {
    var { error } = await sb.from('reports').insert({
      reporter_id: window.state.user.id,
      reported_id: window.state.reportTarget.userId || null,
      item_id: window.state.reportTarget.itemId || null,
      reason: reason,
      description: details || null,
      status: 'pending',
      created_at: new Date().toISOString()
    });
    if (error) throw error;

    // Check if item now has 3+ reports — auto-flag
    if (window.state.reportTarget.itemId) {
      try {
        var { data: reports } = await sb.from('reports').select('id').eq('item_id', window.state.reportTarget.itemId).eq('status', 'pending');
        if (reports && reports.length >= 3) {
          await sb.from('items').update({ status: 'flagged' }).eq('id', window.state.reportTarget.itemId);
          showToast('Item auto-flagged for review.');
        }
      } catch(e) { /* non-critical */ }
    }

    closeModal('reportModalOverlay');
    showToast('Report submitted. Thank you. 🙏');
    window.state.reportTarget = null;
  } catch(e) {
    errEl.textContent = 'Failed to submit: ' + e.message;
    errEl.style.display = 'block';
  }
}

function showRatingPrompt(itemId, ratedUserId) {
  if (!window.state.user) { openAuthModal(); return; }
  window.state.ratingTarget = { itemId: itemId, ratedUserId: ratedUserId };
  document.getElementById('ratingStars').querySelectorAll('span').forEach(function(s) {
    s.textContent = '☆'; s.style.color = '#ccc';
  });
  document.getElementById('ratingValue').value = '0';
  document.getElementById('ratingComment').value = '';
  document.getElementById('ratingError').style.display = 'none';
  document.getElementById('ratingModalOverlay').style.display = 'flex';

  // Star click handler
  document.getElementById('ratingStars').onclick = function(e) {
    var star = e.target.closest('span[data-rating]');
    if (!star) return;
    var rating = parseInt(star.dataset.rating);
    document.getElementById('ratingValue').value = rating;
    var stars = document.getElementById('ratingStars').querySelectorAll('span');
    stars.forEach(function(s, i) {
      s.textContent = i < rating ? '★' : '☆';
      s.style.color = i < rating ? '#f5a623' : '#ccc';
    });
  };
}

async function submitRating() {
  if (!window.state.user || !window.state.ratingTarget) return;
  var rating = parseInt(document.getElementById('ratingValue').value);
  var comment = document.getElementById('ratingComment').value.trim();
  var errEl = document.getElementById('ratingError');
  errEl.style.display = 'none';

  if (rating < 1 || rating > 5) {
    errEl.textContent = 'Please select a rating (1-5 stars).';
    errEl.style.display = 'block';
    return;
  }

  var sb = getSupabase();
  if (!sb) { errEl.textContent = 'Not connected to server.'; errEl.style.display = 'block'; return; }

  try {
    var { error } = await sb.from('ratings').upsert({
      rater_id: window.state.user.id,
      rated_id: window.state.ratingTarget.ratedUserId,
      item_id: window.state.ratingTarget.itemId,
      rating: rating,
      comment: comment || null,
      created_at: new Date().toISOString()
    }, { onConflict: 'rater_id,rated_id,item_id' });
    if (error) throw error;
    closeModal('ratingModalOverlay');
    showToast('Thanks for rating! ⭐');
    window.state.ratingTarget = null;
  } catch(e) {
    errEl.textContent = 'Failed to submit: ' + e.message;
    errEl.style.display = 'block';
  }
}

function isUserBlocked(userId) {
  return window.state.blockedUsers.indexOf(userId) !== -1;
}

function toggleBlockUser(userId) {
  if (isUserBlocked(userId)) {
    window.state.blockedUsers = window.state.blockedUsers.filter(function(id) { return id !== userId; });
    showToast('User unblocked.');
    localStorage.setItem('geogive_blocked', JSON.stringify(window.state.blockedUsers));
    applyFilters();
  } else {
    confirmAction('Block this user? You will no longer see their items or messages.', function() {
      window.state.blockedUsers.push(userId);
      showToast('User blocked.');
      localStorage.setItem('geogive_blocked', JSON.stringify(window.state.blockedUsers));
      applyFilters();
    });
  }
}

function openSafetyModal() {
  document.getElementById('safetyModalOverlay').style.display = 'flex';
}

function closeSafetyModal() {
  closeModal('safetyModalOverlay');
}

function showSafetyTips() {
  if (localStorage.getItem('geogive_safety_shown')) return;
  localStorage.setItem('geogive_safety_shown', 'true');
  openSafetyModal();
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

  // Check if user is admin (simple check — could be expanded)
  var isAdmin = window.state.userProfile && window.state.userProfile.role === 'admin';

  var name = (window.state.userProfile && window.state.userProfile.display_name) || window.state.user.email.split('@')[0];
  var bio = (window.state.userProfile && window.state.userProfile.bio) || '';
  var verified = window.state.user.email_confirmed_at || (window.state.userProfile && window.state.userProfile.verified);
  var html = '';
  html += '<div style="text-align:center;padding:20px">';
  html += '<div style="width:80px;height:80px;border-radius:50%;background:var(--green);color:white;display:inline-flex;align-items:center;justify-content:center;font-size:2rem;margin-bottom:12px">' + escHtml(name.charAt(0).toUpperCase()) + '</div>';
  html += '<h3>' + escHtml(name) + '</h3>';
  if (verified) html += '<div class="verified-badge" style="margin:8px auto">✓ Verified</div>';
  if (bio) html += '<p style="color:#666;margin-top:8px">' + escHtml(bio) + '</p>';
  html += '<p style="color:#999;font-size:0.85rem;margin-top:8px">' + escHtml(window.state.user.email) + '</p>';
  html += '<div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">';
  html += '<input id="profileName" type="text" value="' + escHtml(name) + '" placeholder="Display name" style="flex:1;min-width:180px;padding:10px;border:1px solid #ddd;border-radius:10px">';
  html += '<button class="btn btn-primary" data-fn="submitProfileEdit" type="button">Save</button>';
  html += '</div></div>';

  // Admin section
  if (isAdmin) {
    html += '<div style="margin-top:24px;padding:16px;background:#fff3e0;border-radius:12px">';
    html += '<h4 style="margin-bottom:12px">🛡️ Admin — Report Queue</h4>';
    html += '<div id="adminReportQueue"><p style="color:#999">Loading...</p></div>';
    html += '</div>';
  }

  container.innerHTML = html;

  if (isAdmin) loadAdminReports();
}

async function loadAdminReports() {
  var sb = getSupabase();
  if (!sb) return;
  try {
    var container = document.getElementById('adminReportQueue');
    if (!container) return;
    var { data, error } = await sb.from('reports').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(20);
    if (error) throw error;
    if (!data || data.length === 0) {
      container.innerHTML = '<p style="color:#999">No pending reports. ✓</p>';
      return;
    }
    var html = '';
    data.forEach(function(r) {
      html += '<div style="padding:10px;background:white;border-radius:8px;margin-bottom:8px;font-size:0.85rem">';
      html += '<strong>' + escHtml(r.reason) + '</strong> — ' + escHtml(r.description || 'No details') + '<br>';
      html += '<span style="color:#999;font-size:0.75rem">Report ID: ' + escHtml(r.id) + '</span>';
      html += '<div style="margin-top:6px"><button class="btn btn-sm btn-secondary" data-fn="resolveReport" data-arg-expr="escJs(r.id)" data-arg2="dismissed">Dismiss</button> ';
      html += '<button class="btn btn-sm btn-danger" data-fn="resolveReport" data-arg-expr="escJs(r.id)" data-arg2="actioned">Take Action</button></div>';
      html += '</div>';
    });
    container.innerHTML = html;
  } catch(e) {
    var container = document.getElementById('adminReportQueue');
    if (container) container.innerHTML = '<p style="color:red">Failed to load reports.</p>';
  }
}

async function resolveReport(reportId, action) {
  var sb = getSupabase();
  if (!sb) return;
  try {
    await sb.from('reports').update({ status: action, resolved_at: new Date().toISOString() }).eq('id', reportId);
    showToast('Report ' + action + ' ✓');
    loadAdminReports();
  } catch(e) {
    handleError(e, 'resolve report');
  }
}
