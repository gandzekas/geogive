// ===== REQUESTS =====

function normalizeRequest(r) {
  return {
    id: r.id, itemId: r.item_id || '', requesterId: r.requester_id || '',
    requesterName: r.requester_name || 'Someone', ownerId: r.owner_id || '',
    ownerName: r.owner_name || 'Owner', itemTitle: r.item_title || 'Unknown Item',
    status: r.status || 'pending', createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now()
  };
}

async function createRequest(item) {
  if (!window.state.user) { openAuthModal(); showToast('Please sign in to request items.'); return; }
  var sb = getSupabase();
  if (!sb) return createRequestLocal(item);
  try {
    var { data: reqData, error } = await withRetry(function() {
      return sb.from('requests').insert({
        item_id: item.id, requester_id: window.state.user.id, owner_id: item.ownerId,
        item_title: item.title, requester_name: (window.state.userProfile && window.state.userProfile.display_name) || window.state.user.email.split('@')[0],
        owner_name: item.ownerName, status: 'pending', created_at: new Date().toISOString()
      }).select().single();
    }, { maxAttempts: 2, baseDelay: 500 });
    if (error) throw error;
    var chatId = buildChatId(item.ownerId, window.state.user.id, item.id);
    try {
      await sb.from('chats').insert({ id: chatId, request_id: reqData.id, item_id: item.id, item_title: item.title, participant_1: item.ownerId, participant_2: window.state.user.id, messages: [{ from: 'system', text: 'Request sent for "' + item.title + '"', createdAt: Date.now() }], created_at: new Date().toISOString() });
    } catch(chatError) { console.warn('Chat creation failed:', chatError); }
    window.state.requests.push(normalizeRequest(reqData));
    window.state.chats[chatId] = { id: chatId, itemId: item.id, itemTitle: item.title, participants: [item.ownerId, window.state.user.id], messages: [{ from: 'system', text: 'Request sent for "' + item.title + '"', createdAt: Date.now() }] };
    saveChatsToStorage();
    saveRequestsToStorage();
    showToast('Request sent! Check the Requests tab.');
    trackEvent('request_sent', { item_id: item.id });
    addNotif('Request Sent', 'You requested "' + item.title + '". The giver will be notified.');
    switchPage('requests');
  } catch(e) { createRequestLocal(item); }
}

function createRequestLocal(item) {
  if (!window.state.user) { openAuthModal(); return; }
  var existing = window.state.requests.filter(function(r) { return r.itemId === item.id && r.requesterId === window.state.user.id; });
  if (existing.length > 0) { showToast('You already requested this item!'); return; }
  var request = { id: 'req_' + Date.now(), itemId: item.id, requesterId: window.state.user.id, requesterName: 'You', ownerId: item.ownerId, ownerName: item.ownerName, itemTitle: item.title, status: 'pending', createdAt: Date.now() };
  window.state.requests.push(request);
  var chatId = buildChatId(item.ownerId, window.state.user.id, item.id);
  if (!window.state.chats[chatId]) { window.state.chats[chatId] = { id: chatId, itemId: item.id, itemTitle: item.title, participants: [item.ownerId, window.state.user.id], messages: [{ from: item.ownerId, text: 'Hi! I saw you requested my ' + item.title + '. When would be a good time for pickup?', createdAt: Date.now() }] }; }
  saveChatsToStorage();
  saveRequestsToStorage();
  showToast('Request sent! Check the Requests tab.');
    trackEvent('request_sent', { item_id: item.id });
  addNotif('Request Sent', 'You requested "' + item.title + '". The giver will be notified.');
  switchPage('browse');
}

async function loadRequestsFromSupabase() {
  var sb = getSupabase();
  if (!sb || !window.state.user) return loadRequestsFromStorage();
  try {
    var { data, error } = await withRetry(function() {
      return sb.from('requests').select('*').or('requester_id.eq.' + window.state.user.id + ',owner_id.eq.' + window.state.user.id).order('created_at', { ascending: false });
    }, { maxAttempts: 2, baseDelay: 500 });
    if (error) throw error;
    window.state.requests = (data || []).map(normalizeRequest);
    saveRequestsToStorage();
    await loadChatsFromSupabase();
  } catch(e) { loadRequestsFromStorage(); }
}

function loadRequestsFromStorage() { try { var c = localStorage.getItem('geogive_requests_cache'); if (c) window.state.requests = JSON.parse(c); } catch(e) {} }

function saveRequestsToStorage() { try { localStorage.setItem('geogive_requests_cache', JSON.stringify(window.state.requests)); } catch(e) {} }

function respondToRequest(reqId, action) {
  var req = window.state.requests.find(function(r) { return r.id === reqId; });
  if (!req) return;
  if (req.status !== 'pending') { showToast('This request has already been ' + req.status); return; }

  if (action === 'declined') {
    confirmAction('Decline this request? The requester will be notified.', function() {
      processResponse(reqId, action);
    });
  } else {
    processResponse(reqId, action);
  }
}

function processResponse(reqId, action) {
  var req = window.state.requests.find(function(r) { return r.id === reqId; });
  if (!req) return;
  req.status = action;
  var msg = action === 'accepted' ? 'Your request for "' + req.itemTitle + '" was accepted! 🎉' : 'Your request for "' + req.itemTitle + '" was declined.';
  addNotif('Request ' + (action === 'accepted' ? 'Accepted' : 'Declined'), msg);
  var sb = getSupabase();
  if (sb) {
    sb.from('requests').update({ status: action, updated_at: new Date().toISOString() }).eq('id', reqId)
      .then(function(result) {
        if (result && result.error) console.warn('respondToRequest: server update failed:', result.error.message);
      })
      .catch(function(e) { console.warn('respondToRequest: server update error:', e); });
  }
  var chatId = buildChatId(req.ownerId, req.requesterId, req.itemId);
  var chat = window.state.chats[chatId];
  if (chat) {
    chat.messages.push({ from: 'system', text: action === 'accepted' ? 'Request accepted! Arrange a pickup time.' : 'Request declined.', createdAt: Date.now() });
    saveChatsToStorage();
  }
  showToast(action === 'accepted' ? 'Request accepted! ✓' : 'Request declined.');

  // Show safety tips on first acceptance
  if (action === 'accepted') {
    setTrackedTimeout(function() { showSafetyTips(); }, 500);
  }

  renderRequests();
  saveRequestsToStorage();
}
