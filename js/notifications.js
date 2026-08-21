// ===== NOTIFICATIONS =====

function initNotifications() {
  if (!('Notification' in window)) { window.state.notifPermission = 'unsupported'; return; }
  window.state.notifPermission = Notification.permission;
  // Restore cached notifications (server sync happens on login)
  try {
    var cached = JSON.parse(localStorage.getItem('geogive_notifications') || '[]');
    if (Array.isArray(cached) && cached.length > 0) window.state.notifications = cached;
  } catch(e) {}
}

function addNotif(title, body, onClick) {
  var notif = { id: Date.now(), title: title, body: body, read: false, createdAt: Date.now(), onClick: onClick };
  window.state.notifications.unshift(notif);
  if (window.state.notifications.length > 50) window.state.notifications = window.state.notifications.slice(0, 50);
  showToast('🔔 ' + title);
  persistNotification(notif);

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

// ===== NOTIFICATION DB SYNC (Phase 1) =====
// Local notifications are the source of UX; DB rows make them cross-device.
async function persistNotification(notif) {
  var sb = getSupabase();
  if (!sb || !window.state.user) return;
  try {
    await sb.from('notifications').insert({
      user_id: window.state.user.id,
      type: 'info',
      title: notif.title,
      body: notif.body || '',
      read: false
    });
  } catch(e) { console.warn('persistNotification:', e); }
}

async function loadNotificationsFromServer() {
  var sb = getSupabase();
  if (!sb || !window.state.user) return;
  try {
    var result = await withRetry(function() {
      return sb.from('notifications')
        .select('*').eq('user_id', window.state.user.id)
        .order('created_at', { ascending: false }).limit(50);
    }, { maxAttempts: 2, baseDelay: 400 });
    if (result.error) throw result.error;
    var serverNotifs = (result.data || []).map(function(r) {
      return {
        id: r.id, dbId: r.id, title: r.title,
        body: r.body || '',
        read: !!r.read,
        createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now()
      };
    });
    // Merge: keep local-only notifs (no dbId) that are newer than oldest server row
    var serverIds = {};
    serverNotifs.forEach(function(n) { serverIds[n.dbId] = true; });
    var localOnly = window.state.notifications.filter(function(n) { return !n.dbId && !serverIds[n.id]; });
    window.state.notifications = serverNotifs.concat(localOnly).slice(0, 50);
    try { localStorage.setItem('geogive_notifications', JSON.stringify(window.state.notifications)); } catch(e) {}
  } catch(e) { console.warn('loadNotifications:', e); }
}

// ===== WEB PUSH SUBSCRIPTION (M16) =====
function urlBase64ToUint8Array(base64String) {
  var padding = '='.repeat((4 - base64String.length % 4) % 4);
  var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  var rawData = window.atob(base64);
  var outputArray = new Uint8Array(rawData.length);
  for (var i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  // VAPID public key must be set before push can work.
  // Set localStorage.geogive_vapid_key to your base64url-encoded VAPID public key.
  var VAPID_PUBLIC_KEY = localStorage.getItem('geogive_vapid_key') || '';
  if (!VAPID_PUBLIC_KEY) {
    console.warn('GeoGive: No VAPID public key configured. Set localStorage.geogive_vapid_key.');
    return false;
  }
  try {
    var reg = await navigator.serviceWorker.ready;
    var subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
    // Store subscription locally (would be sent to server in production)
    localStorage.setItem('geogive_push_subscription', JSON.stringify(subscription));
  // Persist subscription to DB so server can push to any device (Phase 2 prep)
  (async function() {
    var sb = getSupabase();
    if (!sb || !window.state.user || !subscription) return;
    try {
      var keys = subscription.toJSON().keys || {};
      await sb.from('push_subscriptions').upsert({
        user_id: window.state.user.id,
        endpoint: subscription.endpoint,
        keys_p256dh: keys.p256dh || '',
        keys_auth: keys.auth || '',
        user_agent: navigator.userAgent
      }, { onConflict: 'endpoint' });
    } catch(e) { console.warn('push sub DB save:', e); }
  })();
    return true;
  } catch(e) {
    console.warn('GeoGive: Push subscription failed:', e);
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
