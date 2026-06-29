// ===== UI COMPONENTS =====

function showToast(msg) { var t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); setTrackedTimeout(function() { t.classList.remove('show'); }, 2500); }

function showLoading(show) { var el = document.getElementById('loadingOverlay'); if (el) el.style.display = show ? 'flex' : 'none'; }

function showSkeletonLoader(show) {
  var container = document.getElementById('itemList');
  if (!container) return;
  if (show) {
    var skeletons = '';
    for (var i = 0; i < 4; i++) {
      skeletons += '<div class="item-card skeleton-card"><div class="skeleton-image"></div><div class="skeleton-info"><div class="skeleton-line skeleton-line-title"></div><div class="skeleton-line skeleton-line-meta"></div><div class="skeleton-line skeleton-line-desc"></div></div></div>';
    }
    container.innerHTML = skeletons;
  }
}

function showConnIndicator(status) {
  var el = document.getElementById('connIndicator');
  if (!el) return;
  el.style.display = 'block';
  el.className = 'conn-indicator';
  if (status === 'offline') el.classList.add('offline');
  else if (status === 'syncing') el.classList.add('syncing');
  el.title = status === 'offline' ? 'Offline' : status === 'syncing' ? 'Syncing...' : 'Connected';
}

function buildItemCard(item) {
  var emoji = CATEGORY_EMOJI[item.category] || '📦';
  var bg = CATEGORY_COLORS[item.category] || '#f5f5f5';
  var isOwn = window.state.user && item.ownerId === window.state.user.id;
  var hasPhotos = item.photos && item.photos.length > 0;
  var distDisplay = item.distance ? item.distance.toFixed(1) + ' mi' : (item.location ? item.location : '');
  var expired = isItemExpired(item);
  var expiringSoon = isExpiringSoon(item);
  var cardClass = 'item-card' + (expired ? ' expired' : '');
  var card = '<article class="' + cardClass + '" tabindex="0" data-fn="openItemDetail" data-arg-expr="escJs(item.id)" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();openItemDetail(\'' + escJs(item.id) + '\')}" aria-label="' + escHtml(item.title) + ', ' + item.condition + '">';
  // Favorite heart button
  var isFav = isFavorite(item.id);
  card += '<button class="fav-btn" data-fn="toggleFavorite" data-arg-expr="escJs(item.id)" aria-label="Favorite" style="position:absolute;top:8px;right:8px;background:white;border:none;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,0.15);font-size:1.1rem;z-index:2">' + (isFav ? '❤️' : '🤍') + '</button>';
  if (hasPhotos) { card += '<div class="item-image"><img src="' + sanitizeUrl(item.photos[0]) + '" alt="' + escHtml(item.title) + '" loading="lazy"></div>'; }
  else { card += '<div class="item-image" style="background:' + bg + '" aria-hidden="true">' + getCategoryIconHtml(item.category, 48) + '</div>'; }
  card += '<div class="item-info">';
  card += '<div class="item-title">' + escHtml(item.title) + '</div>';
  card += '<div class="item-meta">';
  card += '<span class="badge badge-category">' + getCategoryIconHtml(item.category, 16) + ' ' + (CATEGORY_DISPLAY[item.category] || (item.category || 'other')) + '</span>';
  card += '<span class="badge badge-condition">' + item.condition + '</span>';
  if (distDisplay) card += '<span class="badge badge-distance">📍 ' + distDisplay + '</span>';
  if (expired) card += '<span class="badge badge-expired">⏰ Expired</span>';
  else if (expiringSoon) card += '<span class="badge badge-expiring">⏰ ' + daysUntilExpiry(item) + 'd left</span>';
  card += '</div>';
  card += '<div class="item-desc">' + escHtml(truncate(item.desc, 80)) + '</div>';
  // Show owner profile
  card += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;font-size:0.8rem;color:var(--gray-700)">';
  card += '<div class="profile-avatar">' + escHtml((item.ownerName || 'A').charAt(0).toUpperCase()) + '</div>';
  card += '<span>' + escHtml(item.ownerName || 'Anonymous') + '</span>';
  card += '</div>';
  if (!isOwn && item.status === 'available' && !expired) { card += '<div class="item-actions"><button class="btn btn-primary btn-sm" data-fn="requestItem" data-arg-expr="escJs(item.id)">I\'ll Take It</button></div>'; }
  else if (expired && isOwn) { card += '<div class="item-actions"><button class="btn btn-secondary btn-sm" data-fn="renewItem" data-arg-expr="escJs(item.id)">🔄 Renew</button></div>'; }
  else if (isOwn) { card += '<div class="item-actions"><span class="badge status-available">Your listing</span></div>'; }
  else if (expired) { card += '<div class="item-actions"><span class="badge badge-expired">Expired</span></div>'; }
  card += '</div></article>';
  return card;
}

