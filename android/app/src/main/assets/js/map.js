function initMap() {
  if (window.state.map) return; // Already initialized
  var mapEl = document.getElementById('map');
  if (!mapEl) return;
  
  // Default to US center if no location
  var center = window.state.userLocation ? [window.state.userLocation.lat, window.state.userLocation.lng] : [39.8283, -98.5795];
  var zoom = window.state.userLocation ? 13 : 4;
  
  window.state.map = L.map('map').setView(center, zoom);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19
  }).addTo(window.state.map);
  
  // Add user location marker
  if (window.state.userLocation) {
    L.circleMarker([window.state.userLocation.lat, window.state.userLocation.lng], {
      radius: 8, fillColor: '#2d8a4e', color: '#fff', weight: 2, fillOpacity: 1
    }).addTo(window.state.map).bindPopup('<strong>📍 You are here</strong>');
  }
}

function renderMapMarkers() {
  if (!window.state.map) return;
  // Clear existing markers (except user location)
  window.state.mapMarkers.forEach(function(m) { window.state.map.removeLayer(m); });
  window.state.mapMarkers = [];
  
  var bounds = window.state.userLocation ? L.latLngBounds([[window.state.userLocation.lat, window.state.userLocation.lng]]) : L.latLngBounds();
  
  var filtered = getFilteredItems();
  filtered.forEach(function(item) {
    if (!item.lat || !item.lng) return; // Skip items without coordinates
    var emoji = CATEGORY_EMOJI[item.category] || '📦';
    var icon = L.divIcon({
      html: '<div style="font-size:1.5rem;text-align:center;line-height:30px;width:30px;height:30px;background:white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);border:2px solid ' + (CATEGORY_COLORS[item.category] || '#999') + '">' + emoji + '</div>',
      className: 'map-marker-icon',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });
    var marker = L.marker([item.lat, item.lng], { icon: icon })
      .addTo(window.state.map)
      .bindPopup(buildMapPopup(item));
    window.state.mapMarkers.push(marker);
    bounds.extend([item.lat, item.lng]);
  });
  
  if (window.state.mapMarkers.length > 0) {
    window.state.map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
  }
}

function buildMapPopup(item) {
  var emoji = CATEGORY_EMOJI[item.category] || '📦';
  var dist = item.distance ? item.distance.toFixed(1) + ' mi away' : '';
  var safeId = escHtml(item.id);
  return '<div class="map-popup">' +
    '<h4>' + emoji + ' ' + escHtml(item.title) + '</h4>' +
    '<p>' + escHtml(truncate(item.desc, 60)) + '</p>' +
    '<p><strong>' + dist + '</strong> · ' + escHtml(item.condition) + '</p>' +
    '<button class="btn btn-primary btn-sm" onclick="requestItem(\'' + safeId + '\')">I\'ll Take It</button>' +
    '</div>';
}

function setView(view) {
  window.state.currentView = view;
  document.getElementById('viewListBtn').classList.toggle('active', view === 'list');
  document.getElementById('viewMapBtn').classList.toggle('active', view === 'map');
  document.getElementById('mapContainer').classList.toggle('active', view === 'map');
  document.getElementById('browseList').style.display = view === 'list' ? '' : 'none';
  
  if (view === 'map') {
    initMap();
    // Need to wait for map to render after becoming visible
    setTimeout(function() {
      if (window.state.map) window.state.map.invalidateSize();
      renderMapMarkers();
    }, 100);
  }
}

function updateRadiusLabel() {
  var val = document.getElementById('radiusSlider').value;
  window.state.radiusMiles = parseInt(val);
  document.getElementById('radiusValue').textContent = val + ' mi';
}

function getFilteredItems() {
  var filter = document.getElementById('categoryFilter').value;
  var search = document.getElementById('searchInput').value.toLowerCase().trim();
  return window.state.items.filter(function(item) {
    if (item.status !== 'available') return false;
    if (filter !== 'all' && item.category !== filter) return false;
    if (search && item.title.toLowerCase().indexOf(search) === -1 && item.desc.toLowerCase().indexOf(search) === -1) return false;
    // Radius filter: only if we have user location AND item has real distance
    if (window.state.userLocation && item.distance && item.distance > window.state.radiusMiles) return false;
    return true;
  });
}

function applyFilters() {
  window.state.currentPage = 1; // Reset pagination on filter change
  renderBrowse();
  if (window.state.currentView === 'map' && window.state.map) {
    renderMapMarkers();
  }
}

function isItemExpired(item) {
  var createdAt = item.createdAt || (item.created_at ? new Date(item.created_at).getTime() : Date.now());
  var expiresAt = item.expiresAt || (item.expires_at ? new Date(item.expires_at).getTime() : (createdAt + 30 * 24 * 60 * 60 * 1000));
  return Date.now() > expiresAt;
}

function isExpiringSoon(item) {
  if (isItemExpired(item)) return false;
  var createdAt = item.createdAt || (item.created_at ? new Date(item.created_at).getTime() : Date.now());
  var expiresAt = item.expiresAt || (item.expires_at ? new Date(item.expires_at).getTime() : (createdAt + 30 * 24 * 60 * 60 * 1000));
  var daysLeft = (expiresAt - Date.now()) / (24 * 60 * 60 * 1000);
  return daysLeft <= 3;
}

function daysUntilExpiry(item) {
  var createdAt = item.createdAt || (item.created_at ? new Date(item.created_at).getTime() : Date.now());
  var expiresAt = item.expiresAt || (item.expires_at ? new Date(item.expires_at).getTime() : (createdAt + 30 * 24 * 60 * 60 * 1000));
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000)));
}

function toggleShowExpired() {
  var cb = document.getElementById('showExpiredToggle');
  if (cb) {
    localStorage.setItem('geogive_show_expired', cb.checked ? 'true' : 'false');
    applyFilters();
  }
}
