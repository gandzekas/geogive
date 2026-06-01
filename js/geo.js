function initGeolocation() {
  var statusEl = document.getElementById('locationStatus');
  if (!navigator.geolocation) {
    window.state.locationStatus = 'denied';
    statusEl.className = 'loc-status denied';
    statusEl.textContent = '📍 Location not available — enter zip code to set your area';
    return;
  }
  statusEl.className = 'loc-status pending';
  statusEl.textContent = '📍 Detecting your location...';
  
  navigator.geolocation.getCurrentPosition(
    function(pos) {
      window.state.userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      window.state.locationStatus = 'granted';
      statusEl.className = 'loc-status granted';
      statusEl.textContent = '📍 Location found — showing distances from your area';
      // Recalculate distances and re-render
      recalculateDistances();
      applyFilters();
      // If map view is active, update map center
      if (window.state.map && window.state.currentView === 'map') {
        window.state.map.setView([window.state.userLocation.lat, window.state.userLocation.lng], 13);
        renderMapMarkers();
      }
    },
    function(err) {
      window.state.locationStatus = 'denied';
      window.state.userLocation = null;
      statusEl.className = 'loc-status denied';
      if (err.code === 1) {
        statusEl.textContent = '📍 Location denied — enable location in browser settings or enter zip code manually';
      } else {
        statusEl.textContent = '📍 Location unavailable — enter zip code to set your area';
      }
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
  );
}

function haversineDistance(lat1, lng1, lat2, lng2) {
  var R = 3958.8; // Earth radius in miles
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLng = (lng2 - lng1) * Math.PI / 180;
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function zipToLatLng(zip) {
  // Use a simple approach: try to get from item's stored coordinates
  // For now, return null — real geocoding requires an API
  return null;
}

function recalculateDistances() {
  if (!window.state.userLocation) return;
  window.state.items.forEach(function(item) {
    // If item has lat/lng stored, use haversine
    if (item.lat && item.lng) {
      item.distance = haversineDistance(window.state.userLocation.lat, window.state.userLocation.lng, item.lat, item.lng);
    }
    // Otherwise distance stays as-is (random fallback or zip-based)
  });
}
