// ===== ITEM CRUD =====

function normalizeItem(item) {
  var photos = [];
  if (item.item_photos && Array.isArray(item.item_photos)) {
    photos = item.item_photos
      .sort(function (a, b) {
        return (a.order || 0) - (b.order || 0);
      })
      .map(function (p) {
        return p.url;
      });
  } else if (item.photos && Array.isArray(item.photos)) {
    photos = item.photos;
  }
  var createdAt = item.created_at
    ? new Date(item.created_at).getTime()
    : Date.now();
  var expiresAt = item.expires_at
    ? new Date(item.expires_at).getTime()
    : createdAt + 30 * 24 * 60 * 60 * 1000;
  return {
    id: item.id,
    title: item.title || "",
    desc: item.description || "",
    category: item.category || "other",
    condition: item.condition || "Good",
    location: item.zip || "",
    lat: item.lat || null,
    lng: item.lng || null,
    ownerId: item.owner_id || "",
    ownerName: (item.profiles && item.profiles.display_name) || "Anonymous",
    distance: typeof item.distance === "number" ? item.distance : 0,
    status: item.status || "available",
    createdAt: createdAt,
    expiresAt: expiresAt,
    photos: photos,
  };
}

async function loadItemsFromSupabase() {
  var sb = getSupabase();
  if (!sb) {
    loadItemsFromStorage();
    return;
  }
  showSkeletonLoader(true);
  try {
    var query;
    if (
      window.state.userLocation &&
      window.state.userLocation.lat &&
      window.state.userLocation.lng
    ) {
      try {
        var rpcResult = await withRetry(function() {
          return sb.rpc("find_nearby_items", {
            user_lat: window.state.userLocation.lat,
            user_lng: window.state.userLocation.lng,
            radius_miles: window.state.radiusMiles || 10,
            max_results: 200,
          });
        }, { maxAttempts: 2, baseDelay: 500 });
        var data = rpcResult.data;
        var error = rpcResult.error;
        if (!error && data) {
          window.state.items = (data || []).map(function (item) {
            var createdAt = item.created_at
              ? new Date(item.created_at).getTime()
              : Date.now();
            var expiresAt = item.expires_at
              ? new Date(item.expires_at).getTime()
              : createdAt + 30 * 24 * 60 * 60 * 1000;
            return {
              id: item.id,
              title: item.title || "",
              desc: item.description || "",
              category: item.category || "other",
              condition: item.condition || "Good",
              location: item.zip || "",
              lat: item.lat || null,
              lng: item.lng || null,
              ownerId: item.owner_id || "",
              ownerName: "Anonymous",
              distance: item.distance_miles || 0,
              status: item.status || "available",
              createdAt: createdAt,
              expiresAt: expiresAt,
              photos: [],
            };
          });
          recalculateDistances();
          localStorage.setItem(
            "geogive_items_cache",
            JSON.stringify(window.state.items),
          );
          showLoading(false);
          applyFilters();
          return;
        }
      } catch (rpcErr) {
        console.warn("RPC failed, falling back to direct query", rpcErr);
      }
    }

    // Fallback: direct table query with optional search
    query = sb
      .from("items")
      .select(
        "*, profiles:owner_id(display_name, avatar_url), item_photos:photos(url,order)",
      )
      .eq("status", "available")
      .order("created_at", { ascending: false })
      .limit(200);

    // Add server-side search if user has typed a query
    var searchInput = document.getElementById("searchInput");
    if (searchInput && searchInput.value.trim()) {
      var searchTerm = searchInput.value.trim().toLowerCase();
      searchTerm = searchTerm.replace(/%/g, '\\%').replace(/_/g, '\\_');
      query = query.or("title.ilike.%" + searchTerm + "%,description.ilike.%" + searchTerm + "%");
    }

    var queryResult = await withRetry(function() { return query; }, { maxAttempts: 2, baseDelay: 500 });
    var data = queryResult.data;
    var error = queryResult.error;
    if (error) throw error;
    window.state.items = (data || []).map(normalizeItem);
    recalculateDistances();
    localStorage.setItem(
      "geogive_items_cache",
      JSON.stringify(window.state.items),
    );
  } catch (e) {
    handleError(e, "load items");
    loadItemsFromStorage();
    showLoading(false);
    return;
  }
  showLoading(false);
  applyFilters();
}

function loadItemsFromStorage() {
  try {
    var c = localStorage.getItem("geogive_items_cache");
    window.state.items = c ? JSON.parse(c) : null;
  } catch (e) {}
  if (!window.state.items || window.state.items.length === 0) seedData();
  recalculateDistances();
  applyFilters();
}

