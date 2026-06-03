// ===== UTILITY FUNCTIONS =====

function setTrackedTimeout(fn, ms) {
  var id = setTimeout(function() { fn(); removeTimer(id); }, ms);
  window.timers.push(id);
  return id;
}

function removeTimer(id) { var i = window.timers.indexOf(id); if (i > -1) window.timers.splice(i, 1); }

function clearAllTimers() { window.timers.forEach(function(id) { clearTimeout(id); }); timers = []; }

function escHtml(str) { var d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; }

function escJs(str) { return String(str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;'); }

function truncate(str, n) { return (str || '').length > n ? str.substring(0, n) + '...' : (str || ''); }

function timeAgo(ts) { if (!ts) return ''; var diff = Math.floor((Date.now() - ts) / 1000); if (diff < 60) return 'just now'; if (diff < 3600) return Math.floor(diff / 60) + 'm ago'; if (diff < 86400) return Math.floor(diff / 3600) + 'h ago'; return Math.floor(diff / 86400) + 'd ago'; }

function getCategoryIconHtml(category, size) {
  size = size || 24;
  var cat = category || 'other';
  return '<span style="font-size:' + (size * 0.8) + 'px">' + (CATEGORY_EMOJI[cat] || '📦') + '</span>';
}

function debounceSearch() { if (window.state.searchTimer) clearTimeout(window.state.searchTimer); window.state.searchTimer = setTimeout(function() { applyFilters(); }, 300); }

// ===== EXPIRY HELPERS =====

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