function openItemDetail(itemId) {
  var item = findItem(itemId); if (!item) return;
  trackViewedItem(itemId);
  var emoji = CATEGORY_EMOJI[item.category] || '📦';
  var bg = CATEGORY_COLORS[item.category] || '#f5f5f5';
  var isOwn = window.state.user && item.ownerId === window.state.user.id;
  var expired = isItemExpired(item);
  var expiringSoon = isExpiringSoon(item);

  // Build the detail content inside itemModalContent
  var content = document.getElementById('itemModalContent');
  if (!content) return;

  var body = '';
  body += '<div style="padding:16px">';
  body += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
  body += '<h3 style="margin:0;flex:1">' + escHtml(item.title) + '</h3>';
  body += '<button data-fn="closeModal" data-arg="itemModalOverlay" style="background:none;border:none;font-size:1.5rem;cursor:pointer;padding:4px 8px">✕</button>';
  body += '</div>';

  if (item.photos && item.photos.length > 0) {
    body += '<div style="height:180px;border-radius:8px;margin-bottom:16px;overflow:hidden;background:#eee"><img src="' + sanitizeUrl(item.photos[0]) + '" style="width:100%;height:100%;object-fit:cover" alt="' + escHtml(item.title) + '"></div>';
  } else {
    body += '<div style="background:' + bg + ';height:180px;border-radius:8px;margin-bottom:16px;display:flex;align-items:center;justify-content:center;font-size:4rem">' + emoji + '</div>';
  }

  body += '<div class="item-meta" style="margin-bottom:12px">';
  body += '<span class="badge badge-category">' + getCategoryIconHtml(item.category, 16) + ' ' + (CATEGORY_DISPLAY[item.category] || (item.category || 'other')) + '</span> ';
  body += '<span class="badge badge-condition">' + item.condition + '</span> ';
  if (expired) body += '<span class="badge badge-expired">⏰ Expired</span> ';
  else if (expiringSoon) body += '<span class="badge badge-expiring">⏰ Expires in ' + daysUntilExpiry(item) + ' days</span> ';
  if (item.distance) body += '<span class="badge badge-distance">📍 ' + item.distance.toFixed(1) + ' mi away</span>';
  body += '</div>';

  body += '<p style="margin-bottom:12px;line-height:1.5">' + escHtml(item.desc || 'No description provided.') + '</p>';
  body += '<p style="font-size:0.85rem;color:#666;margin-bottom:16px">Listed by <strong>' + escHtml(item.ownerName || 'Anonymous') + '</strong> · ' + timeAgo(item.createdAt) + '</p>';

  if (!isOwn && item.status === 'available' && !expired) {
    body += '<button class="btn btn-primary" style="width:100%;padding:12px;font-size:1rem" data-fn="requestItem" data-arg-expr="escJs(item.id)" data-closemodal="itemModalOverlay">🎁 I\'ll Take It</button>';
    body += '<button class="btn btn-secondary" style="width:100%;padding:12px;font-size:1rem;margin-top:8px" data-fn="shareItem" data-arg-expr="escJs(item.id)">📤 Share</button>';
    body += '<button class="btn btn-secondary" style="width:100%;padding:12px;font-size:1rem;margin-top:8px" data-fn="closeModal" data-arg="itemModalOverlay">🚩 Report</button>';
  } else if (expired && isOwn) {
    body += '<button class="btn btn-secondary" style="width:100%;padding:12px;font-size:1rem" data-fn="renewItem" data-arg-expr="escJs(item.id)" data-closemodal="itemModalOverlay">🔄 Renew Item</button>';
    body += '<p style="font-size:0.85rem;color:var(--gray-400);margin-top:8px;text-align:center">Expired items are hidden from browse. Renew to relist.</p>';
    body += '<button class="btn btn-secondary" style="width:100%;padding:12px;font-size:1rem;margin-top:8px" data-fn="closeModal" data-arg="itemModalOverlay">🚩 Report</button>';
  } else if (isOwn) {
    body += '<p style="color:var(--green);font-weight:600">This is your listing</p>';
    body += '<button class="btn btn-secondary" style="width:100%;padding:12px;font-size:1rem;margin-top:8px" data-fn="switchPage" data-arg="mylistings" data-closemodal="itemModalOverlay">📦 Manage Listing</button>';
  } else if (expired) {
    body += '<p style="color:#b71c1c;font-weight:600">⏰ This item has expired</p>';
    body += '<button class="btn btn-secondary" style="width:100%;padding:12px;font-size:1rem;margin-top:8px" data-fn="closeModal" data-arg="itemModalOverlay">🚩 Report</button>';
  }

  body += '</div>';
  content.innerHTML = body;
  document.getElementById('itemModalOverlay').style.display = 'flex';
}

