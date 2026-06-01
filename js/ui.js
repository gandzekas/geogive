function showToast(msg) { var t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); setTrackedTimeout(function() { t.classList.remove('show'); }, 2500); }

function showLoading(show) { document.getElementById('loadingOverlay').classList.toggle('active', show); }

function showConnIndicator(connected) { var el = document.getElementById('connIndicator'); el.style.display = 'block'; el.className = 'conn-indicator' + (connected ? '' : ' offline'); el.title = connected ? 'Connected' : 'Offline'; }

function buildItemCard(item) {
  var emoji = CATEGORY_EMOJI[item.category] || '📦';
  var bg = CATEGORY_COLORS[item.category] || '#f5f5f5';
  var isOwn = window.state.user && item.ownerId === window.state.user.id;
  var hasPhotos = item.photos && item.photos.length > 0;
  var distDisplay = item.distance ? item.distance.toFixed(1) + ' mi' : (item.location ? item.location : '');
  var expired = isItemExpired(item);
  var expiringSoon = isExpiringSoon(item);
  var cardClass = 'item-card' + (expired ? ' expired' : '');
  var card = '<article class="' + cardClass + '" tabindex="0" onclick="openItemDetail(\'' + item.id + '\')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();openItemDetail(\'' + item.id + '\')}" aria-label="' + item.title + ', ' + item.condition + '">';
  if (hasPhotos) { card += '<div class="item-image"><img src="' + item.photos[0] + '" alt="' + escHtml(item.title) + '" loading="lazy"></div>'; }
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
  if (!isOwn && item.status === 'available' && !expired) { card += '<div class="item-actions"><button class="btn btn-primary btn-sm" onclick="event.stopPropagation();requestItem(\'' + item.id + '\')">I\'ll Take It</button></div>'; }
  else if (expired && isOwn) { card += '<div class="item-actions"><button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();renewItem(\'' + item.id + '\')">🔄 Renew</button></div>'; }
  else if (isOwn) { card += '<div class="item-actions"><span class="badge status-available">Your listing</span></div>'; }
  else if (expired) { card += '<div class="item-actions"><span class="badge badge-expired">Expired</span></div>'; }
  card += '</div></article>';
  return card;
}

function openItemDetail(itemId) {
  var item = findItem(itemId); if (!item) return;
  var emoji = CATEGORY_EMOJI[item.category] || '📦';
  var bg = CATEGORY_COLORS[item.category] || '#f5f5f5';
  var isOwn = window.state.user && item.ownerId === window.state.user.id;
  var expired = isItemExpired(item);
  var expiringSoon = isExpiringSoon(item);
  document.getElementById('modalTitle').textContent = item.title;
  var body = '';
  if (item.photos && item.photos.length > 0) { body += '<div class="item-image" style="height:180px;border-radius:8px;margin-bottom:16px;overflow:hidden"><img src="' + item.photos[0] + '" style="width:100%;height:100%;object-fit:cover" alt="' + escHtml(item.title) + '"></div>'; }
  else { body += '<div class="item-image" style="background:' + bg + ';height:180px;border-radius:8px;margin-bottom:16px;display:flex;align-items:center;justify-content:center" aria-hidden="true">' + getCategoryIconHtml(item.category, 80) + '</div>'; }
  body += '<div class="item-meta" style="margin-bottom:12px">';
  body += '<span class="badge badge-category">' + getCategoryIconHtml(item.category, 16) + ' ' + (CATEGORY_DISPLAY[item.category] || (item.category || 'other')) + '</span> ';
  body += '<span class="badge badge-condition">' + item.condition + '</span> ';
  if (expired) body += '<span class="badge badge-expired">⏰ Expired</span> ';
  else if (expiringSoon) body += '<span class="badge badge-expiring">⏰ Expires in ' + daysUntilExpiry(item) + ' days</span> ';
  if (item.distance) body += '<span class="badge badge-distance">📍 ' + item.distance.toFixed(1) + ' mi away</span>';
  body += '</div>';
  body += '<p style="margin-bottom:12px;line-height:1.5">' + escHtml(item.desc || 'No description provided.') + '</p>';
  body += '<p style="font-size:0.85rem;color:#666;margin-bottom:16px">Listed by <strong><a href="#" onclick="event.stopPropagation();showUserProfile(\'' + escHtml(item.ownerId) + '\')" style="color:var(--green);text-decoration:none">' + escHtml(item.ownerName || 'Anonymous') + '</a></strong> · ' + timeAgo(item.createdAt) + '</p>';
  if (!isOwn && item.status === 'available' && !expired) { body += '<button class="btn btn-primary" style="width:100%;padding:12px;font-size:1rem" onclick="closeModal(\'itemModal\');requestItem(\'' + item.id + '\')">🎁 I\'ll Take It</button>'; }
  else if (expired && isOwn) { body += '<button class="btn btn-secondary" style="width:100%;padding:12px;font-size:1rem" onclick="renewItem(\'' + item.id + '\');closeModal(\'itemModal\');">🔄 Renew Item</button>'; body += '<p style="font-size:0.85rem;color:var(--gray-400);margin-top:8px;text-align:center">Expired items are hidden from browse. Renew to relist.</p>'; }
  else if (isOwn) { body += '<p style="color:var(--green);font-weight:600">This is your listing</p>'; }
  else if (expired) { body += '<p style="color:#b71c1c;font-weight:600">⏰ This item has expired</p>'; }
  document.getElementById('modalBody').innerHTML = body;
  lastFocusedElement = document.activeElement;
  document.getElementById('itemModal').classList.add('active');
  setTimeout(function() {
    var closeBtn = document.querySelector('#itemModal .modal-close');
    if (closeBtn) closeBtn.focus();
  }, 300);
}

