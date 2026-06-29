// ===== IMAGE HANDLING =====

var compressingCount = 0;

function handleImageSelect(e) {
  var files = e.target.files; if (!files || !files.length) return;
  var allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  var remaining = MAX_IMAGES - window.state.selectedImages.length;
  if (remaining <= 0) { showToast('Maximum ' + MAX_IMAGES + ' photos.'); return; }
  var toProcess = Math.min(files.length, remaining);
  var processed = 0;
  for (var i = 0; i < toProcess; i++) {
    var file = files[i];
    // Validate file type
    if (allowedTypes.indexOf(file.type) === -1) {
      showToast('"' + file.name + '" is not a supported image. Use JPEG, PNG, GIF, or WebP.');
      continue;
    }
    if (file.size > MAX_IMAGE_SIZE * 1024 * 1024) {
      showToast('"' + file.name + '" is too large (max ' + MAX_IMAGE_SIZE + 'MB).');
      continue;
    }
    compressAndAddImage(file);
    processed++;
  }
  e.target.value = '';
}

function doneCompressing() {
  compressingCount--;
  if (compressingCount <= 0) {
    compressingCount = 0;
  }
}

function compressAndAddImage(file) {
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

        // Fix EXIF orientation - read before drawing
        var orientation = getOrientation(ev.target.result);

        // For orientations that rotate 90/270, swap dimensions for canvas
        var canvasW = w, canvasH = h;
        if (orientation >= 5 && orientation <= 8) {
          canvasW = h; canvasH = w;
        }
        if (canvasW > maxW || canvasH > maxH) {
          var ratio = Math.min(maxW / canvasW, maxH / canvasH);
          canvasW = Math.round(canvasW * ratio);
          canvasH = Math.round(canvasH * ratio);
        }
        canvas.width = canvasW; canvas.height = canvasH;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasW, canvasH);

        if (orientation > 1) {
          ctx.save();
          applyOrientation(ctx, orientation, canvasW, canvasH);
        }

        ctx.drawImage(img, 0, 0, canvasW, canvasH);
        if (orientation > 1) ctx.restore();

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

// EXIF orientation helpers
function getOrientation(dataUrl) {
  try {
    var base64 = dataUrl.split(',')[1];
    var binary = atob(base64);
    var view = new DataView(new Uint8Array(binary.length).map(function(_, i) { return binary.charCodeAt(i); }).buffer);
    if (view.getUint16(0, false) !== 0xFFD8) return 1; // Not JPEG
    var offset = 2;
    while (offset < view.byteLength) {
      var marker = view.getUint16(offset, false);
      offset += 2;
      if (marker === 0xFFE1) { // APP1 (EXIF)
        if (view.getUint32(offset += 2, false) === 0x45786966) { // "Exif"
          var tiffOffset = offset + 6;
          var littleEndian = view.getUint16(tiffOffset, false) === 0x4949;
          var ifdOffset = view.getUint32(tiffOffset + 4, littleEndian);
          var entries = view.getUint16(tiffOffset + 8 + ifdOffset, littleEndian);
          for (var i = 0; i < entries; i++) {
            var entryOffset = tiffOffset + 10 + ifdOffset + i * 12;
            if (view.getUint16(entryOffset, littleEndian) === 0x0112) { // Orientation tag
              return view.getUint16(entryOffset + 8, littleEndian);
            }
          }
        }
      } else if ((marker & 0xFF00) === 0xFF00) {
        var len = view.getUint16(offset, false);
        offset += len;
      } else break;
    }
  } catch(e) {}
  return 1;
}

function applyOrientation(ctx, orientation, w, h) {
  switch (orientation) {
    case 2: ctx.translate(w, 0); ctx.scale(-1, 1); break;
    case 3: ctx.translate(w, h); ctx.rotate(Math.PI); break;
    case 4: ctx.translate(0, h); ctx.scale(1, -1); break;
    case 5: ctx.translate(w, 0); ctx.scale(-1, 1); ctx.rotate(Math.PI / 2); break;
    case 6: ctx.translate(w, 0); ctx.rotate(Math.PI / 2); break;
    case 7: ctx.translate(w, 0); ctx.scale(-1, 1); ctx.rotate(-Math.PI / 2); break;
    case 8: ctx.translate(0, h); ctx.rotate(-Math.PI / 2); break;
  }
}

function renderImagePreviews() {
  var grid = document.getElementById('imagePreviews');
  if (!grid) return;
  var html = '';
  window.state.selectedImages.forEach(function(dataUrl, idx) {
    html += '<div class="image-preview"><img src="' + dataUrl + '" alt="Photo ' + (idx + 1) + '"><button class="remove-btn" data-fn="removeImage" data-arg="' + idx + '" aria-label="Remove photo ' + (idx + 1) + '">✕</button></div>';
  });
  grid.innerHTML = html;
}

function removeImage(idx) { window.state.selectedImages.splice(idx, 1); renderImagePreviews(); }
