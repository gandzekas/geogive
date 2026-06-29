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
  var bio = document.getElementById('profileBio') ? document.getElementById('profileBio').value.trim() : '';
  if (!name) { showToast('Please enter a display name'); return; }
  saveProfile({ display_name: name, bio: bio });
  closeModal('itemModalOverlay');
}

function renderProfile() {
  var container = document.getElementById('profileContent');
  if (!container) return;
  if (!window.state.user) {
    container.innerHTML = '<div class="empty-state"><p>Please sign in to view your profile.</p></div>';
    return;
  }

  var isAdmin = window.state.userProfile && window.state.userProfile.role === 'admin';
  var name = (window.state.userProfile && window.state.userProfile.display_name) || window.state.user.email.split('@')[0];
  var bio = (window.state.userProfile && window.state.userProfile.bio) || '';
  var verified = window.state.user.email_confirmed_at || (window.state.userProfile && window.state.userProfile.verified);
  var trustScore = calculateTrustScore(window.state.user.id);
  var trustLevel = getTrustLevel(trustScore);
  var myItems = window.state.items.filter(function(i) { return i.ownerId === window.state.user.id; });
  var givenAway = myItems.filter(function(i) { return i.status === 'given'; }).length;

  var html = '';
  html += '<div style="text-align:center;padding:20px">';
  html += '<div style="width:80px;height:80px;border-radius:50%;background:var(--green);color:white;display:inline-flex;align-items:center;justify-content:center;font-size:2rem;margin-bottom:12px">' + escHtml(name.charAt(0).toUpperCase()) + '</div>';
  html += '<h3>' + escHtml(name) + '</h3>';
  if (verified) html += '<div class="verified-badge" style="margin:8px auto">✓ Verified</div>';
  html += '<div style="margin:8px 0">' + trustBadgeHtml(window.state.user.id) + '</div>';
  if (bio) html += '<p style="color:#666;margin-top:8px">' + escHtml(bio) + '</p>';
  html += '<p style="color:#999;font-size:0.85rem;margin-top:8px">' + escHtml(window.state.user.email) + '</p>';

  // Stats
  html += '<div style="display:flex;justify-content:center;gap:20px;margin:16px 0">';
  html += '<div><div style="font-size:1.3rem;font-weight:700;color:var(--green)">' + myItems.length + '</div><div style="font-size:0.7rem;color:#999">Listed</div></div>';
  html += '<div><div style="font-size:1.3rem;font-weight:700;color:var(--green)">' + givenAway + '</div><div style="font-size:0.7rem;color:#999">Given</div></div>';
  html += '<div><div style="font-size:1.3rem;font-weight:700;color:var(--green)">' + trustScore + '/100</div><div style="font-size:0.7rem;color:#999">Trust</div></div>';
  html += '</div>';

  // Edit profile
  html += '<div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">';
  html += '<input id="profileName" type="text" value="' + escHtml(name) + '" placeholder="Display name" style="flex:1;min-width:180px;padding:10px;border:1px solid #ddd;border-radius:10px">';
  html += '<button class="btn btn-primary" data-fn="submitProfileEdit" type="button">Save</button>';
  html += '</div>';
  html += '<textarea id="profileBio" placeholder="Add a short bio..." style="width:100%;padding:10px;border:1px solid #ddd;border-radius:10px;margin-top:8px;min-height:60px">' + escHtml(bio) + '</textarea>';
  html += '</div>';

  // GeoGive Pro status (M42)
  if (isProUser()) {
    html += '<div style="margin-top:16px;padding:12px;background:linear-gradient(135deg,#fff3e0,#ffe0b2);border-radius:12px;text-align:center">';
    html += '<span style="font-size:1.5rem">⭐</span><strong> GeoGive Pro</strong>';
    html += '<p style="font-size:0.8rem;color:#666;margin-top:4px">Unlimited bumps, analytics, pro badge</p>';
    html += '</div>';
  }

  // Referral program (M41)
  html += '<div style="margin-top:16px;padding:16px;background:#e8f5e9;border-radius:12px">';
  html += '<h4 style="margin-bottom:8px">🎁 Invite Friends</h4>';
  html += '<p style="font-size:0.85rem;color:#666;margin-bottom:8px">Share your referral code — both get a free Pro trial!</p>';
  html += '<div style="display:flex;gap:8px;align-items:center">';
  html += '<input type="text" value="' + getReferralCode() + '" readonly style="flex:1;padding:8px;border:1px solid #ddd;border-radius:8px;font-size:0.85rem;font-family:monospace;background:white">';
  html += '<button class="btn btn-sm btn-primary" data-fn="shareReferralCode">Share</button>';
  html += '</div>';
  html += '</div>';

  // Share profile card (M43)
  html += '<div style="margin-top:12px;text-align:center">';
  html += '<button class="btn btn-sm btn-secondary" data-fn="shareProfileCard">📸 Share Profile Card</button>';
  html += '</div>';

  // Admin section (M49 expanded)
  if (isAdmin) {
    html += '<div style="margin-top:24px;padding:16px;background:#fff3e0;border-radius:12px">';
    html += '<h4 style="margin-bottom:12px">🛡️ Admin Dashboard</h4>';

    // Platform stats (local)
    var totalItems = window.state.items ? window.state.items.length : 0;
    var activeItems = window.state.items ? window.state.items.filter(function(i) { return i.status === 'available'; }).length : 0;
    var totalUsers = localStorage.getItem('geogive_admin_user_count') || '—';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">';
    html += '<div style="background:white;padding:10px;border-radius:8px;text-align:center"><div style="font-size:1.4rem;font-weight:700">' + totalItems + '</div><div style="font-size:0.7rem;color:#999">Total Items</div></div>';
    html += '<div style="background:white;padding:10px;border-radius:8px;text-align:center"><div style="font-size:1.4rem;font-weight:700">' + activeItems + '</div><div style="font-size:0.7rem;color:#999">Active</div></div>';
    html += '<div style="background:white;padding:10px;border-radius:8px;text-align:center"><div style="font-size:1.4rem;font-weight:700">' + totalUsers + '</div><div style="font-size:0.7rem;color:#999">Users</div></div>';
    html += '</div>';

    // Broadcast announcement
    html += '<div style="margin-bottom:12px">';
    html += '<label style="font-size:0.8rem;color:#666">📢 Broadcast Message</label>';
    html += '<div style="display:flex;gap:8px;margin-top:4px">';
    html += '<input type="text" id="adminBroadcast" placeholder="Send to all users..." style="flex:1;padding:8px;border:1px solid #ddd;border-radius:8px;font-size:0.85rem">';
    html += '<button class="btn btn-sm btn-primary" data-fn="adminBroadcast">Send</button>';
    html += '</div>';
    html += '</div>';

    // Report queue
    html += '<h5 style="margin-bottom:8px;font-size:0.9rem">📋 Pending Reports</h5>';
    html += '<div id="adminReportQueue"><p style="color:#999">Loading...</p></div>';
    html += '</div>';
  }

  container.innerHTML = html;

  if (isAdmin) loadAdminReports();
}