function requestItem(itemId) { var item = findItem(itemId); if (item) createRequest(item); }

function closeModal(id) { var el = document.getElementById(id); if (el) el.style.display = 'none'; }

// ===== ONBOARDING =====
var onboardingStep = 1;

function showOnboarding() {
  onboardingStep = 1;
  updateOnboardingUI();
  document.getElementById('onboardingModalOverlay').style.display = 'flex';
}

function updateOnboardingUI() {
  for (var i = 1; i <= 3; i++) {
    var step = document.getElementById('onboardingStep' + i);
    var dot = document.getElementById('dot' + i);
    if (step) step.style.display = i === onboardingStep ? '' : 'none';
    if (dot) dot.className = 'onboarding-dot' + (i === onboardingStep ? ' active' : '');
  }
  var btn = document.getElementById('onboardingNextBtn');
  if (btn) btn.textContent = onboardingStep === 3 ? "Let's Go!" : 'Next';
}

function nextOnboardingStep() {
  if (onboardingStep < 3) {
    onboardingStep++;
    updateOnboardingUI();
  } else {
    skipOnboarding();
  }
}

function skipOnboarding() {
  localStorage.setItem('geogive_onboarded', 'true');
  closeModal('onboardingModalOverlay');
}

function switchPage(page) {
  if ((page === 'post' || page === 'mylistings' || page === 'requests') && !window.state.user) { openAuthModal(); showToast('Please sign in first.'); return; }

  // Cleanup infinite scroll observer when leaving browse
  if (window.state.scrollObserver && page !== 'browse') {
    window.state.scrollObserver.disconnect();
    window.state.scrollObserver = null;
    var sentinel = document.getElementById('scrollSentinel');
    if (sentinel) sentinel.remove();
  }

  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  var t = document.getElementById('page-' + page); if (t) t.classList.add('active');
  document.querySelectorAll('.nav-tab').forEach(function(tab) { tab.classList.remove('active'); tab.setAttribute('aria-selected', 'false'); });
  // Update nav tab active state
  var tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(function(tab) {
    if (tab.getAttribute('data-page') === page) { tab.classList.add('active'); tab.setAttribute('aria-selected', 'true'); }
  });
  if (page === 'browse') {
    // Reset pagination when navigating to browse
    window.state.browsePage = 1;
    window.state.isLoadingMore = false;
    window.state.browseHasMore = true;
    applyFilters();
  }
  if (page === 'mylistings') renderMyListings();
  if (page === 'requests') { loadRequestsFromSupabase().then(function() { renderRequests(); }); }
  if (page === 'profile') renderProfile();
  trackPageView(page);
}

