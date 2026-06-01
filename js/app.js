// GeoGive - Main Application Entry Point
// Loads all modules and initializes the app


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
  radiusMiles: 10
};

var timers = [];

// Supabase client reference (set by initSupabase)
window.supabaseClient = null;

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
  // Set global references that modules use
  window.state = state;
  window.timers = timers;
  
  // Init Supabase
  window.supabaseClient = initSupabase();
  if (!supabaseClient) {
    showConnIndicator(false);
    showToast('Open Settings (⚙️) to configure Supabase credentials', 'warning');
  } else {
    showConnIndicator(true);
  }
  
  // Auth
  setupAuthListener();
  checkSession();
  
  // Geolocation
  initGeolocation();
  
  // Load items (from Supabase or localStorage fallback)
  if (supabaseClient) {
    loadItemsFromSupabase();
  } else {
    loadItemsFromStorage();
  }
  
  // UI
  initBottomSheetSwipe();
  
  // Page navigation via data-page attributes
  document.querySelectorAll('[data-page]').forEach(function(el) {
    el.addEventListener('click', function(e) {
      var page = el.getAttribute('data-page');
      if (page) switchPage(page);
    });
  });
  
  // Bottom nav
  document.querySelectorAll('.nav-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      var page = tab.getAttribute('data-page');
      if (page) switchPage(page);
    });
  });
  
  // Network status
  window.addEventListener('online', function() {
    isOnline = true;
    showConnIndicator(true);
    if (supabaseClient) loadItemsFromSupabase();
  });
  window.addEventListener('offline', function() {
    isOnline = false;
    showConnIndicator(false);
  });
  
  // Notifications (optional)
  if ('serviceWorker' in navigator && 'Notification' in window) {
    initNotifications().catch(function() {});
    initFCM().catch(function() {});
  }
});

// ===== OFFLINE QUEUE REPLAY =====
window.addEventListener('online', function() {
  if (supabaseClient) {
    replayOfflineQueue();
    loadItemsFromSupabase();
  }
});

// ===== GLOBAL EXPOSURES for inline handlers =====
// These are called from HTML onclick/onchange attributes
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

// Make state globally accessible
window.state = state;
