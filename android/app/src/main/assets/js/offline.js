// ===== OFFLINE QUEUE =====

function queueOfflineAction(action, data) {
  window.state.offlineQueue.push({ action: action, data: data || null, timestamp: Date.now() });
  localStorage.setItem('geogive_offline_queue', JSON.stringify(window.state.offlineQueue));
}

async function replayOfflineQueue() {
  var sb = getSupabase();
  if (window.state.offlineQueue.length === 0) return;
  var queue = window.state.offlineQueue.slice();
  window.state.offlineQueue = [];
  localStorage.setItem('geogive_offline_queue', '[]');
  var failed = [];
  for (var i = 0; i < queue.length; i++) {
    var item = queue[i];
    try {
      if (!sb) { failed.push(item); continue; }
      if (item.action === 'listItem' && item.data) {
        await saveItemToSupabase(item.data);
      } else if (item.action === 'requestItem' && item.data) {
        var it = findItem(item.data.itemId);
        if (it) await createRequest(it);
        else failed.push(item);
      }
    } catch(e) { failed.push(item); }
  }
  if (failed.length > 0) {
    window.state.offlineQueue = failed.concat(window.state.offlineQueue);
    localStorage.setItem('geogive_offline_queue', JSON.stringify(window.state.offlineQueue));
  }
  var successCount = queue.length - failed.length;
  if (successCount > 0) showToast('Synced ' + successCount + ' offline action(s)');
}

function handleOfflineSubmit(item) {
  var sb = getSupabase();
  if (!isOnline || !sb) {
    queueOfflineAction('listItem', item);
    showToast('You\'re offline. Item will be listed when back online.');
    return true;
  }
  return false;
}
