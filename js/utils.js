// ===== UTILITY FUNCTIONS =====
var DEBUG = false; // Set to true during development

function log() {
  if (DEBUG) console.log.apply(console, arguments);
}

function setTrackedTimeout(fn, ms) {
  var id = setTimeout(function() { fn(); removeTimer(id); }, ms);
  window.timers.push(id);
  return id;
}

function removeTimer(id) { var i = window.timers.indexOf(id); if (i > -1) window.timers.splice(i, 1); }

function escHtml(str) { var d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; }

// ===== CSRF PROTECTION =====
function generateNonce() {
  var array = new Uint8Array(16);
  if (window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(array);
  } else {
    for (var i = 0; i < 16; i++) array[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(array, function(b) { return b.toString(16).padStart(2, '0'); }).join('');
}

function storeNonce() {
  var nonce = generateNonce();
  sessionStorage.setItem('geogive_nonce', nonce);
  return nonce;
}

function verifyNonce(returnedNonce) {
  var stored = sessionStorage.getItem('geogive_nonce');
  sessionStorage.removeItem('geogive_nonce');
  return stored && stored === returnedNonce;
}

function escJs(str) { return String(str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, ''); }

function sanitizeError(error, context) {
  var msg = (error && error.message) ? error.message.toLowerCase() : '';
  var code = error && error.code;
  var status = error && error.status;

  // Auth errors
  if (msg.indexOf('invalid login') !== -1 || msg.indexOf('invalid credentials') !== -1) {
    return 'Invalid email or password.';
  }
  if (msg.indexOf('email not confirmed') !== -1 || msg.indexOf('confirm') !== -1) {
    return 'Please confirm your email first. Check your inbox.';
  }
  if (msg.indexOf('user already registered') !== -1 || msg.indexOf('already exists') !== -1) {
    return 'An account with this email already exists.';
  }
  if (msg.indexOf('weak password') !== -1 || msg.indexOf('password') !== -1) {
    return 'Password is too weak. Please use a stronger password.';
  }
  if (msg.indexOf('email') !== -1 && msg.indexOf('valid') !== -1) {
    return 'Please enter a valid email address.';
  }

  // Network errors
  if (msg.indexOf('network') !== -1 || msg.indexOf('fetch') !== -1 || status === 0) {
    return 'Network error. Please check your connection.';
  }
  if (status === 429 || msg.indexOf('rate limit') !== -1) {
    return 'Too many requests. Please wait a moment and try again.';
  }
  if (status >= 500 || msg.indexOf('internal') !== -1) {
    return 'Server error. Please try again later.';
  }
  if (status === 403 || msg.indexOf('forbidden') !== -1 || msg.indexOf('unauthorized') !== -1) {
    return 'You don\'t have permission to do that.';
  }
  if (status === 404 || msg.indexOf('not found') !== -1) {
    return 'That item no longer exists.';
  }

  // Storage errors
  if (msg.indexOf('storage') !== -1 || msg.indexOf('upload') !== -1) {
    return 'Failed to upload file. Please try a smaller image.';
  }

  // RLS / permission errors
  if (code === '42501' || msg.indexOf('row level security') !== -1 || msg.indexOf('permission') !== -1) {
    return 'Permission denied.';
  }

  // Generic fallback — never expose raw error
  if (context) {
    return 'Something went wrong with ' + context + '. Please try again.';
  }
  return 'Something went wrong. Please try again.';
}

function handleError(e, context) {
  console.error('[GeoGive]', context || 'error', e);
  var msg = sanitizeError(e, context);
  showToast('⚠️ ' + msg);
}

// ===== RETRY LOGIC =====
var RETRYABLE_STATUS = [408, 429, 500, 502, 503, 504];

function isRetryableError(error) {
  if (!error) return false;
  // Network errors (no response)
  if (error.message && error.message.toLowerCase().includes('network')) return true;
  if (error.message && error.message.toLowerCase().includes('fetch')) return true;
  if (error.message && error.message.toLowerCase().includes('timeout')) return true;
  if (error.message && error.message.toLowerCase().includes('timed out')) return true;
  // HTTP status codes worth retrying
  if (error.status && RETRYABLE_STATUS.indexOf(error.status) !== -1) return true;
  if (error.code && error.code === 'PGRST301') return true; // Supabase connection error
  return false;
}

async function withRetry(fn, options) {
  options = options || {};
  var maxAttempts = options.maxAttempts || 3;
  var baseDelay = options.baseDelay || 1000;
  var timeout = options.timeout || 15000; // 15s default timeout
  var onRetry = options.onRetry;
  var lastError;

  for (var attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Add timeout to each attempt
      var result = await Promise.race([
        fn(),
        new Promise(function(_, reject) {
          setTimeout(function() {
            reject(new Error('Request timed out'));
          }, timeout);
        })
      ]);
      return result;
    } catch (e) {
      lastError = e;
      if (attempt < maxAttempts && isRetryableError(e)) {
        var delay = baseDelay * Math.pow(2, attempt - 1);
        if (onRetry) onRetry(attempt, delay, e);
        await new Promise(function(resolve) { setTimeout(resolve, delay); });
      } else {
        throw e;
      }
    }
  }
  throw lastError;
}

function sanitizeUrl(url) {
  if (!url) return '';
  var s = String(url).trim();
  if (s.match(/^data:image\/(jpeg|png|gif|webp);base64,/i)) return s;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.charAt(0) === '/' || s.charAt(0) === '.' || s.charAt(0) === '#') return s;
  return '';
}

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

