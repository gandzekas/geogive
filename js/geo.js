// ===== GEOLOCATION =====

function initGeolocation() {
  var statusEl = document.getElementById('locStatus');
  if (!navigator.geolocation) {
    window.state.locationStatus = 'denied';
    if (statusEl) {
      statusEl.className = 'loc-status denied';
      statusEl.innerHTML = '<span>📍</span> Location not supported';
    }
    return;
  }

  if (statusEl) {
    statusEl.className = 'loc-status pending';
    statusEl.innerHTML = '<span>📡</span> Detecting your location...';
  }

  navigator.geolocation.getCurrentPosition(
    function(pos) {
      window.state.userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      window.state.locationStatus = 'granted';
      if (statusEl) {
        statusEl.className = 'loc-status granted';
        statusEl.innerHTML = '<span>📍</span> Location found';
      }
      recalculateDistances();
      applyFilters();
      if (window.state.map && window.state.currentView === 'map') {
        window.state.map.setView([window.state.userLocation.lat, window.state.userLocation.lng], 13);
        renderMapMarkers();
      }
    },
    function(err) {
      window.state.locationStatus = 'denied';
      window.state.userLocation = null;
      if (statusEl) {
        statusEl.className = 'loc-status denied';
        if (err.code === 1) {
          statusEl.innerHTML = '<span>📍</span> Location denied — enable in browser settings';
        } else {
          statusEl.innerHTML = '<span>📍</span> Location unavailable';
        }
      }
      console.warn('Geolocation error:', err.code, err.message);
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 300000 }
  );
}

function haversineDistance(lat1, lng1, lat2, lng2) {
  var R = 3958.8;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLng = (lng2 - lng1) * Math.PI / 180;
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function recalculateDistances() {
  if (!window.state.userLocation) return;
  window.state.items.forEach(function(item) {
    if (item.lat && item.lng) {
      item.distance = haversineDistance(window.state.userLocation.lat, window.state.userLocation.lng, item.lat, item.lng);
    }
  });
}