async function saveItemToSupabase(item) {
  var sb = getSupabase();
  if (!sb || !window.state.user) return saveItemToStorage(item);
  try {
    var result = await withRetry(function() {
      return sb
        .from("items")
        .insert({
          title: item.title,
          description: item.desc,
          category: item.category,
          condition: item.condition,
          zip: item.location,
          lat: item.lat || (window.state.userLocation ? window.state.userLocation.lat : null),
          lng: item.lng || (window.state.userLocation ? window.state.userLocation.lng : null),
          owner_id: window.state.user.id,
          status: "available",
          created_at: new Date().toISOString(),
        })
        .select()
        .single();
    }, { maxAttempts: 2, baseDelay: 500 });
    var data = result.data;
    var error = result.error;
    if (error) throw error;

    var itemId = data.id;
    item.id = itemId;
    item.ownerId = window.state.user.id;
    item.ownerName =
      (window.state.userProfile && window.state.userProfile.display_name) ||
      window.state.user.email.split("@")[0];
    item.createdAt = new Date(data.created_at).getTime();
    if (data.lat) item.lat = data.lat;
    if (data.lng) item.lng = data.lng;

    // Upload photos
    var photoUrls = [];
    for (var i = 0; i < item.photos.length; i++) {
      var dataUrl = item.photos[i];
      if (dataUrl.indexOf("data:") !== 0) {
        photoUrls.push(dataUrl);
        continue;
      }
      try {
        var parts = dataUrl.split(",");
        var mimeMatch = parts[0].match(/:(.*?);/);
        var mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
        var bstr = atob(parts[1]);
        var u8arr = new Uint8Array(bstr.length);
        for (var j = 0; j < bstr.length; j++) u8arr[j] = bstr.charCodeAt(j);
        var blob = new Blob([u8arr], { type: mime });
        var fileName = itemId + "/" + i + "." + mime.split("/")[1];
        var { error: uploadErr } = await sb.storage
          .from("item-photos")
          .upload(fileName, blob, { upsert: true });
        if (uploadErr) throw uploadErr;
        var { data: urlData } = sb.storage
          .from("item-photos")
          .getPublicUrl(fileName);
        photoUrls.push(urlData.publicUrl);
      } catch (photoErr) {
        console.warn("Photo upload failed, keeping base64:", photoErr);
        photoUrls.push(dataUrl);
      }
    }

    if (photoUrls.length > 0) {
      var photoRecords = photoUrls.map(function (url, idx) {
        return { item_id: itemId, url: url, order: idx };
      });
      await sb.from("photos").insert(photoRecords);
    }
    item.photos = photoUrls;
  } catch (e) {
    console.warn("Supabase save failed:", e);
    saveItemToStorage(item);
  }
}

function saveItemToStorage(item) {
  item.id = item.id || "item_" + Date.now();
  item.ownerId = "local_" + Math.random().toString(36).substr(2, 6);
  item.ownerName = "You";
  item.createdAt = item.createdAt || Date.now();
  if (window.state.userLocation && !item.lat) {
    item.lat = window.state.userLocation.lat;
    item.lng = window.state.userLocation.lng;
  }
  window.state.items.unshift(item);
  localStorage.setItem(
    "geogive_items_cache",
    JSON.stringify(window.state.items),
  );
}

async function deleteItemFromSupabase(itemId) {
  var sb = getSupabase();
  if (!sb) {
    deleteItemFromStorage(itemId);
    return;
  }
  try {
    var { error } = await sb.from("items").delete().eq("id", itemId);
    if (error) throw error;
    deleteItemFromStorage(itemId);
  } catch (e) {
    showToast("Failed to delete on server. Removed locally.");
    deleteItemFromStorage(itemId);
  }
}

function deleteItemFromStorage(itemId) {
  window.state.items = window.state.items.filter(function (i) {
    return i.id !== itemId;
  });
  localStorage.setItem(
    "geogive_items_cache",
    JSON.stringify(window.state.items),
  );
}

async function updateItemStatus(itemId, status) {
  var sb = getSupabase();
  if (!sb) {
    updateItemStatusLocal(itemId, status);
    return;
  }
  var item = findItem(itemId);
  var prev = item ? item.status : null;
  updateItemStatusLocal(itemId, status);
  try {
    var { error } = await sb
      .from("items")
      .update({ status: status })
      .eq("id", itemId);
    if (error) throw error;
  } catch (e) {
    if (prev !== null) updateItemStatusLocal(itemId, prev);
    showToast("Failed to update. Changes reverted.");
  }
}