// ===== FAVORITES =====

function getFavorites() {
  try {
    var favs = localStorage.getItem('geogive_favorites');
    return favs ? JSON.parse(favs) : [];
  } catch(e) { return []; }
}

function saveFavorites(favs) {
  try { localStorage.setItem('geogive_favorites', JSON.stringify(favs)); } catch(e) {}
}

function isFavorite(itemId) {
  return getFavorites().indexOf(String(itemId)) !== -1;
}

function toggleFavorite(itemId) {
  hapticMedium();
  var favs = getFavorites();
  var id = String(itemId);
  var idx = favs.indexOf(id);
  if (idx > -1) {
    favs.splice(idx, 1);
    showToast('Removed from favorites');
  } else {
    favs.unshift(id);
    showToast('Added to favorites ❤️');
  }
  saveFavorites(favs);
  if (document.getElementById('page-browse').classList.contains('active')) renderBrowse();
  if (document.getElementById('page-mylistings').classList.contains('active')) renderMyListings();
}

function shareItem(itemId) {
  var item = findItem(itemId);
  if (!item) return;
  var shareData = {
    title: '🎁 ' + item.title + ' — Free on GeoGive',
    text: item.title + ' (' + item.condition + ') — free on GeoGive! ' + (item.desc || '').substring(0, 100),
    url: window.location.origin + window.location.pathname + '#item-' + itemId
  };
  if (navigator.share) {
    navigator.share(shareData).catch(function() {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(shareData.url).then(function() {
      showToast('📋 Link copied to clipboard!');
    });
  } else {
    prompt('Copy this link:', shareData.url);
  }
}

function confirmAction(message, onConfirm) {
  if (window.confirm(message)) {
    onConfirm();
  }
}

// ===== RATE LIMITING =====
var rateLimits = {};

function rateLimit(key, intervalMs, callback) {
  intervalMs = intervalMs || 2000; // 2 second default
  var now = Date.now();
  if (rateLimits[key] && (now - rateLimits[key]) < intervalMs) {
    return false; // rate limited
  }
  rateLimits[key] = now;
  if (callback) callback();
  return true;
}

function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  // RFC 5322 simplified — checks for basic valid format
  var re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email)) return false;
  // Additional checks
  if (email.length > 254) return false;
  var parts = email.split('@');
  if (parts[0].length > 64) return false; // local part max 64 chars
  return true;
}

// ===== ANALYTICS =====
function trackEvent(eventName, params) {
  try {
    var events = JSON.parse(localStorage.getItem('geogive_analytics') || '[]');
    events.push({
      event: eventName,
      params: params || {},
      timestamp: Date.now(),
      session: sessionStorage.getItem('geogive_session') || 'unknown'
    });
    // Keep only last 500 events
    if (events.length > 500) events = events.slice(-500);
    localStorage.setItem('geogive_analytics', JSON.stringify(events));
  } catch(e) {}
}

function trackPageView(pageName) {
  trackEvent('page_view', { page: pageName });
}

// Initialize session ID
if (!sessionStorage.getItem('geogive_session')) {
  sessionStorage.setItem('geogive_session', generateNonce().substring(0, 8));
}

function trackViewedItem(itemId) {
  try {
    var viewed = JSON.parse(localStorage.getItem('geogive_viewed') || '[]');
    viewed = viewed.filter(function(id) { return id !== itemId; });
    viewed.unshift(itemId);
    if (viewed.length > 20) viewed = viewed.slice(0, 20);
    localStorage.setItem('geogive_viewed', JSON.stringify(viewed));
  } catch(e) {}
}