function renderBrowse() {
  var container = document.getElementById('itemList');
  if (!container) return;
  var items = getFilteredItems();
  if (window.state.userLocation) { items.sort(function(a, b) { return (a.distance || 999) - (b.distance || 999); }); }

  // Store all filtered items for pagination
  window.state.allFilteredItems = items;

  // Reset pagination on new filter/search
  if (!window.state.isLoadingMore) {
    window.state.browsePage = 1;
    window.state.browseHasMore = items.length > window.state.pageSize;
  }

  var pageSize = window.state.pageSize;
  var start = 0;
  var end = window.state.browsePage * pageSize;
  var pageItems = items.slice(start, end);

  if (pageItems.length === 0 && window.state.browsePage === 1) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><p>No items found nearby. Try increasing the radius or listing something!</p></div>';
    return;
  }

  var html = '';
  pageItems.forEach(function(item) { html += buildItemCard(item); });

  if (window.state.browsePage === 1) {
    container.innerHTML = html;
  } else {
    container.insertAdjacentHTML('beforeend', html);
  }

  // Update hasMore
  window.state.browseHasMore = end < items.length;

  // Setup infinite scroll observer
  setupInfiniteScroll();
}

function setupInfiniteScroll() {
  var container = document.getElementById('itemList');
  if (!container) return;

  // Clean up old observer
  if (window.state.scrollObserver) {
    window.state.scrollObserver.disconnect();
  }

  if (!window.state.browseHasMore || window.state.isLoadingMore) return;

  window.state.scrollObserver = new IntersectionObserver(function(entries) {
    var target = entries[0];
    if (target.isIntersecting && !window.state.isLoadingMore && window.state.browseHasMore) {
      loadMoreItems();
    }
  }, { rootMargin: '200px', threshold: 0 });

  // Observe a sentinel element at the end
  var sentinel = document.getElementById('scrollSentinel');
  if (!sentinel) {
    sentinel = document.createElement('div');
    sentinel.id = 'scrollSentinel';
    sentinel.style.height = '1px';
    container.appendChild(sentinel);
  }
  window.state.scrollObserver.observe(sentinel);
}

function loadMoreItems() {
  if (window.state.isLoadingMore || !window.state.browseHasMore) return;
  window.state.isLoadingMore = true;

  var container = document.getElementById('itemList');
  var sentinel = document.getElementById('scrollSentinel');
  if (sentinel) sentinel.textContent = 'Loading...';

  window.state.browsePage++;
  var pageSize = window.state.pageSize;
  var start = (window.state.browsePage - 1) * pageSize;
  var end = window.state.browsePage * pageSize;
  var items = window.state.allFilteredItems.slice(start, end);

  var html = '';
  items.forEach(function(item) { html += buildItemCard(item); });
  container.insertAdjacentHTML('beforeend', html);

  window.state.browseHasMore = end < window.state.allFilteredItems.length;
  window.state.isLoadingMore = false;

  if (sentinel) sentinel.textContent = '';
}

function renderMyListings() {
  var container = document.getElementById('myListings');
  if (!container || !window.state.user) return;
  var myItems = window.state.items.filter(function(i) { return i.ownerId === window.state.user.id; });
  if (myItems.length === 0) { container.innerHTML = '<div class="empty-state"><div class="empty-icon">📦</div><p>You haven\'t listed any items yet.</p><button class="btn btn-primary" style="margin-top:12px" data-fn="switchPage" data-arg="post">🎁 Post Your First Item</button></div>'; return; }
  var html = '';
  myItems.forEach(function(item) {
    html += buildItemCard(item);
    var isOwn = true;
    var expired = isItemExpired(item);
    html += '<div style="display:flex;gap:8px;margin:-4px 0 12px 0;padding:0 4px">';
    if (!expired) html += '<button class="btn btn-sm btn-secondary" data-fn="bumpItem" data-arg-expr="escJs(item.id)">⬆️ Bump</button>';
    html += '<button class="btn btn-sm btn-danger" data-fn="deleteItem" data-arg-expr="escJs(item.id)">🗑️ Delete</button>';
    html += '</div>';
  });
  container.innerHTML = html;
}

