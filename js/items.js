function normalizeItem(item) {
  // Handle photos: can be from item_photos relation or legacy base64 array
  var photos = [];
  if (item.item_photos && Array.isArray(item.item_photos)) {
    photos = item.item_photos.sort(function(a,b) { return (a.order||0)-(b.order||0); }).map(function(p) { return p.url; });
  } else if (item.photos && Array.isArray(item.photos)) {
    photos = item.photos; // Legacy base64 fallback
  }
  var createdAt = item.created_at ? new Date(item.created_at).getTime() : Date.now();
  var expiresAt = item.expires_at ? new Date(item.expires_at).getTime() : (createdAt + 30 * 24 * 60 * 60 * 1000);
  return {
    id: item.id, title: item.title || '', desc: item.description || '',
    category: item.category || 'other', condition: item.condition || 'Good',
    location: item.zip || '', lat: item.lat || null, lng: item.lng || null,
    ownerId: item.owner_id || '', ownerName: (item.profiles && item.profiles.display_name) || 'Anonymous',
    distance: (typeof item.distance === 'number') ? item.distance : 0,
    status: item.status || 'available',
    createdAt: createdAt,
    expiresAt: expiresAt,
    photos: photos
  };
}

async function loadItemsFromSupabase() {
  if (!supabase) { loadItemsFromStorage(); return; }
  showLoading(true);
  try {
    var query;
    // Use PostGIS nearby search when we have user location
    if (window.state.userLocation && window.state.userLocation.lat && window.state.userLocation.lng) {
      var radiusMiles = window.state.radiusMiles || 10;
      var { data, error } = await window.supabaseClient.rpc('find_nearby_items', {
        user_lat: window.state.userLocation.lat,
        user_lng: window.state.userLocation.lng,
        radius_miles: radiusMiles,
        max_results: 200
      });
      if (error) throw error;
      // Normalize RPC results (different shape than table select)
      window.state.items = (data || []).map(function(item) {
        return {
          id: item.id, title: item.title || '', desc: item.description || '',
          category: item.category || 'other', condition: item.condition || 'Good',
          location: item.zip || '', lat: item.lat || null, lng: item.lng || null,
          ownerId: item.owner_id || '', ownerName: 'Anonymous',
          distance: item.distance_miles || 0,
          status: item.status || 'available',
          createdAt: item.created_at ? new Date(item.created_at).getTime() : Date.now(),
          photos: []
        };
      });
      // Load photos for these items
      var itemIds = window.state.items.map(function(i) { return i.id; });
      if (itemIds.length > 0) {
        var { data: photoData } = await window.supabaseClient.from('photos').select('item_id,url,order').in('item_id', itemIds);
        if (photoData) {
          window.state.items.forEach(function(item) {
            item.photos = photoData.filter(function(p) { return p.item_id === item.id; })
              .sort(function(a,b) { return (a.order||0)-(b.order||0); })
              .map(function(p) { return p.url; });
          });
        }
      }
    } else {
      // Fallback: load all available items (for when no location)
      query = window.supabaseClient.from('items').select('*, profiles:owner_id(display_name, avatar_url), item_photos:photos(url,order)').eq('status', 'available').order('created_at', { ascending: false }).limit(200);
      var { data, error } = await query;
      if (error) throw error;
      window.state.items = (data || []).map(normalizeItem);
      recalculateDistances();
    }
    localStorage.setItem('geogive_items_cache', JSON.stringify(window.state.items));
  } catch(e) { console.warn('Supabase load failed:', e); loadItemsFromStorage(); showLoading(false); return; }
  showLoading(false);
  applyFilters();
}

function loadItemsFromStorage() {
  try { var c = localStorage.getItem('geogive_items_cache'); window.state.items = c ? JSON.parse(c) : null; } catch(e) {}
  if (!window.state.items || window.state.items.length === 0) seedData();
  recalculateDistances();
  applyFilters();
}

async function saveItemToSupabase(item) {
  if (!supabase || !window.state.user) return saveItemToStorage(item);
  try {
    // Step 1: Insert item without photos
    var { data, error } = await window.supabaseClient.from('items').insert({
      title: item.title, description: item.desc, category: item.category,
      condition: item.condition, zip: item.location,
      lat: item.lat || (window.state.userLocation ? window.state.userLocation.lat : null),
      lng: item.lng || (window.state.userLocation ? window.state.userLocation.lng : null),
      owner_id: window.state.user.id, status: 'available', created_at: new Date().toISOString()
    }).select().single();
    if (error) throw error;

    var itemId = data.id;
    item.id = itemId; item.ownerId = window.state.user.id;
    item.ownerName = (window.state.userProfile && window.state.userProfile.display_name) || window.state.user.email.split('@')[0];
    item.createdAt = new Date(data.created_at).getTime();
    if (data.lat) item.lat = data.lat;
    if (data.lng) item.lng = data.lng;

    // Step 2: Upload photos to Supabase Storage
    var photoUrls = [];
    for (var i = 0; i < item.photos.length; i++) {
      var dataUrl = item.photos[i];
      // Skip if not a data URL (legacy) or already uploaded
      if (dataUrl.indexOf('data:') !== 0) { photoUrls.push(dataUrl); continue; }
      try {
        // Convert base64 to blob
        var parts = dataUrl.split(',');
        var mime = parts[0].match(/:(.*?);/);
        mime = mime ? mime[1] : 'image/jpeg';
        var bstr = atob(parts[1]);
        var u8arr = new Uint8Array(bstr.length);
        for (var j = 0; j < bstr.length; j++) u8arr[j] = bstr.charCodeAt(j);
        var blob = new Blob([u8arr], { type: mime });
        // Upload to storage
        var fileName = itemId + '/' + i + '.' + mime.split('/')[1];
        var { error: uploadErr } = await window.supabaseClient.storage.from('item-photos').upload(fileName, blob, { upsert: true });
        if (uploadErr) throw uploadErr;
        // Get public URL
        var { data: urlData } = window.supabaseClient.storage.from('item-photos').getPublicUrl(fileName);
        photoUrls.push(urlData.publicUrl);
      } catch(photoErr) {
        console.warn('Photo upload failed, keeping base64:', photoErr);
        photoUrls.push(dataUrl); // Fallback to base64
      }
    }

    // Step 3: Insert photo records
    if (photoUrls.length > 0) {
      var photoRecords = photoUrls.map(function(url, idx) { return { item_id: itemId, url: url, order: idx }; });
      await window.supabaseClient.from('photos').insert(photoRecords);
    }
    item.photos = photoUrls;
  } catch(e) { console.warn('Supabase save failed:', e); saveItemToStorage(item); }
}

