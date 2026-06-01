function queueOfflineAction(action, data) {
  window.state.offlineQueue.push({ action: action, data: data || null, timestamp: Date.now() });
  localStorage.setItem('geogive_offline_queue', JSON.stringify(window.state.offlineQueue));
}

async function replayOfflineQueue() {
  if (window.state.offlineQueue.length === 0) return;
  var queue = window.state.offlineQueue.slice();
  window.state.offlineQueue = [];
  localStorage.setItem('geogive_offline_queue', '[]');
  var failed = [];
  // Process sequentially to handle async operations correctly
  for (var i = 0; i < queue.length; i++) {
    var item = queue[i];
    try {
      if (!supabase) { failed.push(item); continue; }
      if (item.action === 'listItem' && item.data) {
        // Supabase save is async; we await to ensure sequential writes
        // The function itself falls back to localStorage on any error
        await saveItemToSupabase(item.data);
      } else if (item.action === 'requestItem' && item.data) {
        var it = findItem(item.data.itemId);
        if (it) await createRequest(it);
        else failed.push(item);
      }
    } catch(e) { failed.push(item); }
  }
  // Re-queue failures
  if (failed.length > 0) {
    window.state.offlineQueue = failed.concat(window.state.offlineQueue);
    localStorage.setItem('geogive_offline_queue', JSON.stringify(window.state.offlineQueue));
  }
  var successCount = queue.length - failed.length;
  if (successCount > 0) showToast('Synced ' + successCount + ' offline action(s)');
}

function handleOfflineSubmit(item) {
  if (!isOnline || !supabase) {
    queueOfflineAction('listItem', item);
    showToast('You\'re offline. Item will be listed when back online.');
    return true; // Was queued
  }
  return false; // Not queued, proceed normally
}