// ===== ANALYTICS DASHBOARD =====
function renderAnalyticsDashboard() {
  try {
    var events = JSON.parse(localStorage.getItem('geogive_analytics') || '[]');
    var sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    var lastWeekEvents = events.filter(function(e) { return e.timestamp >= sevenDaysAgo; });

    // Count by type
    var pageViews = events.filter(function(e) { return e.event === 'page_view'; }).length;
    var itemsPosted = events.filter(function(e) { return e.event === 'item_posted'; }).length;
    var requestsSent = events.filter(function(e) { return e.event === 'request_sent'; }).length;
    var signIns = events.filter(function(e) { return e.event === 'user_signed_in'; }).length;

    // Most active day in last 7 days
    var dayCounts = {};
    lastWeekEvents.forEach(function(e) {
      var d = new Date(e.timestamp);
      var dayKey = d.toLocaleDateString('en-US', { weekday: 'short' });
      dayCounts[dayKey] = (dayCounts[dayKey] || 0) + 1;
    });
    var mostActive = '—';
    var maxCount = 0;
    Object.keys(dayCounts).forEach(function(day) {
      if (dayCounts[day] > maxCount) { maxCount = dayCounts[day]; mostActive = day + ' (' + maxCount + ')'; }
    });

    // Update DOM
    var set = function(id, val) {
      var el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    set('analyticsTotal', events.length);
    set('analyticsPageViews', pageViews);
    set('analyticsItemsPosted', itemsPosted);
    set('analyticsRequests', requestsSent);
    set('analyticsSignIns', signIns);
    set('analyticsLastWeek', lastWeekEvents.length);
    set('analyticsMostActive', mostActive);
  } catch(e) { log('renderAnalyticsDashboard error:', e); }
}

function clearAnalyticsData() {
  try {
    localStorage.removeItem('geogive_analytics');
    renderAnalyticsDashboard();
    showToast('Analytics data cleared.');
  } catch(e) { showToast('Failed to clear data.'); }
}

// ===== TRUST SCORE (M20) =====
function calculateTrustScore(userId) {
  if (!userId) return 0;
  var score = 50; // Base score for new users
  
  // Get ratings for this user
  var ratings = getRatingsForUser(userId);
  if (ratings.length > 0) {
    var avgRating = ratings.reduce(function(sum, r) { return sum + r.rating; }, 0) / ratings.length;
    // Ratings contribute up to 30 points (avg 5 stars = 30 points)
    score += Math.round((avgRating / 5) * 30);
  } else {
    score += 15; // Neutral for unrated users
  }
  
  // Completed giveaways: +5 per giveaway, max 15
  var giveawaysCompleted = getGiveawaysCompleted(userId);
  score += Math.min(giveawaysCompleted * 5, 15);
  
  // Response rate: based on requests responded to
  var responseRate = getResponseRate(userId);
  // Response rate contributes up to 5 points
  score += Math.round(responseRate * 5);
  
  return Math.min(100, Math.max(0, score));
}

function getTrustLevel(score) {
  if (score >= 80) return { level: 'Trusted', color: '#2d8a4e', icon: '�️' };
  if (score >= 60) return { level: 'Reliable', color: '#4caf50', icon: '✓' };
  if (score >= 40) return { level: 'Newcomer', color: '#ff9800', icon: '🌱' };
  return { level: 'Unverified', color: '#9e9e9e', icon: '?' };
}

function trustBadgeHtml(userId) {
  var score = calculateTrustScore(userId);
  var level = getTrustLevel(score);
  return '<span class="trust-badge" style="background:' + level.color + '20;color:' + level.color + ';padding:2px 8px;border-radius:10px;font-size:0.7rem;font-weight:600;text-align:center;white-space:nowrap">' +
    level.icon + ' ' + level.level + ' (' + score + ')</span>';
}

function getRatingsForUser(userId) {
  try {
    var r = localStorage.getItem('geogive_ratings_' + userId);
    return r ? JSON.parse(r) : [];
  } catch(e) { return []; }
}

function getGiveawaysCompleted(userId) {
  var items = window.state.items.filter(function(i) { return i.ownerId === userId && i.status === 'given'; });
  return items.length;
}

function getResponseRate(userId) {
  var totalReqs = window.state.requests.filter(function(r) { return r.ownerId === userId && r.status !== 'pending'; });
  var allReqs = window.state.requests.filter(function(r) { return r.ownerId === userId; });
  if (allReqs.length === 0) return 0.5; // Neutral
  return totalReqs.length / allReqs.length;
}

function daysUntilExpiry(item) {
  var createdAt = item.createdAt || (item.created_at ? new Date(item.created_at).getTime() : Date.now());
  var expiresAt = item.expiresAt || (item.expires_at ? new Date(item.expires_at).getTime() : (createdAt + 30 * 24 * 60 * 60 * 1000));
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000)));
}
