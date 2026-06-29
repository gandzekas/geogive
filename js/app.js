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
  blockedUsers: [],
  // Pagination for browse
  browsePage: 1,
  browseHasMore: true,
  allFilteredItems: []
};

var timers = [];

// Supabase client reference (set by initSupabase in config.js)

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
  window.state = state;
  window.timers = timers;
  log('DOMContentLoaded: state initialized');

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
    console.warn('DOMContentLoaded: Supabase init FAILED');
    showConnIndicator('offline');
    showToast('Open Settings (⚙️) to configure Supabase credentials');
  } else {
    log('DOMContentLoaded: Supabase init OK');
    showConnIndicator('online');
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
    showConnIndicator('syncing');
    if (supabaseClient) {
      replayOfflineQueue();
      loadItemsFromSupabase();
    }
    setTrackedTimeout(function() { showConnIndicator('online'); }, 1500);
  });
  window.addEventListener('offline', function() {
    isOnline = false;
    showConnIndicator('offline');
  });

  // Register service worker for offline support
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(function(reg) {
      log('Service Worker registered, scope:', reg.scope);
    }).catch(function(err) {
      console.warn('Service Worker registration failed:', err);
    });
  }

  // Notifications (optional)
  if ('Notification' in window) {
    initNotifications();
  }

  // Show onboarding for first-time users
  if (!localStorage.getItem('geogive_onboarded')) {
    setTrackedTimeout(showOnboarding, 1000);
  }
  // Show community guidelines on first use (M27)
  if (!localStorage.getItem('geogive_guidelines_accepted')) {
    setTrackedTimeout(showCommunityGuidelines, 2500);
  }
  // Pull-to-refresh on browse page (M3)
  setupPullToRefresh();

  // Hide loading splash
  var splash = document.getElementById('appSplash');
  if (splash) splash.style.display = 'none';

  // ===== DELEGATED EVENT HANDLER (replaces inline onclick/oninput/onchange/onsubmit) =====
  document.addEventListener('click', function(e) {
    var el = e.target.closest('[data-fn]');
    if (!el) return;
    var fnName = el.getAttribute('data-fn');
    var arg = el.getAttribute('data-arg');
    var argExpr = el.getAttribute('data-arg-expr');
    var arg2 = el.getAttribute('data-arg2');
    var arg2Expr = el.getAttribute('data-arg2-expr');
    var closeModalArg = el.getAttribute('data-closemodal');
    // Handle chained closeModal FIRST (matches original JS execution order)
    if (closeModalArg) closeModal(closeModalArg);
    var fn = window[fnName];
    if (typeof fn === 'function') {
      // Evaluate dynamic expression if present
      var resolvedArg = arg;
      if (argExpr !== null && arg === null) {
        try { resolvedArg = eval(argExpr); } catch(err) { log('data-arg-expr eval error:', err); return; }
      }
      var resolvedArg2 = arg2;
      if (arg2Expr !== null && arg2 === null) {
        try { resolvedArg2 = eval(arg2Expr); } catch(err) { log('data-arg2-expr eval error:', err); return; }
      }
      // Call function with 0, 1, or 2 args
      if (resolvedArg !== null && resolvedArg !== undefined && resolvedArg2 !== null && resolvedArg2 !== undefined) {
        fn.call(el, resolvedArg, resolvedArg2);
      } else if (resolvedArg !== null && resolvedArg !== undefined) {
        fn.call(el, resolvedArg);
      } else {
        fn.call(el);
      }
    }
  });

  document.addEventListener('input', function(e) {
    var el = e.target.closest('[data-fn]');
    if (!el) return;
    var fnName = el.getAttribute('data-fn');
    var fn = window[fnName];
    if (typeof fn === 'function') fn.call(el, el.value);
  });

  document.addEventListener('change', function(e) {
    var el = e.target.closest('[data-fn]');
    if (!el) return;
    var fnName = el.getAttribute('data-fn');
    var fn = window[fnName];
    if (typeof fn === 'function') fn.call(el, e);
  });

  document.addEventListener('submit', function(e) {
    var form = e.target.closest('form[data-fn]');
    if (!form) return;
    e.preventDefault();
    var fnName = form.getAttribute('data-fn');
    var fn = window[fnName];
    if (typeof fn === 'function') fn.call(form, e);
  });

  // Accessibility enhancements
  initAccessibility();

  // Deep-link handling: #item-xxx
  handleDeepLink();
});

