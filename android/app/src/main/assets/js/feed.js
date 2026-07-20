// GeoGive Feed Module (M37 — dynamically loaded)
// This module is lazy-loaded when the user first visits the Feed page.
// renderFeed() is defined in ui.js — this file confirms the module loaded.
window.GeoGiveFeed = {
  init: function() {
    console.log('[GeoGive] Feed module loaded');
  }
};
window.GeoGiveFeed.init();
