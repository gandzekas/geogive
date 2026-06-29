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

// ===== WEB PUSH SUBSCRIPTION (M16) =====
function urlBase64ToUint8Array(base64String) {
  var padding = '='.repeat((4 - base64String.length % 4) % 4);
  var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  var rawData = window.atob(base64String);
  var outputArray = new Uint8Array(rawData.length);
  for (var i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  try {
    var reg = await navigator.serviceWorker.ready;
    var subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: null // Would be set to VAPID public key in production
    });
    // Store subscription locally (would be sent to server in production)
    localStorage.setItem('geogive_push_subscription', JSON.stringify(subscription));
    return true;
  } catch(e) {
    return false;
  }
}

async function unsubscribeFromPush() {
  try {
    var reg = await navigator.serviceWorker.ready;
    var subscription = await reg.pushManager.getSubscription();
    if (subscription) await subscription.unsubscribe();
    localStorage.removeItem('geogive_push_subscription');
    return true;
  } catch(e) { return false; }
}

function isPushSubscribed() {
  return !!localStorage.getItem('geogive_push_subscription');
}

// Request notification permission
async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  try {
    var result = await Notification.requestPermission();
    window.state.notifPermission = result;
    return result;
  } catch(e) {
    return 'denied';
  }
}

// ===== BACKGROUND SYNC REGISTRATION (M34) =====
function registerBackgroundSync() {
  if (!('serviceWorker' in navigator) || !('SyncManager' in window)) return;
  navigator.serviceWorker.ready.then(function(reg) {
    try { reg.sync.register('sync-chat-messages').catch(function() {}); } catch(e) {}
  });
}

// Listen for background sync messages from SW
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'SYNC_CHAT_MESSAGES') {
      var sb = getSupabase();
      if (sb && window.state.user) loadChatsFromSupabase();
    }
  });
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