function updateItemStatusLocal(itemId, status) {
  var item = findItem(itemId);
  if (item) item.status = status;
  localStorage.setItem(
    "geogive_items_cache",
    JSON.stringify(window.state.items),
  );
}

function renewItem(itemId) {
  var item = findItem(itemId);
  if (!item) return;
  item.expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
  item.createdAt = Date.now();
  var sb = getSupabase();
  if (sb && window.state.user) {
    sb.from("items")
      .update({ expires_at: new Date(item.expiresAt).toISOString(), created_at: new Date().toISOString() })
      .eq("id", itemId)
      .then(function() {});
  }
  localStorage.setItem("geogive_items_cache", JSON.stringify(window.state.items));
  showToast("Item renewed & bumped for 30 days! 🔄⬆️");
  applyFilters();
}

function bumpItem(itemId) {
  var lastBump = localStorage.getItem('geogive_last_bump_' + itemId);
  var now = Date.now();
  if (lastBump && (now - parseInt(lastBump)) < 24 * 60 * 60 * 1000) {
    showToast('⏰ You can only bump once per day');
    return;
  }
  var item = findItem(itemId);
  if (!item) return;
  item.createdAt = now;
  localStorage.setItem('geogive_last_bump_' + itemId, now.toString());
  var sb = getSupabase();
  if (sb) {
    sb.from("items").update({ created_at: new Date(now).toISOString() }).eq("id", itemId)
      .then(function() {});
  }
  localStorage.setItem("geogive_items_cache", JSON.stringify(window.state.items));
  showToast('⬆️ Item bumped to top!');
  renderMyListings();
  applyFilters();
}

async function markGiven(itemId) {
  var item = findItem(itemId);
  if (!item) return;

  var acceptedReq = window.state.requests.find(function (r) {
    return r.itemId === itemId && r.status === "accepted";
  });

  updateItemStatus(itemId, "given");

  if (acceptedReq && window.state.user && acceptedReq.requesterId !== window.state.user.id) {
    setTrackedTimeout(function () {
      showRatingPrompt(itemId, acceptedReq.requesterId);
    }, 500);
  }

  renderMyListings();
  showToast("Marked as given away! 🎉");
}

function deleteItem(itemId) {
  confirmAction('Delete this item? This cannot be undone.', function() {
    deleteItemFromSupabase(itemId);
    renderMyListings();
    showToast("Item deleted.");
  });
}

async function handleListSubmit(e) {
  e.preventDefault();
  if (!window.state.user) {
    openAuthModal();
    showToast("Please sign in to list items.");
    return;
  }
  if (!rateLimit('post_item', 3000)) {
    showToast("Please wait a moment before posting again.");
    return;
  }

  var title = document.getElementById("postTitle").value.trim();
  var desc = document.getElementById("postDesc").value.trim();

  // Strip HTML tags to prevent stored XSS
  title = title.replace(/<[^>]*>/g, '');
  desc = desc.replace(/<[^>]*>/g, '');

  // Input validation
  if (!title || title.length < 3) {
    showToast("Title must be at least 3 characters.");
    return;
  }
  if (title.length > 100) {
    showToast("Title must be under 100 characters.");
    return;
  }
  if (desc.length > 1000) {
    showToast("Description must be under 1000 characters.");
    return;
  }

  var item = {
    title: title,
    desc: desc,
    category: document.getElementById("postCategory").value,
    condition: document.getElementById("postCondition").value,
    location: "",
    lat: window.state.userLocation ? window.state.userLocation.lat : null,
    lng: window.state.userLocation ? window.state.userLocation.lng : null,
    photos: window.state.selectedImages.slice(0, MAX_IMAGES),
    distance: 0,
    status: "available",
    createdAt: Date.now(),
  };

  if (handleOfflineSubmit(item)) {
    window.state.selectedImages = [];
    renderImagePreviews();
    document.getElementById("postForm").reset();
    switchPage("browse");
    return;
  }
  showLoading(true);
  await saveItemToSupabase(item);
  showLoading(false);
  window.state.selectedImages = [];
  renderImagePreviews();
  document.getElementById("postForm").reset();
  showToast("Item listed! 🎉");
  trackEvent('item_posted', { category: item.category });
  switchPage("browse");
}

function findItem(id) {
  return window.state.items.find(function (i) {
    return i.id === id;
  });
}
