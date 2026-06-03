// GeoGive - Main Application Entry Point

// ===== STATE =====
var isOnline = navigator.onLine;
var lastFocusedElement = null;
var state = {
  user: null, session: null, userProfile: null,
  items: [], requests: [], chats: {},
  currentChatId: null,
  notifications: [], notifPermission: 'default', selectedImages: [], searchTimer: null,
  authListener: null,
  userLocation: null,
  locationStatus: 'pending',
  map: null, mapMarkers: [],
  currentView: 'list',
  radiusMiles: 10,
  currentPage: 1,
  pageSize: 20,
  isLoadingMore: false,
  scrollObserver: null,
  offlineQueue: [],
  ratings: {},
  blockedUsers: []
};

var timers = [];

// Supabase client reference (set by initSupabase in config.js)

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
  window.state = state;
  window.timers = timers;

  // Load offline queue
  try {
    var q = localStorage.getItem('geogive_offline_queue');
    if (q) state.offlineQueue = JSON.parse(q);
  } catch(e) {}

  // Load blocked users
  try {
    var b = localStorage.getItem('geogive_blocked');
    if (b) state.blockedUsers = JSON.parse(b);
  } catch(e) {}

  // Init Supabase
  var supabaseClient = initSupabase();
  if (!supabaseClient) {
    showConnIndicator(false);
    showToast('Open Settings (⚙️) to configure Supabase credentials');
  } else {
    showConnIndicator(true);
  }

  // Auth
  setupAuthListener();
  checkSession();

  // Geolocation
  initGeolocation();

  // Load items
  if (supabaseClient) {
    loadItemsFromSupabase();
  } else {
    loadItemsFromStorage();
  }

  // Network status
  window.addEventListener('online', function() {
    isOnline = true;
    showConnIndicator(true);
    if (supabaseClient) {
      replayOfflineQueue();
      loadItemsFromSupabase();
    }
  });
  window.addEventListener('offline', function() {
    isOnline = false;
    showConnIndicator(false);
  });

  // Notifications (optional)
  if ('serviceWorker' in navigator && 'Notification' in window) {
    initNotifications();
  }
});

// ===== GLOBAL EXPOSURES for inline handlers =====
window.switchPage = switchPage;
window.openAuthModal = openAuthModal;
window.closeModal = closeModal;
window.handleGoogleAuth = handleGoogleAuth;
window.handleEmailAuth = handleEmailAuth;
window.handleLogout = handleLogout;
window.openSettingsModal = openSettingsModal;
window.saveSettings = saveSettings;
window.setView = setView;
window.updateRadiusLabel = updateRadiusLabel;
window.applyFilters = applyFilters;
window.handleListSubmit = handleListSubmit;
window.openItemDetail = openItemDetail;
window.requestItem = requestItem;
window.deleteItem = deleteItem;
window.markGiven = markGiven;
window.renewItem = renewItem;
window.toggleShowExpired = toggleShowExpired;
window.openChat = openChat;
window.closeChatPage = closeChatPage;
window.sendChatMsg = sendChatMsg;
window.respondToRequest = respondToRequest;
window.showUserProfile = showUserProfile;
window.openReportModal = openReportModal;
window.submitReport = submitReport;
window.submitRating = submitRating;
window.toggleBlockUser = toggleBlockUser;
window.showSafetyTips = showSafetyTips;
window.showToast = showToast;
window.handleImageSelect = handleImageSelect;
window.removeImage = removeImage;
window.switchAuthTab = switchAuthTab;
window.debounceSearch = debounceSearch;
window.initFCM = initFCM;
window.submitProfileEdit = submitProfileEdit;
window.renderProfile = renderProfile;

window.state = state;