function requestItem(itemId) { var item = findItem(itemId); if (item) createRequest(item); }

function closeModal(id) { document.getElementById(id).classList.remove('active'); if (lastFocusedElement && lastFocusedElement.focus) { setTimeout(function() { lastFocusedElement.focus(); }, 100); } }

function switchPage(page) {
  if ((page === 'list' || page === 'mylistings' || page === 'requests') && !window.state.user) { openAuthModal(); showToast('Please sign in first.'); return; }
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  var t = document.getElementById('page-' + page); if (t) t.classList.add('active');
  document.querySelectorAll('.nav-tab').forEach(function(tab) { tab.classList.remove('active'); tab.setAttribute('aria-selected', 'false'); });
  var at = document.getElementById('tab-' + page); if (at) { at.classList.add('active'); at.setAttribute('aria-selected', 'true'); }
  if (page === 'browse') applyFilters();
  if (page === 'mylistings') renderMyListings();
  if (page === 'requests') { loadRequestsFromSupabase().then(function() { renderRequests(); }); }
}

function renderBrowse() {
  var container = document.getElementById('browseList');
  var items = getFilteredItems();
  if (window.state.userLocation) { items.sort(function(a, b) { return (a.distance || 999) - (b.distance || 999); }); }

  // First page or "load more"
  if (window.state.currentPage === 1) {
    if (items.length === 0) { container.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><p>No items found nearby. Try increasing the radius or listing something!</p></div>'; return; }
    var html = '';
    var pageItems = items.slice(0, window.state.pageSize);
    pageItems.forEach(function(item) { html += buildItemCard(item); });
    if (items.length > window.state.pageSize) {
      html += '<div id="loadMoreTrigger" style="height:1px"></div>';
    }
    container.innerHTML = html;
    setupInfiniteScroll();
  } else {
    // Append more items
    var start = (window.state.currentPage - 1) * window.state.pageSize;
    var end = start + window.state.pageSize;
    var pageItems = items.slice(start, end);
    var html = '';
    pageItems.forEach(function(item) { html += buildItemCard(item); });
    // Remove old trigger
    var oldTrigger = document.getElementById('loadMoreTrigger');
    if (oldTrigger) oldTrigger.remove();
    // Append
    var temp = document.createElement('div');
    temp.innerHTML = html;
    while (temp.firstChild) {
      container.appendChild(temp.firstChild);
    }
    if (end < items.length) {
      var trigger = document.createElement('div');
      trigger.id = 'loadMoreTrigger';
      trigger.style.height = '1px';
      container.appendChild(trigger);
      setupInfiniteScroll();
    }
  }
  window.state.isLoadingMore = false;
}

function setupInfiniteScroll() {
  // Disconnect previous observer to prevent leaks
  if (window.state.scrollObserver) { window.state.scrollObserver.disconnect(); window.state.scrollObserver = null; }
  var trigger = document.getElementById('loadMoreTrigger');
  if (!trigger || !('IntersectionObserver' in window)) return;
  var observer = new IntersectionObserver(function(entries) {
    if (entries[0].isIntersecting && !window.state.isLoadingMore) {
      window.state.isLoadingMore = true;
      window.state.currentPage++;
      renderBrowse();
    }
  }, { rootMargin: '200px' });
  observer.observe(trigger);
  window.state.scrollObserver = observer;
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