function renderRequests() {
  var container = document.getElementById('requestsList');
  if (!container || !window.state.user) return;
  var myReqs = window.state.requests.filter(function(r) { return r.requesterId === window.state.user.id || r.ownerId === window.state.user.id; });
  if (myReqs.length === 0) { container.innerHTML = '<div class="empty-state"><div class="empty-icon">📨</div><p>No requests yet.</p></div>'; return; }
  var html = '';
  myReqs.forEach(function(req) {
    html += '<div class="item-card">';
    html += '<div class="item-info">';
    html += '<div class="item-title">' + escHtml(req.itemTitle) + '</div>';
    html += '<div class="item-meta"><span class="badge">' + (req.requesterId === window.state.user.id ? 'You requested this' : 'From: ' + escHtml(req.requesterName)) + '</span>';
    html += '<span class="badge badge-condition">' + req.status + '</span></div>';
    if (req.status === 'pending' && req.ownerId === window.state.user.id) {
      html += '<div class="item-actions" style="margin-top:8px">';
      html += '<button class="btn btn-primary btn-sm" data-fn="respondToRequest" data-arg-expr="escJs(req.id)" data-arg2="accepted">Accept</button> ';
      html += '<button class="btn btn-secondary btn-sm" data-fn="respondToRequest" data-arg-expr="escJs(req.id)" data-arg2="declined">Decline</button>';
      html += '</div>';
    }
    html += '</div></div>';
  });
  container.innerHTML = html;

  // Update badge count
  var pendingCount = myReqs.filter(function(r) { return r.status === 'pending' && r.ownerId === window.state.user.id; }).length;
  var badge = document.getElementById('requestsBadge');
  if (badge) {
    badge.textContent = pendingCount;
    badge.style.display = pendingCount > 0 ? '' : 'none';
  }
}

function seedData() {
  var now = Date.now();
  window.state.items = [
    { id: 'seed1', title: 'Vintage Denim Jacket', desc: 'Classic 90s denim jacket, size M.', category: 'clothing', condition: 'Good', location: '90210', ownerId: 'sarah_k', ownerName: 'Sarah K.', distance: 1.2, status: 'available', createdAt: now - 3600000, expiresAt: now + 29 * 24 * 60 * 60 * 1000, photos: [], lat: 34.0901, lng: -118.4065 },
    { id: 'seed2', title: 'IKEA KALLAX Shelf Unit', desc: '4x4 cube storage unit in white.', category: 'furniture', condition: 'Good', location: '90215', ownerId: 'mike_r', ownerName: 'Mike R.', distance: 2.8, status: 'available', createdAt: now - 7200000, expiresAt: now + 28 * 24 * 60 * 60 * 1000, photos: [], lat: 34.0689, lng: -118.4452 },
    { id: 'seed3', title: 'Nintendo Switch + 3 Games', desc: 'Neon red/blue Switch with Mario Kart, Zelda.', category: 'electronics', condition: 'Like New', location: '90208', ownerId: 'alex_t', ownerName: 'Alex T.', distance: 0.5, status: 'available', createdAt: now - 1800000, expiresAt: now + 5 * 24 * 60 * 60 * 1000, photos: [], lat: 34.0522, lng: -118.2437 },
    { id: 'seed4', title: 'Cookbook Collection (12 books)', desc: 'Assorted cookbooks — Julia Child, Salt Fat Acid Heat.', category: 'books', condition: 'Fair', location: '90212', ownerId: 'jenny_l', ownerName: 'Jenny L.', distance: 3.1, status: 'available', createdAt: now - 5400000, expiresAt: now + 27 * 24 * 60 * 60 * 1000, photos: [], lat: 34.0736, lng: -118.4005 },
    { id: 'seed5', title: 'Yoga Mat + Blocks', desc: 'Barely used yoga mat with 2 foam blocks.', category: 'sports', condition: 'Like New', location: '90211', ownerId: 'expired_user', ownerName: 'Old Seller', distance: 1.5, status: 'available', createdAt: now - 31 * 24 * 60 * 60 * 1000, expiresAt: now - 1 * 24 * 60 * 60 * 1000, photos: [], lat: 34.0622, lng: -118.3056 }
  ];
  localStorage.setItem('geogive_items_cache', JSON.stringify(window.state.items));
}
