function initNotifications() {
  if (!('Notification' in window)) { window.state.notifPermission = 'unsupported'; return; }
  window.state.notifPermission = Notification.permission;
  if (window.state.notifPermission === 'granted') {
    updateNotifBadge();
  }
}

function requestNotifPermission() {
  if (!('Notification' in window)) { showToast('Notifications not supported'); return; }
  Notification.requestPermission().then(function(perm) {
    window.state.notifPermission = perm;
    if (perm === 'granted') {
      showToast('Notifications enabled! 🔔');
      try { new Notification('GeoGive', { body: "You'll be notified when someone requests your items.", icon: '🎁' }); } catch(e) {}
    } else if (perm === 'denied') {
      showToast('Notifications blocked. Enable in browser settings.');
    }
  });
}

function addNotif(title, body, onClick) {
  var notif = { id: Date.now(), title: title, body: body, read: false, createdAt: Date.now(), onClick: onClick };
  window.state.notifications.unshift(notif);
  if (window.state.notifications.length > 50) window.state.notifications = window.state.notifications.slice(0, 50);
  updateNotifBadge();
  renderNotifDropdown();
  // Show browser notification if permitted and app not focused
  if (window.state.notifPermission === 'granted' && document.hidden) {
    try {
      var bn = new Notification(title, { body: body, icon: '🎁', tag: 'geogive-' + Date.now() });
      if (onClick) bn.onclick = onClick;
    } catch(e) {}
  }
  // Also show in-app toast for immediate visibility
  showToast('🔔 ' + title);
}

function updateNotifBadge() {
  var unread = window.state.notifications.filter(function(n) { return !n.read; }).length;
  var badge = document.getElementById('notifBadge');
  if (badge) { badge.textContent = unread; badge.classList.toggle('show', unread > 0); }
}

function toggleNotifDropdown() {
  var dd = document.getElementById('notifDropdown');
  dd.classList.toggle('active');
  // Mark all as read when opened
  if (dd.classList.contains('active')) {
    window.state.notifications.forEach(function(n) { n.read = true; });
    updateNotifBadge();
    // Only request permission if not already decided
    if (window.state.notifPermission === 'default') {
      requestNotifPermission();
    }
  }
  renderNotifDropdown();
}

function renderNotifDropdown() {
  var dd = document.getElementById('notifDropdown');
  if (window.state.notifications.length === 0) {
    dd.innerHTML = '<div class="notif-item empty" id="notifEmpty">No notifications yet</div>';
    return;
  }
  var html = '';
  window.state.notifications.slice(0, 20).forEach(function(n) {
    html += '<div class="notif-item ' + (n.read ? '' : 'unread') + '" onclick="handleNotifClick(' + n.id + ')">';
    html += '<strong>' + escHtml(n.title) + '</strong>';
    html += '<p style="color:var(--gray-400);font-size:0.75rem;margin-top:2px">' + escHtml(n.body) + ' · ' + timeAgo(n.createdAt) + '</p>';
    html += '</div>';
  });
  dd.innerHTML = html;
}

function handleNotifClick(id) {
  var notif = window.state.notifications.find(function(n) { return n.id === id; });
  if (notif) { notif.read = true; updateNotifBadge(); }
  if (notif && notif.onClick) notif.onClick();
  document.getElementById('notifDropdown').classList.remove('active');
}

function initFCM() {
  // FCM requires a service worker. This is a placeholder that will be
  // activated when the PWA manifest + service worker are added in Phase 6.
  // For now, web Notifications API handles in-browser notifications.
  console.log('FCM will be initialized when PWA service worker is registered');
}
