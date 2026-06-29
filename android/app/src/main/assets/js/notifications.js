// ===== NOTIFICATIONS =====

function initNotifications() {
  if (!('Notification' in window)) { window.state.notifPermission = 'unsupported'; return; }
  window.state.notifPermission = Notification.permission;
}

function addNotif(title, body, onClick) {
  var notif = { id: Date.now(), title: title, body: body, read: false, createdAt: Date.now(), onClick: onClick };
  window.state.notifications.unshift(notif);
  if (window.state.notifications.length > 50) window.state.notifications = window.state.notifications.slice(0, 50);
  showToast('🔔 ' + title);

  // Show browser notification if permitted
  if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
    try {
      var browserNotif = new Notification(title, { body: body, icon: '/geogive/icon-192.png' });
      browserNotif.onclick = function() {
        window.focus();
        if (onClick) onClick();
        browserNotif.close();
      };
    } catch(e) {}
  }
}

// ===== NOTIFICATION PREFERENCES =====

function getNotifPrefs() {
  try {
    var prefs = localStorage.getItem('geogive_notif_prefs');
    return prefs ? JSON.parse(prefs) : { messages: true, nearby: true, requests: true };
  } catch(e) { return { messages: true, nearby: true, requests: true }; }
}

function saveNotifPrefs(prefs) {
  try { localStorage.setItem('geogive_notif_prefs', JSON.stringify(prefs)); } catch(e) {}
}

function toggleNotifPref(key) {
  var prefs = getNotifPrefs();
  prefs[key] = !prefs[key];
  saveNotifPrefs(prefs);
  updateNotifToggleUI(key, prefs[key]);
}

function updateNotifToggleUI(key, on) {
  var el = document.getElementById('toggle' + key.charAt(0).toUpperCase() + key.slice(1));
  if (el) {
    el.className = 'toggle-switch' + (on ? ' on' : '');
  }
}

function initNotifToggles() {
  var prefs = getNotifPrefs();
  updateNotifToggleUI('messages', prefs.messages);
  updateNotifToggleUI('nearby', prefs.nearby);
  updateNotifToggleUI('requests', prefs.requests);
}
