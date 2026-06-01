function setTrackedTimeout(fn, ms) {
  var id = setTimeout(function() { fn(); removeTimer(id); }, ms);
  window.timers.push(id);
  return id;
}

function removeTimer(id) { var i = window.timers.indexOf(id); if (i > -1) window.timers.splice(i, 1); }

function clearAllTimers() { window.timers.forEach(function(id) { clearTimeout(id); }); timers = []; }

function escHtml(str) { var d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; }

function truncate(str, n) { return (str || '').length > n ? str.substring(0, n) + '...' : (str || ''); }

function timeAgo(ts) { if (!ts) return ''; var diff = Math.floor((Date.now() - ts) / 1000); if (diff < 60) return 'just now'; if (diff < 3600) return Math.floor(diff / 60) + 'm ago'; if (diff < 86400) return Math.floor(diff / 3600) + 'h ago'; return Math.floor(diff / 86400) + 'd ago'; }

function getCategoryIconHtml(category, size) {
  size = size || 24;
  var cat = category || 'other';
  if (CATEGORY_ICONS[cat]) {
    return '<span class="cat-icon" style="width:' + size + 'px;height:' + size + 'px;display:inline-flex;align-items:center;justify-content:center">' + CATEGORY_ICONS[cat].replace('viewBox="0 0 24 24"', 'viewBox="0 0 24 24" width="' + size + '" height="' + size + '"') + '</span>';
  }
  return '<span style="font-size:' + (size * 0.8) + 'px">' + (CATEGORY_EMOJI[cat] || '📦') + '</span>';
}

function debounceSearch() { if (window.state.searchTimer) clearTimeout(window.state.searchTimer); window.state.searchTimer = setTimeout(function() { applyFilters(); }, 300); }
