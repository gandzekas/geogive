// ===== MAP =====

function initMap() {
  if (window.state.map) return;
  var mapEl = document.getElementById('map');
  if (!mapEl) return;

  var center = window.state.userLocation ? [window.state.userLocation.lat, window.state.userLocation.lng] : [39.8283, -98.5795];
  var zoom = window.state.userLocation ? 13 : 4;

  window.state.map = L.map('map').setView(center, zoom);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 19
  }).addTo(window.state.map);

  if (window.state.userLocation) {
    L.circleMarker([window.state.userLocation.lat, window.state.userLocation.lng], {
      radius: 8, fillColor: '#2d8a4e', color: '#fff', weight: 2, fillOpacity: 1
    }).addTo(window.state.map).bindPopup('<strong>📍 You are here</strong>');
  }
}

function renderMapMarkers() {
  if (!window.state.map) return;
  window.state.mapMarkers.forEach(function(m) { window.state.map.removeLayer(m); });
  window.state.mapMarkers = [];

  var bounds = window.state.userLocation ? L.latLngBounds([[window.state.userLocation.lat, window.state.userLocation.lng]]) : L.latLngBounds();

  var filtered = getFilteredItems();
  filtered.forEach(function(item) {
    if (!item.lat || !item.lng) return;
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
  var mapContainer = document.getElementById('mapContainer');
  var itemList = document.getElementById('itemList');
  if (mapContainer) {
    if (view === 'map') { mapContainer.classList.add('active'); } else { mapContainer.classList.remove('active'); }
  }
  if (itemList) itemList.style.display = view === 'list' ? '' : 'none';

  if (view === 'map') {
    initMap();
    setTimeout(function() {
      if (window.state.map) window.state.map.invalidateSize();
      renderMapMarkers();
    }, 100);
  }
}

function updateRadiusLabel(val) {
  window.state.radiusMiles = parseInt(val);
  document.getElementById('radiusValue').textContent = val + ' km';
}

function getFilteredItems() {
  var filter = document.getElementById('categoryFilter').value;
  var statusFilter = document.getElementById('statusFilter') ? document.getElementById('statusFilter').value : 'available';
  var search = document.getElementById('searchInput').value.toLowerCase().trim();
  return window.state.items.filter(function(item) {
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (filter !== '' && item.category !== filter) return false;
    if (search && item.title.toLowerCase().indexOf(search) === -1 && item.desc.toLowerCase().indexOf(search) === -1) return false;
    if (window.state.userLocation && item.distance && item.distance > (window.state.radiusMiles || 10)) return false;
    return true;
  });
}

function applyFilters() {
  renderBrowse();
  if (window.state.currentView === 'map' && window.state.map) {
    renderMapMarkers();
  }
}

function toggleShowExpired() {
  applyFilters();
}