function initAccessibility() {
  var main = document.querySelector('main');
  if (main) { main.setAttribute('role', 'main'); main.id = 'main-content'; }

  document.querySelectorAll('.nav-tab').forEach(function(tab) {
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-label', tab.textContent.trim());
  });

  document.querySelectorAll('.modal-overlay').forEach(function(overlay) {
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
  });

  var photoInput = document.getElementById('postPhotos');
  if (photoInput) photoInput.setAttribute('aria-label', 'Upload photos of your item');

  var radiusSlider = document.getElementById('radiusSlider');
  if (radiusSlider) radiusSlider.setAttribute('aria-label', 'Search radius in miles');

  var mapContainer = document.getElementById('map');
  if (mapContainer) { mapContainer.setAttribute('role', 'application'); mapContainer.setAttribute('aria-label', 'Map showing nearby items'); }

  var toast = document.getElementById('toast');
  if (toast) { toast.setAttribute('role', 'status'); toast.setAttribute('aria-live', 'polite'); }

  // Skip navigation link
  if (!document.getElementById('skipNav')) {
    var skipLink = document.createElement('a');
    skipLink.id = 'skipNav';
    skipLink.href = '#main-content';
    skipLink.textContent = 'Skip to main content';
    skipLink.style.cssText = 'position:absolute;top:-40px;left:0;background:#2d8a4e;color:white;padding:8px 16px;z-index:10000;border-radius:0 0 8px 0;text-decoration:none;font-weight:600';
    skipLink.onfocus = function() { skipLink.style.top = '0'; };
    skipLink.onblur = function() { skipLink.style.top = '-40px'; };
    document.body.insertBefore(skipLink, document.body.firstChild);
  }
}

// ===== GLOBAL EXPOSURES for inline handlers =====
window.switchPage = switchPage;
window.openAuthModal = openAuthModal;
window.closeModal = closeModal;
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
window.subscribeToPush = subscribeToPush;
window.unsubscribeFromPush = unsubscribeFromPush;
window.isPushSubscribed = isPushSubscribed;
window.requestNotificationPermission = requestNotificationPermission;
window.registerBackgroundSync = registerBackgroundSync;
window.calculateTrustScore = calculateTrustScore;
window.getTrustLevel = getTrustLevel;
window.trustBadgeHtml = trustBadgeHtml;
window.toggleFollow = toggleFollow;
window.isFollowing = isFollowing;
window.getFollowing = getFollowing;
window.getFeedItems = getFeedItems;
window.getFollowers = getFollowers;
window.toggleBlockUser = toggleBlockUser;
window.showSafetyTips = showSafetyTips;
window.closeSafetyModal = closeSafetyModal;
window.showToast = showToast;
window.handleImageSelect = handleImageSelect;
window.removeImage = removeImage;
window.switchAuthTab = switchAuthTab;
window.debounceSearch = debounceSearch;
window.submitProfileEdit = submitProfileEdit;
window.renderProfile = renderProfile;
window.renderFeed = renderFeed;
window.bumpItem = bumpItem;
window.toggleFavorite = toggleFavorite;
window.shareItem = shareItem;
window.nextOnboardingStep = nextOnboardingStep;
window.skipOnboarding = skipOnboarding;
window.restartOnboarding = restartOnboarding;
window.togglePushNotifs = togglePushNotifs;
window.showCommunityGuidelines = showCommunityGuidelines;
window.closeGuidelinesModal = closeGuidelinesModal;
window.toggleNotifPref = toggleNotifPref;
window.filterChatMessages = filterChatMessages;
window.clearChatSearch = clearChatSearch;
window.handleChatTyping = handleChatTyping;
window.resolveReport = resolveReport;
window.haptic = haptic;
window.hapticLight = hapticLight;
window.hapticMedium = hapticMedium;
window.hapticHeavy = hapticHeavy;
window.showRetryUI = showRetryUI;
window.renderEmptyState = renderEmptyState;
window.setupPullToRefresh = setupPullToRefresh;