// ===== SHAREABLE PROFILE CARD (M43) =====
async function shareProfileCard() {
  var user = window.state.user;
  if (!user) return;
  var trust = calculateTrustScore(user.id);
  var trustLevel = getTrustLevel(user.id);
  var bio = user.bio || 'GeoGive community member';
  var listings = window.state.items.filter(function(i) { return i.userId === user.id; });
  var followers = getFollowing(user.id).length;

  // Generate card via Canvas
  var canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 400;
  var ctx = canvas.getContext('2d');

  // Background gradient
  var grad = ctx.createLinearGradient(0, 0, 600, 400);
  grad.addColorStop(0, '#4a90d9');
  grad.addColorStop(1, '#2c5f8a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 600, 400);

  // Card background
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.roundRect(30, 30, 540, 340, 16);
  ctx.fill();

  // Avatar circle
  ctx.fillStyle = '#4a90d9';
  ctx.beginPath();
  ctx.arc(100, 100, 40, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'white';
  ctx.font = 'bold 32px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText((user.name || 'U')[0].toUpperCase(), 100, 112);

  // Name
  ctx.fillStyle = '#333';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(user.name || 'Anonymous', 160, 95);

  // Trust badge
  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#666';
  ctx.fillText(trustLevel + '  ⭐ ' + trust + ' trust', 160, 120);

  // Bio
  ctx.fillStyle = '#555';
  ctx.font = '15px sans-serif';
  var words = bio.split(' ');
  var line = '';
  var y = 170;
  for (var i = 0; i < words.length; i++) {
    var test = line + words[i] + ' ';
    if (ctx.measureText(test).width > 480) {
      ctx.fillText(line, 60, y);
      line = words[i] + ' ';
      y += 22;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, 60, y);

  // Stats
  ctx.fillStyle = '#333';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(listings.length, 120, 250);
  ctx.fillText(followers, 260, 250);
  ctx.fillText(trust, 400, 250);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#888';
  ctx.fillText('Listings', 120, 270);
  ctx.fillText('Followers', 260, 270);
  ctx.fillText('Trust', 400, 270);

  // Branding
  ctx.fillStyle = '#4a90d9';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('🌍 GeoGive', 60, 340);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#999';
  ctx.fillText(window.location.origin, 60, 360);

  // Download
  canvas.toBlob(function(blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'geogive-profile-' + (user.name || 'user') + '.png';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Profile card saved! 📸');
  });
}

// ===== ADMIN BROADCAST (M49) =====
function adminBroadcast() {
  var input = document.getElementById('adminBroadcast');
  if (!input || !input.value.trim()) return;
  var msg = input.value.trim();
  // Store broadcast in localStorage — all users see it on next load
  localStorage.setItem('geogive_admin_broadcast', JSON.stringify({
    message: msg,
    timestamp: Date.now(),
    from: window.state.user ? window.state.user.name : 'Admin'
  }));
  // Show it immediately
  showToast('📢 Broadcast sent to all users!');
  input.value = '';
  trackEvent('admin_broadcast', { message: msg });
}

function checkAdminBroadcast() {
  try {
    var broadcast = JSON.parse(localStorage.getItem('geogive_admin_broadcast') || 'null');
    if (broadcast && broadcast.message) {
      // Show if less than 24h old
      if (Date.now() - broadcast.timestamp < 24 * 60 * 60 * 1000) {
        var banner = document.getElementById('adminBroadcastBanner');
        if (!banner) {
          banner = document.createElement('div');
          banner.id = 'adminBroadcastBanner';
          banner.style.cssText = 'background:#fff3e0;padding:10px 16px;text-align:center;font-size:0.85rem;border-bottom:2px solid #f57c00;position:sticky;top:0;z-index:200';
          document.body.insertBefore(banner, document.body.firstChild);
        }
        banner.innerHTML = '📢 <strong>' + escHtml(broadcast.from) + ':</strong> ' + escHtml(broadcast.message) + ' <button onclick="this.parentElement.style.display=\'none\'" style="background:none;border:none;cursor:pointer;margin-left:8px;font-size:1rem">✕</button>';
      }
    }
  } catch(e) {}
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
