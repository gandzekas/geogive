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
