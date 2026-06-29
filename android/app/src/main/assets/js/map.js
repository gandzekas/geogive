// ===== MAP =====

function initMap() {
  if (window.state.map) return;
  var mapEl = document.getElementById("map");
  if (!mapEl) return;

  var center = window.state.userLocation
    ? [window.state.userLocation.lat, window.state.userLocation.lng]
    : [39.8283, -98.5795];
  var zoom = window.state.userLocation ? 13 : 4;

  window.state.map = L.map("map").setView(center, zoom);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap",
    maxZoom: 19,
  }).addTo(window.state.map);

  // Initialize marker cluster group
  window.state.markerCluster = L.markerClusterGroup({
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    maxClusterRadius: 50,
    iconCreateFunction: function (cluster) {
      var count = cluster.getChildCount();
      var size = count < 10 ? "small" : count < 100 ? "medium" : "large";
      return L.divIcon({
        html:
          '<div class="marker-cluster marker-cluster-' +
          size +
          '"><span>' +
          count +
          "</span></div>",
        className: "marker-cluster-custom",
        iconSize:
          size === "small" ? [40, 40] : size === "medium" ? [50, 50] : [60, 60],
        iconAnchor:
          size === "small" ? [20, 20] : size === "medium" ? [25, 25] : [30, 30],
      });
    },
  });
  window.state.map.addLayer(window.state.markerCluster);

  if (window.state.userLocation) {
    L.circleMarker(
      [window.state.userLocation.lat, window.state.userLocation.lng],
      {
        radius: 8,
        fillColor: "#2d8a4e",
        color: "#fff",
        weight: 2,
        fillOpacity: 1,
      },
    )
      .addTo(window.state.map)
      .bindPopup("<strong>📍 You are here</strong>");
  }
}

function renderMapMarkers() {
  if (!window.state.map) return;

  // Clear existing markers from cluster
  if (window.state.markerCluster) {
    window.state.markerCluster.clearLayers();
  }

  // Reset mapMarkers array for compatibility
  window.state.mapMarkers = [];

  var bounds = L.latLngBounds();

  var filtered = getFilteredItems();
  var markers = [];

  filtered.forEach(function (item) {
    if (!item.lat || !item.lng) return;
    var emoji = CATEGORY_EMOJI[item.category] || "📦";
    var icon = L.divIcon({
      html:
        '<div style="font-size:1.5rem;text-align:center;line-height:30px;width:30px;height:30px;background:white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);border:2px solid ' +
        (CATEGORY_COLORS[item.category] || "#999") +
        '">' +
        emoji +
        "</div>",
      className: "map-marker-icon",
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });
    var marker = L.marker([item.lat, item.lng], { icon: icon }).bindPopup(
      buildMapPopup(item),
    );
    markers.push(marker);
    bounds.extend([item.lat, item.lng]);
    window.state.mapMarkers.push(marker);
  });

  // Add all markers to cluster group
  if (markers.length > 0 && window.state.markerCluster) {
    window.state.markerCluster.addLayers(markers);
  }

  // Extend bounds with user location for fitBounds padding
  if (window.state.userLocation) {
    bounds.extend([window.state.userLocation.lat, window.state.userLocation.lng]);
  }

  if (window.state.mapMarkers.length > 0) {
    window.state.map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
  }
}

function buildMapPopup(item) {
  var emoji = CATEGORY_EMOJI[item.category] || "📦";
  var dist = item.distance ? item.distance.toFixed(1) + " mi away" : "";
  var safeId = String(item.id).replace(/'/g, "\\'");
  return (
    '<div class="map-popup">' +
    "<h4>" +
    emoji +
    " " +
    escHtml(item.title) +
    "</h4>" +
    "<p>" +
    escHtml(truncate(item.desc, 60)) +
    "</p>" +
    "<p><strong>" +
    dist +
    "</strong> · " +
    escHtml(item.condition) +
    "</p>" +
    '<button class="btn btn-primary btn-sm" data-fn="requestItem" data-arg-expr="safeId">I\'ll Take It</button>' +
    "</div>"
  );
}

function setView(view) {
  window.state.currentView = view;
  document
    .getElementById("viewListBtn")
    .classList.toggle("active", view === "list");
  document
    .getElementById("viewMapBtn")
    .classList.toggle("active", view === "map");
  var mapContainer = document.getElementById("mapContainer");
  var itemList = document.getElementById("itemList");
  if (mapContainer) {
    if (view === "map") {
      mapContainer.classList.add("active");
    } else {
      mapContainer.classList.remove("active");
    }
  }
  if (itemList) itemList.style.display = view === "list" ? "" : "none";

  if (view === 'map') {
    initMap();
    setTrackedTimeout(function () {
      if (window.state.map) window.state.map.invalidateSize();
      renderMapMarkers();
    }, 100);
  }
}

function updateRadiusLabel(val) {
  window.state.radiusMiles = parseInt(val);
  document.getElementById("radiusValue").textContent = val + " mi";
  applyFilters();
}

function getFilteredItems() {
  var filter = document.getElementById("categoryFilter").value;
  var statusFilter = document.getElementById("statusFilter")
    ? document.getElementById("statusFilter").value
    : "available";
  var search = document
    .getElementById("searchInput")
    .value.toLowerCase()
    .trim();
  return window.state.items.filter(function (item) {
    // Hide items from blocked users
    if (item.ownerId && isUserBlocked(item.ownerId)) return false;
    // Hide flagged items
    if (item.status === 'flagged') return false;
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    // Hide expired items unless explicitly showing all
    if (statusFilter !== "all" && isItemExpired(item)) return false;
    if (filter !== "" && item.category !== filter) return false;
    if (
      search &&
      item.title.toLowerCase().indexOf(search) === -1 &&
      item.desc.toLowerCase().indexOf(search) === -1
    )
      return false;
    if (
      window.state.userLocation &&
      item.distance &&
      item.distance > (window.state.radiusMiles || 10)
    )
      return false;
    return true;
  });
}

function applyFilters() {
  // Reset pagination when filters change
  window.state.browsePage = 1;
  window.state.isLoadingMore = false;
  window.state.browseHasMore = true;

  renderBrowse();
  if (window.state.currentView === "map" && window.state.map) {
    renderMapMarkers();
  }
}

function toggleShowExpired() {
  applyFilters();
}
