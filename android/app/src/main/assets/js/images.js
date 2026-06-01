function handleImageSelect(e) {
  var files = e.target.files; if (!files || !files.length) return;
  var remaining = MAX_IMAGES - window.state.selectedImages.length;
  if (remaining <= 0) { showImageError('Maximum ' + MAX_IMAGES + ' photos.'); return; }
  var toProcess = Math.min(files.length, remaining);
  var processed = 0;
  for (var i = 0; i < toProcess; i++) {
    var file = files[i];
    if (file.size > MAX_IMAGE_SIZE * 5) { showImageError('"' + file.name + '" is too large (max 10MB raw).'); continue; }
    compressAndAddImage(file, remaining - processed);
    processed++;
  }
  if (processed > 0) {
    var ind = document.getElementById('compressIndicator');
    if (ind) ind.classList.add('active');
  }
  e.target.value = '';
}

function doneCompressing() {
  compressingCount--;
  if (compressingCount <= 0) {
    compressingCount = 0;
    var ind = document.getElementById('compressIndicator');
    if (ind) { setTrackedTimeout(function() { ind.classList.remove('active'); }, 800); }
  }
}

function compressAndAddImage(file, slotsRemaining) {
  if (slotsRemaining <= 0) return;
  compressingCount++;
  var reader = new FileReader();
  reader.onload = function(ev) {
    var img = new Image();
    img.onload = function() {
      try {
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        var maxW = 1200, maxH = 1200;
        var w = img.width, h = img.height;
        if (w > maxW || h > maxH) {
          var ratio = Math.min(maxW / w, maxH / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        canvas.width = w; canvas.height = h;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        var compressed = canvas.toDataURL('image/jpeg', 0.7);
        window.state.selectedImages.push(compressed);
        renderImagePreviews();
      } catch(err) {
        window.state.selectedImages.push(ev.target.result);
        renderImagePreviews();
      }
      doneCompressing();
    };
    img.onerror = function() {
      window.state.selectedImages.push(ev.target.result);
      renderImagePreviews();
      doneCompressing();
    };
    img.src = ev.target.result;
  };
  reader.onerror = function() {
    doneCompressing();
  };
  reader.readAsDataURL(file);
}

function showImageError(msg) { var el = document.getElementById('imageError'); el.textContent = msg; el.style.display = 'block'; setTrackedTimeout(function() { el.style.display = 'none'; }, 4000); }

function getTotalImageSize() {
  return window.state.selectedImages.reduce(function(s, img) { return s + img.length; }, 0);
}

function renderImagePreviews() {
  var grid = document.getElementById('imagePreviewGrid'); var html = '';
  window.state.selectedImages.forEach(function(dataUrl, idx) {
    html += '<div class="image-preview"><img src="' + dataUrl + '" alt="Photo ' + (idx + 1) + '"><button class="remove-btn" onclick="removeImage(' + idx + ')" aria-label="Remove photo ' + (idx + 1) + '">✕</button></div>';
  });
  grid.innerHTML = html;
}

function removeImage(idx) { window.state.selectedImages.splice(idx, 1); renderImagePreviews(); }