window.state = state;

function handleDeepLink() {
  var hash = window.location.hash || '';
  var match = hash.match(/#item-(.+)/);
  if (match && match[1]) {
    var itemId = match[1];
    // Wait for items to load, then open
    var checkAndOpen = function() {
      var item = findItem(itemId);
      if (item) {
        switchPage('browse');
        openItemDetail(itemId);
      }
    };
    // Try immediately, then retry after items load
    checkAndOpen();
    var retries = 0;
    var retryInterval = setInterval(function() {
      retries++;
      if (findItem(itemId) || retries > 10) {
        clearInterval(retryInterval);
        checkAndOpen();
      }
    }, 500);
  }
}

// ===== NAMESPACE: Reduce global pollution =====
// Centralize frequently-used utilities under GeoGive namespace
window.GeoGive = {
  escHtml: escHtml,
  escJs: escJs,
  sanitizeUrl: sanitizeUrl,
  handleError: handleError,
  showToast: showToast,
  showLoading: showLoading,
  switchPage: switchPage,
  openItemDetail: openItemDetail,
  trackEvent: trackEvent,
  rateLimit: rateLimit,
  renderAnalyticsDashboard: renderAnalyticsDashboard,
  clearAnalyticsData: clearAnalyticsData,
  haptic: haptic,
  hapticLight: hapticLight,
  hapticMedium: hapticMedium,
  hapticHeavy: hapticHeavy,
  showRetryUI: showRetryUI,
  renderEmptyState: renderEmptyState
};

// ===== PWA INSTALL PROMPT =====
var deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', function(e) {
  e.preventDefault();
  deferredInstallPrompt = e;
  // Show install button after 30 seconds or on 3rd visit
  var visitCount = parseInt(localStorage.getItem('geogive_visits') || '0') + 1;
  localStorage.setItem('geogive_visits', visitCount.toString());
  if (visitCount >= 3) {
    showInstallPrompt();
  }
});

function showInstallPrompt() {
  if (!deferredInstallPrompt) return;
  // Add a small banner at bottom offering install
  if (document.getElementById('installBanner')) return;
  var banner = document.createElement('div');
  banner.id = 'installBanner';
  banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#2d8a4e;color:white;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;z-index:999;font-size:0.85rem';
  banner.innerHTML = '<span>📲 Install GeoGive for the full app experience!</span>' +
    '<div>' +
    '<button id="installBtn" style="background:white;color:#2d8a4e;border:none;padding:6px 14px;border-radius:6px;font-weight:600;cursor:pointer;margin-right:8px">Install</button>' +
    '<button id="dismissInstall" style="background:none;border:none;color:white;cursor:pointer;font-size:1.2rem">✕</button>' +
    '</div>';
  document.body.appendChild(banner);

  document.getElementById('installBtn').onclick = function() {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(function() {
      banner.remove();
      deferredInstallPrompt = null;
      trackEvent('pwa_installed');
    });
  };
  document.getElementById('dismissInstall').onclick = function() {
    banner.remove();
    localStorage.setItem('geogive_install_dismissed', 'true');
  };
}

window.addEventListener('appinstalled', function() {
  trackEvent('pwa_installed');
  localStorage.setItem('geogive_installed', 'true');
});