function saveItemToStorage(item) {
  item.id = item.id || ('item_' + Date.now());
  item.ownerId = 'local_' + Math.random().toString(36).substr(2, 6);
  item.ownerName = 'You'; item.createdAt = item.createdAt || Date.now();
  if (window.state.userLocation && !item.lat) { item.lat = window.state.userLocation.lat; item.lng = window.state.userLocation.lng; }
  window.state.items.unshift(item);
  localStorage.setItem('geogive_items_cache', JSON.stringify(window.state.items));
}

async function deleteItemFromSupabase(itemId) {
  if (!supabase) { deleteItemFromStorage(itemId); return; }
  try { var { error } = await window.supabaseClient.from('items').delete().eq('id', itemId); if (error) throw error; deleteItemFromStorage(itemId); } catch(e) { showToast('Failed to delete on server. Removed locally.'); deleteItemFromStorage(itemId); }
}

function deleteItemFromStorage(itemId) { window.state.items = window.state.items.filter(function(i) { return i.id !== itemId; }); localStorage.setItem('geogive_items_cache', JSON.stringify(window.state.items)); }

async function updateItemStatus(itemId, status) {
  if (!supabase) { updateItemStatusLocal(itemId, status); return; }
  var item = findItem(itemId); var prev = item ? item.status : null;
  updateItemStatusLocal(itemId, status);
  try { var { error } = await window.supabaseClient.from('items').update({ status: status }).eq('id', itemId); if (error) throw error; } catch(e) { if (prev !== null) updateItemStatusLocal(itemId, prev); showToast('Failed to update. Changes reverted.'); }
}

function updateItemStatusLocal(itemId, status) { var item = findItem(itemId); if (item) item.status = status; localStorage.setItem('geogive_items_cache', JSON.stringify(window.state.items)); }

function renewItem(itemId) {
  var item = findItem(itemId);
  if (!item) return;
  // Reset expiration: set expiresAt to now + 30 days
  item.expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
  // Persist to Supabase if online
  if (supabase && window.state.user) {
    window.supabaseClient.from('items').update({ expires_at: new Date(item.expiresAt).toISOString() }).eq('id', itemId).then(function() {});
  }
  // Update localStorage
  try {
    var stored = JSON.parse(localStorage.getItem('geogive_items') || '[]');
    stored = stored.map(function(i) { if (i.id === itemId) i.expires_at = new Date(item.expiresAt).toISOString(); return i; });
    localStorage.setItem('geogive_items', JSON.stringify(stored));
  } catch(e) {}
  showToast('Item renewed for 30 days! 🔄');
  applyFilters();
}

function markGiven(itemId) { updateItemStatus(itemId, 'given'); renderMyListings(); showToast('Marked as given away! 🎉'); var item = findItem(itemId); if (item && !item.rated) { setTimeout(function() { showRatingPrompt(itemId, item.ownerId); }, 500); } }

async function deleteItem(itemId) {
  await deleteItemFromSupabase(itemId);
  renderMyListings(); showToast('Item deleted.');
}

async function handleListSubmit(e) {
  e.preventDefault();
  if (!window.state.user) { openAuthModal(); showToast('Please sign in to list items.'); return; }
  var item = {
    title: document.getElementById('itemName').value.trim(), desc: document.getElementById('itemDesc').value.trim(),
    category: document.getElementById('itemCategory').value, condition: document.getElementById('itemCondition').value,
    location: document.getElementById('itemLocation').value.trim(),
    lat: window.state.userLocation ? window.state.userLocation.lat : null, lng: window.state.userLocation ? window.state.userLocation.lng : null,
    photos: window.state.selectedImages.slice(0, MAX_IMAGES), distance: 0, status: 'available', createdAt: Date.now()
  };
  // Check if offline — queue instead of submitting
  if (handleOfflineSubmit(item)) {
    window.state.selectedImages = []; renderImagePreviews(); document.getElementById('listForm').reset();
    switchPage('browse');
    return;
  }
  showLoading(true); await saveItemToSupabase(item); showLoading(false);
  window.state.selectedImages = []; renderImagePreviews(); document.getElementById('listForm').reset();
  showToast('Item listed! 🎉'); switchPage('browse');
}

function findItem(id) { return window.state.items.find(function(i) { return i.id === id; }); }
