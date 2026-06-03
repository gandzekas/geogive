// ===== NOTIFICATIONS =====

function initNotifications() {
  if (!('Notification' in window)) { window.state.notifPermission = 'unsupported'; return; }
  window.state.notifPermission = Notification.permission;
}

function addNotif(title, body) {
  var notif = { id: Date.now(), title: title, body: body, read: false, createdAt: Date.now() };
  window.state.notifications.unshift(notif);
  if (window.state.notifications.length > 50) window.state.notifications = window.state.notifications.slice(0, 50);
  showToast('🔔 ' + title);
}

function initFCM() {
  // FCM placeholder — requires service worker + Firebase config
  console.log('FCM placeholder');
}
